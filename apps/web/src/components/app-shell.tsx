import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOutFromApp } from '@/app/brands/actions';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brandmark" href="/">Content SaaS</Link>
        <nav className="nav">
          <Link href="/brands">Marcas</Link>
          <form action={signOutFromApp}>
            <button className="secondary" type="submit">Sair</button>
          </form>
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
