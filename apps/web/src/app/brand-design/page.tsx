import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getCurrentWorkspace } from '@/lib/auth';
import { demoAssets, demoBrands, demoTemplates, isDemoMode } from '@/lib/demo';

type BrandRow = {
  id: string;
  name: string;
  industry: string | null;
  metadata?: Record<string, any> | null;
};

function identity(brand: BrandRow) {
  const data = brand.metadata?.identity as Record<string, unknown> | undefined;
  return {
    primary_color: typeof data?.primary_color === 'string' && data.primary_color ? data.primary_color : '#0f766e',
    secondary_color: typeof data?.secondary_color === 'string' && data.secondary_color ? data.secondary_color : '#115e59',
    font_family: typeof data?.font_family === 'string' && data.font_family ? data.font_family : 'Inter',
    visual_notes: typeof data?.visual_notes === 'string' ? data.visual_notes : 'Sem diretriz visual registrada.',
  };
}

export default async function BrandDesignPage() {
  const { supabase, membership } = await getCurrentWorkspace();
  if (!membership) redirect('/onboarding');

  let brands: BrandRow[] = [];
  let templates: Array<{ template_id: string; name: string; type: string; metadata?: Record<string, any> | null }> = [];
  let assets: Array<{ id: string; brand_id: string; file_name: string; category: string; signedUrl?: string | null }> = [];

  if (isDemoMode()) {
    brands = demoBrands as BrandRow[];
    templates = demoTemplates;
    assets = demoAssets;
  } else {
    const [{ data: brandRows }, { data: templateRows }, { data: assetRows }] = await Promise.all([
      supabase
        .from('brands')
        .select('id, name, industry, metadata')
        .eq('workspace_id', membership.workspace_id)
        .neq('status', 'archived')
        .order('name', { ascending: true }),
      supabase
        .from('templates')
        .select('template_id, name, type, metadata')
        .or(`workspace_id.is.null,workspace_id.eq.${membership.workspace_id}`)
        .limit(12),
      supabase
        .from('brand_assets')
        .select('id, brand_id, file_name, category')
        .eq('workspace_id', membership.workspace_id)
        .neq('status', 'archived')
        .limit(12),
    ]);

    brands = (brandRows ?? []) as BrandRow[];
    templates = (templateRows ?? []) as typeof templates;
    assets = (assetRows ?? []) as typeof assets;
  }

  return (
    <AppShell>
      <section className="portfolio-hero compact-hero">
        <div>
          <small className="muted">Brand Design</small>
          <h1>Biblioteca visual</h1>
          <p className="muted">Tokens, assets e modelos aprovados para manter consistencia entre clientes e criativos.</p>
        </div>
        <div className="client-actions">
          <Link className="button" href="/templates">Modelos globais</Link>
          <Link className="button secondary" href="/clients">Clientes</Link>
        </div>
      </section>

      <section className="brand-design-grid">
        <div className="panel brand-token-panel">
          <div>
            <small className="muted">Identidades</small>
            <h2>Tokens por cliente</h2>
          </div>
          <div className="brand-token-list">
            {brands.map((brand) => {
              const brandIdentity = identity(brand);
              return (
                <Link className="brand-token-card" href={`/clients/${brand.id}#identidade`} key={brand.id}>
                  <div className="swatches">
                    <span style={{ background: brandIdentity.primary_color }} />
                    <span style={{ background: brandIdentity.secondary_color }} />
                  </div>
                  <div>
                    <strong>{brand.name}</strong>
                    <small>{brand.industry || 'Segmento nao definido'} · {brandIdentity.font_family}</small>
                    <p>{brandIdentity.visual_notes}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="panel brand-token-panel">
          <div>
            <small className="muted">Assets</small>
            <h2>Banco visual</h2>
          </div>
          <div className="asset-strip">
            {assets.slice(0, 8).map((asset) => (
              <article className="card" key={asset.id}>
                <div className="asset-preview small">
                  {asset.signedUrl ? <img src={asset.signedUrl} alt={asset.file_name} /> : <span>{asset.category}</span>}
                </div>
                <strong>{asset.file_name}</strong>
                <small className="muted">{asset.category}</small>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="panel brand-template-panel">
        <div>
          <small className="muted">Modelos</small>
          <h2>Direcoes visuais reutilizaveis</h2>
        </div>
        <div className="template-minimal-grid">
          {templates.map((template) => (
            <Link className="template-minimal-card" href={`/templates/${template.template_id}`} key={template.template_id}>
              <small>{template.type}</small>
              <strong>{template.name}</strong>
              <p>{template.metadata?.recommended_use ?? template.metadata?.description ?? 'Modelo disponivel para criacao visual.'}</p>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
