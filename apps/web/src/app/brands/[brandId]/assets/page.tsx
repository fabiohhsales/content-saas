import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getCurrentWorkspace } from '@/lib/auth';
import { uploadBrandAsset } from '../../actions';

export default async function BrandAssetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const [{ brandId }, queryParams] = await Promise.all([params, searchParams]);
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

  const signedAssets = await Promise.all((assets ?? []).map(async (asset) => {
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
        <Link className="button secondary" href={`/brands/${brand.id}`}>Voltar</Link>
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
            <p className="muted">{asset.category} · {Math.round(asset.size_bytes / 1024)} KB</p>
          </article>
        ))}
        {signedAssets.length === 0 ? <p className="muted">Nenhum asset encontrado.</p> : null}
      </section>
    </AppShell>
  );
}
