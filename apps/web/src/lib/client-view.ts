export type ClientViewLike = {
  id: string;
  status: string;
  metadata?: Record<string, any> | null;
};

const fallbackStages: Record<string, string> = {
  'demo-brand-health-grow': 'production',
  'demo-brand-renovo': 'setup',
  'demo-brand-vitta': 'strategy',
  'demo-brand-ortho': 'approval',
  'demo-brand-lumina': 'setup',
};

const fallbackChannels: Record<string, string[]> = {
  'demo-brand-health-grow': ['instagram', 'linkedin'],
  'demo-brand-renovo': ['instagram'],
  'demo-brand-vitta': ['instagram', 'youtube'],
  'demo-brand-ortho': ['instagram', 'linkedin'],
  'demo-brand-lumina': ['instagram', 'tiktok'],
};

export const clientStages = [
  { id: 'setup', label: 'Setup', description: 'Briefing, identidade e assets principais.' },
  { id: 'strategy', label: 'Estrategia', description: 'Plano editorial e preferencias de criacao.' },
  { id: 'production', label: 'Producao', description: 'Conteudos, previews e edicao.' },
  { id: 'approval', label: 'Aprovacao', description: 'Revisoes humanas e ajustes.' },
  { id: 'active', label: 'Ativo', description: 'Operacao recorrente em andamento.' },
];

export function clientStage(client: ClientViewLike) {
  const stage = client.metadata?.stage;
  if (typeof stage === 'string' && stage.length > 0) return stage;
  if (fallbackStages[client.id]) return fallbackStages[client.id];
  return client.status === 'draft' ? 'setup' : 'active';
}

export function clientStageLabel(client: ClientViewLike) {
  const stage = clientStage(client);
  return clientStages.find((item) => item.id === stage)?.label ?? stage;
}

export function clientChannels(client: ClientViewLike) {
  const channels = client.metadata?.channels;
  if (Array.isArray(channels)) return channels.map(String).filter(Boolean);
  return fallbackChannels[client.id] ?? ['instagram'];
}
