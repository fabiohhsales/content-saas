import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { renderCreativeDocument, renderDynamicSlide, renderSlide, closeBrowser, injectDesignTokens } from '../src/renderer.js';
import { listTemplates, loadSchema } from '../src/template-loader.js';
import { RenderFields, RenderSlide } from '../src/types.js';

// 1x1 transparent PNG — enough to satisfy <img> hydration for templates that
// require a photo asset. Not a real image but valid PNG bytes.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function buildFixture(templateId: string): RenderSlide {
  const schema = loadSchema(templateId);
  const fields: RenderFields = {};
  for (const [key, cfg] of Object.entries(schema.fields)) {
    // Always populate every field; required ones MUST be non-empty and must
    // appear in the rendered DOM, optionals just keep the layout stable.
    const stem = `${key.replace(/_/g, ' ')} demo`;
    const limit = Math.max(4, Math.min(cfg.max_chars, 40));
    fields[key] = stem.slice(0, limit);
  }
  const assets: Record<string, string> = {};
  for (const [slot, cfg] of Object.entries(schema.asset_slots ?? {})) {
    if (cfg.required || slot === 'photo' || slot === 'logo') {
      assets[slot] = TINY_PNG_BASE64;
    }
  }
  return { template_id: templateId, fields, assets: assets as RenderSlide['assets'] };
}

after(async () => {
  await closeBrowser();
});

for (const templateId of listTemplates()) {
  test(`renders ${templateId} with required fields visible`, async () => {
    const fixture = buildFixture(templateId);
    const { buffer, post_render_qa } = await renderSlide(fixture);
    assert.ok(buffer.length > 1000, `expected PNG > 1KB, got ${buffer.length} bytes`);
    assert.ok(post_render_qa, 'expected post_render_qa metadata');
  });
}

test('HYDRATION_FAILED when required field is empty', async () => {
  const templates = listTemplates();
  // Pick the first template that has at least one required field.
  const target = templates.find((id) => {
    const s = loadSchema(id);
    return Object.values(s.fields).some((f) => f.required);
  });
  assert.ok(target, 'expected at least one template with a required field');

  const fixture = buildFixture(target!);
  const schema = loadSchema(target!);
  const firstRequired = Object.entries(schema.fields).find(([, c]) => c.required)![0];
  fixture.fields[firstRequired] = '';

  await assert.rejects(
    () => renderSlide(fixture),
    /HYDRATION_FAILED/,
    `expected HYDRATION_FAILED when ${firstRequired} is empty`,
  );
});

test('injectDesignTokens adds safe tokens and ignores unsafe CSS values', () => {
  const html = '<html><head></head><body></body></html>';
  const injected = injectDesignTokens(html, {
    '--bg-dark': '#003A3A',
    '--accent': 'rgba(255, 176, 0, 0.8)',
    '--bad': '#fff; background: red',
    'background': '#000000',
  });

  assert.match(injected, /<style id="design-tokens">/);
  assert.match(injected, /--bg-dark: #003A3A;/);
  assert.match(injected, /--accent: rgba\(255, 176, 0, 0.8\);/);
  assert.doesNotMatch(injected, /background: red/);
  assert.doesNotMatch(injected, /background: #000000/);
});

test('design_tokens change rendered output bytes for a tokenized template', async () => {
  const fixture = buildFixture('statement-dark-01');
  const { buffer: defaultBuffer } = await renderSlide(fixture);
  const { buffer: tokenizedBuffer } = await renderSlide({
    ...fixture,
    design_tokens: {
      '--bg-dark': '#003A3A',
      '--accent': '#FFB000',
      '--text-on-dark': '#FFFFFF',
      '--text-on-light': '#001B1B',
    },
  });

  assert.notEqual(
    Buffer.compare(defaultBuffer, tokenizedBuffer),
    0,
    'expected custom design_tokens to change the rendered PNG',
  );
});

test('triptych-grid-01 handles compact and near-limit card content', async () => {
  const { buffer, post_render_qa } = await renderSlide({
    template_id: 'triptych-grid-01',
    fields: {
      brand_name: 'Hair & Health',
      titulo: 'Queda capilar? Descubra como',
      item_1_label: '1',
      item_1_texto: 'Queda difusa com inicio recente.',
      item_2_label: 'Comparacao',
      item_2_texto: 'Historico familiar, densidade e area doadora mudam a conduta.',
      item_3_label: 'DHI',
      item_3_texto: 'Tecnica e planejamento precisam conversar com seu diagnostico.',
    },
    assets: {},
  });

  assert.ok(buffer.length > 50000, `expected PNG > 50KB, got ${buffer.length} bytes`);
  assert.equal(post_render_qa.density_status, 'ok');
  assert.ok(
    !post_render_qa.truncated_fields.includes('titulo'),
    `expected titulo not truncated, got ${post_render_qa.truncated_fields.join(', ')}`,
  );
});

test('statement-dark-01 renders with and without highlight', async () => {
  const { buffer: withHighlight } = await renderSlide({
    template_id: 'statement-dark-01',
    fields: {
      brand_name: 'Hair & Health',
      kicker: 'AVALIACAO',
      headline: 'Transplante capilar com decisao segura comeca no diagnostico',
      highlight: 'Nem toda queda e calvicie',
      supporting: 'A avaliacao orienta tecnica, expectativa e proximo passo.',
      cta: 'Agende uma avaliacao',
    },
    assets: {},
  });

  const { buffer: withoutHighlight } = await renderSlide({
    template_id: 'statement-dark-01',
    fields: {
      brand_name: 'Hair & Health',
      kicker: 'PROXIMO PASSO',
      headline: 'Entenda sua queda antes de escolher qualquer procedimento',
      highlight: '',
      supporting: 'Um diagnostico bem feito evita escolhas apressadas.',
      cta: 'Converse com a equipe',
    },
    assets: {},
  });

  assert.ok(withHighlight.length > 50000, `expected highlighted PNG > 50KB, got ${withHighlight.length} bytes`);
  assert.ok(withoutHighlight.length > 50000, `expected adaptive PNG > 50KB, got ${withoutHighlight.length} bytes`);
});

test('photo-overlay-01 supports gradient_overlay preset and custom object decorators', async () => {
  const baseSlide: RenderSlide = {
    template_id: 'photo-overlay-01',
    fields: {
      brand_name: 'Health Grow',
      tag: 'DIAGNOSTICO',
      title: 'Queda capilar pede contexto antes da conduta',
      subtitle: 'Historico, rotina e exame mudam a leitura do caso.',
    },
    assets: { photo: TINY_PNG_BASE64 },
  };

  const { buffer: presetBuffer, post_render_qa: presetQa } = await renderSlide({
    ...baseSlide,
    decorators: {
      gradient_overlay: 'accent',
      shape_accents: [{ type: 'line', placement: 'tl' }],
    },
  });
  const { buffer: customBuffer, post_render_qa: customQa } = await renderSlide({
    ...baseSlide,
    decorators: {
      gradient_overlay: {
        preset: 'dark',
        start: 'rgba(11,22,42,.2)',
        end: 'rgba(11,22,42,.9)',
        angle: 145,
        opacity: 0.92,
      },
      shape_accents: [{ type: 'circle', placement: 'bottom-right' }],
    },
  });

  assert.ok(presetBuffer.length > 50000, `expected preset decorator PNG > 50KB, got ${presetBuffer.length} bytes`);
  assert.ok(customBuffer.length > 50000, `expected custom decorator PNG > 50KB, got ${customBuffer.length} bytes`);
  assert.deepEqual(presetQa.truncated_fields, []);
  assert.deepEqual(customQa.truncated_fields, []);
}
);

test('decorator-capable templates remain compatible without decorators', async () => {
  const { buffer, post_render_qa } = await renderSlide({
    template_id: 'editorial-text-01',
    fields: {
      brand_name: 'Health Grow',
      kicker: 'CUIDADO',
      headline: 'Conteudo clinico precisa ser claro e visualmente leve',
      body: 'A hierarquia do texto ajuda o paciente a entender o proximo passo sem promessa exagerada.',
      bullet_1: 'Contexto primeiro',
      bullet_2: 'Conduta individual',
      bullet_3: 'Revisao humana',
      cta: 'Fale com a equipe',
    },
    assets: {},
  });

  assert.ok(buffer.length > 50000, `expected PNG without decorators > 50KB, got ${buffer.length} bytes`);
  assert.deepEqual(post_render_qa.truncated_fields, []);
});

test('renderDynamicSlide renders Drive-style HTML/CSS/schema without local template files', async () => {
  const { buffer } = await renderDynamicSlide(
    {
      template_id: 'drive_dynamic_story_01',
      fields: {
        headline: 'Diagnostico antes da decisao',
        subheadline: 'Entenda sua queda antes de escolher qualquer procedimento.',
        cta: 'Agende uma avaliacao',
      },
      assets: {},
      design_tokens: {
        '--brand-primary': '#222d41',
        '--brand-secondary': '#c8b08a',
      },
    },
    {
      html: '<!doctype html><html><head><link rel="stylesheet" href="style.css" /></head><body><main><h1>{{headline}}</h1><p>{{subheadline}}</p><strong>{{cta}}</strong></main></body></html>',
      css: 'html,body{margin:0;width:1080px;height:1920px;background:var(--brand-primary);color:white}main{padding:100px;font-family:Arial,sans-serif}h1{font-size:80px}p,strong{font-size:40px}',
      schema: {
        template_id: 'drive_dynamic_story_01',
        format: { type: 'story', width: 1080, height: 1920 },
        fields: {
          headline: { type: 'text', required: true, max_chars: 52 },
          subheadline: { type: 'text', required: true, max_chars: 90 },
          cta: { type: 'text', required: true, max_chars: 70 },
        },
      },
    },
  );

  assert.ok(buffer.length > 50000, `expected dynamic PNG > 50KB, got ${buffer.length} bytes`);
});

test('post-render QA detects genuinely clipped dynamic text fields', async () => {
  const { post_render_qa } = await renderDynamicSlide(
    {
      template_id: 'drive_dynamic_clipped_01',
      fields: {
        headline: 'Este texto deliberadamente longo deve ultrapassar a largura visivel do bloco',
      },
      assets: {},
    },
    {
      html: '<!doctype html><html><body><main><h1 id="visual-headline">{{headline}}</h1></main></body></html>',
      css: 'html,body{margin:0;width:1080px;height:1350px}main{padding:80px}#visual-headline{width:180px;white-space:nowrap;overflow:hidden;font-size:48px;font-family:Arial,sans-serif}',
      schema: {
        template_id: 'drive_dynamic_clipped_01',
        format: '1080x1350',
        fields: {
          headline: { type: 'text', required: true, max_chars: 120 },
        },
      },
    },
  );

  assert.deepEqual(post_render_qa.truncated_fields, ['headline']);
});

test('triptych-grid-01 com texto curto centraliza sem cortar nem esvaziar (§17.1)', async () => {
  const { buffer, post_render_qa } = await renderSlide({
    template_id: 'triptych-grid-01',
    fields: {
      brand_name: 'Hair & Health',
      titulo: 'Tres sinais para observar',
      item_1_label: '1',
      item_1_texto: 'Queda recente.',
      item_2_label: '2',
      item_2_texto: 'Area doadora.',
      item_3_label: '3',
      item_3_texto: 'Densidade.',
    },
    assets: {},
  });

  assert.ok(buffer.length > 50000, `expected PNG > 50KB, got ${buffer.length} bytes`);
  // Conteúdo curto não pode disparar truncamento e a densidade deve seguir ok.
  assert.deepEqual(post_render_qa.truncated_fields, []);
  assert.equal(post_render_qa.density_status, 'ok');
});

test('visual_diagnostics is populated with canvas/fields/assets/logo (§12)', async () => {
  const { post_render_qa } = await renderSlide({
    template_id: 'editorial-text-01',
    fields: {
      brand_name: 'Health Grow',
      kicker: 'CUIDADO',
      headline: 'Conteudo clinico precisa ser claro e visualmente leve',
      body: 'A hierarquia do texto ajuda o paciente a entender o proximo passo sem promessa exagerada.',
      bullet_1: 'Contexto primeiro',
      bullet_2: 'Conduta individual',
      bullet_3: 'Revisao humana',
      cta: 'Fale com a equipe',
    },
    assets: {},
  });

  const vd = post_render_qa.visual_diagnostics;
  assert.ok(vd, 'expected visual_diagnostics');
  assert.ok(vd!.canvas.width > 0 && vd!.canvas.height > 0, 'expected canvas dims');
  assert.ok(Array.isArray(vd!.fields) && vd!.fields.length > 0, 'expected field diagnostics');
  assert.ok(Array.isArray(vd!.assets), 'expected asset diagnostics');
  // Sem logo asset → não pode haver placeholder de logo (Fase 1 esconde o slot).
  const logoAsset = vd!.assets.find((a) => a.key === 'logo');
  assert.equal(logoAsset?.placeholder_visible, false, 'logo ausente não deve gerar placeholder');
  assert.equal(vd!.placeholder_visible, false, 'sem assets exigidos → sem placeholder');
});

test('visual_diagnostics marca clipped e frase incompleta no campo cortado', async () => {
  const { post_render_qa } = await renderDynamicSlide(
    {
      template_id: 'drive_dynamic_clipped_02',
      fields: { headline: 'Este texto deliberadamente longo deve ultrapassar a largura visivel do bloco e cortar' },
      assets: {},
    },
    {
      html: '<!doctype html><html><body><main><h1 id="headline">{{headline}}</h1></main></body></html>',
      css: 'html,body{margin:0;width:1080px;height:1350px}main{padding:80px}#headline{width:180px;white-space:nowrap;overflow:hidden;font-size:48px;font-family:Arial,sans-serif}',
      schema: {
        template_id: 'drive_dynamic_clipped_02',
        format: '1080x1350',
        fields: { headline: { type: 'text', required: true, max_chars: 120 } },
      },
    },
  );

  const field = post_render_qa.visual_diagnostics?.fields.find((f) => f.key === 'headline');
  assert.ok(field, 'expected headline field diagnostic');
  assert.equal(field!.clipped, true, 'headline deveria estar clipado');
  assert.ok(field!.box.width > 0, 'expected field box measured');
});

test('renderCreativeDocument renders editable document slides', async () => {
  const outcomes = await renderCreativeDocument(
    {
      schema_version: 1,
      canvas: { width: 1080, height: 1350, format: 'instagram_post' },
      template_id: 'assisted-editor-smoke',
      brand_id: 'brand-smoke',
      tokens: {
        background_color: '#f7f7f4',
        text_color: '#1f2933',
        font_family: 'Arial',
      },
      slides: [
        {
          id: 'slide-1',
          name: 'Smoke',
          background: { color: '#f7f7f4' },
          elements: [
            {
              id: 'headline',
              type: 'text',
              role: 'headline',
              visible: true,
              text: 'Editor assistido renderiza versao final',
              x: 80,
              y: 260,
              width: 760,
              height: 220,
              rotation: 0,
              style: { font_size: 64, font_weight: 700, color: '#1f2933' },
            },
            {
              id: 'cta',
              type: 'shape',
              role: 'shape',
              visible: true,
              x: 80,
              y: 1030,
              width: 420,
              height: 86,
              rotation: 0,
              style: { color: '#0f766e', radius: 8 },
            },
          ],
        },
      ],
    },
    {},
    'png',
  );

  assert.equal(outcomes.length, 1);
  assert.ok(outcomes[0]!.buffer.length > 50000, `expected creative PNG > 50KB, got ${outcomes[0]!.buffer.length} bytes`);
  assert.equal(outcomes[0]!.post_render_qa.density_status, 'ok');
});
