import express from 'express';
import { z } from 'zod';
import {
  GenerateBrandMemoryInputSchema,
  GenerateContentPlanInputSchema,
  GenerateRenderPreviewInputSchema,
  RenderCreativeDocumentInputSchema,
} from '@content-saas/contracts';
import { getEnv } from './env.js';
import { requireInternalSecret } from './auth.js';
import { brandMemoryQueue, contentPlanQueue, creativeRenderQueue, renderPreviewQueue } from './queues.js';
import { supabase } from './supabase.js';

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'orchestrator', timestamp: new Date().toISOString() });
});

app.post('/jobs/generate-brand-memory', requireInternalSecret, async (req, res) => {
  const parsed = GenerateBrandMemoryInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    return;
  }

  const input = parsed.data;
  const { data: jobRun, error } = await supabase
    .from('job_runs')
    .insert({
      workspace_id: input.workspace_id,
      brand_id: input.brand_id,
      job_name: 'generate_brand_memory',
      queue_name: 'brand-memory',
      status: 'queued',
      input_json: input,
      created_by: input.requested_by,
    })
    .select('id')
    .single();

  if (error || !jobRun) {
    res.status(500).json({ error: error?.message ?? 'Could not create job run' });
    return;
  }

  const job = await brandMemoryQueue.add('generate_brand_memory', {
    ...input,
    job_run_id: jobRun.id,
  }, {
    jobId: jobRun.id,
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 },
  });

  res.status(202).json({ job_run_id: jobRun.id, bullmq_job_id: job.id, status: 'queued' });
});

app.post('/jobs/render-preview', requireInternalSecret, async (req, res) => {
  const parsed = GenerateRenderPreviewInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    return;
  }

  const input = parsed.data;
  const { data: jobRun, error } = await supabase
    .from('job_runs')
    .insert({
      workspace_id: input.workspace_id,
      brand_id: input.brand_id,
      job_name: 'render_preview',
      queue_name: 'render-preview',
      status: 'queued',
      input_json: input,
      created_by: input.requested_by,
    })
    .select('id')
    .single();

  if (error || !jobRun) {
    res.status(500).json({ error: error?.message ?? 'Could not create job run' });
    return;
  }

  const job = await renderPreviewQueue.add('render_preview', {
    ...input,
    job_run_id: jobRun.id,
  }, {
    jobId: jobRun.id,
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 },
  });

  res.status(202).json({ job_run_id: jobRun.id, bullmq_job_id: job.id, status: 'queued' });
});

app.post('/jobs/render-creative-document', requireInternalSecret, async (req, res) => {
  const parsed = RenderCreativeDocumentInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    return;
  }

  const input = parsed.data;
  const { data: jobRun, error } = await supabase
    .from('job_runs')
    .insert({
      workspace_id: input.workspace_id,
      brand_id: input.brand_id,
      job_name: 'render_creative_document',
      queue_name: 'creative-render',
      status: 'queued',
      input_json: input,
      created_by: input.requested_by,
    })
    .select('id')
    .single();

  if (error || !jobRun) {
    res.status(500).json({ error: error?.message ?? 'Could not create job run' });
    return;
  }

  const job = await creativeRenderQueue.add('render_creative_document', {
    ...input,
    job_run_id: jobRun.id,
  }, {
    jobId: jobRun.id,
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 },
  });

  res.status(202).json({ job_run_id: jobRun.id, bullmq_job_id: job.id, status: 'queued' });
});

app.post('/jobs/generate-content-plan', requireInternalSecret, async (req, res) => {
  const parsed = GenerateContentPlanInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    return;
  }

  const input = parsed.data;
  const { data: jobRun, error } = await supabase
    .from('job_runs')
    .insert({
      workspace_id: input.workspace_id,
      brand_id: input.brand_id,
      job_name: 'generate_content_plan',
      queue_name: 'content-plan',
      status: 'queued',
      input_json: input,
      created_by: input.requested_by,
    })
    .select('id')
    .single();

  if (error || !jobRun) {
    res.status(500).json({ error: error?.message ?? 'Could not create job run' });
    return;
  }

  const job = await contentPlanQueue.add('generate_content_plan', {
    ...input,
    job_run_id: jobRun.id,
  }, {
    jobId: jobRun.id,
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 },
  });

  res.status(202).json({ job_run_id: jobRun.id, bullmq_job_id: job.id, status: 'queued' });
});

app.post('/jobs/:id/retry', requireInternalSecret, async (req, res) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: 'Invalid job id' });
    return;
  }

  const { data: original, error: originalError } = await supabase
    .from('job_runs')
    .select('*')
    .eq('id', params.data.id)
    .single();

  if (originalError || !original) {
    res.status(404).json({ error: originalError?.message ?? 'Job not found' });
    return;
  }

  if (original.status !== 'failed') {
    res.status(409).json({ error: 'Only failed jobs can be retried' });
    return;
  }

  if (original.job_name !== 'generate_brand_memory' || original.queue_name !== 'brand-memory') {
    res.status(422).json({ error: `Retry is not supported for ${original.job_name}` });
    return;
  }

  const parsedInput = GenerateBrandMemoryInputSchema.safeParse(original.input_json);
  if (!parsedInput.success) {
    res.status(422).json({ error: 'Original job input is invalid', issues: parsedInput.error.issues });
    return;
  }

  const { data: retryRun, error: retryError } = await supabase
    .from('job_runs')
    .insert({
      workspace_id: original.workspace_id,
      brand_id: original.brand_id,
      job_name: original.job_name,
      queue_name: original.queue_name,
      status: 'queued',
      input_json: parsedInput.data,
      created_by: parsedInput.data.requested_by,
      metadata: {
        schema_version: 1,
        retry_of_job_run_id: original.id,
      },
    })
    .select('id')
    .single();

  if (retryError || !retryRun) {
    res.status(500).json({ error: retryError?.message ?? 'Could not create retry job run' });
    return;
  }

  const job = await brandMemoryQueue.add('generate_brand_memory', {
    ...parsedInput.data,
    job_run_id: retryRun.id,
  }, {
    jobId: retryRun.id,
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 },
  });

  await supabase.from('automation_logs').insert({
    workspace_id: original.workspace_id,
    job_run_id: retryRun.id,
    level: 'info',
    message: 'job retry queued',
    context_json: {
      retried_from_job_run_id: original.id,
      bullmq_job_id: job.id,
    },
  });

  res.status(202).json({
    job_run_id: retryRun.id,
    retried_from_job_run_id: original.id,
    bullmq_job_id: job.id,
    status: 'queued',
  });
});

app.get('/jobs/:id', requireInternalSecret, async (req, res) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: 'Invalid job id' });
    return;
  }

  const { data, error } = await supabase
    .from('job_runs')
    .select('*')
    .eq('id', params.data.id)
    .single();

  if (error || !data) {
    res.status(404).json({ error: error?.message ?? 'Job not found' });
    return;
  }

  res.json(data);
});

const env = getEnv();
app.listen(env.PORT, () => {
  console.log(`orchestrator running on port ${env.PORT}`);
});
