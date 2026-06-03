import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getCurrentWorkspace } from '@/lib/auth';
import {
  demoContentPlans,
  demoCreativeDocuments,
  demoMemories,
  demoTemplates,
  getDemoAssets,
  getDemoBrand,
  isDemoMode,
} from '@/lib/demo';
import {
  archiveBrandTemplate,
  completeBrandOnboarding,
  linkBrandTemplate,
  requestBrandMemory,
  updateBrand,
  uploadBrandAsset,
} from '../../brands/actions';
import { requestGeneratedContentPlan } from '../../plans/actions';

type ClientRow = {
  id: string;
  name: string;
  industry: string | null;
  status: string;
  positioning?: string | null;
  voice_notes?: string | null;
  metadata?: Record<string, any> | null;
};

type AssetRow = {
  id: string;
  category: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  metadata?: Record<string, any> | null;
  signedUrl?: string | null;
};

function identity(client: ClientRow) {
  const data = client.metadata?.identity as Record<string, unknown> | undefined;
  return {
    primary_color: typeof data?.primary_color === 'string' && data.primary_color ? data.primary_color : '#0f766e',
    secondary_color: typeof data?.secondary_color === 'string' && data.secondary_color ? data.secondary_color : '#115e59',
    font_family: typeof data?.font_family === 'string' && data.font_family ? data.font_family : 'Arial',
    visual_notes: typeof data?.visual_notes === 'string' ? data.visual_notes : '',
  };
}

function progress(items: Array<{ done: boolean }>) {
  return Math.round((items.filter((item) => item.done).length / items.length) * 100);
}

function formatDate(value?: string | null) {
  if (!value) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

const assetPresets = [
  { title: 'Logo principal', category: 'logo', asset_role: 'primary', variant: 'principal', orientation: 'transparent', accept: 'image/png,image/svg+xml' },
  { title: 'Logo secundaria', category: 'logo', asset_role: 'secondary', variant: 'secundaria', orientation: 'transparent', accept: 'image/png,image/svg+xml' },
  { title: 'Capa ou fundo', category: 'photo', asset_role: 'cover', variant: 'capa', orientation: 'landscape', accept: 'image/png,image/jpeg' },
  { title: 'Foto aprovada', category: 'photo', asset_role: 'avatar', variant: 'foto', orientation: 'portrait', accept: 'image/png,image/jpeg' },
  { title: 'Fonte da marca', category: 'font', asset_role: 'font', variant: 'principal', orientation: '', accept: '.otf,.ttf,.woff,.woff2' },
  { title: 'Referencia visual', category: 'reference', asset_role: 'support', variant: 'referencia', orientation: 'square', accept: 'image/png,image/jpeg,application/pdf' },
];

export default async function ClientWorkspacePage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { supabase, membership } = await getCurrentWorkspace();
  if (!membership) redirect('/onboarding');

  let client: ClientRow | null = null;
  let assets: AssetRow[] = [];
  let plans: Array<{ id: string; title: string; status: string; period_start?: string | null; period_end?: string | null }> = [];
  let memories: Array<{ id: string; version: number; status: string; memory_json?: Record<string, any> }> = [];
  let documents: Array<{ id: string; title: string; status: string; template_ref: string }> = [];
  let templates: Array<{ id?: string; template_id: string; name: string; type: string; recommended_use?: string | null }> = [];
  let linkedTemplateIds = new Set<string>();

  if (isDemoMode()) {
    client = getDemoBrand(clientId) as ClientRow;
    assets = getDemoAssets(client.id) as AssetRow[];
    plans = demoContentPlans.filter((plan) => plan.brand_id === client!.id);
    memories = demoMemories.filter((memory) => memory.brand_id === client!.id);
    documents = demoCreativeDocuments.filter((document) => document.brand_id === client!.id);
    templates = demoTemplates;
    linkedTemplateIds = new Set(demoTemplates.slice(0, 2).map((template) => template.id));
  } else {
    const { data: brand } = await supabase
      .from('brands')
      .select('id, name, industry, status, positioning, voice_notes, metadata')
      .eq('id', clientId)
      .eq('workspace_id', membership.workspace_id)
      .single();

    if (!brand) notFound();
    client = brand as ClientRow;

    const [
      { data: assetRows },
      { data: planRows },
      { data: memoryRows },
      { data: documentRows },
      { data: templateRows },
      { data: brandTemplateRows },
    ] = await Promise.all([
      supabase
        .from('brand_assets')
        .select('id, category, file_name, mime_type, size_bytes, storage_bucket, storage_path, metadata')
        .eq('workspace_id', membership.workspace_id)
        .eq('brand_id', client.id)
        .neq('status', 'archived')
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('content_plans')
        .select('id, title, status, period_start, period_end')
        .eq('workspace_id', membership.workspace_id)
        .eq('brand_id', client.id)
        .neq('status', 'archived')
        .order('period_start', { ascending: false })
        .limit(5),
      supabase
        .from('brand_memories')
        .select('id, version, status, memory_json')
        .eq('workspace_id', membership.workspace_id)
        .eq('brand_id', client.id)
        .order('version', { ascending: false })
        .limit(3),
      supabase
        .from('creative_documents')
        .select('id, title, status, template_ref')
        .eq('workspace_id', membership.workspace_id)
        .eq('brand_id', client.id)
        .neq('status', 'archived')
        .order('updated_at', { ascending: false })
        .limit(5),
      supabase
        .from('templates')
        .select('id, template_id, name, type, metadata')
        .or(`workspace_id.is.null,workspace_id.eq.${membership.workspace_id}`)
        .limit(5),
      supabase
        .from('brand_templates')
        .select('template_id, status, metadata')
        .eq('workspace_id', membership.workspace_id)
        .eq('brand_id', client.id)
        .eq('status', 'active'),
    ]);

    assets = await Promise.all((assetRows ?? []).map(async (asset: any) => {
      const { data } = await supabase.storage.from(asset.storage_bucket).createSignedUrl(asset.storage_path, 60 * 10);
      return { ...asset, signedUrl: data?.signedUrl ?? null };
    }));
    plans = (planRows ?? []) as typeof plans;
    memories = (memoryRows ?? []) as typeof memories;
    documents = (documentRows ?? []) as typeof documents;
    templates = (templateRows ?? []).map((template: any) => ({
      id: template.id,
      template_id: template.template_id,
      name: template.name,
      type: template.type,
      recommended_use: template.metadata?.recommended_use ?? null,
    }));
    linkedTemplateIds = new Set((brandTemplateRows ?? []).map((row: any) => row.template_id));
  }

  if (!client) notFound();

  const clientIdentity = identity(client);
  const checklist = [
    { label: 'Perfil e voz', done: Boolean(client.positioning || client.voice_notes) },
    { label: 'Identidade visual', done: Boolean(clientIdentity.primary_color && clientIdentity.font_family) },
    { label: 'Assets aprovados', done: assets.length > 0 },
    { label: 'Memoria de marca', done: memories.length > 0 },
    { label: 'Templates vinculados', done: linkedTemplateIds.size > 0 },
    { label: 'Estrategia/cronograma', done: plans.length > 0 },
    { label: 'Criativos editaveis', done: documents.length > 0 },
  ];
  const completion = progress(checklist);
  const latestMemory = memories[0];

  return (
    <AppShell>
      <div className="toolbar client-workspace-hero">
        <div>
          <small className="muted">Painel do cliente</small>
          <h1>{client.name}</h1>
          <p className="muted">{client.industry || 'Segmento nao definido'} - {client.status}</p>
        </div>
        <div className="client-actions">
          <Link className="button secondary" href="/clients">Clientes</Link>
          <Link className="button secondary" href={`/brands/${client.id}`}>Dados avancados</Link>
          <Link className="button" href="#geracao">Gerar conteudo</Link>
        </div>
      </div>

      <section className="client-command-strip">
        <div>
          <small className="muted">Identidade</small>
          <div className="brand-token-row">
            <span style={{ background: clientIdentity.primary_color }} />
            <span style={{ background: clientIdentity.secondary_color }} />
            <strong>{clientIdentity.font_family}</strong>
          </div>
        </div>
        <div><strong>{assets.length}</strong><span>assets</span></div>
        <div><strong>{templates.length}</strong><span>templates disponiveis</span></div>
        <div><strong>{plans.length}</strong><span>cronogramas</span></div>
        <div><strong>{documents.length}</strong><span>criativos</span></div>
      </section>

      <section className="panel client-flow-panel">
        <div>
          <small className="muted">Progresso operacional</small>
          <h2>{completion}% pronto para producao</h2>
        </div>
        <div className="client-progress">
          <span style={{ width: `${completion}%` }} />
        </div>
        <div className="client-steps">
          {checklist.map((item) => (
            <span className={item.done ? 'done' : ''} key={item.label}>
              <strong>{item.done ? 'OK' : '--'}</strong>
              {item.label}
            </span>
          ))}
        </div>
      </section>

      <section className="client-workspace-grid">
        <form id="perfil" action={updateBrand.bind(null, client.id)} className="panel grid">
          <div>
            <small className="muted">1. Perfil, identidade e regras</small>
            <h2>Briefing do cliente</h2>
          </div>
          <label>
            Nome do cliente
            <input name="name" required defaultValue={client.name} />
          </label>
          <label>
            Segmento
            <input name="industry" defaultValue={client.industry ?? ''} />
          </label>
          <div id="identidade" className="grid two compact-fields">
            <label>
              Cor primaria
              <input name="primary_color" type="color" defaultValue={clientIdentity.primary_color} />
            </label>
            <label>
              Cor secundaria
              <input name="secondary_color" type="color" defaultValue={clientIdentity.secondary_color} />
            </label>
          </div>
          <label>
            Fonte base
            <select name="font_family" defaultValue={clientIdentity.font_family}>
              <option value="Arial">Arial</option>
              <option value="Inter">Inter</option>
              <option value="Helvetica">Helvetica</option>
              <option value="Georgia">Georgia</option>
              <option value="Montserrat">Montserrat</option>
              <option value="Poppins">Poppins</option>
            </select>
          </label>
          <label>
            Posicionamento
            <textarea name="positioning" defaultValue={client.positioning ?? ''} />
          </label>
          <label>
            Voz, tom e restricoes
            <textarea name="voice_notes" defaultValue={client.voice_notes ?? ''} />
          </label>
          <label>
            Observacoes visuais
            <textarea name="visual_notes" defaultValue={clientIdentity.visual_notes} />
          </label>
          <button type="submit">Salvar briefing</button>
        </form>

        <div id="assets" className="panel grid">
          <div>
            <small className="muted">2. Biblioteca da marca</small>
            <h2>Assets estruturados</h2>
          </div>
          <div className="upload-preset-grid">
            {assetPresets.map((preset) => (
              <form action={uploadBrandAsset.bind(null, client.id)} className="upload-preset" key={preset.title}>
                <div>
                  <strong>{preset.title}</strong>
                  <small className="muted">{preset.category} - {preset.asset_role}</small>
                </div>
                <input type="hidden" name="category" value={preset.category} />
                <input type="hidden" name="asset_role" value={preset.asset_role} />
                <input type="hidden" name="variant" value={preset.variant} />
                <input type="hidden" name="orientation" value={preset.orientation} />
                <input type="hidden" name="tags" value={`${preset.category}, ${preset.asset_role}, ${preset.variant}`} />
                <input type="hidden" name="usage_notes" value={`Asset enviado pelo preset ${preset.title}.`} />
                <input name="file" type="file" accept={preset.accept} required={!isDemoMode()} />
                <button type="submit">Enviar</button>
              </form>
            ))}
          </div>
          <form action={uploadBrandAsset.bind(null, client.id)} className="grid">
            <h3>Upload personalizado</h3>
            <div className="grid two">
              <label>
                Categoria
                <select name="category" defaultValue="logo">
                  <option value="logo">Logo</option>
                  <option value="photo">Foto</option>
                  <option value="font">Fonte</option>
                  <option value="reference">Referencia visual</option>
                  <option value="document">Documento</option>
                  <option value="other">Outro</option>
                </select>
              </label>
              <label>
                Arquivo
                <input name="file" type="file" required={!isDemoMode()} />
              </label>
            </div>
            <div className="grid two">
              <label>
                Papel no design
                <select name="asset_role" defaultValue="primary">
                  <option value="primary">Principal</option>
                  <option value="secondary">Secundario</option>
                  <option value="cover">Capa/fundo</option>
                  <option value="avatar">Avatar/retrato</option>
                  <option value="support">Apoio visual</option>
                </select>
              </label>
              <label>
                Variante
                <input name="variant" placeholder="horizontal, negativo, story..." />
              </label>
            </div>
            <div className="grid two">
              <label>
                Orientacao
                <select name="orientation" defaultValue="">
                  <option value="">Nao definida</option>
                  <option value="square">Quadrada</option>
                  <option value="portrait">Vertical</option>
                  <option value="landscape">Horizontal</option>
                  <option value="transparent">Transparente</option>
                </select>
              </label>
              <label>
                Tags
                <input name="tags" placeholder="premium, medico, fundo claro" />
              </label>
            </div>
            <label>
              Regras de uso
              <textarea name="usage_notes" placeholder="Quando usar, quando evitar, recorte permitido, fundo ideal..." />
            </label>
            <button type="submit">Enviar asset</button>
          </form>
          <div className="asset-strip">
            {assets.map((asset) => (
              <article className="card" key={asset.id}>
                <div className="asset-preview small">
                  {asset.signedUrl && asset.mime_type.startsWith('image/')
                    ? <img src={asset.signedUrl} alt={asset.file_name} />
                    : <span className="muted">{asset.category}</span>}
                </div>
                <strong>{asset.file_name}</strong>
                <small className="muted">
                  {asset.category} - {asset.metadata?.asset_role || 'sem papel'} - {Math.round(asset.size_bytes / 1024)} KB
                </small>
              </article>
            ))}
          </div>
          <Link className="button secondary" href={`/brands/${client.id}/assets`}>Abrir biblioteca completa</Link>
        </div>
      </section>

      <section id="geracao" className="client-workspace-grid">
        <div className="panel grid">
          <div>
            <small className="muted">3. Memoria de marca</small>
            <h2>Gerar base de IA</h2>
          </div>
          {latestMemory ? (
            <div className="card">
              <small className="muted">Versao {latestMemory.version} - {latestMemory.status}</small>
              <p>{String(latestMemory.memory_json?.summary ?? 'Memoria gerada sem resumo.')}</p>
            </div>
          ) : (
            <p className="muted">Gere a memoria depois de preencher identidade e subir os principais assets.</p>
          )}
          <form action={requestBrandMemory.bind(null, client.id)}>
            <button type="submit">Gerar memoria de marca</button>
          </form>
          <form action={completeBrandOnboarding.bind(null, client.id)}>
            <button className="secondary" type="submit">Marcar setup como ativo</button>
          </form>
        </div>

        <form id="estrategia" action={requestGeneratedContentPlan} className="panel grid">
          <div>
            <small className="muted">4. Estrategia e cronograma</small>
            <h2>Gerar plano de conteudo</h2>
          </div>
          <input type="hidden" name="brand_id" value={client.id} />
          <input type="hidden" name="title" value={`Plano editorial - ${client.name}`} />
          <div className="grid two">
            <label>
              Inicio
              <input name="period_start" type="date" required />
            </label>
            <label>
              Fim
              <input name="period_end" type="date" required />
            </label>
          </div>
          <label>
            Objetivo
            <textarea name="objective" placeholder="Campanha, foco comercial, canais e prioridade editorial." />
          </label>
          <div className="grid two">
            <label>
              Canais
              <input name="channels" placeholder="Instagram, LinkedIn, TikTok" />
            </label>
            <label>
              Frequencia
              <input name="frequency" placeholder="3 posts/semana, 1 carrossel/semana..." />
            </label>
          </div>
          <label>
            Pilares de conteudo
            <input name="pillars" placeholder="educacao, prova social, conversao" />
          </label>
          <label>
            Ofertas e campanhas
            <textarea name="campaigns" placeholder="Procedimentos, datas comerciais, lancamentos ou pautas prioritarias." />
          </label>
          <div className="grid two">
            <label>
              Templates preferidos
              <input name="preferred_templates" placeholder="photo-overlay-01, paper-editorial-01" />
            </label>
            <label>
              Restricoes
              <input name="restrictions" placeholder="Evitar antes/depois, promessas absolutas..." />
            </label>
          </div>
          <button type="submit">Gerar cronograma</button>
          <Link className="button secondary" href={`/plans?brand_id=${client.id}`}>Ver planos do cliente</Link>
        </form>
      </section>

      <section className="client-workspace-grid">
        <div id="templates" className="panel grid">
          <div>
            <small className="muted">5. Templates e subtemplates</small>
            <h2>Biblioteca disponivel</h2>
          </div>
          {templates.slice(0, 4).map((template) => (
            <article className="card" key={template.template_id}>
              <small className="muted">{template.type} - {template.id && linkedTemplateIds.has(template.id) ? 'vinculado' : 'global'}</small>
              <strong>{template.name}</strong>
              <p className="muted">{template.recommended_use ?? 'Contrato pronto para campos, assets e render.'}</p>
              <div className="client-actions">
                <Link className="button secondary" href={`/templates/${template.template_id}`}>Ver contrato</Link>
                {template.id && linkedTemplateIds.has(template.id) ? (
                  <form action={archiveBrandTemplate.bind(null, client.id, template.id)}>
                    <button className="secondary" type="submit">Remover</button>
                  </form>
                ) : (
                  <form action={linkBrandTemplate.bind(null, client.id)} className="inline-form">
                    <input type="hidden" name="template_id" value={template.id ?? ''} />
                    <input type="hidden" name="role" value="primary" />
                    <button type="submit" disabled={!template.id}>Usar neste cliente</button>
                  </form>
                )}
              </div>
            </article>
          ))}
          <Link className="button secondary" href="/templates">Abrir templates globais</Link>
        </div>

        <div id="criativos" className="panel grid">
          <div>
            <small className="muted">6. Conteudos e revisao</small>
            <h2>Transicao para editor</h2>
          </div>
          {plans.map((plan) => (
            <Link className="card" href={`/plans/${plan.id}`} key={plan.id}>
              <small className="muted">{formatDate(plan.period_start)} a {formatDate(plan.period_end)} - {plan.status}</small>
              <strong>{plan.title}</strong>
            </Link>
          ))}
          {documents.map((document) => (
            <Link className="card" href={`/editor/${document.id}`} key={document.id}>
              <small className="muted">{document.template_ref} - {document.status}</small>
              <strong>{document.title}</strong>
            </Link>
          ))}
          {plans.length === 0 && documents.length === 0 ? (
            <p className="muted">Depois da estrategia, os itens gerados entram em preview, editor e aprovacao.</p>
          ) : null}
          <Link className="button" href="/editor">Abrir editor</Link>
        </div>
      </section>
    </AppShell>
  );
}
