import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ContentItemCopyJsonSchema,
  EditorialPlaybookJsonSchema,
  GenerateBrandMemoryInputSchema,
  GenerateContentPlanInputSchema,
  GenerateRenderPreviewInputSchema,
  HAIR_TRANSPLANT_PLAYBOOK,
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
      playbook_slug: 'transplante-capilar',
      playbook_version: 1,
      funnel_distribution: {
        topo: 35,
        meio: 35,
        fundo: 20,
        institucional: 10,
      },
    },
  });

  assert.equal(parsed.period_start, '2026-06-01');
  assert.equal(parsed.objective, 'Gerar autoridade editorial para a marca.');
  assert.deepEqual(parsed.strategy?.channels, ['Instagram', 'LinkedIn']);
  assert.deepEqual(parsed.strategy?.preferred_templates, ['photo-overlay-01']);
  assert.equal(parsed.strategy?.playbook_slug, 'transplante-capilar');
});

test('hair transplant editorial playbook validates canonical strategy payload', () => {
  const parsed = EditorialPlaybookJsonSchema.parse(HAIR_TRANSPLANT_PLAYBOOK);

  assert.equal(parsed.vertical, 'transplante_capilar');
  assert.equal(parsed.funnel_distribution.topo, 35);
  assert.ok(parsed.compliance_rules.some((rule) => rule.includes('Nao prometer resultado')));
});

test('content item copy contract accepts editorial review fields', () => {
  const parsed = ContentItemCopyJsonSchema.parse({
    schema_version: 1,
    channel: 'Instagram',
    format: 'carrossel',
    template_id: 'paper-editorial-01',
    funnel_stage: 'meio',
    editorial_pillar: 'Tecnica e processo',
    theme: 'FUE No Shave',
    headline: 'FUE No Shave: para quem faz sentido?',
    central_idea: 'Explicar tecnica sem vender como solucao universal.',
    script_outline: ['Hook', 'Resposta direta', 'Ressalva medica'],
    cta: 'Entenda qual tecnica faz sentido para o seu caso.',
    commercial_intent: 'medio',
    compliance_notes: ['Cada caso precisa de avaliacao individual.'],
    quality_check: [{ criterion: 'A headline responde uma dor real?', passed: true }],
    playbook_slug: 'transplante-capilar',
    playbook_version: 1,
    generation_mode: 'mock_structured_playbook',
  });

  assert.equal(parsed.funnel_stage, 'meio');
  assert.equal(parsed.quality_check[0]?.passed, true);
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
