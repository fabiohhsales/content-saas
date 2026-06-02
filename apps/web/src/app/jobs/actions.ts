'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isDemoMode } from '@/lib/demo';

export async function retryJobRun(jobRunId: string) {
  if (isDemoMode()) {
    revalidatePath('/jobs');
    redirect('/jobs?status=queued');
  }

  const endpoint = process.env.ORCHESTRATOR_INTERNAL_URL ?? 'http://localhost:3002';
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) throw new Error('INTERNAL_SECRET is required');

  const res = await fetch(`${endpoint}/jobs/${jobRunId}/retry`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-secret': secret,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Could not retry job: ${await res.text()}`);
  }

  revalidatePath('/jobs');
  redirect('/jobs?status=queued');
}
