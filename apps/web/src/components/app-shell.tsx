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
          <Link href="/brands">Marcas</Link>
          <Link href="/plans">Planos</Link>
          <Link href="/templates">Templates</Link>
          <Link href="/approvals">Aprovacoes</Link>
          <Link href="/jobs">Jobs</Link>
          <form action={signOutFromApp}>
            <button className="secondary" type="submit">Sair</button>
          </form>
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
