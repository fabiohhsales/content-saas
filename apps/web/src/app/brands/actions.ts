'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { BrandAssetCategorySchema } from '@content-saas/contracts';
import { brandAssetPath } from '@content-saas/supabase';
import { getCurrentWorkspace, requireUser } from '@/lib/auth';
import { DEMO_BRAND_ID, isDemoMode } from '@/lib/demo';
import { slugify } from '@/lib/slug';

const BrandFormSchema = z.object({
  name: z.string().min(2),
  industry: z.string().optional(),
  positioning: z.string().optional(),
  voice_notes: z.string().optional(),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  font_family: z.string().optional(),
  visual_notes: z.string().optional(),
});

function requiredWorkspaceId(membership: Awaited<ReturnType<typeof getCurrentWorkspace>>['membership']) {
  const workspaceId = membership?.workspace_id;
  if (!workspaceId) throw new Error('Workspace is required');
  return workspaceId;
}

function optionalText(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > 0 ? text : undefined;
}

function brandMetadata(input: z.infer<typeof BrandFormSchema>, previous?: Record<string, unknown> | null) {
  return {
    ...previous,
    schema_version: 1,
    identity: {
      ...((previous?.identity as Record<string, unknown> | undefined) ?? {}),
      primary_color: input.primary_color ?? '',
      secondary_color: input.secondary_color ?? '',
      font_family: input.font_family ?? '',
      visual_notes: input.visual_notes ?? '',
    },
  };
}

export async function createBrand(formData: FormData) {
  if (isDemoMode()) {
    redirect(`/brands/${DEMO_BRAND_ID}/onboarding`);
  }

  const { supabase, user, membership } = await getCurrentWorkspace();
  const workspaceId = requiredWorkspaceId(membership);
  const input = BrandFormSchema.parse({
    name: formData.get('name'),
    industry: optionalText(formData.get('industry')),
    positioning: optionalText(formData.get('positioning')),
    voice_notes: optionalText(formData.get('voice_notes')),
    primary_color: optionalText(formData.get('primary_color')),
    secondary_color: optionalText(formData.get('secondary_color')),
    font_family: optionalText(formData.get('font_family')),
    visual_notes: optionalText(formData.get('visual_notes')),
  });

  const { data, error } = await supabase
    .from('brands')
    .insert({
      workspace_id: workspaceId,
      name: input.name,
      slug: slugify(input.name),
      status: 'draft',
      industry: input.industry ?? null,
      positioning: input.positioning ?? null,
      voice_notes: input.voice_notes ?? null,
      metadata: brandMetadata(input),
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Could not create brand');
  revalidatePath('/brands');
  revalidatePath('/clients');
  redirect(`/brands/${data.id}/onboarding`);
}

export async function updateBrand(brandId: string, formData: FormData) {
  if (isDemoMode()) {
    revalidatePath(`/brands/${brandId}`);
    return;
  }

  const { supabase, membership } = await getCurrentWorkspace();
  const workspaceId = requiredWorkspaceId(membership);
  const input = BrandFormSchema.parse({
    name: formData.get('name'),
    industry: optionalText(formData.get('industry')),
    positioning: optionalText(formData.get('positioning')),
    voice_notes: optionalText(formData.get('voice_notes')),
    primary_color: optionalText(formData.get('primary_color')),
    secondary_color: optionalText(formData.get('secondary_color')),
    font_family: optionalText(formData.get('font_family')),
    visual_notes: optionalText(formData.get('visual_notes')),
  });

  const { data: currentBrand } = await supabase
    .from('brands')
    .select('metadata')
    .eq('id', brandId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  const { error } = await supabase
    .from('brands')
    .update({
      name: input.name,
      slug: slugify(input.name),
      industry: input.industry ?? null,
      positioning: input.positioning ?? null,
      voice_notes: input.voice_notes ?? null,
      metadata: brandMetadata(input, (currentBrand?.metadata as Record<string, unknown> | null) ?? null),
    })
    .eq('id', brandId)
    .eq('workspace_id', workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath(`/brands/${brandId}`);
  revalidatePath('/brands');
  revalidatePath('/clients');
}

export async function archiveBrand(brandId: string) {
  if (isDemoMode()) {
    redirect('/brands');
  }

  const { supabase, membership } = await getCurrentWorkspace();
  const workspaceId = requiredWorkspaceId(membership);
  const { error } = await supabase
    .from('brands')
    .update({ status: 'archived' })
    .eq('id', brandId)
    .eq('workspace_id', workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath('/brands');
  revalidatePath('/clients');
  redirect('/clients');
}

export async function completeBrandOnboarding(brandId: string) {
  if (isDemoMode()) {
    redirect(`/brands/${brandId}/assets`);
  }

  const { supabase, membership } = await getCurrentWorkspace();
  const workspaceId = requiredWorkspaceId(membership);
  const { error } = await supabase
    .from('brands')
    .update({ status: 'active' })
    .eq('id', brandId)
    .eq('workspace_id', workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath(`/brands/${brandId}`);
  redirect(`/brands/${brandId}/assets`);
}

export async function uploadBrandAsset(brandId: string, formData: FormData) {
  if (isDemoMode()) {
    revalidatePath(`/brands/${brandId}/assets`);
    revalidatePath(`/brands/${brandId}/onboarding`);
    redirect(`/brands/${brandId}/assets`);
  }

  const { supabase, user, membership } = await getCurrentWorkspace();
  const workspaceId = requiredWorkspaceId(membership);
  const category = BrandAssetCategorySchema.parse(formData.get('category'));
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    throw new Error('Arquivo obrigatorio');
  }

  const storagePath = brandAssetPath(workspaceId, brandId, category, file.name);
  const { error: uploadError } = await supabase.storage
    .from('brand-assets')
    .upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) throw new Error(uploadError.message);

  const { error: insertError } = await supabase.from('brand_assets').insert({
    workspace_id: workspaceId,
    brand_id: brandId,
    category,
    status: 'ready',
    storage_bucket: 'brand-assets',
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
    metadata: { schema_version: 1 },
    created_by: user.id,
  });

  if (insertError) throw new Error(insertError.message);
  revalidatePath(`/brands/${brandId}/assets`);
  revalidatePath(`/brands/${brandId}/onboarding`);
}

export async function requestBrandMemory(brandId: string) {
  if (isDemoMode()) {
    revalidatePath(`/brands/${brandId}`);
    return;
  }

  const { user, membership } = await getCurrentWorkspace();
  const workspaceId = requiredWorkspaceId(membership);
  const endpoint = process.env.ORCHESTRATOR_INTERNAL_URL ?? 'http://localhost:3002';
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) throw new Error('INTERNAL_SECRET is required');

  const res = await fetch(`${endpoint}/jobs/generate-brand-memory`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-secret': secret,
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      brand_id: brandId,
      requested_by: user.id,
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Could not enqueue brand memory job: ${await res.text()}`);
  }

  revalidatePath(`/brands/${brandId}`);
}

export async function signOutFromApp() {
  if (isDemoMode()) {
    redirect('/login');
  }

  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect('/login');
}
