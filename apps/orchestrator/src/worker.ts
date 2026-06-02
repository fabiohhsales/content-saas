import { Worker } from 'bullmq';
import { z } from 'zod';
import { GenerateBrandMemoryInputSchema, GenerateRenderPreviewInputSchema } from '@content-saas/contracts';
import { BRAND_MEMORY_QUEUE, RENDER_PREVIEW_QUEUE, redisConnection } from './queues.js';
import { generateBrandMemory } from './jobs/generate-brand-memory.js';
import { renderPreview } from './jobs/render-preview.js';
import { supabase } from './supabase.js';

const BrandMemoryWorkerPayloadSchema = GenerateBrandMemoryInputSchema.extend({
  job_run_id: z.string().uuid(),
});

const RenderPreviewWorkerPayloadSchema = GenerateRenderPreviewInputSchema.extend({
  job_run_id: z.string().uuid(),
});

async function markFailed(jobName: string, job: { data?: unknown; id?: string | number } | undefined, err: Error) {
  const data = job?.data as Record<string, unknown> | undefined;
  const jobRunId = typeof data?.job_run_id === 'string' ? data.job_run_id : null;
  const workspaceId = typeof data?.workspace_id === 'string' ? data.workspace_id : null;
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
      message: `${jobName} failed`,
      context_json: { message: err.message },
    });
  }
  console.error(`[${jobName}] failed ${job?.id}:`, err);
}

const brandMemoryWorker = new Worker(BRAND_MEMORY_QUEUE, async (job) => {
  const payload = BrandMemoryWorkerPayloadSchema.parse(job.data);
  return generateBrandMemory(payload, payload.job_run_id);
}, {
  connection: redisConnection,
  concurrency: 3,
});

brandMemoryWorker.on('completed', (job) => {
  console.log(`[brand-memory] completed ${job.id}`);
});

brandMemoryWorker.on('failed', async (job, err) => {
  await markFailed('generate_brand_memory', job, err);
});

const renderPreviewWorker = new Worker(RENDER_PREVIEW_QUEUE, async (job) => {
  const payload = RenderPreviewWorkerPayloadSchema.parse(job.data);
  return renderPreview(payload, payload.job_run_id);
}, {
  connection: redisConnection,
  concurrency: 2,
});

renderPreviewWorker.on('completed', (job) => {
  console.log(`[render-preview] completed ${job.id}`);
});

renderPreviewWorker.on('failed', async (job, err) => {
  await markFailed('render_preview', job, err);
});

process.on('SIGTERM', async () => {
  await brandMemoryWorker.close();
  await renderPreviewWorker.close();
  process.exit(0);
});

console.log('brand-memory and render-preview workers started');
