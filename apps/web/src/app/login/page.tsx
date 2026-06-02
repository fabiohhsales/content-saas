import { signInWithEmail } from './actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const query = await searchParams;
  return (
    <main className="main">
      <section className="panel" style={{ maxWidth: 520, margin: '10vh auto 0' }}>
        <h1>Entrar</h1>
        <p className="muted">Use seu e-mail para receber um link de acesso.</p>
        {query.sent ? <p>Link enviado. Verifique sua caixa de entrada.</p> : null}
        <form action={signInWithEmail} className="grid">
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
