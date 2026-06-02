import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getCurrentWorkspace } from '@/lib/auth';
import { getDemoBrand, getDemoMemories, isDemoMode } from '@/lib/demo';
import { archiveBrand, requestBrandMemory, updateBrand } from '../actions';

export default async function BrandDetailPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;

  if (isDemoMode()) {
    const brand = getDemoBrand(brandId);
    const memories = getDemoMemories(brand.id);

    return (
      <AppShell>
        <div className="toolbar">
          <div>
            <h1>{brand.name}</h1>
            <p className="muted">{brand.industry || 'Marca sem segmento definido'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="button secondary" href={`/brands/${brand.id}/onboarding`}>Wizard</Link>
            <Link className="button secondary" href={`/brands/${brand.id}/assets`}>Assets</Link>
            <form action={requestBrandMemory.bind(null, brand.id)}>
              <button type="submit">Gerar memoria</button>
            </form>
          </div>
        </div>

        <section className="grid two">
          <form action={updateBrand.bind(null, brand.id)} className="panel grid">
            <h2>Dados da marca</h2>
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
              Voz
              <textarea name="voice_notes" defaultValue={brand.voice_notes ?? ''} />
            </label>
            <button type="submit">Salvar demo</button>
          </form>

          <div className="panel">
            <h2>Memorias geradas</h2>
            <div className="grid">
              {memories.map((memory: any) => (
                <article className="card" key={memory.id}>
                  <strong>Versao {memory.version}</strong>
                  <p>{memory.memory_json.summary}</p>
                  <small>Status: {memory.status} · confiança {Math.round(memory.memory_json.confidence * 100)}%</small>
                </article>
              ))}
            </div>
          </div>
        </section>

        <form action={archiveBrand.bind(null, brand.id)} style={{ marginTop: 24 }}>
          <button className="secondary" type="submit">Arquivar marca</button>
        </form>
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

  const { data: memories } = await supabase
    .from('brand_memories')
    .select('id, version, status, memory_json, created_at')
    .eq('brand_id', brand.id)
    .order('version', { ascending: false })
    .limit(5);

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <h1>{brand.name}</h1>
          <p className="muted">{brand.industry || 'Marca sem segmento definido'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="button secondary" href={`/brands/${brand.id}/onboarding`}>Wizard</Link>
          <Link className="button secondary" href={`/brands/${brand.id}/assets`}>Assets</Link>
          <form action={requestBrandMemory.bind(null, brand.id)}>
            <button type="submit">Gerar memoria</button>
          </form>
        </div>
      </div>

      <section className="grid two">
        <form action={updateBrand.bind(null, brand.id)} className="panel grid">
          <h2>Dados da marca</h2>
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
            Voz
            <textarea name="voice_notes" defaultValue={brand.voice_notes ?? ''} />
          </label>
          <button type="submit">Salvar</button>
        </form>

        <div className="panel">
          <h2>Memorias geradas</h2>
          <div className="grid">
            {(memories ?? []).map((memory: any) => (
              <article className="card" key={memory.id}>
                <strong>Versao {memory.version}</strong>
                <p>{(memory.memory_json as { summary?: string }).summary}</p>
                <small>Status: {memory.status}</small>
              </article>
            ))}
            {memories?.length === 0 ? <p className="muted">Nenhuma memoria gerada ainda.</p> : null}
          </div>
        </div>
      </section>

      <form action={archiveBrand.bind(null, brand.id)} style={{ marginTop: 24 }}>
        <button className="secondary" type="submit">Arquivar marca</button>
      </form>
    </AppShell>
  );
}
