import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationsDir = resolve(process.cwd(), '../../supabase/migrations');
const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();

const sql = migrationFiles
  .map((file) => readFileSync(resolve(migrationsDir, file), 'utf8'))
  .join('\n\n');

function has(pattern) {
  return pattern.test(sql);
}

function expectSql(pattern, message) {
  assert.equal(has(pattern), true, message);
}

describe('Supabase migrations coverage', () => {
  it('defines all roadmap tables', () => {
    const tables = [
      'workspaces',
      'members',
      'workspace_invitations',
      'brands',
      'brand_assets',
      'brand_memories',
      'templates',
      'brand_templates',
      'content_plans',
      'content_items',
      'generated_assets',
      'approvals',
      'job_runs',
      'automation_logs',
      'asset_collections',
      'global_assets',
      'template_placeholders',
      'creative_documents',
      'creative_versions',
      'creative_renders',
      'editorial_playbooks',
      'brand_playbooks',
    ];

    for (const table of tables) {
      expectSql(new RegExp(`create table public\\.${table}\\s*\\(`), `missing table ${table}`);
    }
  });

  it('enables RLS on every application table', () => {
    const rlsTables = [
      'workspaces',
      'members',
      'workspace_invitations',
      'brands',
      'brand_assets',
      'brand_memories',
      'templates',
      'brand_templates',
      'content_plans',
      'content_items',
      'generated_assets',
      'approvals',
      'job_runs',
      'automation_logs',
      'asset_collections',
      'global_assets',
      'template_placeholders',
      'creative_documents',
      'creative_versions',
      'creative_renders',
      'editorial_playbooks',
      'brand_playbooks',
    ];

    for (const table of rlsTables) {
      expectSql(
        new RegExp(`alter table public\\.${table} enable row level security;`),
        `missing RLS enablement for ${table}`,
      );
    }
  });

  it('keeps multi-tenant membership helpers and role policies in place', () => {
    expectSql(/create or replace function public\.is_workspace_member\(target_workspace_id uuid\)/, 'missing membership helper');
    expectSql(/create or replace function public\.has_workspace_role\(target_workspace_id uuid, allowed_roles public\.workspace_role\[\]\)/, 'missing role helper');
    expectSql(/where m\.workspace_id = target_workspace_id\s+and m\.user_id = auth\.uid\(\)/, 'membership helper must bind workspace and auth user');
    expectSql(/array\['owner','admin','editor'\]::public\.workspace_role\[\]/, 'missing owner/admin/editor write role set');
    expectSql(/array\['owner','admin'\]::public\.workspace_role\[\]/, 'missing owner/admin management role set');
  });

  it('guards workspace-scoped core tables with membership policies', () => {
    const memberReadTables = [
      'brands',
      'brand_assets',
      'brand_memories',
      'brand_templates',
      'content_plans',
      'content_items',
      'generated_assets',
      'approvals',
      'job_runs',
      'automation_logs',
      'creative_documents',
      'creative_versions',
      'creative_renders',
      'brand_playbooks',
    ];

    for (const table of memberReadTables) {
      expectSql(
        new RegExp(`on public\\.${table} for select[\\s\\S]*?public\\.is_workspace_member\\(workspace_id\\)`),
        `missing workspace member read policy for ${table}`,
      );
    }
  });

  it('preserves schema_version checks on persisted JSON contracts', () => {
    const jsonColumns = [
      'memory_json',
      'schema_json',
      'render_contract_json',
      'plan_json',
      'copy_json',
      'render_payload_json',
      'input_json',
      'metadata',
      'context_json',
      'constraints_json',
      'document_json',
      'playbook_json',
      'editorial_profile_json',
    ];

    for (const column of jsonColumns) {
      expectSql(
        new RegExp(`${column}[\\s\\S]{0,120}schema_version`),
        `missing schema_version coverage near ${column}`,
      );
    }
  });

  it('keeps approvals compatible with creative review targets', () => {
    expectSql(/target_type in \('brand_memory', 'content_plan', 'content_item', 'generated_asset', 'creative_document', 'creative_version'\)/, 'approvals must support creative review targets');
  });

  it('keeps private storage buckets and workspace-scoped brand asset policies', () => {
    expectSql(/values \('brand-assets', 'brand-assets', false\)/, 'brand-assets bucket must be private');
    expectSql(/values \('global-assets', 'global-assets', false\)/, 'global-assets bucket must be private');
    expectSql(/bucket_id = 'brand-assets'[\s\S]*?public\.is_workspace_member\(\(storage\.foldername\(name\)\)\[1\]::uuid\)/, 'brand asset reads must use first path segment as workspace id');
    expectSql(/bucket_id = 'brand-assets'[\s\S]*?public\.has_workspace_role\(\(storage\.foldername\(name\)\)\[1\]::uuid, array\['owner','admin','editor'\]::public\.workspace_role\[\]\)/, 'brand asset writes must be restricted to workspace editors');
  });

  it('documents global asset storage as curated read-only for authenticated users', () => {
    expectSql(/create policy "authenticated users can read global asset objects"/, 'global asset objects must remain readable to authenticated users');
    expectSql(/bucket_id = 'global-assets'\s+and auth\.role\(\) = 'authenticated'/, 'global asset read policy must require authenticated users');
    expectSql(/drop policy if exists "workspace editors can upload workspace global asset objects"/, 'broad global asset upload policy must be dropped by hardening migration');
  });

  it('keeps editorial playbooks reusable and tenant scoped', () => {
    expectSql(/create table public\.editorial_playbooks\s*\(/, 'missing editorial playbooks table');
    expectSql(/create table public\.brand_playbooks\s*\(/, 'missing brand playbooks table');
    expectSql(/workspace_id is null\s+or public\.is_workspace_member\(workspace_id\)/, 'global playbooks must be readable while workspace playbooks stay tenant scoped');
    expectSql(/where ep\.id = playbook_id[\s\S]*?and \(ep\.workspace_id is null or ep\.workspace_id = brand_playbooks\.workspace_id\)/, 'brand playbooks must link only global or same-workspace playbooks');
    expectSql(/'transplante-capilar'/, 'missing seeded hair transplant playbook');
  });
});
