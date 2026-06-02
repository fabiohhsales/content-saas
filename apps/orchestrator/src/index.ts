import express from 'express';
import { z } from 'zod';
import { GenerateBrandMemoryInputSchema } from '@content-saas/contracts';
import { getEnv } from './env.js';
import { requireInternalSecret } from './auth.js';
import { brandMemoryQueue } from './queues.js';
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
