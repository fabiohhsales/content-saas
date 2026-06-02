create table public.asset_collections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete cascade,
  scope text not null check (scope in ('global', 'workspace', 'brand')),
  name text not null,
  slug text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  metadata jsonb not null default '{"schema_version":1}'::jsonb check ((metadata->>'schema_version') is not null),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, brand_id, slug),
  check (
    (scope = 'global' and workspace_id is null and brand_id is null)
    or (scope = 'workspace' and workspace_id is not null and brand_id is null)
    or (scope = 'brand' and workspace_id is not null and brand_id is not null)
  )
);

create table public.global_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  collection_id uuid references public.asset_collections(id) on delete set null,
  category text not null check (category in ('logo', 'photo', 'background', 'icon', 'shape', 'texture', 'mockup', 'other')),
  status public.asset_status not null default 'ready',
  storage_bucket text not null default 'global-assets',
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  metadata jsonb not null default '{"schema_version":1}'::jsonb check ((metadata->>'schema_version') is not null),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table public.template_placeholders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  template_ref text not null,
  placeholder_key text not null,
  kind text not null check (kind in ('text', 'image', 'logo', 'color', 'asset')),
  role text not null check (role in ('brand_logo', 'hero_image', 'background_image', 'supporting_image', 'headline', 'subtitle', 'body', 'cta', 'badge', 'disclaimer', 'icon', 'shape')),
  required boolean not null default false,
  constraints_json jsonb not null default '{"schema_version":1}'::jsonb check ((constraints_json->>'schema_version') is not null),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, template_ref, placeholder_key)
);

create table public.creative_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  content_item_id uuid references public.content_items(id) on delete set null,
  generated_asset_id uuid references public.generated_assets(id) on delete set null,
  template_ref text not null,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'editing', 'ready_for_approval', 'approved', 'archived')),
  document_json jsonb not null default '{"schema_version":1}'::jsonb check ((document_json->>'schema_version') is not null),
  metadata jsonb not null default '{"schema_version":1}'::jsonb check ((metadata->>'schema_version') is not null),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.creative_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  creative_document_id uuid not null references public.creative_documents(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'archived')),
  document_json jsonb not null check ((document_json->>'schema_version') is not null),
  change_summary text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (creative_document_id, version)
);

create table public.creative_renders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  creative_document_id uuid not null references public.creative_documents(id) on delete cascade,
  creative_version_id uuid references public.creative_versions(id) on delete set null,
  generated_asset_id uuid references public.generated_assets(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'rendering', 'ready', 'failed', 'archived')),
  output_format text not null default 'png' check (output_format in ('png', 'jpg')),
  storage_bucket text not null default 'brand-assets',
  storage_path text,
  mime_type text,
  metadata jsonb not null default '{"schema_version":1}'::jsonb check ((metadata->>'schema_version') is not null),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.approvals
  drop constraint approvals_target_type_check;

alter table public.approvals
  add constraint approvals_target_type_check
  check (target_type in ('brand_memory', 'content_plan', 'content_item', 'generated_asset', 'creative_document', 'creative_version'));

create index asset_collections_scope_idx on public.asset_collections(scope, status);
create index asset_collections_workspace_brand_idx on public.asset_collections(workspace_id, brand_id, status);
create index global_assets_workspace_category_idx on public.global_assets(workspace_id, category, status);
create index template_placeholders_template_idx on public.template_placeholders(workspace_id, template_ref);
create index creative_documents_workspace_brand_idx on public.creative_documents(workspace_id, brand_id, status, updated_at desc);
create index creative_documents_content_item_idx on public.creative_documents(content_item_id);
create index creative_versions_document_idx on public.creative_versions(creative_document_id, version desc);
create index creative_renders_document_idx on public.creative_renders(creative_document_id, status, created_at desc);

create trigger asset_collections_set_updated_at before update on public.asset_collections for each row execute function public.set_updated_at();
create trigger global_assets_set_updated_at before update on public.global_assets for each row execute function public.set_updated_at();
create trigger template_placeholders_set_updated_at before update on public.template_placeholders for each row execute function public.set_updated_at();
create trigger creative_documents_set_updated_at before update on public.creative_documents for each row execute function public.set_updated_at();
create trigger creative_renders_set_updated_at before update on public.creative_renders for each row execute function public.set_updated_at();

alter table public.asset_collections enable row level security;
alter table public.global_assets enable row level security;
alter table public.template_placeholders enable row level security;
alter table public.creative_documents enable row level security;
alter table public.creative_versions enable row level security;
alter table public.creative_renders enable row level security;

create policy "members can read asset collections"
on public.asset_collections for select
using (scope = 'global' or public.is_workspace_member(workspace_id));

create policy "workspace editors can write asset collections"
on public.asset_collections for all
using (workspace_id is not null and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]))
with check (workspace_id is not null and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

create policy "members can read global assets"
on public.global_assets for select
using (workspace_id is null or public.is_workspace_member(workspace_id));

create policy "workspace editors can write global assets"
on public.global_assets for all
using (workspace_id is not null and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]))
with check (workspace_id is not null and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

create policy "members can read template placeholders"
on public.template_placeholders for select
using (workspace_id is null or public.is_workspace_member(workspace_id));

create policy "workspace editors can write template placeholders"
on public.template_placeholders for all
using (workspace_id is not null and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]))
with check (workspace_id is not null and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

create policy "workspace members can read creative documents"
on public.creative_documents for select
using (public.is_workspace_member(workspace_id));

create policy "workspace editors can write creative documents"
on public.creative_documents for all
using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

create policy "workspace members can read creative versions"
on public.creative_versions for select
using (public.is_workspace_member(workspace_id));

create policy "workspace editors can write creative versions"
on public.creative_versions for all
using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

create policy "workspace members can read creative renders"
on public.creative_renders for select
using (public.is_workspace_member(workspace_id));

create policy "workspace editors can write creative renders"
on public.creative_renders for all
using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

insert into storage.buckets (id, name, public)
values ('global-assets', 'global-assets', false)
on conflict (id) do nothing;

create policy "authenticated users can read global asset objects"
on storage.objects for select
using (
  bucket_id = 'global-assets'
  and auth.role() = 'authenticated'
);

create policy "workspace editors can upload workspace global asset objects"
on storage.objects for insert
with check (
  bucket_id = 'global-assets'
  and auth.role() = 'authenticated'
);
