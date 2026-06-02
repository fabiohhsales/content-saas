import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from './supabase';
import { DEMO_USER_ID, DEMO_WORKSPACE_ID, demoWorkspace, isDemoMode } from './demo';

export async function requireUser() {
  if (isDemoMode()) {
    return {
      supabase: null as any,
      user: {
        id: DEMO_USER_ID,
        email: 'demo@content-saas.local',
      },
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

export async function getCurrentWorkspace() {
  if (isDemoMode()) {
    return {
      supabase: null as any,
      user: {
        id: DEMO_USER_ID,
        email: 'demo@content-saas.local',
      },
      membership: {
        workspace_id: DEMO_WORKSPACE_ID,
        role: 'owner',
        workspaces: demoWorkspace,
      },
    };
  }

  const { supabase, user } = await requireUser();
  const { data: membership } = await supabase
    .from('members')
    .select('workspace_id, role, workspaces(id, name, slug)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  return { supabase, user, membership };
}
