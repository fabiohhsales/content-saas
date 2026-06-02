import express, { Request, Response } from 'express';
import { CreativeRenderRequestSchema, RenderRequestSchema } from '@content-saas/contracts';
import { renderCarousel, renderCreativeDocument, renderDynamicSlide, renderSlide, closeBrowser } from './renderer';
import { listTemplates, loadSchema } from './template-loader';
import { RenderCarouselRequest, RenderDynamicRequest, RenderSlide } from './types';

const app = express();
app.use(express.json({ limit: '100mb' }));

// ─── Health ──────────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    templates: listTemplates(),
  });
});

// ─── List templates ───────────────────────────────────────────────────────────

app.get('/templates', (_req: Request, res: Response) => {
  res.json({ templates: listTemplates() });
});

app.get('/templates/:id/schema', (req: Request, res: Response) => {
  try {
    const schema = loadSchema(req.params.id);
    res.json(schema);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// ─── Render single slide ──────────────────────────────────────────────────────

app.post('/render', async (req: Request, res: Response) => {
  const parsed = RenderRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid render payload', issues: parsed.error.issues });
  }
  const slide = parsed.data as RenderSlide;

  if (!slide?.template_id) {
    return res.status(400).json({ error: 'template_id is required' });
  }

  try {
    const { buffer, post_render_qa } = await renderSlide(slide);
    return res.json({ slide: buffer.toString('base64'), output_format: slide.output_format ?? 'png', post_render_qa });
  } catch (err: any) {
    console.error('[/render] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/render-dynamic', async (req: Request, res: Response) => {
  const body = req.body as RenderDynamicRequest;

  if (!body?.template_id) {
    return res.status(400).json({ error: 'template_id is required' });
  }
  if (!body.template_source?.html || !body.template_source?.schema) {
    return res.status(400).json({ error: 'template_source.html and template_source.schema are required' });
  }

  try {
    const { buffer, post_render_qa } = await renderDynamicSlide(body, body.template_source);
    return res.json({ slide: buffer.toString('base64'), output_format: body.output_format ?? 'png', post_render_qa });
  } catch (err: any) {
    console.error('[/render-dynamic] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Render carousel ──────────────────────────────────────────────────────────

app.post('/render-carousel', async (req: Request, res: Response) => {
  const body = req.body as RenderCarouselRequest;

  if (!Array.isArray(body?.slides) || body.slides.length === 0) {
    return res.status(400).json({ error: 'slides[] array is required' });
  }
  if (body.slides.length > 10) {
    return res.status(400).json({ error: 'max 10 slides per request' });
  }
  for (const [i, s] of body.slides.entries()) {
    if (!s.template_id) {
      return res.status(400).json({ error: `slides[${i}].template_id is required` });
    }
  }

  try {
    const outcomes = await renderCarousel(body.slides);
    return res.json({
      slides: outcomes.map((o) => o.buffer.toString('base64')),
      output_format: body.slides[0]?.output_format ?? 'png',
      post_render_qa: outcomes.map((o) => o.post_render_qa),
      count: outcomes.length,
    });
  } catch (err: any) {
    console.error('[/render-carousel] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

app.post('/render-document', async (req: Request, res: Response) => {
  const parsed = CreativeRenderRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid creative render payload', issues: parsed.error.issues });
  }

  try {
    const outcomes = await renderCreativeDocument(parsed.data.document, parsed.data.asset_urls, parsed.data.output_format);
    return res.json({
      slides: outcomes.map((outcome) => outcome.buffer.toString('base64')),
      output_format: parsed.data.output_format,
      post_render_qa: outcomes.map((outcome) => outcome.post_render_qa),
      count: outcomes.length,
    });
  } catch (err: any) {
    console.error('[/render-document] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit(0);
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

app.listen(PORT, () => {
  console.log(`render-service running on port ${PORT}`);
  console.log(`templates: ${listTemplates().join(', ') || '(none yet)'}`);
});

export default app;
