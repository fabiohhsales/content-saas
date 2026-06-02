create type public.workspace_invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role public.workspace_role not null default 'viewer',
  status public.workspace_invitation_status not null default 'pending',
  invite_token text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  metadata jsonb not null default '{"schema_version":1}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_invitations_email_not_empty check (length(trim(email)) > 3)
);

create unique index workspace_invitations_pending_email_idx
on public.workspace_invitations(workspace_id, lower(email))
where status = 'pending';

create index workspace_invitations_workspace_status_idx
on public.workspace_invitations(workspace_id, status, created_at desc);

create trigger workspace_invitations_set_updated_at
before update on public.workspace_invitations
for each row execute function public.set_updated_at();

alter table public.workspace_invitations enable row level security;

create policy "workspace admins can manage invitations"
on public.workspace_invitations for all
using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

create policy "invitees can read pending invitations"
on public.workspace_invitations for select
using (
  status = 'pending'
  and expires_at > now()
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

create or replace function public.accept_workspace_invitation(invite_token_input text)
returns table (
  workspace_id uuid,
  member_id uuid,
  role public.workspace_role
)
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.workspace_invitations%rowtype;
  inserted_member public.members%rowtype;
  requester_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  requester_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  select *
    into invitation
  from public.workspace_invitations
  where invite_token = invite_token_input
  for update;

  if invitation.id is null then
    raise exception 'Invitation not found';
  end if;

  if invitation.status <> 'pending' then
    raise exception 'Invitation is not pending';
  end if;

  if invitation.expires_at <= now() then
    update public.workspace_invitations
      set status = 'expired'
    where id = invitation.id;
    raise exception 'Invitation expired';
  end if;

  if lower(invitation.email) <> requester_email then
    raise exception 'Invitation email does not match authenticated user';
  end if;

  insert into public.members (workspace_id, user_id, role)
  values (invitation.workspace_id, auth.uid(), invitation.role)
  on conflict (workspace_id, user_id)
  do update set role = excluded.role
  returning * into inserted_member;

  update public.workspace_invitations
    set status = 'accepted',
        accepted_by = auth.uid(),
        accepted_at = now()
  where id = invitation.id;

  return query
    select inserted_member.workspace_id, inserted_member.id, inserted_member.role;
end;
$$;
