import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Content SaaS',
  description: 'Automacao de conteudo com IA',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
