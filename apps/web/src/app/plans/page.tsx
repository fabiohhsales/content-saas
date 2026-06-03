import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SocialIconRow } from '@/components/social-icons';
import { getCurrentWorkspace } from '@/lib/auth';
import { demoBrands, demoContentItems, demoContentPlans, isDemoMode } from '@/lib/demo';
import { createContentPlan, requestGeneratedContentPlan } from './actions';

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

function planObjective(plan: PlanLike) {
  const strategy = plan.plan_json?.strategy as Record<string, unknown> | undefined;
  return String(strategy?.objective || plan.plan_json?.objective || 'Objetivo ainda nao registrado.');
}

function planChannels(plan: PlanLike) {
  const strategy = plan.plan_json?.strategy as Record<string, unknown> | undefined;
  const channels = Array.isArray(strategy?.channels)
    ? strategy.channels
    : Array.isArray(plan.plan_json?.channels)
      ? plan.plan_json.channels
      : [];
  return channels.map(String);
}

function planPillars(plan: PlanLike) {
  const strategy = plan.plan_json?.strategy as Record<string, unknown> | undefined;
  const pillars = Array.isArray(strategy?.pillars)
    ? strategy.pillars
    : Array.isArray(plan.plan_json?.pillars)
      ? plan.plan_json.pillars
      : [];
  return pillars.map(String);
}

function durationDays(start: string, end: string) {
  const startTime = new Date(`${start}T00:00:00`).getTime();
  const endTime = new Date(`${end}T00:00:00`).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 0;
  return Math.max(1, Math.round((endTime - startTime) / 86400000) + 1);
}

function calendarMonthDays(value: string) {
  const base = new Date(`${value}T00:00:00`);
  const year = base.getFullYear();
  const month = base.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const offset = new Date(year, month, 1).getDay();

  return [
    ...Array.from({ length: offset }, (_, index) => ({ key: `blank-${index}`, day: null as number | null })),
    ...Array.from({ length: totalDays }, (_, index) => ({ key: `day-${index + 1}`, day: index + 1 })),
  ];
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
  const boardStats = filteredPlans.reduce(
    (acc, plan) => {
      acc.items += itemCounts[plan.id] ?? 0;
      if (plan.status === 'awaiting_approval') acc.awaiting += 1;
      if (plan.status === 'approved') acc.approved += 1;
      if (plan.status === 'draft' || plan.status === 'generating') acc.inProgress += 1;
      return acc;
    },
    { items: 0, awaiting: 0, approved: 0, inProgress: 0 },
  );
  const scheduledItems = demoContentItems
    .filter((item) => filteredPlans.some((plan) => plan.id === item.content_plan_id))
    .sort((a, b) => new Date(a.scheduled_for ?? '').getTime() - new Date(b.scheduled_for ?? '').getTime());
  const reviewTodos = scheduledItems.filter((item) => ['awaiting_approval', 'changes_requested', 'draft'].includes(item.status)).slice(0, 5);
  const calendarBase = filteredPlans[0]?.period_start ?? '2026-06-01';
  const calendarDays = calendarMonthDays(calendarBase);
  const calendarItemsByDay = scheduledItems.reduce<Record<number, typeof scheduledItems>>((acc, item) => {
    if (!item.scheduled_for) return acc;
    const day = new Date(`${item.scheduled_for}T00:00:00`).getDate();
    acc[day] = [...(acc[day] ?? []), item];
    return acc;
  }, {});

  return (
    <AppShell>
      <section className="plan-board-hero">
        <div>
          <small className="muted">Planejamento editorial</small>
          <h1>Planos de conteudo</h1>
          <p>Visao de cronogramas por cliente, com foco em periodo, objetivo, canais, itens planejados e aprovacao.</p>
        </div>
        <div className="client-actions">
          <Link className="button" href="#novo-plano">Novo plano</Link>
          <Link className="button secondary" href="/approvals?target_type=content_plan">Ver aprovacoes</Link>
        </div>
      </section>

      <section className="plan-board-metrics">
        <div><strong>{filteredPlans.length}</strong><span>cronogramas</span></div>
        <div><strong>{boardStats.items}</strong><span>itens planejados</span></div>
        <div><strong>{boardStats.awaiting}</strong><span>em aprovacao</span></div>
        <div><strong>{boardStats.approved}</strong><span>aprovados</span></div>
        <div><strong>{boardStats.inProgress}</strong><span>em construcao</span></div>
      </section>

      <section className="panel plan-board-filters">
        <form className="grid two" action="/plans">
          <label>
            Cliente
            <select name="brand_id" defaultValue={filters.brand_id ?? ''}>
              <option value="">Todos</option>
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
          <div className="client-actions">
            <button type="submit">Filtrar</button>
            <Link className="button secondary" href="/plans">Limpar</Link>
          </div>
        </form>
      </section>

      <section className="calendar-workspace">
        <div className="panel calendar-panel">
          <div>
            <small className="muted">Cronograma</small>
            <h2>Calendario de publicacoes</h2>
          </div>
          <div className="calendar-month-grid">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((weekday) => (
              <span className="calendar-weekday" key={weekday}>{weekday}</span>
            ))}
            {calendarDays.map((entry) => {
              if (!entry.day) return <span className="calendar-empty" key={entry.key} />;
              const dayItems = calendarItemsByDay[entry.day] ?? [];
              const firstItem = dayItems[0];
              if (!firstItem) {
                return (
                  <span className="calendar-date-card" key={entry.key}>
                    <strong>{entry.day}</strong>
                    <small>Sem publicacao</small>
                  </span>
                );
              }
              return (
                <Link className="calendar-date-card has-items" href={`/plans/${firstItem.content_plan_id}#item-${firstItem.id}`} key={entry.key}>
                  <strong>{entry.day}</strong>
                  <span>{firstItem.title}</span>
                  <SocialIconRow channels={[String(firstItem.channel ?? 'instagram')]} />
                  {dayItems.length > 1 ? <small>+{dayItems.length - 1} item</small> : null}
                </Link>
              );
            })}
            {scheduledItems.length === 0 ? <p className="muted">Sem datas programadas para os filtros atuais.</p> : null}
          </div>
        </div>
        <aside className="panel review-todo-panel">
          <small className="muted">To-do de revisao</small>
          <h2>Pendencias</h2>
          <div className="review-todo-list">
            {reviewTodos.map((item) => (
              <Link href={`/plans/${item.content_plan_id}#item-${item.id}`} key={item.id}>
                <strong>{item.title}</strong>
                <span>{item.status === 'changes_requested' ? 'Ajustes solicitados' : item.status === 'awaiting_approval' ? 'Aguardando aprovacao' : 'Revisar briefing'}</span>
              </Link>
            ))}
            {reviewTodos.length === 0 ? <p className="muted">Nenhuma revisao pendente.</p> : null}
          </div>
        </aside>
      </section>

      <section className="plan-board-grid">
        <div className="panel plan-list-panel">
          <div>
            <small className="muted">Carteira de cronogramas</small>
            <h2>Planos ativos</h2>
          </div>
          <div className="plan-card-list">
            {filteredPlans.map((plan) => {
              const channels = planChannels(plan);
              const pillars = planPillars(plan);
              const itemCount = itemCounts[plan.id] ?? 0;
              return (
                <Link className="plan-board-card" href={`/plans/${plan.id}`} key={plan.id}>
                  <div className="plan-card-main">
                    <small>{plan.brands?.name ?? 'Cliente'}</small>
                    <h2>{plan.title}</h2>
                    <p>{planObjective(plan)}</p>
                    <div className="summary-tags">
                      <SocialIconRow channels={channels} />
                      {channels.slice(0, 3).map((channel) => <span key={channel}>{channel}</span>)}
                      {pillars.slice(0, 2).map((pillar) => <span key={pillar}>{pillar}</span>)}
                    </div>
                  </div>
                  <div className="plan-card-side">
                    <span style={{ color: statusColor(plan.status) }}>{statusLabel(plan.status)}</span>
                    <strong>{itemCount}</strong>
                    <small>itens</small>
                    <div className="mini-gantt" aria-hidden="true">
                      <i style={{ width: `${Math.min(100, Math.max(18, itemCount * 32))}%` }} />
                    </div>
                    <small>{formatDate(plan.period_start)} a {formatDate(plan.period_end)}</small>
                    <small>{durationDays(plan.period_start, plan.period_end)} dias</small>
                  </div>
                </Link>
              );
            })}
            {filteredPlans.length === 0 ? <p className="muted">Nenhum plano encontrado para os filtros atuais.</p> : null}
          </div>
        </div>

        <div id="novo-plano" className="plan-create-column">
          <form action={createContentPlan} className="panel grid">
            <h2>Novo plano</h2>
            {isDemoMode() ? <p className="muted">No demo, este formulario abre o plano exemplo da Clinica Aurora.</p> : null}
            <label>
              Cliente
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
            <div className="grid two">
              <label>
                Canais
                <input name="channels" placeholder="Instagram, LinkedIn..." />
              </label>
              <label>
                Frequencia
                <input name="frequency" placeholder="3 posts/semana" />
              </label>
            </div>
            <label>
              Pilares
              <input name="pillars" placeholder="educacao, prova social, conversao" />
            </label>
            <button type="submit">Criar plano</button>
          </form>

          <div className="panel grid">
            <h2>Gerar com IA</h2>
            <form action={requestGeneratedContentPlan} className="grid">
              <label>
                Cliente
                <select name="brand_id" required defaultValue={brands[0]?.id ?? ''}>
                  {brands.map((brand) => (
                    <option value={brand.id} key={brand.id}>{brand.name}</option>
                  ))}
                </select>
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
                <textarea name="objective" placeholder="Ex: gerar autoridade e leads qualificados no mes." />
              </label>
              <div className="grid two">
                <label>
                  Canais
                  <input name="channels" placeholder="Instagram, LinkedIn..." />
                </label>
                <label>
                  Frequencia
                  <input name="frequency" placeholder="3 posts/semana" />
                </label>
              </div>
              <label>
                Pilares
                <input name="pillars" placeholder="educacao, bastidores, conversao" />
              </label>
              <label>
                Campanhas e restricoes
                <textarea name="campaigns" placeholder="Ofertas, datas, restricoes legais ou temas obrigatorios." />
              </label>
              <button type="submit">Gerar plano</button>
            </form>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
