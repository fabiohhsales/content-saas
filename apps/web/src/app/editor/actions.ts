'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { CreativeDocumentJsonSchema, RenderOutputFormatSchema, type CreativeDocumentJson } from '@content-saas/contracts';
import { getCurrentWorkspace } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo';

const ElementUpdateSchema = z.object({
  slide_id: z.string().min(1),
  element_id: z.string().min(1),
  element_type: z.enum(['text', 'image', 'shape']),
  text: z.string().max(2000).optional(),
  asset_ref: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  rotation: z.number().optional(),
  change_summary: z.string().max(500).optional(),
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

function optionalNumber(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
}

function parseAssetRef(assetRef?: string) {
  if (!assetRef) return { asset_id: undefined, asset_source: undefined };
  const [rawAssetSource, ...idParts] = assetRef.split(':');
  const asset_source = rawAssetSource ?? '';
  const asset_id = idParts.join(':');
  if (!asset_id || !['brand_asset', 'global_asset', 'workspace_asset', 'external'].includes(asset_source)) {
    throw new Error('Invalid asset reference');
  }
  return {
    asset_id,
    asset_source: asset_source as 'brand_asset' | 'global_asset' | 'workspace_asset' | 'external',
  };
}

function updateElement(documentJson: CreativeDocumentJson, input: z.infer<typeof ElementUpdateSchema>) {
  const asset = parseAssetRef(input.asset_ref);
  let changed = false;

  const nextDocument: CreativeDocumentJson = {
    ...documentJson,
    slides: documentJson.slides.map((slide) => {
      if (slide.id !== input.slide_id) return slide;

      return {
        ...slide,
        elements: slide.elements.map((element) => {
          if (element.id !== input.element_id) return element;
          changed = true;

          const layoutPatch = element.locked
            ? {}
            : {
                x: input.x ?? element.x,
                y: input.y ?? element.y,
                width: input.width ?? element.width,
                height: input.height ?? element.height,
                rotation: input.rotation ?? element.rotation,
              };

          if (input.element_type === 'text') {
            return {
              ...element,
              ...layoutPatch,
              text: input.text ?? '',
            };
          }

          return {
            ...element,
            ...layoutPatch,
            asset_id: asset.asset_id,
            asset_source: asset.asset_source,
          };
        }),
      };
    }),
  };

  if (!changed) throw new Error('Creative element not found');
  return CreativeDocumentJsonSchema.parse(nextDocument);
}

async function createVersion(
  documentId: string,
  workspaceId: string,
  documentJson: CreativeDocumentJson,
  userId: string,
  changeSummary: string,
  status: 'draft' | 'submitted' | 'approved' | 'archived' = 'draft',
) {
  const { supabase } = await getCurrentWorkspace();
  const { data: latest } = await supabase
    .from('creative_versions')
    .select('version')
    .eq('workspace_id', workspaceId)
    .eq('creative_document_id', documentId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = Number(latest?.version ?? 0) + 1;
  const { error } = await supabase.from('creative_versions').insert({
    workspace_id: workspaceId,
    creative_document_id: documentId,
    version: nextVersion,
    status,
    document_json: documentJson,
    change_summary: changeSummary,
    created_by: userId,
  });

  if (error) throw new Error(error.message);
  return nextVersion;
}

export async function updateCreativeElement(documentId: string, formData: FormData) {
  const input = ElementUpdateSchema.parse({
    slide_id: formData.get('slide_id'),
    element_id: formData.get('element_id'),
    element_type: formData.get('element_type'),
    text: optionalText(formData.get('text')) ?? '',
    asset_ref: optionalText(formData.get('asset_ref')),
    x: optionalNumber(formData.get('x')),
    y: optionalNumber(formData.get('y')),
    width: optionalNumber(formData.get('width')),
    height: optionalNumber(formData.get('height')),
    rotation: optionalNumber(formData.get('rotation')),
    change_summary: optionalText(formData.get('change_summary')),
  });

  if (isDemoMode()) {
    revalidatePath(`/editor/${documentId}`);
    redirect(`/editor/${documentId}`);
  }

  const { supabase, user, membership } = await getCurrentWorkspace();
  const workspaceId = requiredWorkspaceId(membership);

  const { data: documentRow, error } = await supabase
    .from('creative_documents')
    .select('id, document_json, metadata')
    .eq('id', documentId)
    .eq('workspace_id', workspaceId)
    .single();

  if (error || !documentRow) throw new Error(error?.message ?? 'Creative document not found');

  const documentJson = CreativeDocumentJsonSchema.parse(documentRow.document_json);
  const nextDocument = updateElement(documentJson, input);
  const summary = input.change_summary ?? `Atualizou ${input.element_type === 'text' ? 'texto' : 'asset'} ${input.element_id}`;

  const { error: updateError } = await supabase
    .from('creative_documents')
    .update({
      status: 'editing',
      document_json: nextDocument,
      metadata: {
        ...((documentRow.metadata as Record<string, unknown> | null) ?? {}),
        schema_version: 1,
        last_change_summary: summary,
      },
    })
    .eq('id', documentId)
    .eq('workspace_id', workspaceId);

  if (updateError) throw new Error(updateError.message);
  await createVersion(documentId, workspaceId, nextDocument, user.id, summary);

  revalidatePath('/editor');
  revalidatePath(`/editor/${documentId}`);
  redirect(`/editor/${documentId}`);
}

export async function submitCreativeDocumentApproval(documentId: string, formData?: FormData) {
  const notes = optionalText(formData?.get('notes') ?? null);

  if (isDemoMode()) {
    revalidatePath('/approvals');
    redirect('/approvals?target_type=creative_document&status=pending');
  }

  const { supabase, user, membership } = await getCurrentWorkspace();
  const workspaceId = requiredWorkspaceId(membership);

  const { data: documentRow, error } = await supabase
    .from('creative_documents')
    .select('id, brand_id, title, template_ref, document_json, metadata')
    .eq('id', documentId)
    .eq('workspace_id', workspaceId)
    .single();

  if (error || !documentRow) throw new Error(error?.message ?? 'Creative document not found');

  const documentJson = CreativeDocumentJsonSchema.parse(documentRow.document_json);
  const version = await createVersion(
    documentId,
    workspaceId,
    documentJson,
    user.id,
    notes ?? 'Documento enviado para aprovacao humana.',
    'submitted',
  );

  const { error: approvalError } = await supabase.from('approvals').insert({
    workspace_id: workspaceId,
    target_type: 'creative_document',
    target_id: documentId,
    status: 'pending',
    metadata: {
      schema_version: 1,
      brand_id: documentRow.brand_id,
      title: documentRow.title,
      template_ref: documentRow.template_ref,
      creative_document_id: documentId,
      version,
      slides_count: documentJson.slides.length,
    },
    created_by: user.id,
  });

  if (approvalError) throw new Error(approvalError.message);

  const { error: updateError } = await supabase
    .from('creative_documents')
    .update({
      status: 'ready_for_approval',
      metadata: {
        ...((documentRow as { metadata?: Record<string, unknown> }).metadata ?? {}),
        schema_version: 1,
        submitted_version: version,
        submitted_notes: notes ?? null,
      },
    })
    .eq('id', documentId)
    .eq('workspace_id', workspaceId);

  if (updateError) throw new Error(updateError.message);

  revalidatePath('/editor');
  revalidatePath(`/editor/${documentId}`);
  revalidatePath('/approvals');
  redirect('/approvals?target_type=creative_document&status=pending');
}

export async function requestCreativeDocumentRender(documentId: string, formData: FormData) {
  const outputFormat = RenderOutputFormatSchema.parse(formData.get('output_format') || 'png');

  if (isDemoMode()) {
    revalidatePath('/jobs');
    redirect('/jobs?queue=creative-render');
  }

  const { supabase, user, membership } = await getCurrentWorkspace();
  const workspaceId = requiredWorkspaceId(membership);

  const { data: documentRow, error } = await supabase
    .from('creative_documents')
    .select('id, brand_id, metadata')
    .eq('id', documentId)
    .eq('workspace_id', workspaceId)
    .single();

  if (error || !documentRow) throw new Error(error?.message ?? 'Creative document not found');

  const endpoint = process.env.ORCHESTRATOR_INTERNAL_URL ?? 'http://localhost:3002';
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) throw new Error('INTERNAL_SECRET is required');

  const res = await fetch(`${endpoint}/jobs/render-creative-document`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-secret': secret,
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      brand_id: documentRow.brand_id,
      creative_document_id: documentRow.id,
      requested_by: user.id,
      output_format: outputFormat,
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Could not enqueue creative render job: ${await res.text()}`);
  }

  revalidatePath('/jobs');
  revalidatePath('/editor');
  revalidatePath(`/editor/${documentId}`);
  redirect('/jobs?queue=creative-render');
}
