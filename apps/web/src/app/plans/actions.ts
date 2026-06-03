'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ContentItemStatusSchema, CreativeDocumentJsonSchema, RenderOutputFormatSchema } from '@content-saas/contracts';
import { getCurrentWorkspace } from '@/lib/auth';
import { demoCreativeDocuments, isDemoMode } from '@/lib/demo';

const ContentPlanFormSchema = z.object({
  brand_id: z.string().min(1),
  title: z.string().min(2),
  period_start: z.string().min(1),
  period_end: z.string().min(1),
  objective: z.string().optional(),
  channels: z.string().optional(),
  frequency: z.string().optional(),
  pillars: z.string().optional(),
  campaigns: z.string().optional(),
  preferred_templates: z.string().optional(),
  restrictions: z.string().optional(),
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

const CreativeFromItemSchema = z.object({
  template_id: z.string().optional(),
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

function listFromText(value?: string) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function strategicBriefing(input: z.infer<typeof ContentPlanFormSchema>) {
  const data = {
    schema_version: 1,
    objective: input.objective ?? '',
    channels: listFromText(input.channels),
    frequency: input.frequency ?? '',
    pillars: listFromText(input.pillars),
    campaigns: input.campaigns ?? '',
    preferred_templates: listFromText(input.preferred_templates),
    restrictions: input.restrictions ?? '',
  };

  const summary = [
    data.objective ? `Objetivo: ${data.objective}` : '',
    data.channels.length ? `Canais: ${data.channels.join(', ')}` : '',
    data.frequency ? `Frequencia: ${data.frequency}` : '',
    data.pillars.length ? `Pilares: ${data.pillars.join(', ')}` : '',
    data.campaigns ? `Campanhas/ofertas: ${data.campaigns}` : '',
    data.preferred_templates.length ? `Templates preferidos: ${data.preferred_templates.join(', ')}` : '',
    data.restrictions ? `Restricoes: ${data.restrictions}` : '',
  ].filter(Boolean).join('\n');

  return { data, summary };
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
    channels: optionalText(formData.get('channels')),
    frequency: optionalText(formData.get('frequency')),
    pillars: optionalText(formData.get('pillars')),
    campaigns: optionalText(formData.get('campaigns')),
    preferred_templates: optionalText(formData.get('preferred_templates')),
    restrictions: optionalText(formData.get('restrictions')),
  });
  const briefing = strategicBriefing(input);

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
        strategy: briefing.data,
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

export async function requestGeneratedContentPlan(formData: FormData) {
  const input = ContentPlanFormSchema.parse({
    brand_id: formData.get('brand_id'),
    title: formData.get('title') || 'Plano gerado por IA',
    period_start: formData.get('period_start'),
    period_end: formData.get('period_end'),
    objective: optionalText(formData.get('objective')),
    channels: optionalText(formData.get('channels')),
    frequency: optionalText(formData.get('frequency')),
    pillars: optionalText(formData.get('pillars')),
    campaigns: optionalText(formData.get('campaigns')),
    preferred_templates: optionalText(formData.get('preferred_templates')),
    restrictions: optionalText(formData.get('restrictions')),
  });
  const briefing = strategicBriefing(input);

  if (isDemoMode()) {
    redirect('/jobs?queue=content-plan');
  }

  const { user, membership } = await getCurrentWorkspace();
  const workspaceId = requiredWorkspaceId(membership);
  const endpoint = process.env.ORCHESTRATOR_INTERNAL_URL ?? 'http://localhost:3002';
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) throw new Error('INTERNAL_SECRET is required');

  const res = await fetch(`${endpoint}/jobs/generate-content-plan`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-secret': secret,
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      brand_id: input.brand_id,
      requested_by: user.id,
      period_start: input.period_start,
      period_end: input.period_end,
      objective: input.objective,
      strategy: briefing.data,
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Could not enqueue content plan job: ${await res.text()}`);
  }

  revalidatePath('/plans');
  revalidatePath('/jobs');
  redirect('/jobs?queue=content-plan');
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

export async function requestRenderPreview(planId: string, contentItemId: string, formData: FormData) {
  const outputFormat = RenderOutputFormatSchema.parse(formData.get('output_format') || 'png');

  if (isDemoMode()) {
    revalidatePath(`/plans/${planId}`);
    redirect('/jobs?queue=render-preview');
  }

  const { supabase, user, membership } = await getCurrentWorkspace();
  const workspaceId = requiredWorkspaceId(membership);

  const { data: item, error: itemError } = await supabase
    .from('content_items')
    .select('id, brand_id')
    .eq('id', contentItemId)
    .eq('content_plan_id', planId)
    .eq('workspace_id', workspaceId)
    .single();

  if (itemError || !item) throw new Error(itemError?.message ?? 'Content item not found');

  const endpoint = process.env.ORCHESTRATOR_INTERNAL_URL ?? 'http://localhost:3002';
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) throw new Error('INTERNAL_SECRET is required');

  const res = await fetch(`${endpoint}/jobs/render-preview`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-secret': secret,
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      brand_id: item.brand_id,
      content_item_id: item.id,
      requested_by: user.id,
      output_format: outputFormat,
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Could not enqueue render preview job: ${await res.text()}`);
  }

  revalidatePath(`/plans/${planId}`);
  revalidatePath('/jobs');
  redirect('/jobs?queue=render-preview');
}

export async function createCreativeDocumentFromItem(planId: string, contentItemId: string, formData: FormData) {
  const input = CreativeFromItemSchema.parse({
    template_id: optionalText(formData.get('template_id')),
  });

  if (isDemoMode()) {
    const demoDocument = demoCreativeDocuments.find((document) => document.content_item_id === contentItemId) ?? demoCreativeDocuments[0]!;
    redirect(`/editor/${demoDocument.id}`);
  }

  const { supabase, user, membership } = await getCurrentWorkspace();
  const workspaceId = requiredWorkspaceId(membership);

  const { data: item, error: itemError } = await supabase
    .from('content_items')
    .select('id, brand_id, title, copy_json')
    .eq('id', contentItemId)
    .eq('content_plan_id', planId)
    .eq('workspace_id', workspaceId)
    .single();

  if (itemError || !item) throw new Error(itemError?.message ?? 'Content item not found');

  const templateId = input.template_id
    || (typeof item.copy_json?.template_id === 'string' ? item.copy_json.template_id : '')
    || 'paper-editorial-01';
  const hook = typeof item.copy_json?.hook === 'string' ? item.copy_json.hook : item.title;
  const caption = typeof item.copy_json?.caption === 'string' ? item.copy_json.caption : '';
  const cta = typeof item.copy_json?.cta === 'string' ? item.copy_json.cta : '';

  const documentJson = CreativeDocumentJsonSchema.parse({
    schema_version: 1,
    canvas: { width: 1080, height: 1350, format: 'instagram_post' },
    template_id: templateId,
    brand_id: item.brand_id,
    content_item_id: item.id,
    tokens: {
      primary_color: '#0f766e',
      background_color: '#f8fafc',
      text_color: '#1f2933',
      font_family: 'Arial',
    },
    slides: [
      {
        id: 'slide-1',
        name: 'Criativo principal',
        background: { color: '#f8fafc' },
        elements: [
          {
            id: 'headline',
            type: 'text',
            role: 'headline',
            placeholder: 'headline',
            locked: false,
            visible: true,
            text: hook,
            x: 84,
            y: 250,
            width: 820,
            height: 220,
            rotation: 0,
            style: { font_size: 58, font_weight: 700, color: '#1f2933' },
          },
          {
            id: 'body',
            type: 'text',
            role: 'body',
            placeholder: 'body',
            locked: false,
            visible: true,
            text: caption || 'Texto de apoio a revisar no editor.',
            x: 84,
            y: 540,
            width: 760,
            height: 260,
            rotation: 0,
            style: { font_size: 34, color: '#344054' },
          },
          {
            id: 'cta',
            type: 'text',
            role: 'cta',
            placeholder: 'cta',
            locked: false,
            visible: true,
            text: cta || 'Adicionar CTA',
            x: 84,
            y: 1050,
            width: 620,
            height: 90,
            rotation: 0,
            style: { font_size: 32, color: '#0f766e' },
          },
        ],
      },
    ],
  });

  const { data: existing } = await supabase
    .from('creative_documents')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('content_item_id', item.id)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    redirect(`/editor/${existing.id}`);
  }

  const { data: inserted, error: insertError } = await supabase
    .from('creative_documents')
    .insert({
      workspace_id: workspaceId,
      brand_id: item.brand_id,
      content_item_id: item.id,
      template_ref: templateId,
      title: `${item.title} - criativo editavel`,
      status: 'editing',
      document_json: documentJson,
      metadata: {
        schema_version: 1,
        source: 'content_item',
        content_plan_id: planId,
      },
      created_by: user.id,
    })
    .select('id')
    .single();

  if (insertError || !inserted) throw new Error(insertError?.message ?? 'Could not create creative document');

  revalidatePath('/editor');
  revalidatePath(`/plans/${planId}`);
  redirect(`/editor/${inserted.id}`);
}
