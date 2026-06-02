import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getCurrentWorkspace } from '@/lib/auth';
import { demoAutomationLogs, demoBrands, demoJobRuns, isDemoMode } from '@/lib/demo';

type JobRunLike = {
  id: string;
  brand_id: string | null;
  job_name: string;
  queue_name: string;
  status: string;
  input_json: unknown;
  output_json: unknown;
  error_json: unknown;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

type AutomationLogLike = {
  id: string;
  job_run_id: string | null;
  level: string;
  message: string;
  context_json: unknown;
  created_at: string;
};

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: 'Na fila',
    running: 'Rodando',
    completed: 'Concluido',
    failed: 'Falhou',
  };
  return labels[status] ?? status;
}

function statusColor(status: string) {
  if (status === 'completed') return '#0f766e';
  if (status === 'failed') return '#b42318';
  if (status === 'running') return '#b54708';
  return '#344054';
}

function jsonPreview(value: unknown) {
  if (!value) return '-';
  return JSON.stringify(value, null, 2);
}

function brandName(brandId: string | null) {
  if (!brandId) return 'Sem marca';
  return demoBrands.find((brand) => brand.id === brandId)?.name ?? brandId;
}

export default async function JobsPage() {
  const { supabase, membership } = await getCurrentWorkspace();
  if (!membership) redirect('/onboarding');

  let jobs: JobRunLike[] = [];
  let logs: AutomationLogLike[] = [];

  if (isDemoMode()) {
    jobs = demoJobRuns;
    logs = demoAutomationLogs;
  } else {
    const [{ data: jobRows }, { data: logRows }] = await Promise.all([
      supabase
        .from('job_runs')
        .select('id, brand_id, job_name, queue_name, status, input_json, output_json, error_json, started_at, finished_at, created_at')
        .eq('workspace_id', membership.workspace_id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('automation_logs')
        .select('id, job_run_id, level, message, context_json, created_at')
        .eq('workspace_id', membership.workspace_id)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    jobs = (jobRows ?? []) as JobRunLike[];
    logs = (logRows ?? []) as AutomationLogLike[];
  }

  const summary = jobs.reduce<Record<string, number>>((acc, job) => {
    acc[job.status] = (acc[job.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <h1>Jobs e logs</h1>
          <p className="muted">Acompanhe filas, execucoes assincronas e eventos operacionais do workspace.</p>
        </div>
        <Link className="button secondary" href="/brands">Voltar para marcas</Link>
      </div>

      <section className="grid two" style={{ marginBottom: 18 }}>
        {['queued', 'running', 'completed', 'failed'].map((status) => (
          <article className="card" key={status}>
            <small className="muted">{statusLabel(status)}</small>
            <h2 style={{ margin: '8px 0 0', color: statusColor(status) }}>{summary[status] ?? 0}</h2>
          </article>
        ))}
      </section>

      <section className="panel" style={{ marginBottom: 18 }}>
        <h2>Execucoes recentes</h2>
        <div className="grid">
          {jobs.map((job) => (
            <article className="card" key={job.id}>
              <div className="toolbar" style={{ marginBottom: 8 }}>
                <div>
                  <strong>{job.job_name}</strong>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {job.queue_name} · {brandName(job.brand_id)} · criado {formatDate(job.created_at)}
                  </p>
                </div>
                <span style={{ color: statusColor(job.status), fontWeight: 700 }}>{statusLabel(job.status)}</span>
              </div>
              <div className="grid two">
                <div>
                  <small className="muted">Entrada</small>
                  <pre>{jsonPreview(job.input_json)}</pre>
                </div>
                <div>
                  <small className="muted">{job.error_json ? 'Erro' : 'Saida'}</small>
                  <pre>{jsonPreview(job.error_json ?? job.output_json)}</pre>
                </div>
              </div>
            </article>
          ))}
          {jobs.length === 0 ? <p className="muted">Nenhum job registrado ainda.</p> : null}
        </div>
      </section>

      <section className="panel">
        <h2>Logs de automacao</h2>
        <div className="grid">
          {logs.map((log) => (
            <article className="card" key={log.id}>
              <div className="toolbar" style={{ marginBottom: 8 }}>
                <strong style={{ color: log.level === 'error' ? '#b42318' : '#344054' }}>{log.message}</strong>
                <small className="muted">{formatDate(log.created_at)}</small>
              </div>
              <p className="muted" style={{ marginTop: 0 }}>Job: {log.job_run_id ?? '-'}</p>
              <pre>{jsonPreview(log.context_json)}</pre>
            </article>
          ))}
          {logs.length === 0 ? <p className="muted">Nenhum log registrado ainda.</p> : null}
        </div>
      </section>
    </AppShell>
  );
}
