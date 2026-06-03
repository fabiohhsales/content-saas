import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getCurrentWorkspace } from '@/lib/auth';
import { demoApprovals, demoBrands, isDemoMode } from '@/lib/demo';
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
    content_plan: 'Plano editorial',
    content_item: 'Item de conteudo',
    generated_asset: 'Preview gerado',
    creative_document: 'Criativo editavel',
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
    return brandId ? `/clients/${brandId}#geracao` : null;
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
  searchParams: Promise<{ status?: string; target_type?: string; brand_id?: string }>;
}) {
  const filters = await searchParams;
  const { supabase, membership } = await getCurrentWorkspace();
  if (!membership) redirect('/onboarding');

  let approvals: ApprovalLike[] = [];
  let brands: Array<{ id: string; name: string }> = [];

  if (isDemoMode()) {
    brands = demoBrands.map((brand) => ({ id: brand.id, name: brand.name }));
    approvals = demoApprovals.map((approval) => {
      if (approval.target_type === 'content_plan') return { ...approval, target_href: `/plans/${approval.target_id}` };
      if (approval.target_type === 'brand_memory') return { ...approval, target_href: `/clients/${approval.metadata.brand_id}#geracao` };
      if (approval.target_type === 'generated_asset') return { ...approval, target_href: '/plans/demo-plan-aurora-2026-06#item-demo-content-item-001' };
      if (approval.target_type === 'creative_document') return { ...approval, target_href: `/editor/${approval.target_id}` };
      return approval;
    });
  } else {
    const [{ data: brandRows }, { data }] = await Promise.all([
      supabase
        .from('brands')
        .select('id, name')
        .eq('workspace_id', membership.workspace_id)
        .neq('status', 'archived')
        .order('name', { ascending: true }),
      supabase
        .from('approvals')
        .select('id, target_type, target_id, status, decided_by, decided_at, notes, created_at, metadata')
        .eq('workspace_id', membership.workspace_id)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    brands = (brandRows ?? []) as Array<{ id: string; name: string }>;
    approvals = (data ?? []) as ApprovalLike[];

    const contentItemIds = approvals.filter((approval) => approval.target_type === 'content_item').map((approval) => approval.target_id);
    const generatedAssetIds = approvals.filter((approval) => approval.target_type === 'generated_asset').map((approval) => approval.target_id);
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
      const enrichedApproval: ApprovalLike = enrichedMetadata ? { ...approval, metadata: enrichedMetadata } : { ...approval };
      return {
        ...enrichedApproval,
        target_href: buildTargetHref(enrichedApproval, planByContentItemId, contentItemByGeneratedAssetId),
      };
    });
  }

  const filteredApprovals = approvals.filter((approval) => {
    const statusMatches = !filters.status || approval.status === filters.status;
    const typeMatches = !filters.target_type || approval.target_type === filters.target_type;
    const brandMatches = !filters.brand_id || metadataString(approval.metadata, 'brand_id') === filters.brand_id;
    return statusMatches && typeMatches && brandMatches;
  });

  const summary = approvals.reduce<Record<string, number>>((acc, approval) => {
    acc[approval.status] = (acc[approval.status] ?? 0) + 1;
    return acc;
  }, {});
  const targetTypes = Array.from(new Set(approvals.map((approval) => approval.target_type))).sort();

  return (
    <AppShell>
      <section className="portfolio-hero compact-hero">
        <div>
          <small className="muted">Aprovacao</small>
          <h1>Revisoes humanas</h1>
          <p className="muted">Filtre por cliente, aprove ou selecione ajustes para orientar um novo rendering.</p>
        </div>
        <Link className="button secondary" href="/plans">Cronograma</Link>
      </section>

      <section className="portfolio-summary compact-metrics">
        {['pending', 'approved', 'changes_requested', 'rejected'].map((status) => (
          <div key={status}>
            <strong style={{ color: statusColor(status) }}>{summary[status] ?? 0}</strong>
            <span>{statusLabel(status)}</span>
          </div>
        ))}
      </section>

      <section className="panel portfolio-filters compact-panel">
        <form className="grid three" action="/approvals">
          <label>
            Cliente
            <select name="brand_id" defaultValue={filters.brand_id ?? ''}>
              <option value="">Todos</option>
              {brands.map((brand) => <option value={brand.id} key={brand.id}>{brand.name}</option>)}
            </select>
          </label>
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
              {targetTypes.map((targetType) => <option value={targetType} key={targetType}>{targetTypeLabel(targetType)}</option>)}
            </select>
          </label>
          <div className="client-actions form-actions">
            <button type="submit">Filtrar</button>
            <Link className="button secondary" href="/approvals">Limpar</Link>
          </div>
        </form>
      </section>

      <section className="approval-list">
        {filteredApprovals.map((approval) => {
          const brandName = brands.find((brand) => brand.id === metadataString(approval.metadata, 'brand_id'))?.name ?? 'Cliente nao informado';
          return (
            <article className="approval-card" key={approval.id}>
              <div className="approval-card-main">
                <small>{brandName} · {targetTypeLabel(approval.target_type)} · criado {formatDate(approval.created_at)}</small>
                <h2>{targetLabel(approval)}</h2>
                <p>Status atual: <strong style={{ color: statusColor(approval.status) }}>{statusLabel(approval.status)}</strong></p>
                {approval.notes ? <p className="muted">Ultimo feedback: {approval.notes}</p> : null}
                {approval.target_href ? <Link className="button secondary" href={approval.target_href}>Abrir item</Link> : null}
              </div>
              <div className="approval-card-actions">
                {approval.status === 'pending' ? (
                  <>
                    <form action={decideApproval.bind(null, approval.id)} className="grid">
                      <input type="hidden" name="status" value="approved" />
                      <button type="submit">Aprovar</button>
                    </form>
                    <form action={decideApproval.bind(null, approval.id)} className="grid">
                      <input type="hidden" name="status" value="changes_requested" />
                      <div className="feedback-options">
                        {['Trocar imagem', 'Ajustar texto', 'Rever cores', 'Usar outro modelo', 'Gerar nova versao'].map((option) => (
                          <label key={option}>
                            <input type="checkbox" name="feedback_option" value={option} />
                            {option}
                          </label>
                        ))}
                      </div>
                      <label>
                        Comentario
                        <textarea name="notes" placeholder="Detalhe o ajuste para orientar o re-rendering" />
                      </label>
                      <button className="secondary" type="submit">Pedir ajustes</button>
                    </form>
                  </>
                ) : (
                  <p className="muted">Decidido em {formatDate(approval.decided_at)}</p>
                )}
              </div>
            </article>
          );
        })}
        {filteredApprovals.length === 0 ? <p className="muted">Nenhuma aprovacao encontrada para os filtros atuais.</p> : null}
      </section>
    </AppShell>
  );
}
