import { Worker } from 'bullmq';
import { z } from 'zod';
import { GenerateBrandMemoryInputSchema } from '@content-saas/contracts';
import { BRAND_MEMORY_QUEUE, redisConnection } from './queues.js';
import { generateBrandMemory } from './jobs/generate-brand-memory.js';
import { supabase } from './supabase.js';

const WorkerPayloadSchema = GenerateBrandMemoryInputSchema.extend({
  job_run_id: z.string().uuid(),
});

const worker = new Worker(BRAND_MEMORY_QUEUE, async (job) => {
  const payload = WorkerPayloadSchema.parse(job.data);
  return generateBrandMemory(payload, payload.job_run_id);
}, {
  connection: redisConnection,
  concurrency: 3,
});

worker.on('completed', (job) => {
  console.log(`[brand-memory] completed ${job.id}`);
});

worker.on('failed', async (job, err) => {
  const jobRunId = typeof job?.data?.job_run_id === 'string' ? job.data.job_run_id : null;
  const workspaceId = typeof job?.data?.workspace_id === 'string' ? job.data.workspace_id : null;
  if (jobRunId) {
    await supabase
      .from('job_runs')
      .update({
        status: 'failed',
        error_json: { message: err.message, stack: err.stack },
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobRunId);
  }
  if (jobRunId && workspaceId) {
    await supabase.from('automation_logs').insert({
      workspace_id: workspaceId,
      job_run_id: jobRunId,
      level: 'error',
      message: 'generate_brand_memory failed',
      context_json: { message: err.message },
    });
  }
  console.error(`[brand-memory] failed ${job?.id}:`, err);
});

process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});

console.log('brand-memory worker started');
