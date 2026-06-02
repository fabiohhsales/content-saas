import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentWorkspace } from '@/lib/auth';

export default async function HomePage() {
  const { membership } = await getCurrentWorkspace();
  if (!membership) redirect('/onboarding');

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brandmark">Content SaaS</div>
        <nav className="nav">
          <Link href="/brands">Marcas</Link>
        </nav>
      </header>
      <main className="main">
        <div className="toolbar">
          <div>
            <h1>Operacao de conteudo</h1>
            <p className="muted">Workspace pronto. Comece cadastrando marcas e assets.</p>
          </div>
          <Link className="button" href="/brands">Abrir marcas</Link>
        </div>
      </main>
    </div>
  );
}
