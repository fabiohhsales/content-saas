import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentWorkspace } from '@/lib/auth';
import { demoInvitations, isDemoMode } from '@/lib/demo';
import { acceptWorkspaceInvitation } from '@/app/settings/members/actions';

type InvitationLike = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  workspaces?: { name?: string | null } | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { supabase, user } = await getCurrentWorkspace();

  let invitation: InvitationLike | null = null;

  if (isDemoMode()) {
    invitation = demoInvitations.find((entry) => entry.invite_token === token) ?? demoInvitations[0]!;
  } else {
    const { data } = await supabase
      .from('workspace_invitations')
      .select('id, email, role, status, expires_at, workspaces(name)')
      .eq('invite_token', token)
      .maybeSingle();

    invitation = data as InvitationLike | null;
  }

  if (!invitation) redirect('/login');

  return (
    <main className="main">
      <section className="panel grid" style={{ maxWidth: 680, margin: '40px auto' }}>
        <div>
          <small className="muted">Convite de workspace</small>
          <h1>{invitation.workspaces?.name ?? 'Content SaaS'}</h1>
          <p className="muted">
            Este convite foi emitido para {invitation.email} com papel {invitation.role}.
            Ele expira em {formatDate(invitation.expires_at)}.
          </p>
          <p className="muted">Usuario autenticado: {user.email ?? user.id}</p>
        </div>

        {invitation.status === 'pending' ? (
          <form action={acceptWorkspaceInvitation.bind(null, token)}>
            <button type="submit">Aceitar convite</button>
          </form>
        ) : (
          <p className="muted">Este convite esta com status {invitation.status}.</p>
        )}

        <Link className="button secondary" href="/login">Trocar login</Link>
      </section>
    </main>
  );
}
