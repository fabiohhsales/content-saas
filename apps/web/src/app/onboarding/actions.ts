'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { slugify } from '@/lib/slug';

const WorkspaceFormSchema = z.object({
  name: z.string().min(2),
});

export async function createWorkspace(formData: FormData) {
  const { supabase, user } = await requireUser();
  const { name } = WorkspaceFormSchema.parse({ name: formData.get('name') });
  const slug = slugify(name);

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({ name, slug, created_by: user.id })
    .select('id')
    .single();

  if (workspaceError || !workspace) {
    throw new Error(workspaceError?.message ?? 'Could not create workspace');
  }

  const { error: memberError } = await supabase
    .from('members')
    .insert({ workspace_id: workspace.id, user_id: user.id, role: 'owner' });

  if (memberError) throw new Error(memberError.message);
  redirect('/brands');
}
