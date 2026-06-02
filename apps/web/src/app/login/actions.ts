'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { isDemoMode } from '@/lib/demo';
import { createServerSupabaseClient } from '@/lib/supabase';

const LoginSchema = z.object({
  email: z.string().email(),
});

export async function signInWithEmail(formData: FormData) {
  if (isDemoMode()) {
    redirect('/brands');
  }

  const { email } = LoginSchema.parse({ email: formData.get('email') });
  const supabase = await createServerSupabaseClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) throw new Error(error.message);
  redirect('/login?sent=1');
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect('/login');
}
