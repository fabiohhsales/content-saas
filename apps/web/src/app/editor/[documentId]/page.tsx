import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CreativeDocumentJsonSchema } from '@content-saas/contracts';
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
import { requestCreativeDocumentRender, submitCreativeDocumentApproval } from '../actions';
import { EditorClient } from './editor-client';

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
            <p className="muted">Nao foi possivel abrir este criativo. Gere uma nova versao ou revise o template usado.</p>
          </div>
          <Link className="button secondary" href="/editor">Voltar</Link>
        </div>
        <section className="panel">
          <h2>Como resolver</h2>
          <p className="muted">Volte ao cronograma, gere novamente o criativo ou escolha outro modelo visual para continuar a revisao.</p>
        </section>
      </AppShell>
    );
  }

  const creativeDocument = parsedDocument.data;
  const template = getDemoTemplate(documentRow.template_ref);

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <small className="muted">{documentRow.brands?.name ?? 'Marca'} - {documentRow.template_ref} - {statusLabel(documentRow.status)}</small>
          <h1>{documentRow.title}</h1>
          <p className="muted">Editor assistido para revisar texto, placeholders, logos, imagens e versoes antes da aprovacao.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="button secondary" href="/editor">Voltar</Link>
          {documentRow.content_item_id ? <Link className="button secondary" href={`/plans/demo-plan-aurora-2026-06#item-${documentRow.content_item_id}`}>Ver item</Link> : null}
          <form action={submitCreativeDocumentApproval.bind(null, documentRow.id)}>
            <button type="submit">Enviar para aprovacao</button>
          </form>
          <form action={requestCreativeDocumentRender.bind(null, documentRow.id)} style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
            <label style={{ minWidth: 110 }}>
              Formato
              <select name="output_format" defaultValue="png">
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
              </select>
            </label>
            <button className="secondary" type="submit">Render final</button>
          </form>
        </div>
      </div>

      <EditorClient
        documentId={documentRow.id}
        document={creativeDocument}
        template={template ?? {}}
        brandAssets={brandAssets}
        globalAssets={globalAssets}
        placeholders={placeholders}
        versions={versions}
      />
    </AppShell>
  );
}
