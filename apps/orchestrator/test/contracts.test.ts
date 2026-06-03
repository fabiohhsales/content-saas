import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GenerateBrandMemoryInputSchema,
  GenerateContentPlanInputSchema,
  GenerateRenderPreviewInputSchema,
  RenderCreativeDocumentInputSchema,
} from '@content-saas/contracts';

test('generate_brand_memory input contract accepts canonical payload', () => {
  const parsed = GenerateBrandMemoryInputSchema.parse({
    workspace_id: '00000000-0000-4000-8000-000000000001',
    brand_id: '00000000-0000-4000-8000-000000000002',
    requested_by: '00000000-0000-4000-8000-000000000003',
  });

  assert.equal(parsed.brand_id, '00000000-0000-4000-8000-000000000002');
});

test('render_preview input contract accepts canonical payload and defaults png', () => {
  const parsed = GenerateRenderPreviewInputSchema.parse({
    workspace_id: '00000000-0000-4000-8000-000000000001',
    brand_id: '00000000-0000-4000-8000-000000000002',
    content_item_id: '00000000-0000-4000-8000-000000000004',
    requested_by: '00000000-0000-4000-8000-000000000003',
  });

  assert.equal(parsed.content_item_id, '00000000-0000-4000-8000-000000000004');
  assert.equal(parsed.output_format, 'png');
});

test('generate_content_plan input contract accepts canonical payload', () => {
  const parsed = GenerateContentPlanInputSchema.parse({
    workspace_id: '00000000-0000-4000-8000-000000000001',
    brand_id: '00000000-0000-4000-8000-000000000002',
    requested_by: '00000000-0000-4000-8000-000000000003',
    period_start: '2026-06-01',
    period_end: '2026-06-30',
    objective: 'Gerar autoridade editorial para a marca.',
    strategy: {
      schema_version: 1,
      objective: 'Gerar autoridade editorial para a marca.',
      channels: ['Instagram', 'LinkedIn'],
      frequency: '3 posts por semana',
      pillars: ['educacao', 'prova social'],
      campaigns: 'Campanha de avaliacao inicial',
      preferred_templates: ['photo-overlay-01'],
      restrictions: 'Evitar promessas absolutas.',
    },
  });

  assert.equal(parsed.period_start, '2026-06-01');
  assert.equal(parsed.objective, 'Gerar autoridade editorial para a marca.');
  assert.deepEqual(parsed.strategy?.channels, ['Instagram', 'LinkedIn']);
  assert.deepEqual(parsed.strategy?.preferred_templates, ['photo-overlay-01']);
});

test('render_creative_document input contract accepts canonical payload and defaults png', () => {
  const parsed = RenderCreativeDocumentInputSchema.parse({
    workspace_id: '00000000-0000-4000-8000-000000000001',
    brand_id: '00000000-0000-4000-8000-000000000002',
    creative_document_id: '00000000-0000-4000-8000-000000000005',
    requested_by: '00000000-0000-4000-8000-000000000003',
  });

  assert.equal(parsed.creative_document_id, '00000000-0000-4000-8000-000000000005');
  assert.equal(parsed.output_format, 'png');
});
