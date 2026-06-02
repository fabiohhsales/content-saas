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
