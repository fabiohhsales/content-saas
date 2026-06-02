import {
  GenerateRenderPreviewInputSchema,
  RenderCarouselResponseSchema,
  RenderResponseSchema,
  RenderRequestSchema,
  type GenerateRenderPreviewInput,
  type GenerateRenderPreviewOutput,
  type RenderRequest,
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

function buildCarouselPayloads(item: ContentItemRow, outputFormat: 'png' | 'jpg') {
  const copy = item.copy_json ?? {};
  const slides = Array.isArray(copy.slides)
    ? copy.slides.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];

  if (slides.length <= 1) return [buildRenderPayload(item, outputFormat)];

  const templateId = typeof copy.carousel_template_id === 'string' && copy.carousel_template_id.length > 0
    ? copy.carousel_template_id
    : 'paper-editorial-01';

  return slides.slice(0, 10).map((slide, index) => RenderRequestSchema.parse({
    template_id: templateId,
    output_format: outputFormat,
    fields: {
      eyebrow: `Slide ${index + 1}`,
      headline: slide,
      body: textField(copy.caption) ?? item.title,
      cta: index === slides.length - 1 ? textField(copy.cta) : undefined,
      brand_name: textField(copy.brand_name),
    },
    assets: {},
  }));
}

async function createGeneratedAssets(
  data: GenerateRenderPreviewInput,
  jobRunId: string,
  renderPayloads: RenderRequest[],
) {
  const { data: generatedAssets, error } = await supabase
    .from('generated_assets')
    .insert(renderPayloads.map((renderPayload, index) => ({
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
        slide_index: index + 1,
        slides_count: renderPayloads.length,
      },
      created_by: data.requested_by,
    })))
    .select('id');

  if (error || !generatedAssets || generatedAssets.length === 0) {
    throw new Error(`Could not create generated assets: ${error?.message ?? 'unknown error'}`);
  }

  return generatedAssets as Array<{ id: string }>;
}

async function markGeneratedAssetsFailed(generatedAssetIds: string[], err: unknown) {
  await Promise.all(generatedAssetIds.map((generatedAssetId) => markGeneratedAssetFailed(generatedAssetId, err)));
}

async function renderPayloads(renderPayloads: RenderRequest[], renderInternalUrl: string) {
  if (renderPayloads.length === 1) {
    const renderResponse = await fetch(`${renderInternalUrl}/render`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(renderPayloads[0]),
    });

    if (!renderResponse.ok) {
      throw new Error(`Render service failed: ${renderResponse.status} ${await renderResponse.text()}`);
    }

    const parsedRender = RenderResponseSchema.parse(await renderResponse.json());
    return {
      slides: [parsedRender.slide],
      output_format: parsedRender.output_format,
      post_render_qa: [parsedRender.post_render_qa ?? {}],
    };
  }

  const renderResponse = await fetch(`${renderInternalUrl}/render-carousel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ slides: renderPayloads }),
  });

  if (!renderResponse.ok) {
    throw new Error(`Render carousel service failed: ${renderResponse.status} ${await renderResponse.text()}`);
  }

  const parsedRender = RenderCarouselResponseSchema.parse(await renderResponse.json());
  return {
    slides: parsedRender.slides,
    output_format: parsedRender.output_format,
    post_render_qa: parsedRender.post_render_qa ?? [],
  };
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

  const contentItem = item as ContentItemRow;
  const renderPayloadsToRun = buildCarouselPayloads(contentItem, data.output_format);
  const generatedAssets = await createGeneratedAssets(data, jobRunId, renderPayloadsToRun);
  const generatedAssetIds = generatedAssets.map((generatedAsset) => generatedAsset.id);

  try {
    const env = getEnv();
    const rendered = await renderPayloads(renderPayloadsToRun, env.RENDER_INTERNAL_URL);
    const mimeType = rendered.output_format === 'jpg' ? 'image/jpeg' : 'image/png';

    const storagePaths: string[] = [];
    for (const [index, slide] of rendered.slides.entries()) {
      const generatedAsset = generatedAssets[index];
      if (!generatedAsset) continue;

      const bytes = Buffer.from(slide, 'base64');
      const storagePath = generatedAssetPath(
        data.workspace_id,
        data.brand_id,
        `${data.content_item_id}-slide-${index + 1}`,
        rendered.output_format,
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
            slide_index: index + 1,
            slides_count: rendered.slides.length,
            post_render_qa: rendered.post_render_qa[index] ?? {},
          },
        })
        .eq('id', generatedAsset.id);

      if (updateError) {
        throw new Error(`Could not update generated asset: ${updateError.message}`);
      }

      storagePaths.push(storagePath);
    }

    if (storagePaths.length === 0) {
      throw new Error('Render service returned no slides to persist');
    }

    const { data: approvals, error: approvalError } = await supabase
      .from('approvals')
      .insert(generatedAssets.map((generatedAsset, index) => ({
        workspace_id: data.workspace_id,
        target_type: 'generated_asset',
        target_id: generatedAsset.id,
        status: 'pending',
        metadata: {
          schema_version: 1,
          brand_id: data.brand_id,
          content_item_id: data.content_item_id,
          title: rendered.slides.length > 1 ? `${contentItem.title} - slide ${index + 1}` : contentItem.title,
          storage_path: storagePaths[index] ?? null,
          slide_index: index + 1,
          slides_count: rendered.slides.length,
        },
        created_by: data.requested_by,
      })))
      .select('id');

    if (approvalError) {
      throw new Error(`Could not create approval: ${approvalError.message}`);
    }

    const output = {
      schema_version: 1,
      generated_asset_id: generatedAssetIds[0]!,
      generated_asset_ids: generatedAssetIds,
      approval_id: approvals?.[0]?.id ?? null,
      approval_ids: (approvals ?? []).map((approval: { id: string }) => approval.id),
      storage_bucket: 'brand-assets',
      storage_path: storagePaths[0]!,
      storage_paths: storagePaths,
      mime_type: mimeType,
      output_format: rendered.output_format,
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
    await markGeneratedAssetsFailed(generatedAssetIds, err);
    throw err;
  }
}
