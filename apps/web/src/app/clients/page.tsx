import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getCurrentWorkspace } from '@/lib/auth';
import { demoAssets, demoBrands, demoContentPlans, demoCreativeDocuments, demoTemplates, isDemoMode } from '@/lib/demo';

type ClientRow = {
  id: string;
  name: string;
  industry: string | null;
  status: string;
  positioning?: string | null;
  voice_notes?: string | null;
  metadata?: Record<string, any> | null;
  created_at?: string;
};

type ClientStats = {
  assets: number;
  plans: number;
  documents: number;
  templates: number;
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

function setupSteps(client: ClientRow, stats: ClientStats) {
  const brandIdentity = identity(client);
  return [
    { label: 'Perfil', done: Boolean(client.positioning || client.voice_notes), href: `/clients/${client.id}#perfil` },
    { label: 'Identidade', done: Boolean(brandIdentity.primary_color && brandIdentity.font_family), href: `/clients/${client.id}#identidade` },
    { label: 'Assets', done: stats.assets > 0, href: `/clients/${client.id}#assets` },
    { label: 'Templates', done: stats.templates > 0, href: `/clients/${client.id}#templates` },
    { label: 'Estrategia', done: stats.plans > 0, href: `/clients/${client.id}#estrategia` },
    { label: 'Criativos', done: stats.documents > 0, href: `/clients/${client.id}#criativos` },
  ];
}

function progressPercent(steps: Array<{ done: boolean }>) {
  return Math.round((steps.filter((step) => step.done).length / steps.length) * 100);
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const filters = await searchParams;
  const { supabase, membership } = await getCurrentWorkspace();
  if (!membership) redirect('/onboarding');

  let clients: ClientRow[] = [];
  const statsByClient: Record<string, ClientStats> = {};

  if (isDemoMode()) {
    clients = demoBrands as ClientRow[];
    for (const client of clients) {
      statsByClient[client.id] = {
        assets: demoAssets.filter((asset) => asset.brand_id === client.id || client.id === 'demo-brand-health-grow').length,
        plans: demoContentPlans.filter((plan) => plan.brand_id === client.id).length,
        documents: demoCreativeDocuments.filter((document) => document.brand_id === client.id).length,
        templates: demoTemplates.length,
      };
    }
  } else {
    const { data: clientRows } = await supabase
      .from('brands')
      .select('id, name, industry, status, positioning, voice_notes, metadata, created_at')
      .eq('workspace_id', membership.workspace_id)
      .neq('status', 'archived')
      .order('created_at', { ascending: false });

    clients = (clientRows ?? []) as ClientRow[];

    await Promise.all(clients.map(async (client) => {
      const [{ count: assets }, { count: plans }, { count: documents }, { count: templates }] = await Promise.all([
        supabase
          .from('brand_assets')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', membership.workspace_id)
          .eq('brand_id', client.id)
          .neq('status', 'archived'),
        supabase
          .from('content_plans')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', membership.workspace_id)
          .eq('brand_id', client.id),
        supabase
          .from('creative_documents')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', membership.workspace_id)
          .eq('brand_id', client.id),
        supabase
          .from('templates')
          .select('id', { count: 'exact', head: true })
          .or(`workspace_id.is.null,workspace_id.eq.${membership.workspace_id}`),
      ]);

      statsByClient[client.id] = {
        assets: assets ?? 0,
        plans: plans ?? 0,
        documents: documents ?? 0,
        templates: templates ?? 0,
      };
    }));
  }

  const visibleClients = clients.filter((client) => {
    const query = (filters.q ?? '').trim().toLowerCase();
    const matchesQuery = !query
      || client.name.toLowerCase().includes(query)
      || (client.industry ?? '').toLowerCase().includes(query);
    const matchesStatus = !filters.status || client.status === filters.status;
    return matchesQuery && matchesStatus;
  });
  const portfolioStats = visibleClients.reduce(
    (acc, client) => {
      const stats = statsByClient[client.id] ?? { assets: 0, plans: 0, documents: 0, templates: 0 };
      acc.assets += stats.assets;
      acc.plans += stats.plans;
      acc.documents += stats.documents;
      if (client.status === 'active') acc.active += 1;
      if (client.status === 'draft') acc.draft += 1;
      return acc;
    },
    { active: 0, draft: 0, assets: 0, plans: 0, documents: 0 },
  );

  return (
    <AppShell>
      <section className="portfolio-hero">
        <div>
          <small className="muted">Operacao cliente-first</small>
          <h1>Clientes</h1>
          <p className="muted">Visao geral do portfolio: setup, identidade, cronogramas, criativos e pendencias de cada cliente.</p>
        </div>
        <div className="client-actions">
          <Link className="button" href="/clients/new">Novo cliente</Link>
          <Link className="button secondary" href="/plans">Ver cronogramas</Link>
        </div>
      </section>

      <section className="portfolio-summary">
        <div><strong>{visibleClients.length}</strong><span>clientes filtrados</span></div>
        <div><strong>{portfolioStats.active}</strong><span>ativos</span></div>
        <div><strong>{portfolioStats.assets}</strong><span>assets</span></div>
        <div><strong>{portfolioStats.plans}</strong><span>cronogramas</span></div>
        <div><strong>{portfolioStats.documents}</strong><span>criativos</span></div>
      </section>

      <section className="panel portfolio-filters">
        <form className="grid two" action="/clients">
          <label>
            Buscar cliente
            <input name="q" defaultValue={filters.q ?? ''} placeholder="Nome ou segmento" />
          </label>
          <label>
            Status
            <select name="status" defaultValue={filters.status ?? ''}>
              <option value="">Todos</option>
              <option value="active">Ativos</option>
              <option value="draft">Em setup</option>
            </select>
          </label>
          <div className="client-actions">
            <button type="submit">Filtrar</button>
            <Link className="button secondary" href="/clients">Limpar</Link>
          </div>
        </form>
      </section>

      <section className="client-portfolio-grid">
          {visibleClients.map((client) => {
            const stats = statsByClient[client.id] ?? { assets: 0, plans: 0, documents: 0, templates: 0 };
            const steps = setupSteps(client, stats);
            const percent = progressPercent(steps);
            const clientIdentity = identity(client);

            return (
              <article className="client-card client-card-polished" key={client.id}>
                <div className="client-card-header">
                  <div>
                    <small className="muted">{client.industry || 'Segmento nao definido'} - {client.status}</small>
                    <h2>{client.name}</h2>
                  </div>
                  <div className="swatches" aria-label="Cores do cliente">
                    <span style={{ background: clientIdentity.primary_color }} />
                    <span style={{ background: clientIdentity.secondary_color }} />
                  </div>
                </div>
                <p className="muted">{client.positioning || 'Briefing ainda sem posicionamento consolidado.'}</p>

                <div className="client-progress">
                  <span style={{ width: `${percent}%` }} />
                </div>
                <div className="portfolio-card-status">
                  <strong>{percent}% setup</strong>
                  <span>{stats.plans > 0 ? 'Cronograma iniciado' : 'Sem cronograma'}</span>
                </div>

                <div className="client-steps">
                  {steps.map((step) => (
                    <Link className={step.done ? 'done' : ''} href={step.href} key={step.label}>
                      <strong>{step.done ? 'OK' : '--'}</strong>
                      {step.label}
                    </Link>
                  ))}
                </div>

                <div className="client-metrics">
                  <span><strong>{stats.assets}</strong> assets</span>
                  <span><strong>{stats.templates}</strong> templates</span>
                  <span><strong>{stats.plans}</strong> planos</span>
                  <span><strong>{stats.documents}</strong> criativos</span>
                </div>

                <div className="client-actions">
                  <Link className="button" href={`/clients/${client.id}`}>Abrir painel</Link>
                  <Link className="button secondary" href={`/clients/${client.id}#assets`}>Assets</Link>
                  <Link className="button secondary" href={`/plans?brand_id=${client.id}`}>Estrategia</Link>
                  <Link className="button secondary" href="/editor">Editor</Link>
                </div>
              </article>
            );
          })}
          {visibleClients.length === 0 ? <p className="muted">Nenhum cliente encontrado para os filtros atuais.</p> : null}
      </section>
    </AppShell>
  );
}
