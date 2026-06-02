import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getCurrentWorkspace } from '@/lib/auth';
import { demoCreativeDocuments, isDemoMode } from '@/lib/demo';

type CreativeDocumentRow = {
  id: string;
  title: string;
  brand_id: string;
  content_item_id: string | null;
  generated_asset_id: string | null;
  template_ref: string;
  status: string;
  document_json?: Record<string, any>;
  metadata?: Record<string, unknown>;
  updated_at?: string;
  brands?: { name?: string | null } | null;
};

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    editing: 'Em edicao',
    ready_for_approval: 'Pronto para aprovacao',
    approved: 'Aprovado',
    archived: 'Arquivado',
  };
  return labels[status] ?? status;
}

function statusColor(status: string) {
  if (status === 'approved') return '#0f766e';
  if (status === 'ready_for_approval') return '#b54708';
  if (status === 'archived') return '#b42318';
  return '#344054';
}

function formatDate(value?: string) {
  if (!value) return 'Sem atualizacao';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function countEditableElements(documentJson?: Record<string, any>) {
  const slides = Array.isArray(documentJson?.slides) ? documentJson.slides : [];
  return slides.reduce((total: number, slide: any) => {
    const elements = Array.isArray(slide?.elements) ? slide.elements : [];
    return total + elements.filter((element: any) => !element.locked).length;
  }, 0);
}

export default async function EditorIndexPage() {
  const { supabase, membership } = await getCurrentWorkspace();
  if (!membership) redirect('/onboarding');

  let documents: CreativeDocumentRow[] = [];

  if (isDemoMode()) {
    documents = demoCreativeDocuments as CreativeDocumentRow[];
  } else {
    const { data } = await supabase
      .from('creative_documents')
      .select('id, title, brand_id, content_item_id, generated_asset_id, template_ref, status, document_json, metadata, updated_at, brands(name)')
      .eq('workspace_id', membership.workspace_id)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false });

    documents = (data ?? []) as CreativeDocumentRow[];
  }

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <h1>Editor assistido</h1>
          <p className="muted">Revise criativos gerados, troque logos/imagens em placeholders e prepare novas versoes para aprovacao.</p>
        </div>
        <Link className="button secondary" href="/templates">Biblioteca de templates</Link>
      </div>

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="grid two">
          <div>
            <small className="muted">Escopo do MVP</small>
            <h2>Edicao guiada por template</h2>
            <p className="muted">O designer edita campos e assets permitidos pelo contrato, preservando memoria de marca e consistencia visual.</p>
          </div>
          <div>
            <small className="muted">Bibliotecas conectadas</small>
            <h2>Marca, workspace e global</h2>
            <p className="muted">A tela de documento ja cruza placeholders com assets aprovados e elementos globais reutilizaveis.</p>
          </div>
        </div>
      </section>

      <section className="grid two">
        {documents.map((document) => (
          <Link className="card" href={`/editor/${document.id}`} key={document.id}>
            <small className="muted">{document.brands?.name ?? 'Marca'} · {document.template_ref}</small>
            <h2>{document.title}</h2>
            <p style={{ color: statusColor(document.status), fontWeight: 700 }}>{statusLabel(document.status)}</p>
            <p className="muted">
              {Array.isArray(document.document_json?.slides) ? document.document_json.slides.length : 0} slide(s) ·{' '}
              {countEditableElements(document.document_json)} elementos editaveis
            </p>
            <small className="muted">Atualizado em {formatDate(document.updated_at)}</small>
          </Link>
        ))}
        {documents.length === 0 ? <p className="muted">Nenhum documento editavel criado ainda.</p> : null}
      </section>
    </AppShell>
  );
}
