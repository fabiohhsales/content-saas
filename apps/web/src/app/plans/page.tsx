import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getCurrentWorkspace } from '@/lib/auth';
import { demoBrands, demoContentItems, demoContentPlans, isDemoMode } from '@/lib/demo';
import { createContentPlan } from './actions';

type PlanLike = {
  id: string;
  brand_id: string;
  title: string;
  period_start: string;
  period_end: string;
  status: string;
  plan_json?: Record<string, unknown>;
  created_at?: string;
  brands?: { name?: string | null } | null;
};

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    generating: 'Gerando',
    awaiting_approval: 'Em aprovacao',
    approved: 'Aprovado',
    archived: 'Arquivado',
  };
  return labels[status] ?? status;
}

function statusColor(status: string) {
  if (status === 'approved') return '#0f766e';
  if (status === 'awaiting_approval') return '#b54708';
  if (status === 'archived') return '#667085';
  return '#344054';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ brand_id?: string; status?: string }>;
}) {
  const filters = await searchParams;
  const { supabase, membership } = await getCurrentWorkspace();
  if (!membership) redirect('/onboarding');

  let brands: Array<{ id: string; name: string }> = [];
  let plans: PlanLike[] = [];

  if (isDemoMode()) {
    brands = demoBrands.map((brand) => ({ id: brand.id, name: brand.name }));
    plans = demoContentPlans.map((plan) => ({
      ...plan,
      brands: { name: demoBrands.find((brand) => brand.id === plan.brand_id)?.name ?? 'Marca demo' },
    }));
  } else {
    const [{ data: brandRows }, { data: planRows }] = await Promise.all([
      supabase
        .from('brands')
        .select('id, name')
        .eq('workspace_id', membership.workspace_id)
        .neq('status', 'archived')
        .order('name', { ascending: true }),
      supabase
        .from('content_plans')
        .select('id, brand_id, title, period_start, period_end, status, plan_json, created_at, brands(name)')
        .eq('workspace_id', membership.workspace_id)
        .neq('status', 'archived')
        .order('period_start', { ascending: false })
        .limit(100),
    ]);

    brands = (brandRows ?? []) as Array<{ id: string; name: string }>;
    plans = (planRows ?? []) as PlanLike[];
  }

  const filteredPlans = plans.filter((plan) => {
    const brandMatches = !filters.brand_id || plan.brand_id === filters.brand_id;
    const statusMatches = !filters.status || plan.status === filters.status;
    return brandMatches && statusMatches;
  });

  const itemCounts = demoContentItems.reduce<Record<string, number>>((acc, item) => {
    if (item.content_plan_id) acc[item.content_plan_id] = (acc[item.content_plan_id] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <h1>Planos de conteudo</h1>
          <p className="muted">Planeje campanhas editoriais por marca, periodo, canal e status de aprovacao.</p>
        </div>
        <Link className="button secondary" href="/approvals?target_type=content_plan">Ver aprovacoes</Link>
      </div>

      <section className="grid two">
        <form action={createContentPlan} className="panel grid">
          <h2>Novo plano</h2>
          {isDemoMode() ? <p className="muted">No demo, este formulario abre o plano exemplo da Clinica Aurora.</p> : null}
          <label>
            Marca
            <select name="brand_id" required defaultValue={brands[0]?.id ?? ''}>
              {brands.map((brand) => (
                <option value={brand.id} key={brand.id}>{brand.name}</option>
              ))}
            </select>
          </label>
          <label>
            Titulo
            <input name="title" required minLength={2} placeholder="Plano editorial Junho/2026" />
          </label>
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
            <textarea name="objective" placeholder="Objetivo editorial, foco comercial, publico ou campanha." />
          </label>
          <button type="submit">Criar plano</button>
        </form>

        <div className="panel grid">
          <h2>Filtros</h2>
          <form className="grid" action="/plans">
            <label>
              Marca
              <select name="brand_id" defaultValue={filters.brand_id ?? ''}>
                <option value="">Todas</option>
                {brands.map((brand) => (
                  <option value={brand.id} key={brand.id}>{brand.name}</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select name="status" defaultValue={filters.status ?? ''}>
                <option value="">Todos</option>
                <option value="draft">Rascunho</option>
                <option value="generating">Gerando</option>
                <option value="awaiting_approval">Em aprovacao</option>
                <option value="approved">Aprovado</option>
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="submit">Filtrar</button>
              <Link className="button secondary" href="/plans">Limpar</Link>
            </div>
          </form>
        </div>
      </section>

      <section className="grid" style={{ marginTop: 18 }}>
        {filteredPlans.map((plan) => (
          <Link className="card" href={`/plans/${plan.id}`} key={plan.id}>
            <div className="toolbar" style={{ marginBottom: 8 }}>
              <div>
                <small className="muted">{plan.brands?.name ?? 'Marca'} · {formatDate(plan.period_start)} a {formatDate(plan.period_end)}</small>
                <h2 style={{ margin: '6px 0' }}>{plan.title}</h2>
              </div>
              <span style={{ color: statusColor(plan.status), fontWeight: 700 }}>{statusLabel(plan.status)}</span>
            </div>
            <p className="muted">{String(plan.plan_json?.objective ?? 'Sem objetivo registrado.')}</p>
            <small>{isDemoMode() ? `${itemCounts[plan.id] ?? 0} itens planejados` : 'Abrir itens planejados'}</small>
          </Link>
        ))}
        {filteredPlans.length === 0 ? <p className="muted">Nenhum plano encontrado para os filtros atuais.</p> : null}
      </section>
    </AppShell>
  );
}
