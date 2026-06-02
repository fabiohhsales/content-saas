import { createWorkspace } from './actions';
import { requireUser } from '@/lib/auth';

export default async function OnboardingPage() {
  await requireUser();

  return (
    <main className="main">
      <section className="panel" style={{ maxWidth: 640, margin: '8vh auto 0' }}>
        <h1>Criar workspace</h1>
        <p className="muted">Este workspace sera o limite multi-tenant para marcas, assets, memorias e jobs.</p>
        <form action={createWorkspace} className="grid">
          <label>
            Nome do workspace
            <input name="name" required minLength={2} placeholder="Health Grow Studio" />
          </label>
          <button type="submit">Criar workspace</button>
        </form>
      </section>
    </main>
  );
}
