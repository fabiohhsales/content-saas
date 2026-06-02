import {
  CreativeDocumentJsonSchema,
  CreativeRenderResponseSchema,
  RenderCreativeDocumentInputSchema,
  type CreativeDocumentJson,
  type RenderCreativeDocumentInput,
  type RenderCreativeDocumentOutput,
} from '@content-saas/contracts';
import { generatedAssetPath } from '@content-saas/supabase';
import { getEnv } from '../env.js';
import { supabase } from '../supabase.js';

type CreativeDocumentRow = {
  id: string;
  workspace_id: string;
  brand_id: string;
  title: string;
  document_json: unknown;
};

function collectAssetIds(documentJson: CreativeDocumentJson) {
  const ids = new Set<string>();
  for (const slide of documentJson.slides) {
    if (slide.background.asset_id) ids.add(slide.background.asset_id);
    for (const element of slide.elements) {
      if (element.asset_id) ids.add(element.asset_id);
    }
  }
  return Array.from(ids);
}

async function signedUrl(bucket: string, path: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function buildAssetUrls(workspaceId: string, brandId: string, documentJson: CreativeDocumentJson) {
  const assetIds = collectAssetIds(documentJson);
  if (assetIds.length === 0) return {};

  const assetUrls: Record<string, string> = {};

  const [{ data: brandAssets }, { data: globalAssets }] = await Promise.all([
    supabase
      .from('brand_assets')
      .select('id, storage_bucket, storage_path')
      .eq('workspace_id', workspaceId)
      .eq('brand_id', brandId)
      .in('id', assetIds),
    supabase
      .from('global_assets')
      .select('id, storage_bucket, storage_path')
      .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
      .in('id', assetIds),
  ]);

  for (const asset of [...(brandAssets ?? []), ...(globalAssets ?? [])] as Array<{ id: string; storage_bucket: string; storage_path: string }>) {
    const url = await signedUrl(asset.storage_bucket, asset.storage_path);
    if (url) assetUrls[asset.id] = url;
  }

  return assetUrls;
}

async function markCreativeRendersFailed(renderIds: string[], err: unknown) {
  const message = err instanceof Error ? err.message : 'Unknown creative render error';
  await Promise.all(renderIds.map((renderId) => supabase
    .from('creative_renders')
    .update({
      status: 'failed',
      metadata: {
        schema_version: 1,
        error: { message },
      },
    })
    .eq('id', renderId)));
}

export async function renderCreativeDocument(
  input: RenderCreativeDocumentInput,
  jobRunId: string,
): Promise<RenderCreativeDocumentOutput> {
  const data = RenderCreativeDocumentInputSchema.parse(input);

  await supabase
    .from('job_runs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', jobRunId);

  const { data: documentRow, error: documentError } = await supabase
    .from('creative_documents')
    .select('id, workspace_id, brand_id, title, document_json')
    .eq('id', data.creative_document_id)
    .eq('workspace_id', data.workspace_id)
    .eq('brand_id', data.brand_id)
    .single();

  if (documentError || !documentRow) {
    throw new Error(`Creative document not found: ${data.creative_document_id}`);
  }

  const document = documentRow as CreativeDocumentRow;
  const documentJson = CreativeDocumentJsonSchema.parse(document.document_json);
  const assetUrls = await buildAssetUrls(data.workspace_id, data.brand_id, documentJson);

  const { data: renderRows, error: renderInsertError } = await supabase
    .from('creative_renders')
    .insert(documentJson.slides.map((slide, index) => ({
      workspace_id: data.workspace_id,
      creative_document_id: data.creative_document_id,
      creative_version_id: data.creative_version_id ?? null,
      status: 'rendering',
      output_format: data.output_format,
      storage_bucket: 'brand-assets',
      metadata: {
        schema_version: 1,
        job_run_id: jobRunId,
        slide_id: slide.id,
        slide_index: index + 1,
        slides_count: documentJson.slides.length,
      },
      created_by: data.requested_by,
    })))
    .select('id');

  if (renderInsertError || !renderRows || renderRows.length === 0) {
    throw new Error(`Could not create creative render rows: ${renderInsertError?.message ?? 'unknown error'}`);
  }

  const creativeRenderIds = (renderRows as Array<{ id: string }>).map((row) => row.id);

  try {
    const env = getEnv();
    const renderResponse = await fetch(`${env.RENDER_INTERNAL_URL}/render-document`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        document: documentJson,
        asset_urls: assetUrls,
        output_format: data.output_format,
      }),
    });

    if (!renderResponse.ok) {
      throw new Error(`Render document service failed: ${renderResponse.status} ${await renderResponse.text()}`);
    }

    const rendered = CreativeRenderResponseSchema.parse(await renderResponse.json());
    const mimeType = rendered.output_format === 'jpg' ? 'image/jpeg' : 'image/png';
    const storagePaths: string[] = [];

    for (const [index, slide] of rendered.slides.entries()) {
      const renderId = creativeRenderIds[index];
      if (!renderId) continue;

      const bytes = Buffer.from(slide, 'base64');
      const storagePath = generatedAssetPath(
        data.workspace_id,
        data.brand_id,
        `${data.creative_document_id}-final-slide-${index + 1}`,
        rendered.output_format,
      );

      const { error: uploadError } = await supabase.storage
        .from('brand-assets')
        .upload(storagePath, bytes, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Could not upload creative render: ${uploadError.message}`);
      }

      const { error: updateError } = await supabase
        .from('creative_renders')
        .update({
          status: 'ready',
          storage_path: storagePath,
          mime_type: mimeType,
          metadata: {
            schema_version: 1,
            job_run_id: jobRunId,
            slide_index: index + 1,
            slides_count: rendered.slides.length,
            post_render_qa: rendered.post_render_qa?.[index] ?? {},
          },
        })
        .eq('id', renderId);

      if (updateError) {
        throw new Error(`Could not update creative render: ${updateError.message}`);
      }

      storagePaths.push(storagePath);
    }

    if (storagePaths.length === 0) {
      throw new Error('Render service returned no creative slides to persist');
    }

    const output = {
      schema_version: 1,
      creative_render_ids: creativeRenderIds,
      storage_bucket: 'brand-assets',
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
      message: 'render_creative_document completed',
      context_json: output,
    });

    return output;
  } catch (err) {
    await markCreativeRendersFailed(creativeRenderIds, err);
    throw err;
  }
}
