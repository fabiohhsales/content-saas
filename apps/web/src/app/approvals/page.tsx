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
  target_href?: string | null;
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
    creative_document: 'Documento criativo',
    creative_version: 'Versao criativa',
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

function metadataString(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function buildTargetHref(
  approval: ApprovalLike,
  planByContentItemId: Map<string, string>,
  contentItemByGeneratedAssetId: Map<string, string>,
) {
  if (approval.target_type === 'content_plan') return `/plans/${approval.target_id}`;

  if (approval.target_type === 'brand_memory') {
    const brandId = metadataString(approval.metadata, 'brand_id');
    return brandId ? `/brands/${brandId}#brand-memories` : null;
  }

  if (approval.target_type === 'content_item') {
    const planId = metadataString(approval.metadata, 'content_plan_id') ?? planByContentItemId.get(approval.target_id);
    return planId ? `/plans/${planId}#item-${approval.target_id}` : null;
  }

  if (approval.target_type === 'generated_asset') {
    const contentItemId = metadataString(approval.metadata, 'content_item_id') ?? contentItemByGeneratedAssetId.get(approval.target_id);
    const planId = contentItemId ? planByContentItemId.get(contentItemId) : null;
    return planId && contentItemId ? `/plans/${planId}#item-${contentItemId}` : null;
  }

  if (approval.target_type === 'creative_document') return `/editor/${approval.target_id}`;

  if (approval.target_type === 'creative_version') {
    const creativeDocumentId = metadataString(approval.metadata, 'creative_document_id');
    return creativeDocumentId ? `/editor/${creativeDocumentId}` : null;
  }

  return null;
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
    approvals = demoApprovals.map((approval) => {
      if (approval.target_type === 'content_plan') {
        return { ...approval, target_href: `/plans/${approval.target_id}` };
      }
      if (approval.target_type === 'brand_memory') {
        return { ...approval, target_href: `/brands/${approval.metadata.brand_id}#brand-memories` };
      }
      if (approval.target_type === 'generated_asset') {
        return { ...approval, target_href: '/plans/demo-plan-aurora-2026-06#item-demo-content-item-001' };
      }
      if (approval.target_type === 'creative_document') {
        return { ...approval, target_href: `/editor/${approval.target_id}` };
      }
      return approval;
    });
  } else {
    const { data } = await supabase
      .from('approvals')
      .select('id, target_type, target_id, status, decided_by, decided_at, notes, created_at, metadata')
      .eq('workspace_id', membership.workspace_id)
      .order('created_at', { ascending: false })
      .limit(100);

    approvals = (data ?? []) as ApprovalLike[];

    const contentItemIds = approvals
      .filter((approval) => approval.target_type === 'content_item')
      .map((approval) => approval.target_id);
    const generatedAssetIds = approvals
      .filter((approval) => approval.target_type === 'generated_asset')
      .map((approval) => approval.target_id);
    const brandMemoryIds = approvals
      .filter((approval) => approval.target_type === 'brand_memory' && !metadataString(approval.metadata, 'brand_id'))
      .map((approval) => approval.target_id);

    const contentItemByGeneratedAssetId = new Map<string, string>();
    if (generatedAssetIds.length > 0) {
      const { data: assets } = await supabase
        .from('generated_assets')
        .select('id, content_item_id')
        .eq('workspace_id', membership.workspace_id)
        .in('id', generatedAssetIds);

      (assets ?? []).forEach((asset: any) => {
        if (asset.content_item_id) contentItemByGeneratedAssetId.set(asset.id, asset.content_item_id);
      });
    }

    const allContentItemIds = Array.from(new Set([
      ...contentItemIds,
      ...Array.from(contentItemByGeneratedAssetId.values()),
      ...approvals.map((approval) => metadataString(approval.metadata, 'content_item_id')).filter((value): value is string => Boolean(value)),
    ]));

    const planByContentItemId = new Map<string, string>();
    if (allContentItemIds.length > 0) {
      const { data: items } = await supabase
        .from('content_items')
        .select('id, content_plan_id')
        .eq('workspace_id', membership.workspace_id)
        .in('id', allContentItemIds);

      (items ?? []).forEach((item: any) => {
        if (item.content_plan_id) planByContentItemId.set(item.id, item.content_plan_id);
      });
    }

    const brandByMemoryId = new Map<string, string>();
    if (brandMemoryIds.length > 0) {
      const { data: memories } = await supabase
        .from('brand_memories')
        .select('id, brand_id')
        .eq('workspace_id', membership.workspace_id)
        .in('id', brandMemoryIds);

      (memories ?? []).forEach((memory: any) => {
        if (memory.brand_id) brandByMemoryId.set(memory.id, memory.brand_id);
      });
    }

    approvals = approvals.map((approval) => {
      const enrichedMetadata = approval.target_type === 'brand_memory' && !metadataString(approval.metadata, 'brand_id')
        ? { ...(approval.metadata ?? {}), brand_id: brandByMemoryId.get(approval.target_id) }
        : approval.metadata;
      const enrichedApproval: ApprovalLike = enrichedMetadata
        ? { ...approval, metadata: enrichedMetadata }
        : { ...approval };
      return {
        ...enrichedApproval,
        target_href: buildTargetHref(enrichedApproval, planByContentItemId, contentItemByGeneratedAssetId),
      };
    });
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
                {approval.target_href ? (
                  <Link className="button secondary" href={approval.target_href} style={{ marginTop: 12 }}>
                    Abrir alvo
                  </Link>
                ) : (
                  <p className="muted">Destino direto indisponivel para este alvo.</p>
                )}
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
