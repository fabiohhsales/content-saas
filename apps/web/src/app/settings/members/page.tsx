import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { AppShell } from '@/components/app-shell';
import { getCurrentWorkspace } from '@/lib/auth';
import { demoInvitations, demoMembers, isDemoMode } from '@/lib/demo';
import {
  addWorkspaceMember,
  inviteWorkspaceMember,
  removeWorkspaceMember,
  revokeWorkspaceInvitation,
  updateWorkspaceMemberRole,
} from './actions';

type MemberLike = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  email?: string | null;
  created_at: string;
  updated_at: string;
};

type InvitationLike = {
  id: string;
  workspace_id: string;
  email: string;
  role: string;
  status: string;
  invite_token: string;
  expires_at: string;
  created_at: string;
};

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    owner: 'Owner',
    admin: 'Admin',
    editor: 'Editor',
    viewer: 'Viewer',
  };
  return labels[role] ?? role;
}

function roleDescription(role: string) {
  const descriptions: Record<string, string> = {
    owner: 'Controle total do workspace e dos membros.',
    admin: 'Gerencia workspace, membros e operacao editorial.',
    editor: 'Cria marcas, assets, planos, jobs e aprovacoes.',
    viewer: 'Consulta informacoes sem alterar operacao.',
  };
  return descriptions[role] ?? 'Papel customizado.';
}

function roleColor(role: string) {
  if (role === 'owner') return '#0f766e';
  if (role === 'admin') return '#115e59';
  if (role === 'editor') return '#344054';
  return '#667085';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

async function getEmailsByUserId(userIds: string[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey || userIds.length === 0) return new Map<string, string>();

  const admin = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return new Map<string, string>();

  return new Map(
    data.users
      .filter((user) => userIds.includes(user.id))
      .map((user) => [user.id, user.email ?? '']),
  );
}

export default async function MembersPage() {
  const { supabase, membership } = await getCurrentWorkspace();
  if (!membership) redirect('/onboarding');

  const workspace = Array.isArray(membership.workspaces) ? membership.workspaces[0] : membership.workspaces;
  const canManage = ['owner', 'admin'].includes(membership.role);
  let members: MemberLike[] = [];
  let invitations: InvitationLike[] = [];

  if (isDemoMode()) {
    members = demoMembers;
    invitations = demoInvitations;
  } else {
    const [{ data }, { data: inviteRows }] = await Promise.all([
      supabase
        .from('members')
        .select('id, workspace_id, user_id, role, created_at, updated_at')
        .eq('workspace_id', membership.workspace_id)
        .order('created_at', { ascending: true }),
      supabase
        .from('workspace_invitations')
        .select('id, workspace_id, email, role, status, invite_token, expires_at, created_at')
        .eq('workspace_id', membership.workspace_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ]);

    const rows = (data ?? []) as MemberLike[];
    const emailsByUserId = await getEmailsByUserId(rows.map((member) => member.user_id));
    members = rows.map((member) => ({
      ...member,
      email: emailsByUserId.get(member.user_id) ?? null,
    }));
    invitations = (inviteRows ?? []) as InvitationLike[];
  }

  const summary = members.reduce<Record<string, number>>((acc, member) => {
    acc[member.role] = (acc[member.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <small className="muted">{workspace?.name ?? 'Workspace'}</small>
          <h1>Membros</h1>
          <p className="muted">Controle acesso ao workspace sem misturar dados entre clientes.</p>
        </div>
        <Link className="button secondary" href="/brands">Voltar para marcas</Link>
      </div>

      <section className="grid two" style={{ marginBottom: 18 }}>
        {['owner', 'admin', 'editor', 'viewer'].map((role) => (
          <article className="card" key={role}>
            <small className="muted">{roleLabel(role)}</small>
            <h2 style={{ color: roleColor(role), margin: '8px 0 4px' }}>{summary[role] ?? 0}</h2>
            <p className="muted">{roleDescription(role)}</p>
          </article>
        ))}
      </section>

      <section className="grid two">
        <form action={inviteWorkspaceMember} className="panel grid">
          <h2>Convidar por e-mail</h2>
          {isDemoMode() ? <p className="muted">No demo, a action apenas simula o convite.</p> : null}
          {!canManage ? <p className="muted">Seu papel atual nao permite convidar membros.</p> : null}
          <label>
            E-mail
            <input name="email" type="email" required placeholder="pessoa@empresa.com" disabled={!canManage} />
          </label>
          <label>
            Papel
            <select name="role" defaultValue="viewer" disabled={!canManage}>
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>
          <button type="submit" disabled={!canManage}>Criar convite</button>
        </form>

        <form action={addWorkspaceMember} className="panel grid">
          <h2>Adicionar membro</h2>
          {isDemoMode() ? <p className="muted">No demo, a action apenas simula a atualizacao.</p> : null}
          {!canManage ? <p className="muted">Seu papel atual nao permite gerenciar membros.</p> : null}
          <label>
            User ID Supabase
            <input
              name="user_id"
              required
              pattern="[0-9a-fA-F-]{36}"
              placeholder="00000000-0000-4000-8000-000000000000"
              disabled={!canManage}
            />
          </label>
          <label>
            Papel
            <select name="role" defaultValue="viewer" disabled={!canManage}>
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>
          <button type="submit" disabled={!canManage}>Adicionar</button>
        </form>
      </section>

      <section className="grid two" style={{ marginTop: 18 }}>
        <div className="panel grid">
          <h2>Modelo de permissao</h2>
          <p className="muted">
            Owner/admin gerenciam workspace e membros. Editor opera marcas, assets, conteudo,
            jobs e aprovacoes. Viewer consulta a operacao sem escrever.
          </p>
          <pre>{JSON.stringify({
            schema_version: 1,
            workspace_id: membership.workspace_id,
            current_role: membership.role,
            can_manage_members: canManage,
            invitation_flow: '/invite/[token]',
          }, null, 2)}</pre>
        </div>

        <div className="panel grid">
          <h2>Convites pendentes</h2>
          {invitations.map((invitation) => (
            <article className="card" key={invitation.id}>
              <div className="toolbar" style={{ marginBottom: 8 }}>
                <div>
                  <small className="muted">Expira em {formatDate(invitation.expires_at)}</small>
                  <h3 style={{ margin: '6px 0' }}>{invitation.email}</h3>
                  <p className="muted">Papel: {roleLabel(invitation.role)}</p>
                </div>
                <span style={{ color: roleColor(invitation.role), fontWeight: 700 }}>{invitation.status}</span>
              </div>
              <pre>{JSON.stringify({
                schema_version: 1,
                invite_url: `/invite/${invitation.invite_token}`,
              }, null, 2)}</pre>
              <form action={revokeWorkspaceInvitation.bind(null, invitation.id)}>
                <button className="secondary" type="submit" disabled={!canManage}>Revogar convite</button>
              </form>
            </article>
          ))}
          {invitations.length === 0 ? <p className="muted">Nenhum convite pendente.</p> : null}
        </div>
      </section>

      <section className="grid" style={{ marginTop: 18 }}>
        {members.map((member) => (
          <article className="card" key={member.id}>
            <div className="toolbar" style={{ marginBottom: 8 }}>
              <div>
                <small className="muted">Entrou em {formatDate(member.created_at)}</small>
                <h2 style={{ margin: '6px 0' }}>{member.email || member.user_id}</h2>
                <p className="muted">{member.email ? member.user_id : 'E-mail indisponivel sem service role no server.'}</p>
              </div>
              <span style={{ color: roleColor(member.role), fontWeight: 700 }}>{roleLabel(member.role)}</span>
            </div>

            <div className="grid two">
              <form action={updateWorkspaceMemberRole.bind(null, member.id)} className="grid">
                <label>
                  Papel
                  <select name="role" defaultValue={member.role} disabled={!canManage}>
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </label>
                <button className="secondary" type="submit" disabled={!canManage}>Salvar papel</button>
              </form>

              <div className="grid">
                <small className="muted">Ultima alteracao: {formatDate(member.updated_at)}</small>
                <form action={removeWorkspaceMember.bind(null, member.id)}>
                  <button className="secondary" type="submit" disabled={!canManage || member.role === 'owner'}>
                    Remover membro
                  </button>
                </form>
              </div>
            </div>
          </article>
        ))}
        {members.length === 0 ? <p className="muted">Nenhum membro encontrado.</p> : null}
      </section>
    </AppShell>
  );
}
