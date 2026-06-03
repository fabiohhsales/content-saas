import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getCurrentWorkspace } from '@/lib/auth';

export default async function HomePage() {
  const { membership } = await getCurrentWorkspace();
  if (!membership) redirect('/onboarding');

  return (
    <AppShell>
      <section className="hero-panel">
        <div>
          <small className="muted">Content SaaS</small>
          <h1>Operacao de conteudo orientada a clientes</h1>
          <p className="muted">Cadastre o cliente, defina identidade, suba logos/assets/templates, planeje estrategia e avance para geracao, editor e aprovacao.</p>
        </div>
        <div className="client-actions">
          <Link className="button" href="/clients">Abrir clientes</Link>
          <Link className="button secondary" href="/plans">Cronogramas</Link>
          <Link className="button secondary" href="/editor">Editor</Link>
        </div>
      </section>
    </AppShell>
  );
}
