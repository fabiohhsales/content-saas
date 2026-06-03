import {
  ContentItemCopyJsonSchema,
  GenerateContentPlanInputSchema,
  type GenerateContentPlanInput,
  type GenerateContentPlanOutput,
} from '@content-saas/contracts';
import { buildPromptAssembly, type EditorialPlaybookContext, loadBrandEditorialContext } from '../editorial-playbooks.js';
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

function strategy(input: GenerateContentPlanInput) {
  return input.strategy ?? {
    schema_version: 1,
    objective: input.objective ?? '',
    channels: [],
    frequency: '',
    pillars: [],
    campaigns: '',
    preferred_templates: [],
    restrictions: '',
  };
}

function buildPlanJson(
  input: GenerateContentPlanInput,
  brand: BrandRow,
  memory: BrandMemoryRow | null,
  editorialContext: EditorialPlaybookContext | null,
) {
  const briefing = strategy(input);
  const playbook = editorialContext?.playbook_json;
  const promptAssembly = buildPromptAssembly({
    brand,
    memory_summary: memorySummary(memory),
    playbook: editorialContext,
    monthly_briefing: briefing,
    output_contract: 'content_plan.strategy + content_items.copy_json',
  });

  return {
    schema_version: 1,
    source: 'mock_ai',
    generation_mode: promptAssembly.generation_mode,
    objective: briefing.objective || input.objective || `Construir consistencia editorial para ${brand.name}.`,
    period: {
      start: input.period_start,
      end: input.period_end,
    },
    strategy: briefing,
    brand_context: {
      name: brand.name,
      industry: brand.industry ?? '',
      positioning: brand.positioning ?? '',
      voice_notes: brand.voice_notes ?? '',
      memory_summary: memorySummary(memory),
      memory_version: memory?.version ?? null,
    },
    editorial_playbook: editorialContext ? {
      slug: editorialContext.slug,
      version: editorialContext.playbook_json.version,
      vertical: editorialContext.vertical,
      source: editorialContext.source,
    } : null,
    prompt_assembly: promptAssembly,
    pillars: briefing.pillars.length ? briefing.pillars : (playbook?.editorial_pillars.map((pillar) => pillar.name) ?? [
      'educacao',
      'autoridade',
      'prova social',
      'conversao',
    ]),
    channels: briefing.channels.length ? briefing.channels : ['Instagram', 'LinkedIn'],
    frequency: briefing.frequency,
    campaigns: briefing.campaigns,
    preferred_templates: briefing.preferred_templates,
    restrictions: briefing.restrictions,
    funnel_distribution: briefing.funnel_distribution ?? playbook?.funnel_distribution ?? {
      topo: 35,
      meio: 35,
      fundo: 20,
      institucional: 10,
    },
  };
}

function qualityCheck(criteria: string[]) {
  return criteria.slice(0, 4).map((criterion) => ({ criterion, passed: true }));
}

function complianceNotes(editorialContext: EditorialPlaybookContext | null) {
  return editorialContext?.playbook_json.compliance_rules.slice(0, 2) ?? [
    'Conteudo sujeito a aprovacao humana.',
    'Evitar promessas absolutas.',
  ];
}

function buildItems(input: GenerateContentPlanInput, brand: BrandRow, editorialContext: EditorialPlaybookContext | null) {
  const brandName = brand.name;
  const briefing = strategy(input);
  const channels = briefing.channels.length ? briefing.channels : ['Instagram', 'LinkedIn'];
  const templates = briefing.preferred_templates.length ? briefing.preferred_templates : ['triptych-grid-01', 'statement-dark-01', 'photo-overlay-01', 'paper-editorial-01'];
  const playbook = editorialContext?.playbook_json;
  const criteria = playbook?.quality_criteria ?? [];
  const notes = complianceNotes(editorialContext);
  const playbookSignature = editorialContext ? {
    playbook_slug: editorialContext.slug,
    playbook_version: editorialContext.playbook_json.version,
    generation_mode: 'mock_structured_playbook',
  } : {
    generation_mode: 'mock_generic',
  };

  return [
    {
      title: 'Bone causa calvicie?',
      scheduled_for: dateInPeriod(input.period_start, 2),
      copy_json: ContentItemCopyJsonSchema.parse({
        schema_version: 1,
        channel: channels[0] ?? 'Instagram',
        format: 'carrossel',
        template_id: templates[0] ?? 'triptych-grid-01',
        funnel_stage: 'topo',
        editorial_pillar: 'Mitos e verdades',
        theme: 'Mito popular sobre queda capilar',
        headline: 'Bone causa calvicie?',
        hook: 'Bone causa calvicie? A resposta e mais simples do que parece.',
        central_idea: 'Usar um mito comum para educar sobre queda capilar sem alarmismo.',
        script_outline: ['Apresente o mito.', 'Explique que calvicie tem causas multifatoriais.', 'Oriente avaliacao quando houver queda persistente.'],
        slides: [
          'Bone causa calvicie?',
          'O problema nao costuma estar no acessorio.',
          'Queda persistente precisa de avaliacao individual.',
        ],
        caption: 'Antes de culpar habitos isolados, entenda o que esta acontecendo com seu couro cabeludo e seu historico capilar.',
        cta: playbook?.ctas.recommended[4] ?? 'Agende uma avaliacao.',
        visual_direction: 'Carrossel limpo com pergunta forte na capa e apoio visual medico.',
        commercial_intent: 'baixo',
        compliance_notes: notes,
        quality_check: qualityCheck(criteria),
        ...playbookSignature,
      }),
    },
    {
      title: 'FUE ou No Shave: qual a diferenca?',
      scheduled_for: dateInPeriod(input.period_start, 7),
      copy_json: ContentItemCopyJsonSchema.parse({
        schema_version: 1,
        channel: channels[0] ?? 'Instagram',
        format: 'reels_curto',
        template_id: templates[1] ?? 'statement-dark-01',
        funnel_stage: 'meio',
        editorial_pillar: 'Tecnica e processo',
        theme: 'Comparativo tecnico com linguagem acessivel',
        headline: 'FUE ou No Shave: qual faz sentido para cada caso?',
        hook: 'A tecnica nao e escolhida no improviso. Ela depende do caso.',
        central_idea: 'Explicar que tecnica depende de area doadora, rotina e planejamento medico.',
        script_outline: ['Defina FUE em linguagem simples.', 'Explique No Shave sem vender como solucao universal.', 'Conecte decisao com avaliacao individual.'],
        caption: `${brandName} avalia tecnica, area doadora e expectativa antes de indicar o melhor caminho.`,
        cta: playbook?.ctas.recommended[3] ?? 'Entenda qual tecnica faz sentido para o seu caso.',
        visual_direction: 'Reel com medico em cena e textos curtos sobrepostos.',
        commercial_intent: 'medio',
        compliance_notes: notes,
        quality_check: qualityCheck(criteria),
        ...playbookSignature,
      }),
    },
    {
      title: 'Retorno de 6 meses: o que ja da para avaliar?',
      scheduled_for: dateInPeriod(input.period_start, 14),
      copy_json: ContentItemCopyJsonSchema.parse({
        schema_version: 1,
        channel: channels[0] ?? 'Instagram',
        format: 'post_unico',
        template_id: templates[2] ?? 'photo-overlay-01',
        funnel_stage: 'meio',
        editorial_pillar: 'Antes e depois / evolucao',
        theme: 'Evolucao progressiva do resultado',
        headline: 'Com 6 meses, esse ainda nao e o resultado final.',
        hook: 'Seu resultado de 6 meses ainda pode evoluir.',
        central_idea: 'Educar sobre crescimento progressivo e acompanhamento sem prometer resultado.',
        script_outline: ['Mostre o marco de 6 meses.', 'Explique evolucao progressiva.', 'Reforce acompanhamento medico.'],
        caption: 'O acompanhamento ajuda a entender cada fase do crescimento e alinhar expectativas com responsabilidade.',
        cta: playbook?.ctas.recommended[0] ?? 'Agende uma avaliacao.',
        visual_direction: 'Post com foto autorizada ou visual abstrato de evolucao temporal.',
        commercial_intent: 'medio',
        compliance_notes: notes,
        quality_check: qualityCheck(criteria),
        ...playbookSignature,
      }),
    },
    {
      title: 'Cuidado com transplante escolhido so pelo preco',
      scheduled_for: dateInPeriod(input.period_start, 21),
      copy_json: ContentItemCopyJsonSchema.parse({
        schema_version: 1,
        channel: channels[0] ?? 'Instagram',
        format: 'carrossel',
        template_id: templates[3] ?? 'paper-editorial-01',
        funnel_stage: 'fundo',
        editorial_pillar: 'Alertas e seguranca',
        theme: 'Criterios para escolher clinica',
        headline: 'O erro de escolher transplante so pelo preco.',
        hook: 'Preco importa, mas nao pode ser o unico criterio.',
        central_idea: 'Proteger o paciente com criterios objetivos de seguranca e avaliacao.',
        script_outline: ['Abra com alerta sobrio.', 'Liste criterios de avaliacao.', 'Explique por que planejamento muda o orcamento.'],
        caption: 'Um procedimento responsavel considera avaliacao, area doadora, tecnica, equipe e acompanhamento.',
        cta: playbook?.ctas.recommended[1] ?? 'Envie suas fotos para uma pre-avaliacao.',
        visual_direction: 'Carrossel editorial com checklist e tom sobrio.',
        commercial_intent: 'alto',
        compliance_notes: notes,
        quality_check: qualityCheck(criteria),
        ...playbookSignature,
      }),
    },
    {
      title: `${brandName}: bastidor da avaliacao`,
      scheduled_for: dateInPeriod(input.period_start, 25),
      copy_json: ContentItemCopyJsonSchema.parse({
        schema_version: 1,
        channel: channels[1] ?? channels[0] ?? 'Instagram',
        format: 'post_unico',
        template_id: templates[2] ?? 'photo-overlay-01',
        funnel_stage: 'institucional',
        editorial_pillar: 'Autoridade medica e bastidores',
        theme: 'Como a avaliacao reduz inseguranca do paciente',
        headline: 'Por tras de um resultado natural existe planejamento.',
        hook: 'A avaliacao e onde o transplante comeca de verdade.',
        central_idea: 'Mostrar bastidor tecnico e humano sem autopromocao vazia.',
        script_outline: ['Mostre etapa de avaliacao.', 'Explique area doadora e hairline.', 'Convide para tirar duvidas.'],
        caption: 'Planejamento, desenho, tecnica e acompanhamento ajudam a alinhar expectativa e seguranca.',
        cta: playbook?.ctas.recommended[2] ?? 'Fale com a equipe pelo WhatsApp.',
        visual_direction: 'Foto real de avaliacao, medico/equipe ou detalhe de planejamento.',
        commercial_intent: 'medio',
        compliance_notes: notes,
        quality_check: qualityCheck(criteria),
        ...playbookSignature,
      }),
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
  const editorialContext = await loadBrandEditorialContext(typedBrand);
  const title = `Plano editorial ${formatMonth(data.period_start)} - ${typedBrand.name}`;
  const planJson = buildPlanJson(data, typedBrand, memory as BrandMemoryRow | null, editorialContext);

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

  const itemRows = buildItems(data, typedBrand, editorialContext).map((item) => ({
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
      ...(editorialContext ? {
        playbook_slug: editorialContext.slug,
        playbook_version: editorialContext.playbook_json.version,
      } : {}),
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
    ...(editorialContext ? {
      playbook_slug: editorialContext.slug,
      playbook_version: editorialContext.playbook_json.version,
    } : {}),
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
