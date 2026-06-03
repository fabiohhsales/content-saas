import Link from 'next/link';
import { isDemoMode } from '@/lib/demo';
import { signInWithEmail } from './actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const query = await searchParams;
  const demo = isDemoMode();
  return (
    <main className="main">
      <section className="panel" style={{ maxWidth: 520, margin: '10vh auto 0' }}>
        <h1>Entrar</h1>
        <p className="muted">
          {demo ? 'Modo demo ativo. Entre no produto com dados fictícios.' : 'Use seu e-mail para receber um link de acesso.'}
        </p>
        {demo ? <Link className="button" href="/clients">Abrir demo</Link> : null}
        {query.sent ? <p>Link enviado. Verifique sua caixa de entrada.</p> : null}
        <form action={signInWithEmail} className="grid" style={{ marginTop: 18 }}>
          <label>
            E-mail
            <input name="email" type="email" required placeholder="voce@empresa.com" />
          </label>
          <button type="submit">Enviar link</button>
        </form>
      </section>
    </main>
  );
}
