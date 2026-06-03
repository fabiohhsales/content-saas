export const DEMO_WORKSPACE_ID = '00000000-0000-4000-8000-000000000101';
export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000102';
export const DEMO_BRAND_ID = 'demo-brand-health-grow';

export function isDemoMode() {
  return process.env.DEMO_MODE === 'true';
}

function assetImage(label: string, bg: string, fg: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="${bg}"/><circle cx="510" cy="88" r="54" fill="${fg}" opacity=".18"/><rect x="56" y="74" width="210" height="28" rx="6" fill="${fg}" opacity=".32"/><rect x="56" y="128" width="410" height="18" rx="5" fill="${fg}" opacity=".22"/><rect x="56" y="164" width="320" height="18" rx="5" fill="${fg}" opacity=".18"/><text x="56" y="304" fill="${fg}" font-family="Arial" font-size="36" font-weight="700">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const demoWorkspace = {
  id: DEMO_WORKSPACE_ID,
  name: 'Health Grow Studio',
  slug: 'health-grow-studio',
};

export const demoMembers = [
  {
    id: 'demo-member-owner',
    workspace_id: DEMO_WORKSPACE_ID,
    user_id: DEMO_USER_ID,
    role: 'owner',
    email: 'demo@content-saas.local',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
  },
  {
    id: 'demo-member-editor',
    workspace_id: DEMO_WORKSPACE_ID,
    user_id: '00000000-0000-4000-8000-000000000202',
    role: 'editor',
    email: 'editor@content-saas.local',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: 'demo-member-viewer',
    workspace_id: DEMO_WORKSPACE_ID,
    user_id: '00000000-0000-4000-8000-000000000203',
    role: 'viewer',
    email: 'viewer@content-saas.local',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
  },
];

export const demoInvitations = [
  {
    id: 'demo-invitation-editor',
    workspace_id: DEMO_WORKSPACE_ID,
    email: 'convidado@content-saas.local',
    role: 'editor',
    status: 'pending',
    invite_token: 'demo-invite-token',
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6).toISOString(),
    accepted_by: null,
    accepted_at: null,
    metadata: { schema_version: 1 },
    created_at: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
  },
];

export const demoBrands = [
  {
    id: DEMO_BRAND_ID,
    workspace_id: DEMO_WORKSPACE_ID,
    name: 'Clínica Aurora',
    slug: 'clinica-aurora',
    status: 'active',
    industry: 'Saúde estética',
    positioning: 'Clínica premium que traduz tratamentos capilares e dermatológicos em conteúdo educativo, seguro e humano.',
    voice_notes: 'Tom consultivo, acolhedor e criterioso. Evitar promessas absolutas e linguagem sensacionalista.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-brand-renovo',
    workspace_id: DEMO_WORKSPACE_ID,
    name: 'Renovo Hair',
    slug: 'renovo-hair',
    status: 'draft',
    industry: 'Transplante capilar',
    positioning: 'Autoridade médica com comunicação clara para pacientes em fase de decisão.',
    voice_notes: 'Didático, direto e tranquilizador.',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'demo-brand-vitta',
    workspace_id: DEMO_WORKSPACE_ID,
    name: 'Vitta Derm',
    slug: 'vitta-derm',
    status: 'active',
    industry: 'Dermatologia',
    positioning: 'Clinica dermatologica com foco em prevencao, naturalidade e acompanhamento de longo prazo.',
    voice_notes: 'Educativo, sereno e proximo. Evitar tom comercial agressivo.',
    metadata: { schema_version: 1, identity: { primary_color: '#7c3aed', secondary_color: '#0f172a', font_family: 'Inter', visual_notes: 'Visual limpo, fotos claras, fundos neutros e detalhes em violeta.' } },
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'demo-brand-ortho',
    workspace_id: DEMO_WORKSPACE_ID,
    name: 'Ortho Prime',
    slug: 'ortho-prime',
    status: 'active',
    industry: 'Ortopedia',
    positioning: 'Centro de ortopedia esportiva com comunicacao pratica para prevencao, diagnostico e recuperacao.',
    voice_notes: 'Direto, tecnico na medida e orientado a decisao.',
    metadata: { schema_version: 1, identity: { primary_color: '#2563eb', secondary_color: '#16a34a', font_family: 'Montserrat', visual_notes: 'Usar fotos de movimento, linhas limpas e contraste azul/verde.' } },
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'demo-brand-lumina',
    workspace_id: DEMO_WORKSPACE_ID,
    name: 'Lumina Estetica',
    slug: 'lumina-estetica',
    status: 'draft',
    industry: 'Estetica facial',
    positioning: 'Studio boutique para tratamentos faciais minimamente invasivos e conteudo de autocuidado.',
    voice_notes: 'Acolhedor, sofisticado e sem exageros.',
    metadata: { schema_version: 1, identity: { primary_color: '#be185d', secondary_color: '#9f7aea', font_family: 'Poppins', visual_notes: 'Preferir close-ups suaves, pele natural e composicao editorial.' } },
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
];

export const demoAssets = [
  {
    id: 'asset-logo-aurora',
    brand_id: DEMO_BRAND_ID,
    category: 'logo',
    status: 'ready',
    file_name: 'logo-principal.png',
    mime_type: 'image/png',
    size_bytes: 84210,
    metadata: { schema_version: 1, asset_role: 'primary', variant: 'horizontal', orientation: 'transparent', tags: ['logo', 'principal'] },
    signedUrl: assetImage('Logo Aurora', '#f7f7f4', '#0f766e'),
  },
  {
    id: 'asset-photo-consultorio',
    brand_id: DEMO_BRAND_ID,
    category: 'photo',
    status: 'ready',
    file_name: 'consultorio-premium.jpg',
    mime_type: 'image/jpeg',
    size_bytes: 322048,
    metadata: { schema_version: 1, asset_role: 'cover', variant: 'consultorio', orientation: 'landscape', tags: ['foto', 'ambiente'] },
    signedUrl: assetImage('Consultório', '#eef4f3', '#115e59'),
  },
  {
    id: 'asset-reference-feed',
    brand_id: DEMO_BRAND_ID,
    category: 'reference',
    status: 'ready',
    file_name: 'referencia-feed-editorial.png',
    mime_type: 'image/png',
    size_bytes: 210944,
    metadata: { schema_version: 1, asset_role: 'support', variant: 'feed editorial', orientation: 'square', tags: ['referencia', 'editorial'] },
    signedUrl: assetImage('Referência Visual', '#f1f5f9', '#344054'),
  },
  {
    id: 'asset-briefing',
    brand_id: DEMO_BRAND_ID,
    category: 'document',
    status: 'ready',
    file_name: 'briefing-marca.pdf',
    mime_type: 'application/pdf',
    size_bytes: 128000,
    metadata: { schema_version: 1, asset_role: 'briefing', variant: 'documento', orientation: '', tags: ['briefing'] },
    signedUrl: null,
  },
];

export const demoAssetCollections = [
  {
    id: '00000000-0000-4000-8000-000000000301',
    workspace_id: null,
    brand_id: null,
    scope: 'global',
    name: 'Elementos editoriais globais',
    slug: 'elementos-editoriais-globais',
    status: 'active',
    metadata: { schema_version: 1, description: 'Fundos, formas e icones reutilizaveis por qualquer workspace.' },
  },
  {
    id: '00000000-0000-4000-8000-000000000302',
    workspace_id: DEMO_WORKSPACE_ID,
    brand_id: DEMO_BRAND_ID,
    scope: 'brand',
    name: 'Assets aprovados Clinica Aurora',
    slug: 'assets-aprovados-clinica-aurora',
    status: 'active',
    metadata: { schema_version: 1, description: 'Logos, fotos e referencias que preservam a memoria de marca.' },
  },
];

export const demoGlobalAssets = [
  {
    id: '00000000-0000-4000-8000-000000000401',
    workspace_id: null,
    collection_id: '00000000-0000-4000-8000-000000000301',
    category: 'background',
    status: 'ready',
    storage_bucket: 'global-assets',
    storage_path: 'global/backgrounds/paper-soft.png',
    file_name: 'paper-soft.png',
    mime_type: 'image/png',
    size_bytes: 184200,
    metadata: { schema_version: 1, tags: ['editorial', 'clean', 'premium'], dominant_color: '#f7f7f4' },
    signedUrl: assetImage('Fundo editorial', '#f7f7f4', '#98a2b3'),
  },
  {
    id: '00000000-0000-4000-8000-000000000402',
    workspace_id: null,
    collection_id: '00000000-0000-4000-8000-000000000301',
    category: 'icon',
    status: 'ready',
    storage_bucket: 'global-assets',
    storage_path: 'global/icons/check-clinical.png',
    file_name: 'check-clinical.png',
    mime_type: 'image/png',
    size_bytes: 44320,
    metadata: { schema_version: 1, tags: ['saude', 'validacao', 'selo'], dominant_color: '#0f766e' },
    signedUrl: assetImage('Icone saude', '#ecfdf3', '#0f766e'),
  },
  {
    id: '00000000-0000-4000-8000-000000000403',
    workspace_id: null,
    collection_id: '00000000-0000-4000-8000-000000000301',
    category: 'shape',
    status: 'ready',
    storage_bucket: 'global-assets',
    storage_path: 'global/shapes/soft-frame.png',
    file_name: 'soft-frame.png',
    mime_type: 'image/png',
    size_bytes: 92500,
    metadata: { schema_version: 1, tags: ['moldura', 'minimal'], dominant_color: '#d0d5dd' },
    signedUrl: assetImage('Moldura soft', '#f8fafc', '#344054'),
  },
];

export const demoTemplatePlaceholders = [
  {
    id: '00000000-0000-4000-8000-000000000501',
    workspace_id: null,
    template_ref: 'photo-overlay-01',
    placeholder_key: 'logo_primary',
    kind: 'logo',
    role: 'brand_logo',
    required: false,
    constraints_json: { schema_version: 1, accepted_sources: ['brand_asset'], accepted_categories: ['logo'] },
  },
  {
    id: '00000000-0000-4000-8000-000000000502',
    workspace_id: null,
    template_ref: 'photo-overlay-01',
    placeholder_key: 'hero_image',
    kind: 'image',
    role: 'hero_image',
    required: true,
    constraints_json: { schema_version: 1, accepted_sources: ['brand_asset', 'global_asset'], accepted_categories: ['photo', 'background'] },
  },
  {
    id: '00000000-0000-4000-8000-000000000503',
    workspace_id: null,
    template_ref: 'paper-editorial-01',
    placeholder_key: 'headline',
    kind: 'text',
    role: 'headline',
    required: true,
    constraints_json: { schema_version: 1, max_chars: 84 },
  },
];

export const demoMemories = [
  {
    id: 'memory-aurora-v1',
    brand_id: DEMO_BRAND_ID,
    version: 1,
    status: 'draft',
    created_at: new Date().toISOString(),
    memory_json: {
      schema_version: 1,
      summary: 'Clínica Aurora combina autoridade médica, acolhimento e estética premium. A comunicação deve educar sem prometer resultado garantido.',
      confidence: 0.72,
      voice: {
        tone: 'consultivo, humano e criterioso',
        adjectives: ['claro', 'seguro', 'premium'],
      },
      content_rules: [
        'Explicar tratamentos com linguagem simples.',
        'Evitar antes/depois sem autorização explícita.',
        'Usar assets aprovados da biblioteca da marca.',
      ],
    },
  },
];

export const demoJobRuns = [
  {
    id: 'job-demo-memory-001',
    workspace_id: DEMO_WORKSPACE_ID,
    brand_id: DEMO_BRAND_ID,
    job_name: 'generate_brand_memory',
    queue_name: 'brand-memory',
    status: 'completed',
    input_json: {
      workspace_id: DEMO_WORKSPACE_ID,
      brand_id: DEMO_BRAND_ID,
      requested_by: DEMO_USER_ID,
    },
    output_json: {
      brand_memory_id: 'memory-aurora-v1',
      version: 1,
      summary: demoMemories[0]!.memory_json.summary,
      confidence: 0.72,
    },
    error_json: null,
    started_at: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
    finished_at: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
  },
  {
    id: 'job-demo-render-001',
    workspace_id: DEMO_WORKSPACE_ID,
    brand_id: DEMO_BRAND_ID,
    job_name: 'render_preview',
    queue_name: 'render-preview',
    status: 'queued',
    input_json: {
      content_item_id: 'demo-content-item-001',
      output_format: 'png',
    },
    output_json: null,
    error_json: null,
    started_at: null,
    finished_at: null,
    created_at: new Date(Date.now() - 1000 * 90).toISOString(),
  },
  {
    id: 'job-demo-plan-001',
    workspace_id: DEMO_WORKSPACE_ID,
    brand_id: 'demo-brand-renovo',
    job_name: 'generate_content_plan',
    queue_name: 'content-plan',
    status: 'failed',
    input_json: {
      brand_id: 'demo-brand-renovo',
      month: '2026-06',
    },
    output_json: null,
    error_json: {
      message: 'Demo de falha controlada: briefing insuficiente para gerar plano.',
    },
    started_at: new Date(Date.now() - 1000 * 60 * 44).toISOString(),
    finished_at: new Date(Date.now() - 1000 * 60 * 43).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'job-demo-creative-render-001',
    workspace_id: DEMO_WORKSPACE_ID,
    brand_id: DEMO_BRAND_ID,
    job_name: 'render_creative_document',
    queue_name: 'creative-render',
    status: 'queued',
    input_json: {
      creative_document_id: '00000000-0000-4000-8000-000000000601',
      output_format: 'png',
    },
    output_json: null,
    error_json: null,
    started_at: null,
    finished_at: null,
    created_at: new Date(Date.now() - 1000 * 45).toISOString(),
  },
];

export const demoAutomationLogs = [
  {
    id: 'log-demo-001',
    workspace_id: DEMO_WORKSPACE_ID,
    job_run_id: 'job-demo-memory-001',
    level: 'info',
    message: 'generate_brand_memory completed',
    context_json: {
      confidence: 0.72,
      version: 1,
    },
    created_at: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
  },
  {
    id: 'log-demo-002',
    workspace_id: DEMO_WORKSPACE_ID,
    job_run_id: 'job-demo-render-001',
    level: 'info',
    message: 'render_preview queued',
    context_json: {
      queue_name: 'render-preview',
    },
    created_at: new Date(Date.now() - 1000 * 90).toISOString(),
  },
  {
    id: 'log-demo-003',
    workspace_id: DEMO_WORKSPACE_ID,
    job_run_id: 'job-demo-plan-001',
    level: 'error',
    message: 'generate_content_plan failed',
    context_json: {
      reason: 'briefing_insufficient',
    },
    created_at: new Date(Date.now() - 1000 * 60 * 43).toISOString(),
  },
  {
    id: 'log-demo-004',
    workspace_id: DEMO_WORKSPACE_ID,
    job_run_id: 'job-demo-creative-render-001',
    level: 'info',
    message: 'render_creative_document queued',
    context_json: {
      queue_name: 'creative-render',
      creative_document_id: '00000000-0000-4000-8000-000000000601',
    },
    created_at: new Date(Date.now() - 1000 * 45).toISOString(),
  },
];

export const demoTemplates = [
  {
    id: 'template-demo-photo-overlay',
    workspace_id: null,
    template_id: 'photo-overlay-01',
    name: 'Photo overlay',
    type: 'post_unico',
    recommended_use: 'Post de impacto com foto principal, headline curta e CTA.',
    status: 'available',
    schema_json: {
      schema_version: 1,
      fields: [
        { key: 'eyebrow', label: 'Eyebrow', max_chars: 32, required: false },
        { key: 'headline', label: 'Headline', max_chars: 72, required: true },
        { key: 'body', label: 'Texto de apoio', max_chars: 160, required: false },
        { key: 'cta', label: 'CTA', max_chars: 42, required: false },
      ],
      asset_slots: {
        photo: { required: true, accepted_types: ['image/jpeg', 'image/png'] },
        logo: { required: false, accepted_types: ['image/png'] },
      },
    },
    render_contract_json: {
      schema_version: 1,
      endpoint: '/render',
      output_formats: ['png', 'jpg'],
      supports_design_tokens: true,
      supports_decorators: true,
    },
  },
  {
    id: 'template-demo-triptych',
    workspace_id: null,
    template_id: 'triptych-grid-01',
    name: 'Triptych grid',
    type: 'carrossel',
    recommended_use: 'Sequencia educativa com tres blocos visuais e ritmo de leitura claro.',
    status: 'available',
    schema_json: {
      schema_version: 1,
      fields: [
        { key: 'headline', label: 'Headline', max_chars: 64, required: true },
        { key: 'card_1', label: 'Card 1', max_chars: 90, required: true },
        { key: 'card_2', label: 'Card 2', max_chars: 90, required: true },
        { key: 'card_3', label: 'Card 3', max_chars: 90, required: true },
      ],
      asset_slots: {
        logo: { required: false, accepted_types: ['image/png'] },
      },
    },
    render_contract_json: {
      schema_version: 1,
      endpoint: '/render',
      output_formats: ['png', 'jpg'],
      supports_design_tokens: true,
      supports_decorators: false,
    },
  },
  {
    id: 'template-demo-statement',
    workspace_id: null,
    template_id: 'statement-dark-01',
    name: 'Statement dark',
    type: 'post_unico',
    recommended_use: 'Frase forte, tese editorial ou posicionamento de marca.',
    status: 'available',
    schema_json: {
      schema_version: 1,
      fields: [
        { key: 'headline', label: 'Statement', max_chars: 110, required: true },
        { key: 'highlight_box', label: 'Destaque', max_chars: 70, required: false },
        { key: 'brand_name', label: 'Marca', max_chars: 40, required: false },
      ],
      asset_slots: {
        logo: { required: false, accepted_types: ['image/png'] },
      },
    },
    render_contract_json: {
      schema_version: 1,
      endpoint: '/render',
      output_formats: ['png', 'jpg'],
      supports_design_tokens: true,
      supports_decorators: true,
    },
  },
  {
    id: 'template-demo-paper-editorial',
    workspace_id: null,
    template_id: 'paper-editorial-01',
    name: 'Paper editorial',
    type: 'post_unico',
    recommended_use: 'Conteudo editorial premium, explicativo e com pouca dependencia de foto.',
    status: 'available',
    schema_json: {
      schema_version: 1,
      fields: [
        { key: 'eyebrow', label: 'Eyebrow', max_chars: 28, required: false },
        { key: 'headline', label: 'Headline', max_chars: 84, required: true },
        { key: 'body', label: 'Corpo', max_chars: 220, required: true },
      ],
      asset_slots: {},
    },
    render_contract_json: {
      schema_version: 1,
      endpoint: '/render',
      output_formats: ['png', 'jpg'],
      supports_design_tokens: true,
      supports_decorators: false,
    },
  },
];

export const demoApprovals = [
  {
    id: 'approval-demo-memory-001',
    workspace_id: DEMO_WORKSPACE_ID,
    target_type: 'brand_memory',
    target_id: 'memory-aurora-v1',
    target_label: 'Memoria de marca v1 - Clinica Aurora',
    status: 'pending',
    decided_by: null,
    decided_at: null,
    notes: null,
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    metadata: {
      schema_version: 1,
      brand_id: DEMO_BRAND_ID,
      summary: demoMemories[0]!.memory_json.summary,
    },
  },
  {
    id: 'approval-demo-plan-001',
    workspace_id: DEMO_WORKSPACE_ID,
    target_type: 'content_plan',
    target_id: 'demo-plan-renovo-2026-06',
    target_label: 'Plano editorial Junho/2026 - Renovo Hair',
    status: 'changes_requested',
    decided_by: DEMO_USER_ID,
    decided_at: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
    notes: 'Adicionar mais conteudos de fundo de funil e reduzir repeticao de temas.',
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    metadata: {
      schema_version: 1,
      brand_id: 'demo-brand-renovo',
    },
  },
  {
    id: 'approval-demo-asset-001',
    workspace_id: DEMO_WORKSPACE_ID,
    target_type: 'generated_asset',
    target_id: 'demo-generated-asset-001',
    target_label: 'Preview PNG - photo-overlay-01',
    status: 'approved',
    decided_by: DEMO_USER_ID,
    decided_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    notes: 'Aprovado para seguir para agendamento.',
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    metadata: {
      schema_version: 1,
      template_id: 'photo-overlay-01',
    },
  },
  {
    id: 'approval-demo-creative-001',
    workspace_id: DEMO_WORKSPACE_ID,
    target_type: 'creative_document',
    target_id: '00000000-0000-4000-8000-000000000602',
    target_label: 'Carrossel editavel - 3 mitos sobre tratamento capilar',
    status: 'pending',
    decided_by: null,
    decided_at: null,
    notes: null,
    created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    metadata: {
      schema_version: 1,
      brand_id: DEMO_BRAND_ID,
      template_ref: 'paper-editorial-01',
      slides_count: 2,
    },
  },
];

export const demoContentPlans = [
  {
    id: 'demo-plan-aurora-2026-06',
    workspace_id: DEMO_WORKSPACE_ID,
    brand_id: DEMO_BRAND_ID,
    title: 'Plano editorial Junho/2026 - Clinica Aurora',
    period_start: '2026-06-01',
    period_end: '2026-06-30',
    status: 'draft',
    plan_json: {
      schema_version: 1,
      objective: 'Educar pacientes sobre tratamentos capilares com autoridade medica e linguagem acolhedora.',
      channels: ['Instagram', 'LinkedIn'],
      pillars: ['educacao', 'prova social', 'conversao'],
    },
    created_at: new Date(Date.now() - 1000 * 60 * 70).toISOString(),
  },
  {
    id: 'demo-plan-renovo-2026-06',
    workspace_id: DEMO_WORKSPACE_ID,
    brand_id: 'demo-brand-renovo',
    title: 'Plano editorial Junho/2026 - Renovo Hair',
    period_start: '2026-06-01',
    period_end: '2026-06-30',
    status: 'awaiting_approval',
    plan_json: {
      schema_version: 1,
      objective: 'Apoiar decisao de pacientes que estao comparando clinicas de transplante capilar.',
      channels: ['Instagram'],
      pillars: ['diagnostico', 'metodo', 'bastidores'],
    },
    created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
  },
];

export const demoContentItems = [
  {
    id: 'demo-content-item-001',
    workspace_id: DEMO_WORKSPACE_ID,
    brand_id: DEMO_BRAND_ID,
    content_plan_id: 'demo-plan-aurora-2026-06',
    title: 'Quando investigar queda capilar persistente?',
    status: 'draft',
    scheduled_for: '2026-06-05T13:00:00.000Z',
    channel: 'Instagram',
    format: 'post_unico',
    template_id: 'photo-overlay-01',
    copy_json: {
      schema_version: 1,
      hook: 'Queda capilar persistente merece investigacao, nao improviso.',
      caption: 'Entenda sinais que indicam a hora de buscar avaliacao medica e evitar promessas rapidas.',
      cta: 'Agende uma avaliacao individualizada.',
    },
    created_at: new Date(Date.now() - 1000 * 60 * 62).toISOString(),
  },
  {
    id: 'demo-content-item-002',
    workspace_id: DEMO_WORKSPACE_ID,
    brand_id: DEMO_BRAND_ID,
    content_plan_id: 'demo-plan-aurora-2026-06',
    title: '3 mitos sobre tratamento capilar',
    status: 'awaiting_approval',
    scheduled_for: '2026-06-12T13:00:00.000Z',
    channel: 'Instagram',
    format: 'carrossel',
    template_id: 'triptych-grid-01',
    copy_json: {
      schema_version: 1,
      hook: 'Nem todo conselho popular ajuda seu cabelo.',
      slides: ['Shampoo nao resolve tudo', 'Suplemento sem diagnostico pode frustrar', 'Resultado exige plano e acompanhamento'],
      cta: 'Salve para conversar com seu medico.',
    },
    created_at: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
  },
  {
    id: 'demo-content-item-003',
    workspace_id: DEMO_WORKSPACE_ID,
    brand_id: 'demo-brand-renovo',
    content_plan_id: 'demo-plan-renovo-2026-06',
    title: 'O que avaliar antes do transplante capilar',
    status: 'changes_requested',
    scheduled_for: '2026-06-18T13:00:00.000Z',
    channel: 'Instagram',
    format: 'post_unico',
    template_id: 'paper-editorial-01',
    copy_json: {
      schema_version: 1,
      hook: 'A decisao pelo transplante comeca antes da tecnica.',
      caption: 'Briefing pede mais conteudo de fundo de funil antes da aprovacao.',
    },
    created_at: new Date(Date.now() - 1000 * 60 * 190).toISOString(),
  },
];

export const demoGeneratedAssets = [
  {
    id: 'demo-generated-asset-001',
    workspace_id: DEMO_WORKSPACE_ID,
    brand_id: DEMO_BRAND_ID,
    content_item_id: 'demo-content-item-001',
    status: 'ready',
    storage_bucket: 'brand-assets',
    storage_path: `${DEMO_WORKSPACE_ID}/${DEMO_BRAND_ID}/generated/demo-content-item-001.png`,
    mime_type: 'image/png',
    render_payload_json: {
      schema_version: 1,
      template_id: 'photo-overlay-01',
      output_format: 'png',
      fields: {
        headline: 'Queda capilar persistente merece investigacao, nao improviso.',
        body: 'Entenda sinais que indicam a hora de buscar avaliacao medica.',
        cta: 'Agende uma avaliacao.',
      },
      assets: {},
    },
    metadata: {
      schema_version: 1,
      post_render_qa: {
        text_overflow: false,
        safe_area: true,
      },
    },
    signedUrl: assetImage('Preview PNG', '#ecfdf3', '#0f766e'),
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'demo-generated-asset-carousel-001',
    workspace_id: DEMO_WORKSPACE_ID,
    brand_id: DEMO_BRAND_ID,
    content_item_id: 'demo-content-item-002',
    status: 'ready',
    storage_bucket: 'brand-assets',
    storage_path: `${DEMO_WORKSPACE_ID}/${DEMO_BRAND_ID}/generated/demo-content-item-002-slide-1.png`,
    mime_type: 'image/png',
    render_payload_json: {
      schema_version: 1,
      template_id: 'paper-editorial-01',
      output_format: 'png',
      fields: {
        eyebrow: 'Slide 1',
        headline: 'Shampoo nao resolve tudo',
        body: 'Nem todo conselho popular ajuda seu cabelo.',
      },
      assets: {},
    },
    metadata: {
      schema_version: 1,
      slide_index: 1,
      slides_count: 3,
      post_render_qa: {},
    },
    signedUrl: assetImage('Carousel 1', '#f8fafc', '#344054'),
    created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  },
  {
    id: 'demo-generated-asset-carousel-002',
    workspace_id: DEMO_WORKSPACE_ID,
    brand_id: DEMO_BRAND_ID,
    content_item_id: 'demo-content-item-002',
    status: 'ready',
    storage_bucket: 'brand-assets',
    storage_path: `${DEMO_WORKSPACE_ID}/${DEMO_BRAND_ID}/generated/demo-content-item-002-slide-2.png`,
    mime_type: 'image/png',
    render_payload_json: {
      schema_version: 1,
      template_id: 'paper-editorial-01',
      output_format: 'png',
      fields: {
        eyebrow: 'Slide 2',
        headline: 'Suplemento sem diagnostico pode frustrar',
        body: 'Resultado exige contexto, criterio e acompanhamento.',
      },
      assets: {},
    },
    metadata: {
      schema_version: 1,
      slide_index: 2,
      slides_count: 3,
      post_render_qa: {},
    },
    signedUrl: assetImage('Carousel 2', '#eef4f3', '#115e59'),
    created_at: new Date(Date.now() - 1000 * 60 * 19).toISOString(),
  },
];

export const demoCreativeDocuments = [
  {
    id: '00000000-0000-4000-8000-000000000601',
    workspace_id: DEMO_WORKSPACE_ID,
    brand_id: DEMO_BRAND_ID,
    content_item_id: 'demo-content-item-001',
    generated_asset_id: 'demo-generated-asset-001',
    template_ref: 'photo-overlay-01',
    title: 'Queda capilar persistente - versao editavel',
    status: 'editing',
    updated_at: new Date(Date.now() - 1000 * 60 * 11).toISOString(),
    brands: { name: 'Clinica Aurora' },
    document_json: {
      schema_version: 1,
      canvas: { width: 1080, height: 1350, format: 'instagram_post' },
      template_id: 'photo-overlay-01',
      brand_id: DEMO_BRAND_ID,
      content_item_id: 'demo-content-item-001',
      generated_asset_id: 'demo-generated-asset-001',
      tokens: {
        primary_color: '#0f766e',
        background_color: '#f7f7f4',
        text_color: '#1f2933',
        font_family: 'Arial',
      },
      slides: [
        {
          id: 'slide-1',
          name: 'Feed principal',
          background: { color: '#f7f7f4', asset_id: '00000000-0000-4000-8000-000000000401', asset_source: 'global_asset' },
          elements: [
            {
              id: 'logo',
              type: 'image',
              role: 'brand_logo',
              placeholder: 'logo_primary',
              locked: false,
              visible: true,
              asset_id: 'asset-logo-aurora',
              asset_source: 'brand_asset',
              x: 72,
              y: 68,
              width: 180,
              height: 72,
              rotation: 0,
              style: { fit: 'contain' },
            },
            {
              id: 'headline',
              type: 'text',
              role: 'headline',
              placeholder: 'headline',
              locked: false,
              visible: true,
              text: 'Queda capilar persistente merece investigacao, nao improviso.',
              x: 72,
              y: 350,
              width: 760,
              height: 220,
              rotation: 0,
              style: { font_size: 58, font_weight: 700, color: '#1f2933' },
            },
            {
              id: 'hero',
              type: 'image',
              role: 'hero_image',
              placeholder: 'hero_image',
              locked: false,
              visible: true,
              asset_id: 'asset-photo-consultorio',
              asset_source: 'brand_asset',
              x: 612,
              y: 760,
              width: 360,
              height: 360,
              rotation: 0,
              style: { fit: 'cover', radius: 8 },
            },
            {
              id: 'cta',
              type: 'text',
              role: 'cta',
              placeholder: 'cta',
              locked: false,
              visible: true,
              text: 'Agende uma avaliacao individualizada.',
              x: 72,
              y: 1110,
              width: 520,
              height: 80,
              rotation: 0,
              style: { font_size: 30, color: '#0f766e' },
            },
          ],
        },
      ],
    },
    metadata: { schema_version: 1, source: 'generated_asset', current_version: 2 },
  },
  {
    id: '00000000-0000-4000-8000-000000000602',
    workspace_id: DEMO_WORKSPACE_ID,
    brand_id: DEMO_BRAND_ID,
    content_item_id: 'demo-content-item-002',
    generated_asset_id: 'demo-generated-asset-carousel-001',
    template_ref: 'paper-editorial-01',
    title: '3 mitos sobre tratamento capilar - carrossel editavel',
    status: 'ready_for_approval',
    updated_at: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
    brands: { name: 'Clinica Aurora' },
    document_json: {
      schema_version: 1,
      canvas: { width: 1080, height: 1350, format: 'instagram_post' },
      template_id: 'paper-editorial-01',
      brand_id: DEMO_BRAND_ID,
      content_item_id: 'demo-content-item-002',
      generated_asset_id: 'demo-generated-asset-carousel-001',
      tokens: {
        primary_color: '#115e59',
        background_color: '#eef4f3',
        text_color: '#1f2933',
        font_family: 'Arial',
      },
      slides: [
        {
          id: 'slide-1',
          name: 'Mito 1',
          background: { color: '#f8fafc' },
          elements: [
            { id: 'headline-1', type: 'text', role: 'headline', placeholder: 'headline', locked: false, visible: true, text: 'Shampoo nao resolve tudo', x: 84, y: 260, width: 760, height: 180, rotation: 0, style: { font_size: 64, font_weight: 700, color: '#1f2933' } },
            { id: 'body-1', type: 'text', role: 'body', placeholder: 'body', locked: false, visible: true, text: 'Nem todo conselho popular ajuda seu cabelo.', x: 84, y: 520, width: 720, height: 120, rotation: 0, style: { font_size: 32, color: '#344054' } },
          ],
        },
        {
          id: 'slide-2',
          name: 'Mito 2',
          background: { color: '#eef4f3' },
          elements: [
            { id: 'headline-2', type: 'text', role: 'headline', placeholder: 'headline', locked: false, visible: true, text: 'Suplemento sem diagnostico pode frustrar', x: 84, y: 260, width: 820, height: 220, rotation: 0, style: { font_size: 56, font_weight: 700, color: '#1f2933' } },
            { id: 'body-2', type: 'text', role: 'body', placeholder: 'body', locked: false, visible: true, text: 'Resultado exige contexto, criterio e acompanhamento.', x: 84, y: 560, width: 720, height: 120, rotation: 0, style: { font_size: 32, color: '#344054' } },
          ],
        },
      ],
    },
    metadata: { schema_version: 1, source: 'carousel_preview', current_version: 1 },
  },
];

export const demoCreativeVersions = [
  {
    id: '00000000-0000-4000-8000-000000000701',
    workspace_id: DEMO_WORKSPACE_ID,
    creative_document_id: '00000000-0000-4000-8000-000000000601',
    version: 1,
    status: 'draft',
    change_summary: 'Documento criado a partir do primeiro preview renderizado.',
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: '00000000-0000-4000-8000-000000000702',
    workspace_id: DEMO_WORKSPACE_ID,
    creative_document_id: '00000000-0000-4000-8000-000000000601',
    version: 2,
    status: 'draft',
    change_summary: 'Logo aplicado no placeholder e CTA revisado.',
    created_at: new Date(Date.now() - 1000 * 60 * 11).toISOString(),
  },
];

export function getDemoBrand(brandId: string) {
  return demoBrands.find((brand) => brand.id === brandId) ?? demoBrands[0]!;
}

export function getDemoAssets(brandId: string, category?: string) {
  return demoAssets.filter((asset) => {
    if (asset.brand_id !== brandId && brandId !== DEMO_BRAND_ID) return false;
    return !category || asset.category === category;
  });
}

export function getDemoMemories(brandId: string) {
  return demoMemories.filter((memory) => memory.brand_id === brandId || brandId !== DEMO_BRAND_ID);
}

export function getDemoTemplate(templateId: string) {
  return demoTemplates.find((template) => template.template_id === templateId || template.id === templateId) ?? demoTemplates[0]!;
}

export function getDemoContentPlan(planId: string) {
  return demoContentPlans.find((plan) => plan.id === planId) ?? demoContentPlans[0]!;
}

export function getDemoContentItems(planId: string) {
  return demoContentItems.filter((item) => item.content_plan_id === planId);
}

export function getDemoGeneratedAssets(contentItemIds: string[]) {
  return demoGeneratedAssets.filter((asset) => asset.content_item_id && contentItemIds.includes(asset.content_item_id));
}

export function getDemoCreativeDocument(documentId: string) {
  return demoCreativeDocuments.find((document) => document.id === documentId) ?? demoCreativeDocuments[0]!;
}

export function getDemoCreativeVersions(documentId: string) {
  return demoCreativeVersions.filter((version) => version.creative_document_id === documentId);
}

export function getDemoTemplatePlaceholders(templateRef: string) {
  return demoTemplatePlaceholders.filter((placeholder) => placeholder.template_ref === templateRef);
}
