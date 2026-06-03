import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getCurrentWorkspace } from '@/lib/auth';
import { getDemoAssets, getDemoBrand, isDemoMode } from '@/lib/demo';
import { uploadBrandAsset } from '../../actions';

export default async function BrandAssetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const [{ brandId }, queryParams] = await Promise.all([params, searchParams]);

  if (isDemoMode()) {
    const brand = getDemoBrand(brandId);
    const signedAssets = getDemoAssets(brand.id, queryParams.category);

    return (
      <AppShell>
        <div className="toolbar">
          <div>
            <h1>Biblioteca de assets</h1>
            <p className="muted">{brand.name}</p>
          </div>
          <Link className="button secondary" href={`/clients/${brand.id}`}>Voltar ao cliente</Link>
        </div>

        <form action={uploadBrandAsset.bind(null, brand.id)} className="panel grid" style={{ marginBottom: 18 }}>
          <h2>Novo asset</h2>
          <p className="muted">No modo demo, o upload e apenas simulado.</p>
          <div className="grid two">
            <label>
              Categoria
              <select name="category" defaultValue="photo">
                <option value="logo">Logo</option>
                <option value="photo">Foto</option>
                <option value="font">Fonte</option>
                <option value="reference">Referencia visual</option>
                <option value="document">Documento</option>
                <option value="other">Outro</option>
              </select>
            </label>
            <label>
              Arquivo
              <input name="file" type="file" />
            </label>
          </div>
          <div className="grid two">
            <label>
              Papel no design
              <select name="asset_role" defaultValue="primary">
                <option value="primary">Principal</option>
                <option value="secondary">Secundario</option>
                <option value="cover">Capa/fundo</option>
                <option value="avatar">Avatar/retrato</option>
                <option value="support">Apoio visual</option>
              </select>
            </label>
            <label>
              Variante
              <input name="variant" placeholder="horizontal, negativo, story..." />
            </label>
          </div>
          <label>
            Regras de uso
            <textarea name="usage_notes" placeholder="Tags, recorte permitido, fundo ideal, restricoes..." />
          </label>
          <button type="submit">Simular envio</button>
        </form>

        <div className="nav" style={{ marginBottom: 16 }}>
          {['all', 'logo', 'photo', 'font', 'reference', 'document', 'other'].map((category) => (
            <Link key={category} href={category === 'all' ? `/brands/${brand.id}/assets` : `/brands/${brand.id}/assets?category=${category}`}>
              {category}
            </Link>
          ))}
        </div>

        <section className="grid two">
          {signedAssets.map((asset: any) => (
            <article className="card" key={asset.id}>
              <div className="asset-preview">
                {asset.signedUrl && asset.mime_type.startsWith('image/')
                  ? <img src={asset.signedUrl} alt={asset.file_name} />
                  : <span className="muted">{asset.mime_type}</span>}
              </div>
              <strong>{asset.file_name}</strong>
              <p className="muted">{asset.category} - {asset.metadata?.asset_role ?? 'sem papel'} - {Math.round(asset.size_bytes / 1024)} KB</p>
            </article>
          ))}
          {signedAssets.length === 0 ? <p className="muted">Nenhum asset encontrado.</p> : null}
        </section>
      </AppShell>
    );
  }

  const { supabase, membership } = await getCurrentWorkspace();
  if (!membership) redirect('/onboarding');

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name')
    .eq('id', brandId)
    .eq('workspace_id', membership.workspace_id)
    .single();

  if (!brand) notFound();

  let query = supabase
    .from('brand_assets')
    .select('*')
    .eq('brand_id', brand.id)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });

  if (queryParams.category) query = query.eq('category', queryParams.category);
  const { data: assets } = await query;

  const signedAssets = await Promise.all((assets ?? []).map(async (asset: any) => {
    const { data } = await supabase.storage
      .from(asset.storage_bucket)
      .createSignedUrl(asset.storage_path, 60 * 10);
    return { ...asset, signedUrl: data?.signedUrl ?? null };
  }));

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <h1>Biblioteca de assets</h1>
          <p className="muted">{brand.name}</p>
        </div>
        <Link className="button secondary" href={`/clients/${brand.id}`}>Voltar ao cliente</Link>
      </div>

      <form action={uploadBrandAsset.bind(null, brand.id)} className="panel grid" style={{ marginBottom: 18 }}>
        <h2>Novo asset</h2>
        <div className="grid two">
          <label>
            Categoria
            <select name="category" defaultValue="photo">
              <option value="logo">Logo</option>
              <option value="photo">Foto</option>
              <option value="font">Fonte</option>
              <option value="reference">Referencia visual</option>
              <option value="document">Documento</option>
              <option value="other">Outro</option>
            </select>
          </label>
          <label>
            Arquivo
            <input name="file" type="file" required />
          </label>
        </div>
        <div className="grid two">
          <label>
            Papel no design
            <select name="asset_role" defaultValue="primary">
              <option value="primary">Principal</option>
              <option value="secondary">Secundario</option>
              <option value="cover">Capa/fundo</option>
              <option value="avatar">Avatar/retrato</option>
              <option value="support">Apoio visual</option>
            </select>
          </label>
          <label>
            Variante
            <input name="variant" placeholder="horizontal, negativo, story..." />
          </label>
        </div>
        <div className="grid two">
          <label>
            Orientacao
            <select name="orientation" defaultValue="">
              <option value="">Nao definida</option>
              <option value="square">Quadrada</option>
              <option value="portrait">Vertical</option>
              <option value="landscape">Horizontal</option>
              <option value="transparent">Transparente</option>
            </select>
          </label>
          <label>
            Tags
            <input name="tags" placeholder="premium, medico, fundo claro" />
          </label>
        </div>
        <label>
          Regras de uso
          <textarea name="usage_notes" placeholder="Quando usar, quando evitar, recorte permitido, fundo ideal..." />
        </label>
        <button type="submit">Enviar</button>
      </form>

      <div className="nav" style={{ marginBottom: 16 }}>
        {['all', 'logo', 'photo', 'font', 'reference', 'document', 'other'].map((category) => (
          <Link key={category} href={category === 'all' ? `/brands/${brand.id}/assets` : `/brands/${brand.id}/assets?category=${category}`}>
            {category}
          </Link>
        ))}
      </div>

      <section className="grid two">
        {signedAssets.map((asset) => (
          <article className="card" key={asset.id}>
            <div className="asset-preview">
              {asset.signedUrl && asset.mime_type.startsWith('image/')
                ? <img src={asset.signedUrl} alt={asset.file_name} />
                : <span className="muted">{asset.mime_type}</span>}
            </div>
            <strong>{asset.file_name}</strong>
            <p className="muted">{asset.category} - {asset.metadata?.asset_role ?? 'sem papel'} - {Math.round(asset.size_bytes / 1024)} KB</p>
          </article>
        ))}
        {signedAssets.length === 0 ? <p className="muted">Nenhum asset encontrado.</p> : null}
      </section>
    </AppShell>
  );
}
