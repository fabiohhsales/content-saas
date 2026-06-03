import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOutFromApp } from '@/app/brands/actions';
import { isDemoMode } from '@/lib/demo';

export function AppShell({ children }: { children: ReactNode }) {
  const demo = isDemoMode();
  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brandmark" href="/">Content SaaS</Link>
        <nav className="nav">
          {demo ? <span>Demo mode</span> : null}
          <Link href="/clients">Clientes</Link>
          <Link href="/pipeline">Pipeline</Link>
          <Link href="/plans">Cronograma</Link>
          <Link href="/editor">Editor</Link>
          <Link href="/approvals">Aprovacao</Link>
          <Link href="/brand-design">Brand Design</Link>
          <Link href="/jobs">Jobs</Link>
          <Link href="/settings/members">Membros</Link>
          <form action={signOutFromApp}>
            <button className="secondary" type="submit">Sair</button>
          </form>
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
