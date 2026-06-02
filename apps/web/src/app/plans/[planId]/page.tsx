import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getCurrentWorkspace } from '@/lib/auth';
import { demoBrands, demoCreativeDocuments, getDemoContentItems, getDemoContentPlan, getDemoGeneratedAssets, isDemoMode } from '@/lib/demo';
import {
  archiveContentPlan,
  createContentItem,
  createPlanApproval,
  requestRenderPreview,
  updateContentItemStatus,
} from '../actions';

type PlanDetail = {
  id: string;
  brand_id: string;
  title: string;
  period_start: string;
  period_end: string;
  status: string;
  plan_json?: Record<string, unknown>;
  brands?: { id?: string; name?: string | null } | null;
};

type ItemLike = {
  id: string;
  title: string;
  status: string;
  scheduled_for: string | null;
  copy_json?: Record<string, unknown>;
  created_at?: string;
};

type GeneratedAssetLike = {
  id: string;
  content_item_id: string | null;
  status: string;
  storage_bucket: string;
  storage_path: string | null;
  mime_type: string | null;
  render_payload_json?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  signedUrl?: string | null;
  created_at?: string;
};

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    generating: 'Gerando',
    awaiting_approval: 'Em aprovacao',
    changes_requested: 'Ajustes solicitados',
    approved: 'Aprovado',
    published: 'Publicado',
    cancelled: 'Cancelado',
    archived: 'Arquivado',
  };
  return labels[status] ?? status;
}

function statusColor(status: string) {
  if (status === 'approved' || status === 'published') return '#0f766e';
  if (status === 'awaiting_approval' || status === 'changes_requested') return '#b54708';
  if (status === 'cancelled' || status === 'archived') return '#b42318';
  return '#344054';
}

function formatDate(value: string | null) {
  if (!value) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: value.includes('T') ? '2-digit' : undefined,
    minute: value.includes('T') ? '2-digit' : undefined,
  }).format(new Date(value.includes('T') ? value : `${value}T00:00:00`));
}

function jsonValue(value: unknown) {
  return value == null || value === '' ? '-' : String(value);
}

export default async function PlanDetailPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const { supabase, membership } = await getCurrentWorkspace();
  if (!membership) redirect('/onboarding');

  let plan: PlanDetail | null = null;
  let items: ItemLike[] = [];
  let generatedAssets: GeneratedAssetLike[] = [];

  if (isDemoMode()) {
    const demoPlan = getDemoContentPlan(planId);
    const brand = demoBrands.find((entry) => entry.id === demoPlan.brand_id);
    plan = {
      ...demoPlan,
      brands: brand ? { id: brand.id, name: brand.name } : { name: 'Marca demo' },
    };
    items = getDemoContentItems(demoPlan.id);
    generatedAssets = getDemoGeneratedAssets(items.map((item) => item.id));
  } else {
    const [{ data: planRow }, { data: itemRows }] = await Promise.all([
      supabase
        .from('content_plans')
        .select('id, brand_id, title, period_start, period_end, status, plan_json, brands(id, name)')
        .eq('id', planId)
        .eq('workspace_id', membership.workspace_id)
        .single(),
      supabase
        .from('content_items')
        .select('id, title, status, scheduled_for, copy_json, created_at')
        .eq('content_plan_id', planId)
        .eq('workspace_id', membership.workspace_id)
        .order('scheduled_for', { ascending: true }),
    ]);

    plan = planRow as PlanDetail | null;
    items = (itemRows ?? []) as ItemLike[];

    if (plan) {
      const itemIds = items.map((item) => item.id);
      if (itemIds.length > 0) {
        const { data: assetRows } = await supabase
          .from('generated_assets')
          .select('id, content_item_id, status, storage_bucket, storage_path, mime_type, render_payload_json, metadata, created_at')
          .eq('workspace_id', membership.workspace_id)
          .eq('brand_id', plan.brand_id)
          .in('content_item_id', itemIds)
          .neq('status', 'archived')
          .order('created_at', { ascending: false });

        generatedAssets = (assetRows ?? []) as GeneratedAssetLike[];
      }
    }

    generatedAssets = await Promise.all(generatedAssets.map(async (asset) => {
      if (!asset.storage_path || asset.status !== 'ready') return asset;
      const { data: signed } = await supabase.storage
        .from(asset.storage_bucket)
        .createSignedUrl(asset.storage_path, 60 * 10);
      return { ...asset, signedUrl: signed?.signedUrl ?? null };
    }));
  }

  if (!plan) notFound();
  const assetsByItem = generatedAssets.reduce<Record<string, GeneratedAssetLike[]>>((acc, asset) => {
    if (!asset.content_item_id) return acc;
    acc[asset.content_item_id] = [...(acc[asset.content_item_id] ?? []), asset];
    return acc;
  }, {});

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <small className="muted">{plan.brands?.name ?? 'Marca'} · {formatDate(plan.period_start)} a {formatDate(plan.period_end)}</small>
          <h1>{plan.title}</h1>
          <p className="muted">{jsonValue(plan.plan_json?.objective)}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="button secondary" href="/plans">Voltar</Link>
          <form action={createPlanApproval.bind(null, plan.id)}>
            <button type="submit">Enviar para aprovacao</button>
          </form>
        </div>
      </div>

      <section className="grid two">
        <form action={createContentItem.bind(null, plan.id)} className="panel grid">
          <h2>Novo item</h2>
          {isDemoMode() ? <p className="muted">No demo, o item nao e persistido; o fluxo real grava em content_items.</p> : null}
          <label>
            Titulo
            <input name="title" required minLength={2} placeholder="Gancho ou tema do post" />
          </label>
          <div className="grid two">
            <label>
              Canal
              <input name="channel" placeholder="Instagram" />
            </label>
            <label>
              Formato
              <input name="format" placeholder="post_unico, carrossel..." />
            </label>
          </div>
          <div className="grid two">
            <label>
              Template
              <input name="template_id" placeholder="photo-overlay-01" />
            </label>
            <label>
              Agendamento
              <input name="scheduled_for" type="datetime-local" />
            </label>
          </div>
          <label>
            Hook
            <input name="hook" />
          </label>
          <label>
            Legenda
            <textarea name="caption" />
          </label>
          <label>
            CTA
            <input name="cta" />
          </label>
          <button type="submit">Adicionar item</button>
        </form>

        <div className="panel grid">
          <h2>Contrato do plano</h2>
          <pre>{JSON.stringify(plan.plan_json ?? { schema_version: 1 }, null, 2)}</pre>
          <div>
            <small className="muted">Status atual</small>
            <p style={{ color: statusColor(plan.status), fontWeight: 700 }}>{statusLabel(plan.status)}</p>
          </div>
          <form action={archiveContentPlan.bind(null, plan.id)}>
            <button className="secondary" type="submit">Arquivar plano</button>
          </form>
        </div>
      </section>

      <section className="grid" style={{ marginTop: 18 }}>
        {items.map((item) => (
          <article className="card" id={`item-${item.id}`} key={item.id}>
            <div className="toolbar" style={{ marginBottom: 8 }}>
              <div>
                <small className="muted">{formatDate(item.scheduled_for)} · {jsonValue(item.copy_json?.channel)} · {jsonValue(item.copy_json?.format)}</small>
                <h2 style={{ margin: '6px 0' }}>{item.title}</h2>
              </div>
              <span style={{ color: statusColor(item.status), fontWeight: 700 }}>{statusLabel(item.status)}</span>
            </div>
            <div className="grid two">
              <div>
                <small className="muted">Copy JSON</small>
                <pre>{JSON.stringify(item.copy_json ?? { schema_version: 1 }, null, 2)}</pre>
              </div>
              <form action={updateContentItemStatus.bind(null, item.id, plan.id)} className="grid">
                <label>
                  Atualizar status
                  <select name="status" defaultValue={item.status}>
                    <option value="draft">Rascunho</option>
                    <option value="generating">Gerando</option>
                    <option value="awaiting_approval">Em aprovacao</option>
                    <option value="changes_requested">Ajustes solicitados</option>
                    <option value="approved">Aprovado</option>
                    <option value="published">Publicado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </label>
                <button className="secondary" type="submit">Salvar status</button>
              </form>
            </div>
            <div className="grid" style={{ marginTop: 16 }}>
              <div className="toolbar" style={{ marginBottom: 0 }}>
                <div>
                  <small className="muted">Previews gerados</small>
                  <p className="muted" style={{ margin: '4px 0 0' }}>Render PNG/JPG salvo em Storage e enviado para aprovacao humana.</p>
                </div>
                <form action={requestRenderPreview.bind(null, plan.id, item.id)} style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
                  <label style={{ minWidth: 120 }}>
                    Formato
                    <select name="output_format" defaultValue="png">
                      <option value="png">PNG</option>
                      <option value="jpg">JPG</option>
                    </select>
                  </label>
                  <button type="submit">Gerar preview</button>
                </form>
              </div>
              <div className="grid two">
                {(assetsByItem[item.id] ?? []).map((asset) => (
                  <article className="card" id={`asset-${asset.id}`} key={asset.id}>
                    <div className="asset-preview">
                      {asset.signedUrl ? <img alt="Preview gerado" src={asset.signedUrl} /> : <span className="muted">{statusLabel(asset.status)}</span>}
                    </div>
                    <strong>{asset.mime_type ?? 'Preview'}</strong>
                    {isDemoMode() && demoCreativeDocuments.find((document) => document.generated_asset_id === asset.id) ? (
                      <Link className="button secondary" href={`/editor/${demoCreativeDocuments.find((document) => document.generated_asset_id === asset.id)!.id}`} style={{ margin: '10px 0' }}>
                        Abrir no editor
                      </Link>
                    ) : null}
                    <p className="muted">Status: {statusLabel(asset.status)} · {asset.storage_path ?? 'sem arquivo ainda'}</p>
                    <pre>{JSON.stringify(asset.render_payload_json ?? { schema_version: 1 }, null, 2)}</pre>
                  </article>
                ))}
                {(assetsByItem[item.id] ?? []).length === 0 ? <p className="muted">Nenhum preview renderizado para este item.</p> : null}
              </div>
            </div>
          </article>
        ))}
        {items.length === 0 ? <p className="muted">Nenhum item planejado ainda.</p> : null}
      </section>
    </AppShell>
  );
}
