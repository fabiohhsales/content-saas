import {
  GenerateRenderPreviewInputSchema,
  RenderResponseSchema,
  RenderRequestSchema,
  type GenerateRenderPreviewInput,
  type GenerateRenderPreviewOutput,
} from '@content-saas/contracts';
import { generatedAssetPath } from '@content-saas/supabase';
import { getEnv } from '../env.js';
import { supabase } from '../supabase.js';

type ContentItemRow = {
  id: string;
  workspace_id: string;
  brand_id: string;
  title: string;
  copy_json: Record<string, unknown>;
};

async function markGeneratedAssetFailed(generatedAssetId: string, err: unknown) {
  const message = err instanceof Error ? err.message : 'Unknown render preview error';
  await supabase
    .from('generated_assets')
    .update({
      status: 'failed',
      metadata: {
        schema_version: 1,
        error: { message },
      },
    })
    .eq('id', generatedAssetId);
}

function textField(value: unknown) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter((entry) => typeof entry === 'string') as string[];
  return undefined;
}

function buildRenderPayload(item: ContentItemRow, outputFormat: 'png' | 'jpg') {
  const copy = item.copy_json ?? {};
  const templateId = typeof copy.template_id === 'string' && copy.template_id.length > 0
    ? copy.template_id
    : 'paper-editorial-01';

  return RenderRequestSchema.parse({
    template_id: templateId,
    output_format: outputFormat,
    fields: {
      eyebrow: textField(copy.channel) ?? 'Conteudo',
      headline: textField(copy.hook) ?? item.title,
      body: textField(copy.caption) ?? item.title,
      cta: textField(copy.cta),
      brand_name: textField(copy.brand_name),
      card_1: Array.isArray(copy.slides) ? textField(copy.slides[0]) : undefined,
      card_2: Array.isArray(copy.slides) ? textField(copy.slides[1]) : undefined,
      card_3: Array.isArray(copy.slides) ? textField(copy.slides[2]) : undefined,
    },
    assets: {},
  });
}

export async function renderPreview(
  input: GenerateRenderPreviewInput,
  jobRunId: string,
): Promise<GenerateRenderPreviewOutput> {
  const data = GenerateRenderPreviewInputSchema.parse(input);

  await supabase
    .from('job_runs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', jobRunId);

  const { data: item, error: itemError } = await supabase
    .from('content_items')
    .select('id, workspace_id, brand_id, title, copy_json')
    .eq('id', data.content_item_id)
    .eq('workspace_id', data.workspace_id)
    .eq('brand_id', data.brand_id)
    .single();

  if (itemError || !item) {
    throw new Error(`Content item not found: ${data.content_item_id}`);
  }

  const renderPayload = buildRenderPayload(item as ContentItemRow, data.output_format);
  const { data: generatedAsset, error: assetError } = await supabase
    .from('generated_assets')
    .insert({
      workspace_id: data.workspace_id,
      brand_id: data.brand_id,
      content_item_id: data.content_item_id,
      status: 'rendering',
      storage_bucket: 'brand-assets',
      render_payload_json: {
        schema_version: 1,
        ...renderPayload,
      },
      metadata: {
        schema_version: 1,
        job_run_id: jobRunId,
      },
      created_by: data.requested_by,
    })
    .select('id')
    .single();

  if (assetError || !generatedAsset) {
    throw new Error(`Could not create generated asset: ${assetError?.message ?? 'unknown error'}`);
  }

  try {
    const env = getEnv();
    const renderResponse = await fetch(`${env.RENDER_INTERNAL_URL}/render`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(renderPayload),
    });

    if (!renderResponse.ok) {
      throw new Error(`Render service failed: ${renderResponse.status} ${await renderResponse.text()}`);
    }

    const parsedRender = RenderResponseSchema.parse(await renderResponse.json());
    const bytes = Buffer.from(parsedRender.slide, 'base64');
    const mimeType = parsedRender.output_format === 'jpg' ? 'image/jpeg' : 'image/png';
    const storagePath = generatedAssetPath(
      data.workspace_id,
      data.brand_id,
      data.content_item_id,
      parsedRender.output_format,
    );

    const { error: uploadError } = await supabase.storage
      .from('brand-assets')
      .upload(storagePath, bytes, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Could not upload generated preview: ${uploadError.message}`);
    }

    const { error: updateError } = await supabase
      .from('generated_assets')
      .update({
        status: 'ready',
        storage_path: storagePath,
        mime_type: mimeType,
        metadata: {
          schema_version: 1,
          job_run_id: jobRunId,
          post_render_qa: parsedRender.post_render_qa ?? {},
        },
      })
      .eq('id', generatedAsset.id);

    if (updateError) {
      throw new Error(`Could not update generated asset: ${updateError.message}`);
    }

    const { data: approval, error: approvalError } = await supabase
      .from('approvals')
      .insert({
        workspace_id: data.workspace_id,
        target_type: 'generated_asset',
        target_id: generatedAsset.id,
        status: 'pending',
        metadata: {
          schema_version: 1,
          brand_id: data.brand_id,
          content_item_id: data.content_item_id,
          title: item.title,
          storage_path: storagePath,
        },
        created_by: data.requested_by,
      })
      .select('id')
      .single();

    if (approvalError) {
      throw new Error(`Could not create approval: ${approvalError.message}`);
    }

    const output = {
      generated_asset_id: generatedAsset.id,
      approval_id: approval?.id ?? null,
      storage_bucket: 'brand-assets',
      storage_path: storagePath,
      mime_type: mimeType,
      output_format: parsedRender.output_format,
    };

    await supabase
      .from('job_runs')
      .update({
        status: 'completed',
        output_json: output,
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobRunId);

    await supabase.from('automation_logs').insert({
      workspace_id: data.workspace_id,
      job_run_id: jobRunId,
      level: 'info',
      message: 'render_preview completed',
      context_json: output,
    });

    return output;
  } catch (err) {
    await markGeneratedAssetFailed(generatedAsset.id, err);
    throw err;
  }
}
