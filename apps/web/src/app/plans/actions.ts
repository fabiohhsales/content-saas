'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ContentItemStatusSchema } from '@content-saas/contracts';
import { getCurrentWorkspace } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo';

const ContentPlanFormSchema = z.object({
  brand_id: z.string().min(1),
  title: z.string().min(2),
  period_start: z.string().min(1),
  period_end: z.string().min(1),
  objective: z.string().optional(),
});

const ContentItemFormSchema = z.object({
  title: z.string().min(2),
  channel: z.string().optional(),
  format: z.string().optional(),
  template_id: z.string().optional(),
  scheduled_for: z.string().optional(),
  hook: z.string().optional(),
  caption: z.string().optional(),
  cta: z.string().optional(),
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

export async function createContentPlan(formData: FormData) {
  if (isDemoMode()) {
    redirect('/plans/demo-plan-aurora-2026-06');
  }

  const { supabase, user, membership } = await getCurrentWorkspace();
  const workspaceId = requiredWorkspaceId(membership);
  const input = ContentPlanFormSchema.parse({
    brand_id: formData.get('brand_id'),
    title: formData.get('title'),
    period_start: formData.get('period_start'),
    period_end: formData.get('period_end'),
    objective: optionalText(formData.get('objective')),
  });

  const { data, error } = await supabase
    .from('content_plans')
    .insert({
      workspace_id: workspaceId,
      brand_id: input.brand_id,
      title: input.title,
      period_start: input.period_start,
      period_end: input.period_end,
      status: 'draft',
      plan_json: {
        schema_version: 1,
        objective: input.objective ?? '',
        source: 'manual',
      },
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Could not create content plan');
  revalidatePath('/plans');
  redirect(`/plans/${data.id}`);
}

export async function createContentItem(planId: string, formData: FormData) {
  if (isDemoMode()) {
    revalidatePath(`/plans/${planId}`);
    return;
  }

  const { supabase, user, membership } = await getCurrentWorkspace();
  const workspaceId = requiredWorkspaceId(membership);

  const { data: plan, error: planError } = await supabase
    .from('content_plans')
    .select('id, brand_id')
    .eq('id', planId)
    .eq('workspace_id', workspaceId)
    .single();

  if (planError || !plan) throw new Error(planError?.message ?? 'Content plan not found');

  const input = ContentItemFormSchema.parse({
    title: formData.get('title'),
    channel: optionalText(formData.get('channel')),
    format: optionalText(formData.get('format')),
    template_id: optionalText(formData.get('template_id')),
    scheduled_for: optionalText(formData.get('scheduled_for')),
    hook: optionalText(formData.get('hook')),
    caption: optionalText(formData.get('caption')),
    cta: optionalText(formData.get('cta')),
  });

  const scheduledFor = input.scheduled_for ? new Date(input.scheduled_for).toISOString() : null;
  const { error } = await supabase.from('content_items').insert({
    workspace_id: workspaceId,
    brand_id: plan.brand_id,
    content_plan_id: plan.id,
    title: input.title,
    status: 'draft',
    scheduled_for: scheduledFor,
    copy_json: {
      schema_version: 1,
      channel: input.channel ?? '',
      format: input.format ?? '',
      template_id: input.template_id ?? '',
      hook: input.hook ?? '',
      caption: input.caption ?? '',
      cta: input.cta ?? '',
    },
    created_by: user.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/plans/${planId}`);
  revalidatePath('/plans');
}

export async function updateContentItemStatus(itemId: string, planId: string, formData: FormData) {
  const status = ContentItemStatusSchema.parse(formData.get('status'));

  if (isDemoMode()) {
    revalidatePath(`/plans/${planId}`);
    return;
  }

  const { supabase, membership } = await getCurrentWorkspace();
  const workspaceId = requiredWorkspaceId(membership);
  const { error } = await supabase
    .from('content_items')
    .update({ status })
    .eq('id', itemId)
    .eq('content_plan_id', planId)
    .eq('workspace_id', workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath(`/plans/${planId}`);
  revalidatePath('/plans');
}

export async function archiveContentPlan(planId: string) {
  if (isDemoMode()) {
    redirect('/plans');
  }

  const { supabase, membership } = await getCurrentWorkspace();
  const workspaceId = requiredWorkspaceId(membership);
  const { error } = await supabase
    .from('content_plans')
    .update({ status: 'archived' })
    .eq('id', planId)
    .eq('workspace_id', workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath('/plans');
  redirect('/plans');
}

export async function createPlanApproval(planId: string) {
  if (isDemoMode()) {
    redirect('/approvals?target_type=content_plan');
  }

  const { supabase, user, membership } = await getCurrentWorkspace();
  const workspaceId = requiredWorkspaceId(membership);
  const { data: plan, error: planError } = await supabase
    .from('content_plans')
    .select('id, brand_id, title')
    .eq('id', planId)
    .eq('workspace_id', workspaceId)
    .single();

  if (planError || !plan) throw new Error(planError?.message ?? 'Content plan not found');

  const { error: approvalError } = await supabase.from('approvals').insert({
    workspace_id: workspaceId,
    target_type: 'content_plan',
    target_id: plan.id,
    status: 'pending',
    metadata: {
      schema_version: 1,
      brand_id: plan.brand_id,
      title: plan.title,
    },
    created_by: user.id,
  });

  if (approvalError) throw new Error(approvalError.message);

  await supabase
    .from('content_plans')
    .update({ status: 'awaiting_approval' })
    .eq('id', plan.id)
    .eq('workspace_id', workspaceId);

  revalidatePath(`/plans/${planId}`);
  revalidatePath('/approvals');
  redirect('/approvals?target_type=content_plan&status=pending');
}
