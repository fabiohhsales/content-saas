import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getCurrentWorkspace } from '@/lib/auth';
import { getDemoTemplate, isDemoMode } from '@/lib/demo';

type TemplateLike = {
  id?: string;
  workspace_id?: string | null;
  template_id: string;
  name: string;
  type: string;
  recommended_use?: string | null;
  schema_json: {
    schema_version?: number;
    fields?: Array<{ key: string; label: string; max_chars: number; required: boolean; type?: string }>;
    asset_slots?: Record<string, unknown>;
  };
  render_contract_json?: Record<string, unknown>;
};

function jsonPreview(value: unknown) {
  if (!value) return '-';
  return JSON.stringify(value, null, 2);
}

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    carrossel: 'Carrossel',
    post_unico: 'Post unico',
    stories: 'Stories',
    reels: 'Reels',
    institucional: 'Institucional',
  };
  return labels[type] ?? type;
}

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const { supabase, membership } = await getCurrentWorkspace();
  if (!membership) redirect('/onboarding');

  let template: TemplateLike | null = null;

  if (isDemoMode()) {
    template = getDemoTemplate(templateId);
  } else {
    const { data } = await supabase
      .from('templates')
      .select('id, workspace_id, template_id, name, type, schema_json, render_contract_json, metadata')
      .eq('template_id', templateId)
      .or(`workspace_id.is.null,workspace_id.eq.${membership.workspace_id}`)
      .limit(1)
      .maybeSingle();

    if (data) {
      template = {
        ...(data as any),
        recommended_use: (data as any).metadata?.recommended_use ?? null,
      } as TemplateLike;
    }
  }

  if (!template) notFound();

  const fields = template.schema_json.fields ?? [];
  const assetSlots = template.schema_json.asset_slots ?? {};

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <h1>{template.name}</h1>
          <p className="muted">{template.template_id} · {typeLabel(template.type)}</p>
        </div>
        <Link className="button secondary" href="/templates">Voltar para templates</Link>
      </div>

      <section className="grid two" style={{ marginBottom: 18 }}>
        <article className="panel">
          <h2>Uso recomendado</h2>
          <p className="muted">{template.recommended_use ?? 'Sem recomendacao cadastrada.'}</p>
          <p><strong>Schema version:</strong> {template.schema_json.schema_version ?? 1}</p>
        </article>

        <article className="panel">
          <h2>Contrato de render</h2>
          <pre>{jsonPreview(template.render_contract_json ?? { schema_version: 1, endpoint: '/render' })}</pre>
        </article>
      </section>

      <section className="panel" style={{ marginBottom: 18 }}>
        <h2>Campos</h2>
        <div className="grid">
          {fields.map((field) => (
            <article className="card" key={field.key}>
              <div className="toolbar" style={{ marginBottom: 0 }}>
                <div>
                  <strong>{field.label}</strong>
                  <p className="muted" style={{ margin: '4px 0 0' }}>{field.key}</p>
                </div>
                <small className="muted">{field.required ? 'Obrigatorio' : 'Opcional'} · max {field.max_chars}</small>
              </div>
            </article>
          ))}
          {fields.length === 0 ? <p className="muted">Nenhum campo cadastrado.</p> : null}
        </div>
      </section>

      <section className="panel">
        <h2>Slots de assets</h2>
        <pre>{jsonPreview(assetSlots)}</pre>
      </section>
    </AppShell>
  );
}
