import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getCurrentWorkspace } from '@/lib/auth';
import { getDemoAssets, getDemoBrand, isDemoMode } from '@/lib/demo';
import { completeBrandOnboarding, updateBrand, uploadBrandAsset } from '../../actions';

export default async function BrandOnboardingPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;

  if (isDemoMode()) {
    const brand = getDemoBrand(brandId);
    const count = getDemoAssets(brand.id).length;

    return (
      <AppShell>
        <div className="toolbar">
          <div>
            <h1>Onboarding de marca</h1>
            <p className="muted">{brand.name}</p>
          </div>
          <Link className="button secondary" href={`/brands/${brand.id}`}>Voltar</Link>
        </div>

        <section className="grid two">
          <form action={updateBrand.bind(null, brand.id)} className="panel grid">
            <h2>1. Base estrategica</h2>
            <label>
              Nome
              <input name="name" required defaultValue={brand.name} />
            </label>
            <label>
              Segmento
              <input name="industry" defaultValue={brand.industry ?? ''} />
            </label>
            <label>
              Posicionamento
              <textarea name="positioning" defaultValue={brand.positioning ?? ''} />
            </label>
            <label>
              Voz e tom
              <textarea name="voice_notes" defaultValue={brand.voice_notes ?? ''} />
            </label>
            <button type="submit">Salvar base demo</button>
          </form>

          <form action={uploadBrandAsset.bind(null, brand.id)} className="panel grid">
            <h2>2. Upload estruturado</h2>
            <label>
              Categoria
              <select name="category" defaultValue="reference">
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
            <button type="submit">Simular envio</button>
            <p className="muted">{count} assets demo cadastrados para esta marca.</p>
          </form>
        </section>

        <section className="panel" style={{ marginTop: 16 }}>
          <h2>3. Revisao</h2>
          <p className="muted">No demo, a conclusão leva para a biblioteca de assets.</p>
          <form action={completeBrandOnboarding.bind(null, brand.id)}>
            <button type="submit">Concluir onboarding</button>
          </form>
        </section>
      </AppShell>
    );
  }

  const { supabase, membership } = await getCurrentWorkspace();
  if (!membership) redirect('/onboarding');

  const { data: brand } = await supabase
    .from('brands')
    .select('*')
    .eq('id', brandId)
    .eq('workspace_id', membership.workspace_id)
    .single();

  if (!brand) notFound();

  const { count } = await supabase
    .from('brand_assets')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brand.id);

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <h1>Onboarding de marca</h1>
          <p className="muted">{brand.name}</p>
        </div>
        <Link className="button secondary" href={`/brands/${brand.id}`}>Voltar</Link>
      </div>

      <section className="grid two">
        <form action={updateBrand.bind(null, brand.id)} className="panel grid">
          <h2>1. Base estrategica</h2>
          <label>
            Nome
            <input name="name" required defaultValue={brand.name} />
          </label>
          <label>
            Segmento
            <input name="industry" defaultValue={brand.industry ?? ''} />
          </label>
          <label>
            Posicionamento
            <textarea name="positioning" defaultValue={brand.positioning ?? ''} />
          </label>
          <label>
            Voz e tom
            <textarea name="voice_notes" defaultValue={brand.voice_notes ?? ''} />
          </label>
          <button type="submit">Salvar base</button>
        </form>

        <form action={uploadBrandAsset.bind(null, brand.id)} className="panel grid">
          <h2>2. Upload estruturado</h2>
          <label>
            Categoria
            <select name="category" defaultValue="reference">
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
          <button type="submit">Enviar asset</button>
          <p className="muted">{count ?? 0} assets cadastrados para esta marca.</p>
        </form>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>3. Revisao</h2>
        <p className="muted">Ao concluir, a marca fica ativa e pronta para gerar memoria de marca.</p>
        <form action={completeBrandOnboarding.bind(null, brand.id)}>
          <button type="submit">Concluir onboarding</button>
        </form>
      </section>
    </AppShell>
  );
}
