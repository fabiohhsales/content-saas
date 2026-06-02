import {
  GenerateContentPlanInputSchema,
  type GenerateContentPlanInput,
  type GenerateContentPlanOutput,
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

type BrandMemoryRow = {
  version: number;
  memory_json: Record<string, unknown>;
};

function formatMonth(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function dateInPeriod(periodStart: string, offsetDays: number) {
  const date = new Date(`${periodStart}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString();
}

function memorySummary(memory: BrandMemoryRow | null) {
  const summary = memory?.memory_json?.summary;
  return typeof summary === 'string' && summary.length > 0
    ? summary
    : 'Memoria de marca ainda nao consolidada; usar posicionamento e briefing da marca como base.';
}

function buildPlanJson(input: GenerateContentPlanInput, brand: BrandRow, memory: BrandMemoryRow | null) {
  return {
    schema_version: 1,
    source: 'mock_ai',
    objective: input.objective ?? `Construir consistencia editorial para ${brand.name}.`,
    period: {
      start: input.period_start,
      end: input.period_end,
    },
    brand_context: {
      name: brand.name,
      industry: brand.industry ?? '',
      positioning: brand.positioning ?? '',
      voice_notes: brand.voice_notes ?? '',
      memory_summary: memorySummary(memory),
      memory_version: memory?.version ?? null,
    },
    pillars: [
      'educacao',
      'autoridade',
      'prova social',
      'conversao',
    ],
    channels: ['Instagram', 'LinkedIn'],
  };
}

function buildItems(input: GenerateContentPlanInput, brand: BrandRow) {
  const brandName = brand.name;
  const industry = brand.industry ?? 'mercado';
  const objective = input.objective ?? `fortalecer autoridade de ${brandName}`;

  return [
    {
      title: `${brandName}: guia rapido para entender o problema`,
      scheduled_for: dateInPeriod(input.period_start, 2),
      copy_json: {
        schema_version: 1,
        channel: 'Instagram',
        format: 'carrossel',
        template_id: 'triptych-grid-01',
        hook: `O que toda pessoa precisa saber antes de decidir sobre ${industry}.`,
        slides: [
          'Entenda o contexto antes da solucao.',
          'Compare criterios objetivos, nao promessas.',
          'Procure acompanhamento com processo claro.',
        ],
        cta: 'Salve para revisar com calma.',
      },
    },
    {
      title: `${brandName}: tese de posicionamento`,
      scheduled_for: dateInPeriod(input.period_start, 7),
      copy_json: {
        schema_version: 1,
        channel: 'LinkedIn',
        format: 'post_unico',
        template_id: 'statement-dark-01',
        hook: `${brandName} acredita que ${objective}.`,
        caption: 'Conteudo gerado como rascunho inicial e sujeito a aprovacao humana.',
        cta: 'Converse com nossa equipe.',
      },
    },
    {
      title: `${brandName}: bastidor de confianca`,
      scheduled_for: dateInPeriod(input.period_start, 14),
      copy_json: {
        schema_version: 1,
        channel: 'Instagram',
        format: 'post_unico',
        template_id: 'photo-overlay-01',
        hook: 'Confianca nasce quando o processo fica claro.',
        caption: `Mostre como ${brandName} organiza etapas, criterios e acompanhamento.`,
        cta: 'Veja como funciona.',
      },
    },
    {
      title: `${brandName}: convite para avaliacao`,
      scheduled_for: dateInPeriod(input.period_start, 21),
      copy_json: {
        schema_version: 1,
        channel: 'Instagram',
        format: 'post_unico',
        template_id: 'paper-editorial-01',
        hook: 'Decisoes melhores comecam com diagnostico melhor.',
        caption: `Fechar o ciclo editorial com convite consultivo para ${industry}.`,
        cta: 'Agende uma conversa.',
      },
    },
  ];
}

export async function generateContentPlan(
  input: GenerateContentPlanInput,
  jobRunId: string,
): Promise<GenerateContentPlanOutput> {
  const data = GenerateContentPlanInputSchema.parse(input);

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

  const { data: memory } = await supabase
    .from('brand_memories')
    .select('version, memory_json')
    .eq('brand_id', data.brand_id)
    .eq('workspace_id', data.workspace_id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const typedBrand = brand as BrandRow;
  const title = `Plano editorial ${formatMonth(data.period_start)} - ${typedBrand.name}`;
  const planJson = buildPlanJson(data, typedBrand, memory as BrandMemoryRow | null);

  const { data: insertedPlan, error: planError } = await supabase
    .from('content_plans')
    .insert({
      workspace_id: data.workspace_id,
      brand_id: data.brand_id,
      title,
      period_start: data.period_start,
      period_end: data.period_end,
      status: 'draft',
      plan_json: planJson,
      metadata: {
        schema_version: 1,
        generated_by_job_run_id: jobRunId,
      },
      created_by: data.requested_by,
    })
    .select('id')
    .single();

  if (planError || !insertedPlan) {
    throw new Error(`Could not save content plan: ${planError?.message ?? 'unknown error'}`);
  }

  const itemRows = buildItems(data, typedBrand).map((item) => ({
    workspace_id: data.workspace_id,
    brand_id: data.brand_id,
    content_plan_id: insertedPlan.id,
    title: item.title,
    status: 'draft',
    scheduled_for: item.scheduled_for,
    copy_json: item.copy_json,
    metadata: {
      schema_version: 1,
      generated_by_job_run_id: jobRunId,
    },
    created_by: data.requested_by,
  }));

  const { data: insertedItems, error: itemsError } = await supabase
    .from('content_items')
    .insert(itemRows)
    .select('id');

  if (itemsError || !insertedItems) {
    throw new Error(`Could not save content items: ${itemsError?.message ?? 'unknown error'}`);
  }

  const output = {
    schema_version: 1,
    content_plan_id: insertedPlan.id,
    content_item_ids: insertedItems.map((item: { id: string }) => item.id),
    title,
    items_count: insertedItems.length,
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
    message: 'generate_content_plan completed',
    context_json: output,
  });

  return output;
}
