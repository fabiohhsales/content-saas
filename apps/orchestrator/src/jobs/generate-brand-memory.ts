import {
  BrandMemoryJsonSchema,
  GenerateBrandMemoryInputSchema,
  type GenerateBrandMemoryInput,
  type GenerateBrandMemoryOutput,
} from '@content-saas/contracts';
import { supabase } from '../supabase.js';

type BrandRow = {
  id: string;
  workspace_id: string;
  name: string;
  industry: string | null;
  positioning: string | null;
  voice_notes: string | null;
};

type AssetRow = {
  id: string;
  category: string;
  file_name: string;
  mime_type: string;
  storage_path: string;
};

function summarizeAssets(assets: AssetRow[]) {
  return assets.reduce<Record<string, number>>((acc, asset) => {
    acc[asset.category] = (acc[asset.category] ?? 0) + 1;
    return acc;
  }, {});
}

function buildMockMemory(brand: BrandRow, assets: AssetRow[]) {
  const assetCounts = summarizeAssets(assets);
  const summary = `${brand.name} tem uma base inicial com ${assets.length} assets estruturados para orientar conteudo e identidade visual.`;

  return BrandMemoryJsonSchema.parse({
    schema_version: 1,
    summary,
    positioning: brand.positioning || `Posicionamento inicial de ${brand.name} aguardando refinamento humano.`,
    target_audience: brand.industry ? `Publico relacionado a ${brand.industry}.` : 'Publico a definir no refinamento da marca.',
    voice: {
      tone: brand.voice_notes || 'claro, consultivo e consistente',
      adjectives: ['claro', 'confiavel', 'humano'],
      forbidden_words: [],
      preferred_words: [],
    },
    visual_identity: {
      primary_colors: [],
      typography: {},
      asset_inventory: assetCounts,
    },
    content_rules: [
      'Preservar consistencia de tom e identidade visual.',
      'Usar assets aprovados da biblioteca da marca.',
    ],
    restrictions: [
      'Nao publicar sem aprovacao humana.',
    ],
    confidence: assets.length > 0 ? 0.72 : 0.48,
  });
}

export async function generateBrandMemory(input: GenerateBrandMemoryInput, jobRunId: string): Promise<GenerateBrandMemoryOutput> {
  const data = GenerateBrandMemoryInputSchema.parse(input);

  await supabase
    .from('job_runs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', jobRunId);

  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id, workspace_id, name, industry, positioning, voice_notes')
    .eq('id', data.brand_id)
    .eq('workspace_id', data.workspace_id)
    .single();

  if (brandError || !brand) {
    throw new Error(`Brand not found: ${data.brand_id}`);
  }

  const { data: assets, error: assetsError } = await supabase
    .from('brand_assets')
    .select('id, category, file_name, mime_type, storage_path')
    .eq('brand_id', data.brand_id)
    .eq('workspace_id', data.workspace_id)
    .neq('status', 'archived');

  if (assetsError) {
    throw new Error(`Could not load brand assets: ${assetsError.message}`);
  }

  const { data: latest } = await supabase
    .from('brand_memories')
    .select('version')
    .eq('brand_id', data.brand_id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = (latest?.version ?? 0) + 1;
  const memory = buildMockMemory(brand as BrandRow, (assets ?? []) as AssetRow[]);

  const { data: inserted, error: insertError } = await supabase
    .from('brand_memories')
    .insert({
      workspace_id: data.workspace_id,
      brand_id: data.brand_id,
      version,
      status: 'draft',
      memory_json: memory,
      generated_by_job_run_id: jobRunId,
      created_by: data.requested_by,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    throw new Error(`Could not save brand memory: ${insertError?.message ?? 'unknown error'}`);
  }

  const output = {
    brand_memory_id: inserted.id,
    version,
    summary: memory.summary,
    confidence: memory.confidence,
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
    message: 'generate_brand_memory completed',
    context_json: output,
  });

  return output;
}
