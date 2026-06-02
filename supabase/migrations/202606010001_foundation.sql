create extension if not exists pgcrypto;

create type public.workspace_role as enum ('owner', 'admin', 'editor', 'viewer');
create type public.brand_status as enum ('draft', 'active', 'archived');
create type public.asset_category as enum ('logo', 'photo', 'font', 'reference', 'document', 'other');
create type public.asset_status as enum ('uploaded', 'processing', 'ready', 'failed', 'archived');
create type public.plan_status as enum ('draft', 'generating', 'awaiting_approval', 'approved', 'archived');
create type public.content_item_status as enum ('draft', 'generating', 'awaiting_approval', 'changes_requested', 'approved', 'published', 'cancelled');
create type public.approval_status as enum ('pending', 'approved', 'changes_requested', 'rejected');
create type public.job_run_status as enum ('queued', 'running', 'completed', 'failed');
create type public.log_level as enum ('debug', 'info', 'warn', 'error');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members m
    where m.workspace_id = target_workspace_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_workspace_role(target_workspace_id uuid, allowed_roles public.workspace_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members m
    where m.workspace_id = target_workspace_id
      and m.user_id = auth.uid()
      and m.role = any(allowed_roles)
  );
$$;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  status public.brand_status not null default 'draft',
  industry text,
  positioning text,
  voice_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  category public.asset_category not null,
  status public.asset_status not null default 'uploaded',
  storage_bucket text not null default 'brand-assets',
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table public.brand_memories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  memory_json jsonb not null check ((memory_json->>'schema_version') is not null),
  generated_by_job_run_id uuid,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, version)
);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  template_id text not null,
  name text not null,
  type text not null check (type in ('carrossel', 'post_unico', 'stories', 'reels', 'institucional')),
  schema_json jsonb not null check ((schema_json->>'schema_version') is not null),
  render_contract_json jsonb not null default '{"schema_version":1}'::jsonb check ((render_contract_json->>'schema_version') is not null),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, template_id)
);

create table public.brand_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  template_id uuid not null references public.templates(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, template_id)
);

create table public.content_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  title text not null,
  period_start date not null,
  period_end date not null,
  status public.plan_status not null default 'draft',
  plan_json jsonb not null default '{"schema_version":1}'::jsonb check ((plan_json->>'schema_version') is not null),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  content_plan_id uuid references public.content_plans(id) on delete set null,
  title text not null,
  status public.content_item_status not null default 'draft',
  scheduled_for timestamptz,
  copy_json jsonb not null default '{"schema_version":1}'::jsonb check ((copy_json->>'schema_version') is not null),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.generated_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  content_item_id uuid references public.content_items(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'rendering', 'ready', 'failed', 'archived')),
  storage_bucket text not null default 'brand-assets',
  storage_path text,
  mime_type text,
  render_payload_json jsonb not null default '{"schema_version":1}'::jsonb check ((render_payload_json->>'schema_version') is not null),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  target_type text not null check (target_type in ('brand_memory', 'content_plan', 'content_item', 'generated_asset')),
  target_id uuid not null,
  status public.approval_status not null default 'pending',
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  job_name text not null,
  queue_name text not null,
  status public.job_run_status not null default 'queued',
  input_json jsonb not null default '{}'::jsonb,
  output_json jsonb,
  error_json jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.brand_memories
  add constraint brand_memories_generated_by_job_run_id_fkey
  foreign key (generated_by_job_run_id) references public.job_runs(id) on delete set null;

create table public.automation_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_run_id uuid references public.job_runs(id) on delete set null,
  level public.log_level not null default 'info',
  message text not null,
  context_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index members_user_id_idx on public.members(user_id);
create index brands_workspace_status_idx on public.brands(workspace_id, status);
create index brand_assets_workspace_brand_idx on public.brand_assets(workspace_id, brand_id, category, status);
create index brand_memories_workspace_brand_idx on public.brand_memories(workspace_id, brand_id, version desc);
create index templates_workspace_idx on public.templates(workspace_id);
create index content_plans_workspace_brand_idx on public.content_plans(workspace_id, brand_id, status);
create index content_items_workspace_brand_idx on public.content_items(workspace_id, brand_id, status);
create index generated_assets_workspace_brand_idx on public.generated_assets(workspace_id, brand_id, status);
create index approvals_workspace_target_idx on public.approvals(workspace_id, target_type, target_id, status);
create index job_runs_workspace_status_idx on public.job_runs(workspace_id, status, created_at desc);
create index automation_logs_workspace_job_idx on public.automation_logs(workspace_id, job_run_id, created_at desc);

create trigger workspaces_set_updated_at before update on public.workspaces for each row execute function public.set_updated_at();
create trigger members_set_updated_at before update on public.members for each row execute function public.set_updated_at();
create trigger brands_set_updated_at before update on public.brands for each row execute function public.set_updated_at();
create trigger brand_assets_set_updated_at before update on public.brand_assets for each row execute function public.set_updated_at();
create trigger brand_memories_set_updated_at before update on public.brand_memories for each row execute function public.set_updated_at();
create trigger templates_set_updated_at before update on public.templates for each row execute function public.set_updated_at();
create trigger brand_templates_set_updated_at before update on public.brand_templates for each row execute function public.set_updated_at();
create trigger content_plans_set_updated_at before update on public.content_plans for each row execute function public.set_updated_at();
create trigger content_items_set_updated_at before update on public.content_items for each row execute function public.set_updated_at();
create trigger generated_assets_set_updated_at before update on public.generated_assets for each row execute function public.set_updated_at();
create trigger approvals_set_updated_at before update on public.approvals for each row execute function public.set_updated_at();
create trigger job_runs_set_updated_at before update on public.job_runs for each row execute function public.set_updated_at();

alter table public.workspaces enable row level security;
alter table public.members enable row level security;
alter table public.brands enable row level security;
alter table public.brand_assets enable row level security;
alter table public.brand_memories enable row level security;
alter table public.templates enable row level security;
alter table public.brand_templates enable row level security;
alter table public.content_plans enable row level security;
alter table public.content_items enable row level security;
alter table public.generated_assets enable row level security;
alter table public.approvals enable row level security;
alter table public.job_runs enable row level security;
alter table public.automation_logs enable row level security;

create policy "members can read their workspaces"
on public.workspaces for select
using (public.is_workspace_member(id));

create policy "authenticated users can create workspaces"
on public.workspaces for insert
with check (auth.uid() = created_by);

create policy "owners and admins can update workspaces"
on public.workspaces for update
using (public.has_workspace_role(id, array['owner','admin']::public.workspace_role[]))
with check (public.has_workspace_role(id, array['owner','admin']::public.workspace_role[]));

create policy "members can read memberships"
on public.members for select
using (public.is_workspace_member(workspace_id));

create policy "users can create their first owner membership"
on public.members for insert
with check (
  user_id = auth.uid()
  and role = 'owner'
  and exists (select 1 from public.workspaces w where w.id = workspace_id and w.created_by = auth.uid())
);

create policy "owners and admins can manage memberships"
on public.members for all
using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

create policy "workspace members can read brands" on public.brands for select using (public.is_workspace_member(workspace_id));
create policy "workspace editors can insert brands" on public.brands for insert with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));
create policy "workspace editors can update brands" on public.brands for update using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[])) with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

create policy "workspace members can read brand assets" on public.brand_assets for select using (public.is_workspace_member(workspace_id));
create policy "workspace editors can write brand assets" on public.brand_assets for insert with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));
create policy "workspace editors can update brand assets" on public.brand_assets for update using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[])) with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

create policy "workspace members can read brand memories" on public.brand_memories for select using (public.is_workspace_member(workspace_id));
create policy "workspace editors can write brand memories" on public.brand_memories for all using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[])) with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

create policy "workspace members can read templates" on public.templates for select using (workspace_id is null or public.is_workspace_member(workspace_id));
create policy "workspace editors can write templates" on public.templates for all using (workspace_id is not null and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[])) with check (workspace_id is not null and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

create policy "workspace members can read brand templates" on public.brand_templates for select using (public.is_workspace_member(workspace_id));
create policy "workspace editors can write brand templates" on public.brand_templates for all using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[])) with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

create policy "workspace members can read content plans" on public.content_plans for select using (public.is_workspace_member(workspace_id));
create policy "workspace editors can write content plans" on public.content_plans for all using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[])) with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

create policy "workspace members can read content items" on public.content_items for select using (public.is_workspace_member(workspace_id));
create policy "workspace editors can write content items" on public.content_items for all using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[])) with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

create policy "workspace members can read generated assets" on public.generated_assets for select using (public.is_workspace_member(workspace_id));
create policy "workspace editors can write generated assets" on public.generated_assets for all using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[])) with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

create policy "workspace members can read approvals" on public.approvals for select using (public.is_workspace_member(workspace_id));
create policy "workspace editors can create approvals" on public.approvals for insert with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));
create policy "workspace editors can update approvals" on public.approvals for update using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[])) with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

create policy "workspace members can read job runs" on public.job_runs for select using (public.is_workspace_member(workspace_id));
create policy "workspace editors can create job runs" on public.job_runs for insert with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));
create policy "workspace members can read automation logs" on public.automation_logs for select using (public.is_workspace_member(workspace_id));

insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', false)
on conflict (id) do nothing;

create policy "workspace members can read brand asset objects"
on storage.objects for select
using (
  bucket_id = 'brand-assets'
  and public.is_workspace_member((storage.foldername(name))[1]::uuid)
);

create policy "workspace editors can upload brand asset objects"
on storage.objects for insert
with check (
  bucket_id = 'brand-assets'
  and public.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner','admin','editor']::public.workspace_role[])
);

create policy "workspace editors can update brand asset objects"
on storage.objects for update
using (
  bucket_id = 'brand-assets'
  and public.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner','admin','editor']::public.workspace_role[])
)
with check (
  bucket_id = 'brand-assets'
  and public.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner','admin','editor']::public.workspace_role[])
);
