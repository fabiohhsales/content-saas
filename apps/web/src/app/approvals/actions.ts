'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getCurrentWorkspace } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo';

const DecisionSchema = z.object({
  status: z.enum(['approved', 'changes_requested', 'rejected']),
  notes: z.string().max(2000).optional(),
});

export async function decideApproval(approvalId: string, formData: FormData) {
  const options = formData.getAll('feedback_option').map(String).filter(Boolean);
  const rawNotes = String(formData.get('notes') || '');
  const notes = [...options, rawNotes].filter(Boolean).join(' | ') || undefined;
  const input = DecisionSchema.parse({
    status: formData.get('status'),
    notes,
  });

  if (isDemoMode()) {
    revalidatePath('/approvals');
    redirect(`/approvals?status=${input.status}`);
  }

  const { supabase, user, membership } = await getCurrentWorkspace();
  const workspaceId = membership?.workspace_id;
  if (!workspaceId) throw new Error('Workspace is required');

  const { error } = await supabase
    .from('approvals')
    .update({
      status: input.status,
      notes: input.notes ?? null,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq('id', approvalId)
    .eq('workspace_id', workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath('/approvals');
  redirect(`/approvals?status=${input.status}`);
}
