import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getCurrentWorkspace } from '@/lib/auth';
import { demoBrands, demoCreativeDocuments, getDemoContentItems, getDemoContentPlan, getDemoGeneratedAssets, isDemoMode } from '@/lib/demo';
import {
  archiveContentPlan,
  createCreativeDocumentFromItem,
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
  channel?: string | null;
  format?: string | null;
  template_id?: string | null;
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

type CreativeDocumentLike = {
  id: string;
  content_item_id: string | null;
  title: string;
  status: string;
  template_ref: string;
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

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function planStrategy(planJson?: Record<string, unknown>) {
  const strategy = planJson?.strategy as Record<string, unknown> | undefined;
  const playbook = planJson?.editorial_playbook as Record<string, unknown> | undefined;
  return {
    objective: String(strategy?.objective || planJson?.objective || 'Objetivo ainda nao consolidado.'),
    channels: stringList(strategy?.channels).length ? stringList(strategy?.channels) : stringList(planJson?.channels),
    frequency: String(strategy?.frequency || 'Frequencia nao definida'),
    pillars: stringList(strategy?.pillars).length ? stringList(strategy?.pillars) : stringList(planJson?.pillars),
    campaigns: String(strategy?.campaigns || 'Sem campanha registrada'),
    restrictions: String(strategy?.restrictions || 'Sem restricoes registradas'),
    playbookSlug: String(strategy?.playbook_slug || playbook?.slug || ''),
    playbookVersion: String(strategy?.playbook_version || playbook?.version || ''),
    funnelDistribution: (strategy?.funnel_distribution as Record<string, unknown> | undefined)
      ?? (planJson?.funnel_distribution as Record<string, unknown> | undefined)
      ?? {},
  };
}

function itemOffsetPercent(date: string | null, start: string, end: string) {
  if (!date) return 0;
  const startTime = new Date(`${start}T00:00:00`).getTime();
  const endTime = new Date(`${end}T23:59:59`).getTime();
  const itemTime = new Date(date).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) return 0;
  return Math.min(96, Math.max(0, Math.round(((itemTime - startTime) / (endTime - startTime)) * 100)));
}

function itemField(item: ItemLike, field: 'channel' | 'format' | 'template_id') {
  const direct = item[field];
  const fromCopy = item.copy_json?.[field];
  return jsonValue(direct || fromCopy);
}

export default async function PlanDetailPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const { supabase, membership } = await getCurrentWorkspace();
  if (!membership) redirect('/onboarding');

  let plan: PlanDetail | null = null;
  let items: ItemLike[] = [];
  let generatedAssets: GeneratedAssetLike[] = [];
  let creativeDocuments: CreativeDocumentLike[] = [];

  if (isDemoMode()) {
    const demoPlan = getDemoContentPlan(planId);
    const brand = demoBrands.find((entry) => entry.id === demoPlan.brand_id);
    plan = {
      ...demoPlan,
      brands: brand ? { id: brand.id, name: brand.name } : { name: 'Marca demo' },
    };
    items = getDemoContentItems(demoPlan.id);
    generatedAssets = getDemoGeneratedAssets(items.map((item) => item.id));
    creativeDocuments = demoCreativeDocuments.filter((document) => items.some((item) => item.id === document.content_item_id));
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

        const { data: documentRows } = await supabase
          .from('creative_documents')
          .select('id, content_item_id, title, status, template_ref')
          .eq('workspace_id', membership.workspace_id)
          .eq('brand_id', plan.brand_id)
          .in('content_item_id', itemIds)
          .neq('status', 'archived')
          .order('updated_at', { ascending: false });

        creativeDocuments = (documentRows ?? []) as CreativeDocumentLike[];
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
  const strategy = planStrategy(plan.plan_json);
  const assetsByItem = generatedAssets.reduce<Record<string, GeneratedAssetLike[]>>((acc, asset) => {
    if (!asset.content_item_id) return acc;
    acc[asset.content_item_id] = [...(acc[asset.content_item_id] ?? []), asset];
    return acc;
  }, {});
  const documentsByItem = creativeDocuments.reduce<Record<string, CreativeDocumentLike[]>>((acc, document) => {
    if (!document.content_item_id) return acc;
    acc[document.content_item_id] = [...(acc[document.content_item_id] ?? []), document];
    return acc;
  }, {});

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <small className="muted">{plan.brands?.name ?? 'Marca'} · {formatDate(plan.period_start)} a {formatDate(plan.period_end)}</small>
          <h1>{plan.title}</h1>
          <p className="muted">{strategy.objective}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="button secondary" href="/plans">Voltar</Link>
          <form action={createPlanApproval.bind(null, plan.id)}>
            <button type="submit">Enviar para aprovacao</button>
          </form>
        </div>
      </div>

      <section className="plan-overview">
        <article className="panel plan-summary">
          <small className="muted">Resumo estrategico</small>
          <h2>{strategy.objective}</h2>
          <div className="summary-tags">
            {strategy.channels.map((channel) => <span key={channel}>{channel}</span>)}
            <span>{strategy.frequency}</span>
          </div>
          <div className="grid two">
            <div>
              <small className="muted">Pilares</small>
              <p>{strategy.pillars.length ? strategy.pillars.join(', ') : 'Nao definidos'}</p>
            </div>
            <div>
              <small className="muted">Campanha</small>
              <p>{strategy.campaigns}</p>
            </div>
          </div>
          <div>
            <small className="muted">Restricoes</small>
            <p>{strategy.restrictions}</p>
          </div>
          {strategy.playbookSlug ? (
            <div>
              <small className="muted">Playbook editorial</small>
              <p>{strategy.playbookSlug} v{strategy.playbookVersion}</p>
              <div className="summary-tags">
                {Object.entries(strategy.funnelDistribution).map(([stage, percent]) => (
                  <span key={stage}>{stage}: {String(percent)}%</span>
                ))}
              </div>
            </div>
          ) : null}
        </article>

        <article className="panel plan-scoreboard">
          <div><strong>{items.length}</strong><span>itens</span></div>
          <div><strong>{generatedAssets.length}</strong><span>previews</span></div>
          <div><strong>{creativeDocuments.length}</strong><span>criativos</span></div>
          <div><strong>{statusLabel(plan.status)}</strong><span>status</span></div>
        </article>
      </section>

      <section className="panel plan-timeline">
        <div className="toolbar">
          <div>
            <small className="muted">Linha editorial</small>
            <h2>Cronograma visual</h2>
          </div>
          <span className="muted">{formatDate(plan.period_start)} a {formatDate(plan.period_end)}</span>
        </div>
        <div className="timeline-rail">
          {items.map((item) => (
            <Link
              className="timeline-marker"
              href={`#item-${item.id}`}
              key={item.id}
              style={{ left: `${itemOffsetPercent(item.scheduled_for, plan.period_start, plan.period_end)}%` }}
              title={item.title}
            >
              <span />
              <strong>{new Date(item.scheduled_for ?? plan.period_start).getDate()}</strong>
            </Link>
          ))}
        </div>
        <div className="timeline-list">
          {items.map((item) => (
            <Link href={`#item-${item.id}`} key={item.id}>
              <strong>{formatDate(item.scheduled_for)}</strong>
              <span>{item.title}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid two" style={{ marginTop: 18 }}>
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
              Direcao visual
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
          <h2>Resumo operacional</h2>
          <div>
            <small className="muted">Status atual</small>
            <p style={{ color: statusColor(plan.status), fontWeight: 700 }}>{statusLabel(plan.status)}</p>
          </div>
          <div>
            <small className="muted">Objetivo</small>
            <p>{strategy.objective}</p>
          </div>
          <div>
            <small className="muted">Canais e frequencia</small>
            <p>{strategy.channels.join(', ') || 'Sem canais'} - {strategy.frequency}</p>
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
                <small className="muted">{formatDate(item.scheduled_for)} · {itemField(item, 'channel')} · {itemField(item, 'format')}</small>
                <h2 style={{ margin: '6px 0' }}>{item.title}</h2>
              </div>
              <span style={{ color: statusColor(item.status), fontWeight: 700 }}>{statusLabel(item.status)}</span>
            </div>
            <div className="grid two">
              <div>
                <small className="muted">Resumo do item</small>
                <div className="item-copy-summary">
                  <p><strong>Funil:</strong> {jsonValue(item.copy_json?.funnel_stage)} · <strong>Pilar:</strong> {jsonValue(item.copy_json?.editorial_pillar)} · <strong>Intencao:</strong> {jsonValue(item.copy_json?.commercial_intent)}</p>
                  <p><strong>Headline:</strong> {jsonValue(item.copy_json?.headline || item.copy_json?.hook)}</p>
                  <p><strong>Ideia central:</strong> {jsonValue(item.copy_json?.central_idea)}</p>
                  <p><strong>Hook:</strong> {jsonValue(item.copy_json?.hook)}</p>
                  <p><strong>Legenda:</strong> {jsonValue(item.copy_json?.caption)}</p>
                  <p><strong>CTA:</strong> {jsonValue(item.copy_json?.cta)}</p>
                  <p><strong>Direcao visual:</strong> {itemField(item, 'template_id')}</p>
                  {stringList(item.copy_json?.compliance_notes).length ? (
                    <p><strong>Compliance:</strong> {stringList(item.copy_json?.compliance_notes).join(' | ')}</p>
                  ) : null}
                </div>
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
                  <small className="muted">Preview e editor</small>
                  <p className="muted" style={{ margin: '4px 0 0' }}>Gere PNG/JPG ou transforme este item em documento visual editavel.</p>
                </div>
                <div className="client-actions">
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
                  <form action={createCreativeDocumentFromItem.bind(null, plan.id, item.id)} style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
                    <label style={{ minWidth: 180 }}>
                      Direcao visual
                      <input name="template_id" defaultValue={String(item.template_id || item.copy_json?.template_id || 'paper-editorial-01')} />
                    </label>
                    <button type="submit">Criar criativo editavel</button>
                  </form>
                </div>
              </div>
              <div className="grid two">
                {(documentsByItem[item.id] ?? []).map((document) => (
                  <article className="card" key={document.id}>
                    <small className="muted">{document.template_ref} - {statusLabel(document.status)}</small>
                    <strong>{document.title}</strong>
                    <Link className="button secondary" href={`/editor/${document.id}`} style={{ marginTop: 10 }}>Abrir no editor</Link>
                  </article>
                ))}
              </div>
              <div className="grid two">
                {(assetsByItem[item.id] ?? []).map((asset) => (
                  <article className="card" id={`asset-${asset.id}`} key={asset.id}>
                    <div className="asset-preview">
                      {asset.signedUrl ? <img alt="Preview gerado" src={asset.signedUrl} /> : <span className="muted">{statusLabel(asset.status)}</span>}
                    </div>
                    <strong>{asset.mime_type?.includes('jpeg') ? 'Preview JPG' : asset.mime_type?.includes('png') ? 'Preview PNG' : 'Preview'}</strong>
                    {isDemoMode() && demoCreativeDocuments.find((document) => document.generated_asset_id === asset.id) ? (
                      <Link className="button secondary" href={`/editor/${demoCreativeDocuments.find((document) => document.generated_asset_id === asset.id)!.id}`} style={{ margin: '10px 0' }}>
                        Abrir no editor
                      </Link>
                    ) : null}
                    <p className="muted">Status: {statusLabel(asset.status)}</p>
                    <div className="item-copy-summary">
                      <p><strong>Direcao visual:</strong> {jsonValue(asset.render_payload_json?.template_id)}</p>
                      <p><strong>Arquivo:</strong> {jsonValue(asset.render_payload_json?.output_format).toUpperCase()}</p>
                    </div>
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
