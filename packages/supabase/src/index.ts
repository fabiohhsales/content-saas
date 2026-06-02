import { createClient } from '@supabase/supabase-js';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: { id: string; name: string; slug: string; created_by: string | null; metadata: Json; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; slug: string; created_by?: string | null; metadata?: Json };
        Update: Partial<Database['public']['Tables']['workspaces']['Insert']>;
      };
      members: {
        Row: { id: string; workspace_id: string; user_id: string; role: 'owner' | 'admin' | 'editor' | 'viewer'; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id: string; user_id: string; role: 'owner' | 'admin' | 'editor' | 'viewer'; created_at?: string; updated_at?: string };
        Update: Partial<Database['public']['Tables']['members']['Insert']>;
      };
      brands: {
        Row: { id: string; workspace_id: string; name: string; slug: string; status: 'draft' | 'active' | 'archived'; industry: string | null; positioning: string | null; voice_notes: string | null; metadata: Json; created_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id: string; name: string; slug: string; status?: 'draft' | 'active' | 'archived'; industry?: string | null; positioning?: string | null; voice_notes?: string | null; metadata?: Json; created_by?: string | null };
        Update: Partial<Database['public']['Tables']['brands']['Insert']>;
      };
      brand_assets: {
        Row: { id: string; workspace_id: string; brand_id: string; category: string; status: string; storage_bucket: string; storage_path: string; file_name: string; mime_type: string; size_bytes: number; metadata: Json; created_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id: string; brand_id: string; category: string; status?: string; storage_bucket?: string; storage_path: string; file_name: string; mime_type: string; size_bytes: number; metadata?: Json; created_by?: string | null };
        Update: Partial<Database['public']['Tables']['brand_assets']['Insert']>;
      };
      brand_memories: {
        Row: { id: string; workspace_id: string; brand_id: string; version: number; status: string; memory_json: Json; generated_by_job_run_id: string | null; created_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id: string; brand_id: string; version: number; status?: string; memory_json: Json; generated_by_job_run_id?: string | null; created_by?: string | null };
        Update: Partial<Database['public']['Tables']['brand_memories']['Insert']>;
      };
      content_plans: {
        Row: { id: string; workspace_id: string; brand_id: string; title: string; period_start: string; period_end: string; status: string; plan_json: Json; metadata: Json; created_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id: string; brand_id: string; title: string; period_start: string; period_end: string; status?: string; plan_json?: Json; metadata?: Json; created_by?: string | null };
        Update: Partial<Database['public']['Tables']['content_plans']['Insert']>;
      };
      content_items: {
        Row: { id: string; workspace_id: string; brand_id: string; content_plan_id: string | null; title: string; status: string; scheduled_for: string | null; copy_json: Json; metadata: Json; created_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id: string; brand_id: string; content_plan_id?: string | null; title: string; status?: string; scheduled_for?: string | null; copy_json?: Json; metadata?: Json; created_by?: string | null };
        Update: Partial<Database['public']['Tables']['content_items']['Insert']>;
      };
      generated_assets: {
        Row: { id: string; workspace_id: string; brand_id: string; content_item_id: string | null; status: string; storage_bucket: string; storage_path: string | null; mime_type: string | null; render_payload_json: Json; metadata: Json; created_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id: string; brand_id: string; content_item_id?: string | null; status?: string; storage_bucket?: string; storage_path?: string | null; mime_type?: string | null; render_payload_json?: Json; metadata?: Json; created_by?: string | null };
        Update: Partial<Database['public']['Tables']['generated_assets']['Insert']>;
      };
      approvals: {
        Row: { id: string; workspace_id: string; target_type: string; target_id: string; status: string; decided_by: string | null; decided_at: string | null; notes: string | null; metadata: Json; created_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id: string; target_type: string; target_id: string; status?: string; decided_by?: string | null; decided_at?: string | null; notes?: string | null; metadata?: Json; created_by?: string | null };
        Update: Partial<Database['public']['Tables']['approvals']['Insert']>;
      };
      job_runs: {
        Row: { id: string; workspace_id: string; brand_id: string | null; job_name: string; queue_name: string; status: string; input_json: Json; output_json: Json | null; error_json: Json | null; started_at: string | null; finished_at: string | null; created_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id: string; brand_id?: string | null; job_name: string; queue_name: string; status?: string; input_json?: Json; output_json?: Json | null; error_json?: Json | null; started_at?: string | null; finished_at?: string | null; created_by?: string | null };
        Update: Partial<Database['public']['Tables']['job_runs']['Insert']>;
      };
      automation_logs: {
        Row: { id: string; workspace_id: string; job_run_id: string | null; level: string; message: string; context_json: Json; created_at: string };
        Insert: { id?: string; workspace_id: string; job_run_id?: string | null; level?: string; message: string; context_json?: Json };
        Update: Partial<Database['public']['Tables']['automation_logs']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      workspace_role: 'owner' | 'admin' | 'editor' | 'viewer';
      brand_status: 'draft' | 'active' | 'archived';
      asset_category: 'logo' | 'photo' | 'font' | 'reference' | 'document' | 'other';
      asset_status: 'uploaded' | 'processing' | 'ready' | 'failed' | 'archived';
      job_run_status: 'queued' | 'running' | 'completed' | 'failed';
    };
    CompositeTypes: Record<string, never>;
  };
};

export function createBrowserSupabaseClient(url: string, anonKey: string) {
  return createClient(url, anonKey);
}

export function createServiceSupabaseClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function brandAssetPath(workspaceId: string, brandId: string, category: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return `${workspaceId}/${brandId}/${category}/${Date.now()}-${safeName}`;
}

export function generatedAssetPath(workspaceId: string, brandId: string, contentItemId: string, outputFormat: string) {
  const extension = outputFormat === 'jpg' ? 'jpg' : 'png';
  return `${workspaceId}/${brandId}/generated/${contentItemId}-${Date.now()}.${extension}`;
}
