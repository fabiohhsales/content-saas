import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getCurrentWorkspace } from '@/lib/auth';
import { createBrand } from './actions';

export default async function BrandsPage() {
  const { supabase, membership } = await getCurrentWorkspace();
  if (!membership) redirect('/onboarding');

  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, industry, status, created_at')
    .eq('workspace_id', membership.workspace_id)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <h1>Marcas</h1>
          <p className="muted">Cadastre marcas, organize assets e gere memoria de marca.</p>
        </div>
      </div>

      <section className="grid two">
        <form action={createBrand} className="panel grid">
          <h2>Nova marca</h2>
          <label>
            Nome
            <input name="name" required minLength={2} />
          </label>
          <label>
            Segmento
            <input name="industry" placeholder="Saude, estetica, varejo..." />
          </label>
          <label>
            Posicionamento
            <textarea name="positioning" />
          </label>
          <label>
            Voz
            <textarea name="voice_notes" />
          </label>
          <button type="submit">Criar marca</button>
        </form>

        <div className="grid">
          {(brands ?? []).map((brand) => (
            <Link className="card" href={`/brands/${brand.id}`} key={brand.id}>
              <h3>{brand.name}</h3>
              <p className="muted">{brand.industry || 'Sem segmento definido'}</p>
              <small>Status: {brand.status}</small>
            </Link>
          ))}
          {brands?.length === 0 ? <p className="muted">Nenhuma marca cadastrada ainda.</p> : null}
        </div>
      </section>
    </AppShell>
  );
}
