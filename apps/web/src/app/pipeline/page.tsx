import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SocialIconRow } from '@/components/social-icons';
import { getCurrentWorkspace } from '@/lib/auth';
import { clientChannels, clientStage, clientStages } from '@/lib/client-view';
import { demoBrands, isDemoMode } from '@/lib/demo';

type PipelineClient = {
  id: string;
  name: string;
  industry: string | null;
  status: string;
  positioning?: string | null;
  metadata?: Record<string, any> | null;
};

export default async function PipelinePage() {
  const { supabase, membership } = await getCurrentWorkspace();
  if (!membership) redirect('/onboarding');

  let clients: PipelineClient[] = [];

  if (isDemoMode()) {
    clients = demoBrands as PipelineClient[];
  } else {
    const { data } = await supabase
      .from('brands')
      .select('id, name, industry, status, positioning, metadata')
      .eq('workspace_id', membership.workspace_id)
      .neq('status', 'archived')
      .order('created_at', { ascending: false });

    clients = (data ?? []) as PipelineClient[];
  }

  return (
    <AppShell>
      <section className="portfolio-hero compact-hero">
        <div>
          <small className="muted">Pipeline</small>
          <h1>Fluxo dos clientes</h1>
          <p className="muted">Kanban simples para acompanhar setup, estrategia, producao, aprovacao e operacao recorrente.</p>
        </div>
        <div className="client-actions">
          <Link className="button" href="/clients/new">Novo cliente</Link>
          <Link className="button secondary" href="/clients">Tabela</Link>
        </div>
      </section>

      <section className="pipeline-board">
        {clientStages.map((stage) => {
          const stageClients = clients.filter((client) => clientStage(client) === stage.id);
          return (
            <article className="pipeline-column" key={stage.id}>
              <div className="pipeline-column-header">
                <div>
                  <strong>{stage.label}</strong>
                  <small>{stage.description}</small>
                </div>
                <span>{stageClients.length}</span>
              </div>
              <div className="pipeline-card-list">
                {stageClients.map((client) => (
                  <Link className="pipeline-card" href={`/clients/${client.id}`} key={client.id}>
                    <strong>{client.name}</strong>
                    <small>{client.industry || 'Segmento nao definido'}</small>
                    <p>{client.positioning || 'Briefing em construcao.'}</p>
                    <SocialIconRow channels={clientChannels(client)} />
                  </Link>
                ))}
                {stageClients.length === 0 ? <p className="muted">Sem clientes nesta etapa.</p> : null}
              </div>
            </article>
          );
        })}
      </section>
    </AppShell>
  );
}
