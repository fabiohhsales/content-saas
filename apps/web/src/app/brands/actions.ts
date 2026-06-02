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
});

function requiredWorkspaceId(membership: Awaited<ReturnType<typeof getCurrentWorkspace>>['membership']) {
  const workspaceId = membership?.workspace_id;
  if (!workspaceId) throw new Error('Workspace is required');
  return workspaceId;
}

export async function createBrand(formData: FormData) {
  if (isDemoMode()) {
    redirect(`/brands/${DEMO_BRAND_ID}/onboarding`);
  }

  const { supabase, user, membership } = await getCurrentWorkspace();
  const workspaceId = requiredWorkspaceId(membership);
  const input = BrandFormSchema.parse({
    name: formData.get('name'),
    industry: formData.get('industry') || undefined,
    positioning: formData.get('positioning') || undefined,
    voice_notes: formData.get('voice_notes') || undefined,
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
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Could not create brand');
  revalidatePath('/brands');
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
    industry: formData.get('industry') || undefined,
    positioning: formData.get('positioning') || undefined,
    voice_notes: formData.get('voice_notes') || undefined,
  });

  const { error } = await supabase
    .from('brands')
    .update({
      name: input.name,
      slug: slugify(input.name),
      industry: input.industry ?? null,
      positioning: input.positioning ?? null,
      voice_notes: input.voice_notes ?? null,
    })
    .eq('id', brandId)
    .eq('workspace_id', workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath(`/brands/${brandId}`);
  revalidatePath('/brands');
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
  redirect('/brands');
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
