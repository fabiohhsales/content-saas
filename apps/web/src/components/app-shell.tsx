import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOutFromApp } from '@/app/brands/actions';
import { isDemoMode } from '@/lib/demo';

export function AppShell({ children }: { children: ReactNode }) {
  const demo = isDemoMode();
  const navItems = [
    { href: '/clients', label: 'Clientes' },
    { href: '/pipeline', label: 'Pipeline' },
    { href: '/plans', label: 'Cronograma' },
    { href: '/editor', label: 'Editor' },
    { href: '/approvals', label: 'Aprovacao' },
    { href: '/brand-design', label: 'Brand Design' },
    { href: '/jobs', label: 'Jobs' },
    { href: '/settings/members', label: 'Config' },
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <Link className="brandmark" href="/">Content SaaS</Link>
          {demo ? <span className="demo-pill">Demo mode</span> : null}
        </div>
        <nav className="nav">
          {navItems.map((item) => (
            <Link href={item.href} key={item.href}>{item.label}</Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <form action={signOutFromApp}>
            <button className="secondary" type="submit">Sair</button>
          </form>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <small className="muted">Content automation workspace</small>
            <strong>Operacao de conteudo</strong>
          </div>
          <Link className="button secondary" href="/clients/new">Novo cliente</Link>
        </header>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
