import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CreativeDocumentJsonSchema, type CreativeDocumentJson } from '@content-saas/contracts';
import { AppShell } from '@/components/app-shell';
import { getCurrentWorkspace } from '@/lib/auth';
import {
  demoAssets,
  demoGlobalAssets,
  getDemoCreativeDocument,
  getDemoCreativeVersions,
  getDemoTemplate,
  getDemoTemplatePlaceholders,
  isDemoMode,
} from '@/lib/demo';

type CreativeDocumentRow = {
  id: string;
  title: string;
  workspace_id: string;
  brand_id: string;
  content_item_id: string | null;
  generated_asset_id: string | null;
  template_ref: string;
  status: string;
  document_json: Record<string, any>;
  metadata?: Record<string, any>;
  updated_at?: string;
  brands?: { name?: string | null } | null;
};

type AssetRow = {
  id: string;
  category: string;
  status: string;
  file_name: string;
  mime_type: string;
  storage_bucket?: string;
  storage_path?: string;
  metadata?: Record<string, any>;
  signedUrl?: string | null;
};

type PlaceholderRow = {
  id?: string;
  template_ref: string;
  placeholder_key: string;
  kind: string;
  role: string;
  required: boolean;
  constraints_json?: Record<string, any>;
};

type VersionRow = {
  id: string;
  version: number;
  status: string;
  change_summary: string | null;
  created_at: string;
};

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    editing: 'Em edicao',
    ready_for_approval: 'Pronto para aprovacao',
    approved: 'Aprovado',
    archived: 'Arquivado',
    submitted: 'Enviado',
  };
  return labels[status] ?? status;
}

function formatDate(value?: string) {
  if (!value) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function assetLabel(asset?: AssetRow) {
  if (!asset) return 'Sem asset aplicado';
  return `${asset.file_name} · ${asset.category}`;
}

function styleNumber(value: unknown, fallback: number) {
  return typeof value === 'number' ? value : fallback;
}

function CanvasPreview({ document, assetsById }: { document: CreativeDocumentJson; assetsById: Record<string, AssetRow> }) {
  const slide = document.slides[0]!;
  const canvas = document.canvas;
  const backgroundAsset = slide.background.asset_id ? assetsById[slide.background.asset_id] : null;

  return (
    <div
      className="creative-canvas"
      style={{
        aspectRatio: `${canvas.width} / ${canvas.height}`,
        background: slide.background.color ?? document.tokens.background_color ?? '#f7f7f4',
      }}
    >
      {backgroundAsset?.signedUrl ? <img className="creative-background" alt="" src={backgroundAsset.signedUrl} /> : null}
      {slide.elements.filter((element) => element.visible).map((element) => {
        const asset = element.asset_id ? assetsById[element.asset_id] : undefined;
        const baseStyle = {
          left: `${(element.x / canvas.width) * 100}%`,
          top: `${(element.y / canvas.height) * 100}%`,
          width: `${(element.width / canvas.width) * 100}%`,
          height: `${(element.height / canvas.height) * 100}%`,
          transform: `rotate(${element.rotation}deg)`,
        };

        if (element.type === 'image') {
          return (
            <div className="creative-element image" style={baseStyle} key={element.id}>
              {asset?.signedUrl ? <img alt={asset.file_name} src={asset.signedUrl} /> : <span>{element.placeholder ?? element.role}</span>}
            </div>
          );
        }

        if (element.type === 'shape') {
          return <div className="creative-element shape" style={{ ...baseStyle, background: String(element.style.color ?? '#d0d5dd') }} key={element.id} />;
        }

        return (
          <div
            className="creative-element text"
            style={{
              ...baseStyle,
              color: String(element.style.color ?? document.tokens.text_color ?? '#1f2933'),
              fontSize: `${Math.max(14, styleNumber(element.style.font_size, 32) * 0.44)}px`,
              fontWeight: Number(element.style.font_weight ?? 400),
            }}
            key={element.id}
          >
            {element.text}
          </div>
        );
      })}
    </div>
  );
}

export default async function EditorDetailPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  const { supabase, membership } = await getCurrentWorkspace();
  if (!membership) redirect('/onboarding');

  let documentRow: CreativeDocumentRow | null = null;
  let brandAssets: AssetRow[] = [];
  let globalAssets: AssetRow[] = [];
  let placeholders: PlaceholderRow[] = [];
  let versions: VersionRow[] = [];

  if (isDemoMode()) {
    documentRow = getDemoCreativeDocument(documentId) as CreativeDocumentRow;
    brandAssets = demoAssets.filter((asset) => asset.status === 'ready') as AssetRow[];
    globalAssets = demoGlobalAssets.filter((asset) => asset.status === 'ready') as AssetRow[];
    placeholders = getDemoTemplatePlaceholders(documentRow.template_ref) as PlaceholderRow[];
    versions = getDemoCreativeVersions(documentRow.id) as VersionRow[];
  } else {
    const { data } = await supabase
      .from('creative_documents')
      .select('id, title, workspace_id, brand_id, content_item_id, generated_asset_id, template_ref, status, document_json, metadata, updated_at, brands(name)')
      .eq('id', documentId)
      .eq('workspace_id', membership.workspace_id)
      .maybeSingle();

    documentRow = data as CreativeDocumentRow | null;
    if (!documentRow) notFound();

    const [{ data: brandAssetRows }, { data: globalAssetRows }, { data: placeholderRows }, { data: versionRows }] = await Promise.all([
      supabase
        .from('brand_assets')
        .select('id, category, status, file_name, mime_type, storage_bucket, storage_path, metadata')
        .eq('workspace_id', membership.workspace_id)
        .eq('brand_id', documentRow.brand_id)
        .eq('status', 'ready')
        .order('created_at', { ascending: false }),
      supabase
        .from('global_assets')
        .select('id, category, status, file_name, mime_type, storage_bucket, storage_path, metadata')
        .or(`workspace_id.is.null,workspace_id.eq.${membership.workspace_id}`)
        .eq('status', 'ready')
        .order('created_at', { ascending: false }),
      supabase
        .from('template_placeholders')
        .select('id, template_ref, placeholder_key, kind, role, required, constraints_json')
        .eq('template_ref', documentRow.template_ref)
        .or(`workspace_id.is.null,workspace_id.eq.${membership.workspace_id}`),
      supabase
        .from('creative_versions')
        .select('id, version, status, change_summary, created_at')
        .eq('workspace_id', membership.workspace_id)
        .eq('creative_document_id', documentRow.id)
        .order('version', { ascending: false }),
    ]);

    brandAssets = (brandAssetRows ?? []) as AssetRow[];
    globalAssets = (globalAssetRows ?? []) as AssetRow[];
    placeholders = (placeholderRows ?? []) as PlaceholderRow[];
    versions = (versionRows ?? []) as VersionRow[];

    const signAsset = async (asset: AssetRow) => {
      if (!asset.storage_bucket || !asset.storage_path || !asset.mime_type.startsWith('image/')) return asset;
      const { data: signed } = await supabase.storage.from(asset.storage_bucket).createSignedUrl(asset.storage_path, 60 * 10);
      return { ...asset, signedUrl: signed?.signedUrl ?? null };
    };

    brandAssets = await Promise.all(brandAssets.map(signAsset));
    globalAssets = await Promise.all(globalAssets.map(signAsset));
  }

  if (!documentRow) notFound();

  const parsedDocument = CreativeDocumentJsonSchema.safeParse(documentRow.document_json);
  if (!parsedDocument.success) {
    return (
      <AppShell>
        <div className="toolbar">
          <div>
            <h1>{documentRow.title}</h1>
            <p className="muted">Documento criativo com contrato invalido.</p>
          </div>
          <Link className="button secondary" href="/editor">Voltar</Link>
        </div>
        <pre>{JSON.stringify(parsedDocument.error.format(), null, 2)}</pre>
      </AppShell>
    );
  }

  const creativeDocument = parsedDocument.data;
  const template = getDemoTemplate(documentRow.template_ref);
  const allAssets = [...brandAssets, ...globalAssets];
  const assetsById = allAssets.reduce<Record<string, AssetRow>>((acc, asset) => {
    acc[asset.id] = asset;
    return acc;
  }, {});
  const editableElements = creativeDocument.slides.flatMap((slide) => slide.elements.map((element) => ({ ...element, slide_id: slide.id })));

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <small className="muted">{documentRow.brands?.name ?? 'Marca'} · {documentRow.template_ref} · {statusLabel(documentRow.status)}</small>
          <h1>{documentRow.title}</h1>
          <p className="muted">Editor assistido para revisar texto, placeholders, logos, imagens e versoes antes da aprovacao.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="button secondary" href="/editor">Voltar</Link>
          {documentRow.content_item_id ? <Link className="button secondary" href={`/plans/demo-plan-aurora-2026-06#item-${documentRow.content_item_id}`}>Ver item</Link> : null}
          <Link className="button" href="/approvals?target_type=creative_document">Enviar para aprovacao</Link>
        </div>
      </div>

      <section className="editor-layout">
        <aside className="panel grid">
          <div>
            <small className="muted">Template</small>
            <h2>{template.name}</h2>
            <p className="muted">{template.recommended_use}</p>
          </div>
          <div>
            <small className="muted">Placeholders criticos</small>
            <div className="grid" style={{ marginTop: 8 }}>
              {placeholders.map((placeholder) => (
                <article className="mini-card" key={placeholder.placeholder_key}>
                  <strong>{placeholder.placeholder_key}</strong>
                  <p className="muted">{placeholder.kind} · {placeholder.role} · {placeholder.required ? 'obrigatorio' : 'opcional'}</p>
                </article>
              ))}
              {placeholders.length === 0 ? <p className="muted">Sem placeholders cadastrados para este template.</p> : null}
            </div>
          </div>
          <div>
            <small className="muted">Historico</small>
            <div className="grid" style={{ marginTop: 8 }}>
              {versions.map((version) => (
                <article className="mini-card" key={version.id}>
                  <strong>v{version.version} · {statusLabel(version.status)}</strong>
                  <p className="muted">{version.change_summary ?? 'Sem resumo.'}</p>
                  <small className="muted">{formatDate(version.created_at)}</small>
                </article>
              ))}
              {versions.length === 0 ? <p className="muted">Nenhuma versao salva ainda.</p> : null}
            </div>
          </div>
        </aside>

        <main className="grid">
          <section className="panel">
            <CanvasPreview document={creativeDocument} assetsById={assetsById} />
          </section>

          <section className="panel">
            <div className="toolbar" style={{ marginBottom: 10 }}>
              <div>
                <h2>Elementos editaveis</h2>
                <p className="muted">Campos que o designer deve revisar antes de renderizar a versao final.</p>
              </div>
              <span className="muted">{creativeDocument.slides.length} slide(s)</span>
            </div>
            <div className="grid two">
              {editableElements.map((element) => (
                <article className="card" key={`${element.slide_id}-${element.id}`}>
                  <small className="muted">{element.slide_id} · {element.placeholder ?? element.role}</small>
                  <h3>{element.role}</h3>
                  {element.type === 'text' ? (
                    <label>
                      Texto
                      <textarea defaultValue={element.text ?? ''} />
                    </label>
                  ) : (
                    <div>
                      <p className="muted">Asset aplicado: {assetLabel(element.asset_id ? assetsById[element.asset_id] : undefined)}</p>
                      <select defaultValue={element.asset_id ?? ''}>
                        <option value="">Sem asset</option>
                        {allAssets.map((asset) => (
                          <option value={asset.id} key={asset.id}>{asset.file_name} · {asset.category}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside className="panel grid">
          <div>
            <small className="muted">Assets da marca</small>
            <h2>Biblioteca Aurora</h2>
          </div>
          <div className="grid">
            {brandAssets.map((asset) => (
              <article className="mini-card asset-row" key={asset.id}>
                {asset.signedUrl ? <img alt={asset.file_name} src={asset.signedUrl} /> : null}
                <div>
                  <strong>{asset.file_name}</strong>
                  <p className="muted">{asset.category} · {asset.mime_type}</p>
                </div>
              </article>
            ))}
          </div>
          <div>
            <small className="muted">Biblioteca global</small>
            <h2>Elementos reutilizaveis</h2>
          </div>
          <div className="grid">
            {globalAssets.map((asset) => (
              <article className="mini-card asset-row" key={asset.id}>
                {asset.signedUrl ? <img alt={asset.file_name} src={asset.signedUrl} /> : null}
                <div>
                  <strong>{asset.file_name}</strong>
                  <p className="muted">{asset.category} · {(asset.metadata?.tags ?? []).join(', ')}</p>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>Contrato JSON preservado</h2>
        <pre>{JSON.stringify(creativeDocument, null, 2)}</pre>
      </section>
    </AppShell>
  );
}
