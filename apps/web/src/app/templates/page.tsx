import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getCurrentWorkspace } from '@/lib/auth';
import { demoTemplates, isDemoMode } from '@/lib/demo';

type TemplateLike = {
  id?: string;
  workspace_id?: string | null;
  template_id: string;
  name: string;
  type: string;
  recommended_use?: string | null;
  status?: string | null;
  schema_json: {
    schema_version?: number;
    fields?: Array<{ key: string; label: string; max_chars: number; required: boolean; type?: string }>;
    asset_slots?: Record<string, unknown>;
  };
  render_contract_json?: Record<string, unknown>;
};

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

function renderSupport(template: TemplateLike) {
  const contract = template.render_contract_json ?? {};
  const formats = Array.isArray(contract.output_formats) ? contract.output_formats.join(', ') : 'png';
  return `${formats}${contract.supports_design_tokens ? ' · tokens' : ''}${contract.supports_decorators ? ' · decorators' : ''}`;
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const filters = await searchParams;
  const { supabase, membership } = await getCurrentWorkspace();
  if (!membership) redirect('/onboarding');

  let templates: TemplateLike[] = [];
  if (isDemoMode()) {
    templates = demoTemplates;
  } else {
    const { data } = await supabase
      .from('templates')
      .select('id, workspace_id, template_id, name, type, schema_json, render_contract_json, metadata')
      .or(`workspace_id.is.null,workspace_id.eq.${membership.workspace_id}`)
      .order('name', { ascending: true });

    templates = (data ?? []).map((row: any) => ({
      ...row,
      recommended_use: row.metadata?.recommended_use ?? null,
      status: row.metadata?.status ?? 'available',
    })) as TemplateLike[];
  }

  const filteredTemplates = filters.type
    ? templates.filter((template) => template.type === filters.type)
    : templates;

  const types = Array.from(new Set(templates.map((template) => template.type))).sort();

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <h1>Biblioteca de templates</h1>
          <p className="muted">Explore formatos, campos obrigatorios e contratos de render antes de gerar previews.</p>
        </div>
        <Link className="button secondary" href="/brands">Voltar para marcas</Link>
      </div>

      <section className="panel" style={{ marginBottom: 18 }}>
        <form className="grid two" action="/templates">
          <label>
            Tipo
            <select name="type" defaultValue={filters.type ?? ''}>
              <option value="">Todos</option>
              {types.map((type) => (
                <option value={type} key={type}>{typeLabel(type)}</option>
              ))}
            </select>
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
            <button type="submit">Filtrar</button>
            <Link className="button secondary" href="/templates">Limpar</Link>
          </div>
        </form>
      </section>

      <section className="grid two">
        {filteredTemplates.map((template) => (
          <Link className="card" href={`/templates/${template.template_id}`} key={template.template_id}>
            <small className="muted">{typeLabel(template.type)}</small>
            <h2>{template.name}</h2>
            <p className="muted">{template.recommended_use ?? 'Template disponivel para testes de render.'}</p>
            <p>
              <strong>{template.schema_json.fields?.length ?? 0}</strong> campos ·{' '}
              <strong>{Object.keys(template.schema_json.asset_slots ?? {}).length}</strong> slots de asset
            </p>
            <small className="muted">Render: {renderSupport(template)}</small>
          </Link>
        ))}
        {filteredTemplates.length === 0 ? <p className="muted">Nenhum template encontrado para os filtros atuais.</p> : null}
      </section>
    </AppShell>
  );
}
