import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getCurrentWorkspace } from '@/lib/auth';
import { demoApprovals, isDemoMode } from '@/lib/demo';
import { decideApproval } from './actions';

type ApprovalLike = {
  id: string;
  target_type: string;
  target_id: string;
  target_label?: string | null;
  status: string;
  decided_by: string | null;
  decided_at: string | null;
  notes: string | null;
  created_at: string;
  metadata?: Record<string, unknown>;
};

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Pendente',
    approved: 'Aprovado',
    changes_requested: 'Ajustes solicitados',
    rejected: 'Rejeitado',
  };
  return labels[status] ?? status;
}

function targetTypeLabel(targetType: string) {
  const labels: Record<string, string> = {
    brand_memory: 'Memoria de marca',
    content_plan: 'Plano de conteudo',
    content_item: 'Item de conteudo',
    generated_asset: 'Asset gerado',
  };
  return labels[targetType] ?? targetType;
}

function statusColor(status: string) {
  if (status === 'approved') return '#0f766e';
  if (status === 'changes_requested') return '#b54708';
  if (status === 'rejected') return '#b42318';
  return '#344054';
}

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function jsonPreview(value: unknown) {
  if (!value) return '-';
  return JSON.stringify(value, null, 2);
}

function targetLabel(approval: ApprovalLike) {
  return approval.target_label ?? String(approval.metadata?.title ?? approval.metadata?.summary ?? approval.target_id);
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; target_type?: string }>;
}) {
  const filters = await searchParams;
  const { supabase, membership } = await getCurrentWorkspace();
  if (!membership) redirect('/onboarding');

  let approvals: ApprovalLike[] = [];

  if (isDemoMode()) {
    approvals = demoApprovals;
  } else {
    const { data } = await supabase
      .from('approvals')
      .select('id, target_type, target_id, status, decided_by, decided_at, notes, created_at, metadata')
      .eq('workspace_id', membership.workspace_id)
      .order('created_at', { ascending: false })
      .limit(100);

    approvals = (data ?? []) as ApprovalLike[];
  }

  const filteredApprovals = approvals.filter((approval) => {
    const statusMatches = !filters.status || approval.status === filters.status;
    const typeMatches = !filters.target_type || approval.target_type === filters.target_type;
    return statusMatches && typeMatches;
  });

  const summary = approvals.reduce<Record<string, number>>((acc, approval) => {
    acc[approval.status] = (acc[approval.status] ?? 0) + 1;
    return acc;
  }, {});

  const targetTypes = Array.from(new Set(approvals.map((approval) => approval.target_type))).sort();

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <h1>Aprovacoes</h1>
          <p className="muted">Centralize decisoes humanas para memorias, planos, conteudos e previews gerados.</p>
        </div>
        <Link className="button secondary" href="/brands">Voltar para marcas</Link>
      </div>

      <section className="grid two" style={{ marginBottom: 18 }}>
        {['pending', 'approved', 'changes_requested', 'rejected'].map((status) => (
          <article className="card" key={status}>
            <small className="muted">{statusLabel(status)}</small>
            <h2 style={{ margin: '8px 0 0', color: statusColor(status) }}>{summary[status] ?? 0}</h2>
          </article>
        ))}
      </section>

      <section className="panel" style={{ marginBottom: 18 }}>
        <form className="grid two" action="/approvals">
          <label>
            Status
            <select name="status" defaultValue={filters.status ?? ''}>
              <option value="">Todos</option>
              <option value="pending">Pendente</option>
              <option value="approved">Aprovado</option>
              <option value="changes_requested">Ajustes solicitados</option>
              <option value="rejected">Rejeitado</option>
            </select>
          </label>
          <label>
            Tipo
            <select name="target_type" defaultValue={filters.target_type ?? ''}>
              <option value="">Todos</option>
              {targetTypes.map((targetType) => (
                <option value={targetType} key={targetType}>{targetTypeLabel(targetType)}</option>
              ))}
            </select>
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
            <button type="submit">Filtrar</button>
            <Link className="button secondary" href="/approvals">Limpar</Link>
          </div>
        </form>
      </section>

      <section className="grid">
        {filteredApprovals.map((approval) => (
          <article className="card" key={approval.id}>
            <div className="toolbar" style={{ marginBottom: 8 }}>
              <div>
                <small className="muted">{targetTypeLabel(approval.target_type)} · criado {formatDate(approval.created_at)}</small>
                <h2 style={{ margin: '6px 0' }}>{targetLabel(approval)}</h2>
              </div>
              <span style={{ color: statusColor(approval.status), fontWeight: 700 }}>{statusLabel(approval.status)}</span>
            </div>

            <div className="grid two">
              <div>
                <small className="muted">Contexto</small>
                <pre>{jsonPreview(approval.metadata ?? { target_id: approval.target_id })}</pre>
              </div>
              <div>
                <small className="muted">Decisao</small>
                <p className="muted">
                  Decidido em {formatDate(approval.decided_at)}
                  {approval.notes ? ` · ${approval.notes}` : ''}
                </p>
                {approval.status === 'pending' ? (
                  <div className="grid" style={{ marginTop: 12 }}>
                    <form action={decideApproval.bind(null, approval.id)} className="grid">
                      <input type="hidden" name="status" value="approved" />
                      <label>
                        Nota opcional
                        <textarea name="notes" placeholder="Observacao para o historico de aprovacao" />
                      </label>
                      <button type="submit">Aprovar</button>
                    </form>
                    <form action={decideApproval.bind(null, approval.id)} className="grid">
                      <input type="hidden" name="status" value="changes_requested" />
                      <label>
                        Ajustes solicitados
                        <textarea name="notes" required placeholder="Descreva o que precisa mudar" />
                      </label>
                      <button className="secondary" type="submit">Pedir ajustes</button>
                    </form>
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        ))}
        {filteredApprovals.length === 0 ? <p className="muted">Nenhuma aprovacao encontrada para os filtros atuais.</p> : null}
      </section>
    </AppShell>
  );
}
