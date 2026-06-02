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
    signedUrl: null,
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
