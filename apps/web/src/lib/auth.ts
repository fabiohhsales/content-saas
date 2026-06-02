import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from './supabase';

export async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

export async function getCurrentWorkspace() {
  const { supabase, user } = await requireUser();
  const { data: membership } = await supabase
    .from('members')
    .select('workspace_id, role, workspaces(id, name, slug)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  return { supabase, user, membership };
}
