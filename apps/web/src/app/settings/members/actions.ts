'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { WorkspaceRoleSchema } from '@content-saas/contracts';
import { getCurrentWorkspace } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo';

const AdminRoles = ['owner', 'admin'] as const;

const AddMemberFormSchema = z.object({
  user_id: z.string().uuid(),
  role: WorkspaceRoleSchema.exclude(['owner']),
});

const UpdateMemberRoleFormSchema = z.object({
  role: WorkspaceRoleSchema,
});

function requiredWorkspace(membership: Awaited<ReturnType<typeof getCurrentWorkspace>>['membership']) {
  if (!membership?.workspace_id) throw new Error('Workspace is required');
  return membership;
}

function assertCanManageMembers(role: string | undefined) {
  if (!role || !AdminRoles.includes(role as (typeof AdminRoles)[number])) {
    throw new Error('Apenas owner/admin podem gerenciar membros');
  }
}

export async function addWorkspaceMember(formData: FormData) {
  if (isDemoMode()) {
    revalidatePath('/settings/members');
    return;
  }

  const { supabase, membership } = await getCurrentWorkspace();
  const currentMembership = requiredWorkspace(membership);
  assertCanManageMembers(currentMembership.role);

  const input = AddMemberFormSchema.parse({
    user_id: formData.get('user_id'),
    role: formData.get('role'),
  });

  const { error } = await supabase
    .from('members')
    .insert({
      workspace_id: currentMembership.workspace_id,
      user_id: input.user_id,
      role: input.role,
    });

  if (error) throw new Error(error.message);
  revalidatePath('/settings/members');
}

export async function updateWorkspaceMemberRole(memberId: string, formData: FormData) {
  if (isDemoMode()) {
    revalidatePath('/settings/members');
    return;
  }

  const { supabase, user, membership } = await getCurrentWorkspace();
  const currentMembership = requiredWorkspace(membership);
  assertCanManageMembers(currentMembership.role);

  const input = UpdateMemberRoleFormSchema.parse({
    role: formData.get('role'),
  });

  const { data: target, error: targetError } = await supabase
    .from('members')
    .select('id, user_id, role')
    .eq('id', memberId)
    .eq('workspace_id', currentMembership.workspace_id)
    .single();

  if (targetError || !target) throw new Error(targetError?.message ?? 'Member not found');
  if (target.user_id === user.id && target.role === 'owner' && input.role !== 'owner') {
    throw new Error('Voce nao pode remover seu proprio papel de owner');
  }

  const { error } = await supabase
    .from('members')
    .update({ role: input.role })
    .eq('id', memberId)
    .eq('workspace_id', currentMembership.workspace_id);

  if (error) throw new Error(error.message);
  revalidatePath('/settings/members');
}

export async function removeWorkspaceMember(memberId: string) {
  if (isDemoMode()) {
    revalidatePath('/settings/members');
    return;
  }

  const { supabase, user, membership } = await getCurrentWorkspace();
  const currentMembership = requiredWorkspace(membership);
  assertCanManageMembers(currentMembership.role);

  const { data: target, error: targetError } = await supabase
    .from('members')
    .select('id, user_id, role')
    .eq('id', memberId)
    .eq('workspace_id', currentMembership.workspace_id)
    .single();

  if (targetError || !target) throw new Error(targetError?.message ?? 'Member not found');
  if (target.user_id === user.id) {
    throw new Error('Voce nao pode remover a si mesmo do workspace');
  }

  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', memberId)
    .eq('workspace_id', currentMembership.workspace_id);

  if (error) throw new Error(error.message);
  revalidatePath('/settings/members');
}
