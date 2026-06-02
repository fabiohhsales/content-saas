import { chromium, Browser } from 'playwright';
import { CreativeRenderDocument, CreativeRenderSlide, DynamicTemplateSource, RenderFields, RenderSlide, TemplateSchema } from './types';
import { getDimensionsFromSchema, loadTemplateHtml, loadSchema } from './template-loader';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return browser;
}

function isSafeDesignTokenKey(key: string): boolean {
  return /^--[a-zA-Z0-9_-]+$/.test(key);
}

/** Font-family values: letras, dígitos, espaços, hífens apenas. */
const SAFE_FONT_VALUE_RE = /^[a-zA-Z0-9 \-]+$/;

function isSafeDesignTokenValue(key: string, value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || /[;<>{}]/.test(trimmed)) return false;

  // Font tokens usam regra própria — sem cores, sem quotes, sem injeção CSS.
  if (key.startsWith('--font-')) {
    return SAFE_FONT_VALUE_RE.test(trimmed) && trimmed.length <= 60;
  }

  // Spacing tokens — apenas Npx (cap 4 dígitos). Rejeita unidades não-px
  // (vw, %, calc, etc), valores negativos e abuso de tamanho. Templates
  // usam fallback hardcoded via var(--space-X, Npx).
  if (key.startsWith('--space-')) {
    return /^\d{1,4}px$/.test(trimmed);
  }

  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$/.test(trimmed)) return true;

  if (/^(white|black|transparent)$/.test(trimmed.toLowerCase())) return true;

  // rgb(r,g,b) or rgba(r,g,b,a) — validate channel ranges 0-255 and alpha 0-1
  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+))?\s*\)$/);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return Number(r) <= 255 && Number(g) <= 255 && Number(b) <= 255;
  }

  // hsl(h,s%,l%) or hsla(h,s%,l%,a) — validate h 0-360, s/l 0-100
  const hslMatch = trimmed.match(/^hsla?\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*(?:,\s*(0|1|0?\.\d+))?\s*\)$/);
  if (hslMatch) {
    const [, h, s, l] = hslMatch;
    return Number(h) <= 360 && Number(s) <= 100 && Number(l) <= 100;
  }

  return false;
}

/** Constrói URL do Google Fonts a partir dos tokens --font-* presentes. */
function buildGoogleFontsUrl(tokens: Record<string, string>): string | null {
  const specs: Array<[string, string]> = [
    ['--font-heading', 'ital,wght@0,400;0,600;0,700;1,400;1,700'],
    ['--font-body',    'wght@300;400;500;600;700'],
    ['--font-accent',  'ital,wght@0,400;0,600;0,700;1,400;1,700'],
  ];
  const families: string[] = [];
  for (const [key, weights] of specs) {
    const name = tokens[key]?.trim();
    if (!name || !SAFE_FONT_VALUE_RE.test(name)) continue;
    families.push(`family=${name.replace(/\s+/g, '+')}:${weights}`);
  }
  if (families.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}

export function injectDesignTokens(html: string, tokens?: Record<string, string>): string {
  if (!tokens) return html;
  const cssDecls = Object.entries(tokens)
    .filter(([key, value]) => typeof key === 'string' && typeof value === 'string')
    .map(([key, value]) => [key.trim(), value.trim()] as const)
    .filter(([key, value]) => isSafeDesignTokenKey(key) && isSafeDesignTokenValue(key, value))
    .map(([key, value]) => `${key}: ${value};`)
    .join(' ');

  const googleFontsUrl = buildGoogleFontsUrl(tokens);
  const fontLink = googleFontsUrl
    ? `<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><link rel="stylesheet" href="${googleFontsUrl}" />`
    : '';

  const toInject = fontLink + (cssDecls ? `<style id="design-tokens">:root{${cssDecls}}</style>` : '');
  if (!toInject) return html;

  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>${toInject}`);
  }
  return toInject + html;
}

/**
 * Resultado de QA pós-render — calculado in-page após o screenshot.
 * Não bloqueia o render; informa o orquestrador para o gate determinístico.
 */
export interface VisualFieldDiagnostic {
  key: string;
  visible: boolean;
  text_length: number;
  box: { x: number; y: number; width: number; height: number };
  overflow_x: boolean;
  overflow_y: boolean;
  clipped: boolean;
  ends_with_incomplete_phrase: boolean;
}

export interface VisualAssetDiagnostic {
  key: string; // 'logo' | 'photo' | 'photo2' | ...
  visible: boolean;
  placeholder_visible: boolean;
}

export interface VisualLogoDiagnostic {
  present: boolean;
  visible: boolean;
  /** Fração de pixels quase-brancos opacos (0–1). -1 quando não calculável. */
  white_box_ratio: number;
  transparent_likely: boolean;
}

export interface VisualDiagnostics {
  canvas: { width: number; height: number; density_ratio: number };
  fields: VisualFieldDiagnostic[];
  assets: VisualAssetDiagnostic[];
  logo: VisualLogoDiagnostic;
  placeholder_visible: boolean;
  safe_area_violations: string[];
}

export interface PostRenderQA {
  /** 'low' quando >55% do canvas está sem conteúdo visível. */
  density_status: 'ok' | 'low';
  /** Razão entre altura ocupada por conteúdo / altura do canvas (0–1). */
  density_ratio: number;
  /** Campos cujo texto renderizado terminou em "…" ou cuja largura excedeu o container. */
  truncated_fields: string[];
  /** Diagnóstico visual estruturado (§12). Aditivo — consumidores antigos ignoram. */
  visual_diagnostics?: VisualDiagnostics;
}

export interface RenderOutcome {
  buffer: Buffer;
  post_render_qa: PostRenderQA;
}

function normalizeShapePlacement(
  placement: 'top' | 'bottom' | 'left' | 'right' | 'tl' | 'tr' | 'bl' | 'br' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
): 'top' | 'bottom' | 'left' | 'right' | 'tl' | 'tr' | 'bl' | 'br' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' {
  if (placement === 'tl') return 'top-left';
  if (placement === 'tr') return 'top-right';
  if (placement === 'bl') return 'bottom-left';
  if (placement === 'br') return 'bottom-right';
  return placement;
}

function normalizeDecorators(raw?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const decorators: Record<string, unknown> = { ...raw };

  if (Array.isArray(raw.shape_accents)) {
    decorators.shape_accents = raw.shape_accents.map((shape) => {
      if (!shape || typeof shape !== 'object') return shape;
      const typed = shape as Record<string, unknown>;
      const placement = typeof typed.placement === 'string'
        ? normalizeShapePlacement(typed.placement as
          | 'top'
          | 'bottom'
          | 'left'
          | 'right'
          | 'tl'
          | 'tr'
          | 'bl'
          | 'br'
          | 'top-left'
          | 'top-right'
          | 'bottom-left'
          | 'bottom-right')
        : typed.placement;
      return { ...typed, placement };
    });
  }

  const overlay = raw.gradient_overlay;
  if (typeof overlay === 'string') {
    const presets: Record<string, { start: string; end: string; angle: number; opacity: number }> = {
      none: { start: 'rgba(11,22,42,0)', end: 'rgba(11,22,42,0)', angle: 180, opacity: 0 },
      dark: { start: 'rgba(11,22,42,.1)', end: 'rgba(11,22,42,.86)', angle: 180, opacity: 1 },
      light: { start: 'rgba(248,245,240,.05)', end: 'rgba(248,245,240,.25)', angle: 180, opacity: 1 },
      accent: { start: 'rgba(201,169,110,.08)', end: 'rgba(11,22,42,.78)', angle: 160, opacity: 1 },
    };
    decorators.gradient_overlay = { preset: overlay, ...(presets[overlay] ?? presets.none) };
  } else if (overlay && typeof overlay === 'object') {
    const typed = overlay as Record<string, unknown>;
    decorators.gradient_overlay = {
      preset: typeof typed.preset === 'string' ? typed.preset : undefined,
      start: typeof typed.start === 'string' ? typed.start : undefined,
      end: typeof typed.end === 'string' ? typed.end : undefined,
      angle: typeof typed.angle === 'number' ? typed.angle : undefined,
      opacity: typeof typed.opacity === 'number' ? typed.opacity : undefined,
    };
  }

  return decorators;
}

export async function renderSlide(slide: RenderSlide): Promise<RenderOutcome> {
  const schema = loadSchema(slide.template_id);
  const html = injectDesignTokens(loadTemplateHtml(slide.template_id), slide.design_tokens);
  return renderHtmlSlide(html, schema, slide);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function visibleFieldValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(' ');
  return String(value ?? '');
}

function shouldRequireVisibleText(field: { key: string; type?: string }): boolean {
  const type = field.type?.toLowerCase();
  if (type === 'list' || type === 'image' || type === 'video') return false;
  if (field.key.endsWith('_url') || field.key.endsWith('_image')) return false;
  return true;
}

function htmlFieldValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => `<span>${escapeHtml(String(item))}</span>`).join('<br />');
  }
  return escapeHtml(String(value ?? ''));
}

function injectStylesheet(html: string, css?: string): string {
  if (!css?.trim()) return html;
  const style = `<style id="dynamic-template-css">${css}</style>`;
  const withoutRelativeStylesheet = html.replace(/<link\b[^>]*href=["']style\.css["'][^>]*>\s*/i, '');
  if (withoutRelativeStylesheet.includes('</head>')) {
    return withoutRelativeStylesheet.replace('</head>', `${style}</head>`);
  }
  return style + withoutRelativeStylesheet;
}

function hydrateMustachePlaceholders(html: string, fields: RenderFields): string {
  return html.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_match, key: string) => {
    return htmlFieldValue(fields[key]);
  });
}

function buildDynamicHtml(source: DynamicTemplateSource, fields: RenderFields, tokens?: Record<string, string>): string {
  const withCss = injectStylesheet(source.html, source.css);
  const withFields = hydrateMustachePlaceholders(withCss, fields);
  return injectDesignTokens(withFields, tokens);
}

export async function renderDynamicSlide(slide: RenderSlide, source: DynamicTemplateSource): Promise<RenderOutcome> {
  if (!source.html?.trim()) throw new Error('template_source.html is required');
  if (!source.schema?.template_id) throw new Error('template_source.schema.template_id is required');
  const html = buildDynamicHtml(source, slide.fields, slide.design_tokens);
  return renderHtmlSlide(html, source.schema, slide);
}

function cssValue(value: unknown, fallback: string): string {
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed || /[;<>{}]/.test(trimmed)) return fallback;
  return trimmed;
}

function creativeAssetUrl(assetId: string | undefined, assetUrls: Record<string, string>): string | null {
  if (!assetId) return null;
  const value = assetUrls[assetId];
  if (!value) return null;
  if (value.startsWith('data:image/') || value.startsWith('https://') || value.startsWith('http://')) return value;
  return null;
}

function buildCreativeHtml(
  document: CreativeRenderDocument,
  slide: CreativeRenderSlide,
  assetUrls: Record<string, string>,
): string {
  const canvas = document.canvas;
  const backgroundAsset = creativeAssetUrl(slide.background?.asset_id, assetUrls);
  const backgroundColor = cssValue(slide.background?.color ?? document.tokens?.background_color, '#f7f7f4');
  const textColor = cssValue(document.tokens?.text_color, '#1f2933');
  const fontFamily = cssValue(document.tokens?.font_family, 'Arial');
  const elements = slide.elements
    .filter((element) => element.visible !== false)
    .map((element) => {
      const style = element.style ?? {};
      const left = `${element.x}px`;
      const top = `${element.y}px`;
      const width = `${element.width}px`;
      const height = `${element.height}px`;
      const rotation = Number(element.rotation ?? 0);
      const base = `left:${left};top:${top};width:${width};height:${height};transform:rotate(${rotation}deg);`;

      if (element.type === 'image') {
        const url = creativeAssetUrl(element.asset_id, assetUrls);
        const fit = cssValue(style.fit, 'cover');
        const radius = Number(style.radius ?? 8);
        return `<div class="el image" data-role="${escapeHtml(element.role)}" style="${base}border-radius:${radius}px;">${
          url
            ? `<img src="${escapeHtml(url)}" style="object-fit:${fit};" />`
            : `<span>${escapeHtml(element.placeholder ?? element.role)}</span>`
        }</div>`;
      }

      if (element.type === 'shape') {
        const color = cssValue(style.color, '#d0d5dd');
        const radius = Number(style.radius ?? 8);
        return `<div class="el shape" data-role="${escapeHtml(element.role)}" style="${base}background:${color};border-radius:${radius}px;"></div>`;
      }

      const color = cssValue(style.color, textColor);
      const fontSize = Number(style.font_size ?? 32);
      const fontWeight = Number(style.font_weight ?? 400);
      const lineHeight = Number(style.line_height ?? 1.08);
      return `<div class="el text" data-role="${escapeHtml(element.role)}" style="${base}color:${color};font-size:${fontSize}px;font-weight:${fontWeight};line-height:${lineHeight};">${escapeHtml(element.text ?? '')}</div>`;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body { margin: 0; width: ${canvas.width}px; height: ${canvas.height}px; overflow: hidden; }
    body { font-family: ${fontFamily}, Arial, sans-serif; background: ${backgroundColor}; color: ${textColor}; }
    .canvas { position: relative; width: ${canvas.width}px; height: ${canvas.height}px; overflow: hidden; background: ${backgroundColor}; }
    .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .32; }
    .el { position: absolute; box-sizing: border-box; transform-origin: center center; }
    .el.text { overflow: hidden; white-space: pre-wrap; word-break: normal; }
    .el.image { display: flex; align-items: center; justify-content: center; overflow: hidden; background: rgba(255,255,255,.48); border: 1px solid rgba(102,112,133,.22); }
    .el.image img { width: 100%; height: 100%; display: block; }
    .el.image span { color: #667085; font-size: 24px; font-weight: 700; }
  </style>
</head>
<body>
  <main class="canvas">
    ${backgroundAsset ? `<img class="bg" src="${escapeHtml(backgroundAsset)}" />` : ''}
    ${elements}
  </main>
</body>
</html>`;
}

async function renderCreativeSlide(
  document: CreativeRenderDocument,
  slide: CreativeRenderSlide,
  assetUrls: Record<string, string>,
  outputFormat: 'png' | 'jpg',
): Promise<RenderOutcome> {
  const { width, height } = document.canvas;
  const b = await getBrowser();
  const context = await b.newContext({ deviceScaleFactor: 2 });
  const page = await context.newPage();

  try {
    await page.setViewportSize({ width, height });
    await page.setContent(buildCreativeHtml(document, slide, assetUrls), { waitUntil: 'load', timeout: 15000 });
    await page.evaluate('document.fonts.ready');
    await page.waitForTimeout(150);
    const screenshotType = outputFormat === 'jpg' ? 'jpeg' : 'png';
    const buffer = await page.screenshot({
      type: screenshotType,
      quality: screenshotType === 'jpeg' ? 92 : undefined,
      clip: { x: 0, y: 0, width, height },
    });
    const post_render_qa = {
      density_status: 'ok' as const,
      density_ratio: 1,
      truncated_fields: [],
      visual_diagnostics: {
        canvas: { width, height, density_ratio: 1 },
        fields: [],
        assets: [],
        logo: { present: false, visible: false, white_box_ratio: -1, transparent_likely: false },
        placeholder_visible: false,
        safe_area_violations: [],
      },
    };
    return { buffer: buffer as Buffer, post_render_qa };
  } finally {
    await context.close();
  }
}

export async function renderCreativeDocument(
  document: CreativeRenderDocument,
  assetUrls: Record<string, string> = {},
  outputFormat: 'png' | 'jpg' = 'png',
): Promise<RenderOutcome[]> {
  const results: RenderOutcome[] = [];
  for (const slide of document.slides.slice(0, 10)) {
    results.push(await renderCreativeSlide(document, slide, assetUrls, outputFormat));
  }
  return results;
}

async function renderHtmlSlide(html: string, schema: TemplateSchema, slide: RenderSlide): Promise<RenderOutcome> {
  const { width, height } = getDimensionsFromSchema(schema);

  const b = await getBrowser();
  const context = await b.newContext({ deviceScaleFactor: 2 });
  const page = await context.newPage();

  try {
    await page.setViewportSize({ width, height });
    const renderData = {
      fields: slide.fields as Record<string, unknown>,
      assets: slide.assets as Record<string, unknown>,
      decorators: normalizeDecorators(slide.decorators as Record<string, unknown> | undefined),
    };
    await page.addInitScript({ content: `globalThis.__DATA__ = ${JSON.stringify(renderData)};` });
    await page.setContent(html, { waitUntil: 'load', timeout: 15000 });

    // Inject render data, fire event, AND do a direct-DOM safety hydration in
    // case the template's renderdata listener registered after our dispatch.
    await page.evaluate(`(() => {
      const fields = ${JSON.stringify(renderData.fields)};
      const assets = ${JSON.stringify(renderData.assets)};
      const decorators = ${JSON.stringify(renderData.decorators ?? {})};
      const g = globalThis;
      g.__DATA__ = { fields, assets, decorators };
      if (typeof g.__renderTemplate === 'function') {
        g.__renderTemplate(g.__DATA__);
      }
      g.document.dispatchEvent(new g.Event('renderdata'));

      for (const [key, value] of Object.entries(fields)) {
        if ((typeof value !== 'string' && !Array.isArray(value)) || !value) continue;
        const el = g.document.getElementById(key);
        if (el && !el.textContent?.trim()) {
          el.textContent = Array.isArray(value) ? value.join(' ') : value;
        }
      }
    })()`);

    // ── Fail-loud: placeholder visual para assets ausentes ──────────────────
    // Quando um template espera asset (foto/photo2) mas o slot vem vazio, o
    // fallback div (`.bg-fallback`, `.side-fallback`, `.placeholder`) fica
    // visível como bloco de cor sólida. Injetamos um overlay com ícone +
    // texto "imagem ausente" para que a equipe veja imediatamente no PNG
    // gerado que tem um buraco. O texto explícito casa com o warning que
    // foi para o ClickUp ("Post foi gerado com placeholder visual").
    const expectedAssetKeys = Object.keys(schema.asset_slots ?? {});
    const providedAssetKeys = Object.keys((slide.assets as Record<string, unknown>) ?? {}).filter(
      (k) => (slide.assets as Record<string, unknown>)[k],
    );
    // Logo é tratado à parte: ausência NÃO vira placeholder cinza (gera o
    // "retângulo branco/cinza" que derruba a percepção premium — plano §7.3/§12.2).
    // Em vez disso, o slot de logo fica display:none e o brand_name tipográfico
    // (já presente nos campos do template) carrega a identidade.
    const missingAssets = expectedAssetKeys.filter(
      (k) => k !== 'background_color' && k !== 'accent_color' && k !== 'seal' && k !== 'logo' && !providedAssetKeys.includes(k),
    );
    const logoMissing = expectedAssetKeys.includes('logo') && !providedAssetKeys.includes('logo');
    if (logoMissing) {
      await page.evaluate(`(() => {
        const doc = globalThis.document;
        const selectors = [
          '[data-asset-slot="logo"]',
          '[data-asset="logo"]',
          '#logo',
          '.logo-wrapper',
          '.logo-container',
          '.logo-img',
          '.brand-logo',
          'img[id*="logo"]',
          'img[class*="logo"]',
        ];
        const seen = new Set();
        for (const sel of selectors) {
          doc.querySelectorAll(sel).forEach((el) => {
            // Só esconde nós que efetivamente carregam o logo gráfico (img ou
            // wrapper só-de-imagem). Mantém visível qualquer wrapper que também
            // contenha o brand_name textual, para não apagar a marca tipográfica.
            const isImg = el.tagName === 'IMG';
            const hasText = (el.textContent || '').trim().length > 0;
            if ((isImg || !hasText) && !seen.has(el)) {
              seen.add(el);
              el.style.display = 'none';
            }
          });
        }
      })()`);
    }
    if (missingAssets.length > 0) {
      await page.evaluate(`(() => {
        const missing = ${JSON.stringify(missingAssets)};
        const doc = globalThis.document;
        // CSS global para placeholder de asset ausente
        const style = doc.createElement('style');
        style.textContent = \`
          .asset-missing-placeholder {
            background: #6b7280 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            color: rgba(255, 255, 255, 0.85) !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
            text-align: center !important;
            padding: 24px !important;
            position: relative !important;
            min-height: 200px !important;
          }
          .asset-missing-placeholder::before {
            content: '';
            display: block;
            width: 64px;
            height: 64px;
            margin-bottom: 16px;
            background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='3' width='18' height='18' rx='2' ry='2'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/><line x1='3' y1='3' x2='21' y2='21'/></svg>");
            background-repeat: no-repeat;
            background-position: center;
            background-size: contain;
            opacity: 0.85;
          }
          .asset-missing-placeholder::after {
            content: attr(data-missing-label);
            font-size: 18px;
            font-weight: 600;
            letter-spacing: 0.5px;
            opacity: 0.92;
            line-height: 1.3;
          }
        \`;
        doc.head.appendChild(style);

        // Mapa de candidatos: quando 'photo' está ausente, marcar bg-fallback /
        // side-fallback-left / side-fallback ESQUERDA / placeholders genéricos.
        // Quando 'photo2' está ausente, marcar side-fallback-right.
        const labelFor = (asset) => {
          if (asset === 'photo') return 'Imagem ausente';
          if (asset === 'photo2') return 'Segunda imagem ausente';
          if (asset === 'logo') return 'Logo ausente';
          return 'Asset ausente: ' + asset;
        };

        for (const asset of missing) {
          let targets = [];
          if (asset === 'logo') {
            // Logo: tenta seletores canônicos usados nos templates
            const logoSelectors = [
              '[data-asset-slot="logo"]',
              '[data-asset="logo"]',
              '#logo',
              '.logo-wrapper',
              '.logo-container',
              '.logo-img',
              '.brand-logo',
            ];
            for (const sel of logoSelectors) {
              const el = doc.querySelector(sel);
              if (el && getComputedStyle(el).display !== 'none') targets.push(el);
            }
            // Fallback: <img> com id ou class contendo "logo"
            doc.querySelectorAll('img[id*="logo"], img[class*="logo"]').forEach((el) => {
              if (getComputedStyle(el).display !== 'none') targets.push(el);
            });
          } else if (asset === 'photo') {
            // primeira foto: bg-fallback geral OU side-fallback esquerda
            const bg = doc.querySelector('.bg-fallback');
            if (bg && getComputedStyle(bg).display !== 'none') targets.push(bg);
            const left = doc.getElementById('side_left_fallback');
            if (left && getComputedStyle(left).display !== 'none') targets.push(left);
            // genéricos
            doc.querySelectorAll('.placeholder').forEach((el) => {
              if (getComputedStyle(el).display !== 'none') targets.push(el);
            });
          } else if (asset === 'photo2') {
            const right = doc.getElementById('side_right_fallback');
            if (right && getComputedStyle(right).display !== 'none') targets.push(right);
          }
          for (const el of targets) {
            el.classList.add('asset-missing-placeholder');
            el.setAttribute('data-missing-label', labelFor(asset));
          }
        }
      })()`);
    }

    await page.evaluate('document.fonts.ready');
    await page.waitForTimeout(150);

    const requiredFields = Object.entries(schema.fields)
      .filter(([, config]) => config.required)
      .map(([key, config]) => ({ key, value: visibleFieldValue(slide.fields[key]), type: config.type }));
    const emptyRequiredFields = requiredFields.filter((field) => !field.value.trim()).map((field) => field.key);
    if (emptyRequiredFields.length > 0) {
      throw new Error(`HYDRATION_FAILED: required fields empty: ${emptyRequiredFields.join(', ')}`);
    }

    const missingFields = await page.evaluate(`(() => {
      const requiredFields = ${JSON.stringify(requiredFields)};
      const normalize = (value) => value.replace(/\\s+/g, ' ').trim().toLowerCase();
      const bodyText = normalize(document.body.innerText || '');
      return requiredFields
        .filter((field) => ${shouldRequireVisibleText.toString()}(field))
        .filter((field) => !bodyText.includes(normalize(field.value)))
        .map((field) => field.key);
    })()`) as string[];
    /*
    const missingFieldsLegacy = await page.evaluate(
      ({ requiredFields }: { requiredFields: Array<{ key: string; value: string }> }) => {
        const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = (globalThis as any).document;
        // Use innerText — it reflects actually-rendered visible text. If text
        // is in textContent but not in innerText, the screenshot will be empty
        // even if the DOM looks fine (e.g. missing system fonts at zero metric).
        const bodyText = normalize((doc.body.innerText as string) || '');
        return requiredFields
          .filter((field) => !bodyText.includes(normalize(field.value)))
          .map((field) => field.key);
      },
      { requiredFields }
    );
    */

    if (missingFields.length > 0) {
      throw new Error(`HYDRATION_FAILED: required fields not visible in DOM: ${missingFields.join(', ')}`);
    }

    const outputFormat = slide.output_format === 'jpg' ? 'jpeg' : 'png';
    const buffer = await page.screenshot({
      type: outputFormat,
      quality: outputFormat === 'jpeg' ? 92 : undefined,
      clip: { x: 0, y: 0, width, height },
    });

    // ── Post-render QA: density + truncation detection (in-page eval) ─────
    // Não bloqueia o render; orquestrador decide com base em post_render_qa.
    const post_render_qa = await runPostRenderQA(page, schema, slide.fields, width, height);

    return { buffer: buffer as Buffer, post_render_qa };
  } finally {
    await context.close();
  }
}

/**
 * Calcula densidade visual (% canvas com conteúdo) + detecta campos truncados.
 *
 * Density: soma das alturas (bbox) dos elementos visíveis filhos diretos de <body>
 * / height do canvas. Não usa sharp — métrica DOM-based, baixo custo. Marca
 * 'low' quando ratio < 0.45 (i.e. >55% vazio, alinhado ao handoff §9).
 *
 * Truncation: para cada field-key conhecido (id no DOM = key), verifica:
 *   1. textContent terminado em "…" / "..." (truncamento na fonte);
 *   2. overflow horizontal real quando o elemento clipa eixo X;
 *   3. overflow vertical real quando o elemento clipa eixo Y e tem limite
 *      explícito (max-height/line-clamp). Elementos sem clip, como headings
 *      fluidos, não são truncados só porque scrollHeight arredondou maior.
 */
async function runPostRenderQA(
  page: import('playwright').Page,
  schema: TemplateSchema,
  fields: RenderFields,
  canvasWidth: number,
  canvasHeight: number,
): Promise<PostRenderQA> {
  const fieldKeys = Object.keys(schema.fields ?? {});
  const result = await page.evaluate(
    ({ fieldKeys, fields, canvasWidth, canvasHeight }) => {
      const doc = (globalThis as any).document;
      const win = globalThis as any;
      const normalizeText = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();
      const findFieldElement = (key: string, expectedText: string) => {
        const byId = doc.getElementById(key);
        if (byId) return byId;
        if (!expectedText) return null;
        const leaves = Array.from(doc.body.querySelectorAll('*') || []).filter((node: any) => node.children.length === 0);
        return leaves.find((node: any) => normalizeText(node.textContent) === expectedText) ?? null;
      };
      const isVisible = (el: any): boolean => {
        if (!el) return false;
        const s = win.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
        const r = el.getBoundingClientRect();
        return r.width > 1 && r.height > 1;
      };
      // Frase incompleta: termina em reticências OU vírgula crua OU preposição/artigo curto solto.
      const endsIncomplete = (text: string): boolean =>
        /[.]{3}$/.test(text) ||
        /…$/.test(text) ||
        /,$/.test(text) ||
        /\s(?:e|de|do|da|com|para|a|o|os|as|um|uma|no|na)$/i.test(text);

      // density: soma bboxes visíveis dos filhos diretos de body > * (main/post/wrap)
      let occupied = 0;
      const root: any = doc.body.firstElementChild;
      const containers: any[] = root ? [root] : Array.from(doc.body.children);
      for (const container of containers) {
        for (const child of Array.from(container.children) as any[]) {
          const rect = child.getBoundingClientRect();
          if (rect.height > 4) occupied += rect.height;
        }
      }
      const density_ratio = Math.min(1, occupied / canvasHeight);

      // truncation + diagnóstico por campo
      const truncated: string[] = [];
      const fieldDiagnostics: any[] = [];
      const safeAreaViolations: string[] = [];
      const clippedOverflowValues = new Set(['hidden', 'clip', 'scroll', 'auto']);
      const within = (r: any, label: string) => {
        const tol = 2;
        if (r.left < -tol || r.top < -tol || r.right > canvasWidth + tol || r.bottom > canvasHeight + tol) {
          safeAreaViolations.push(label);
        }
      };

      for (const key of fieldKeys) {
        const expectedText = normalizeText(Array.isArray(fields[key]) ? fields[key].join(' ') : fields[key]);
        const el: any = findFieldElement(key, expectedText);
        if (!el) {
          fieldDiagnostics.push({
            key, visible: false, text_length: 0,
            box: { x: 0, y: 0, width: 0, height: 0 },
            overflow_x: false, overflow_y: false, clipped: false, ends_with_incomplete_phrase: false,
          });
          continue;
        }
        const rect = el.getBoundingClientRect();
        const text = (el.textContent || '').trim();
        const style = win.getComputedStyle(el);
        const clipsX = clippedOverflowValues.has(style.overflowX);
        const clipsY = clippedOverflowValues.has(style.overflowY);
        const hasVerticalConstraint =
          style.maxHeight !== 'none' ||
          (style.webkitLineClamp && style.webkitLineClamp !== 'none' && style.webkitLineClamp !== '0');
        const overflow_x = clipsX && el.scrollWidth > el.clientWidth + 2;
        const overflow_y = clipsY && hasVerticalConstraint && el.scrollHeight > el.clientHeight + 4;
        const incomplete = text ? endsIncomplete(text) : false;
        const clipped = overflow_x || overflow_y;

        if (text && (incomplete || clipped)) truncated.push(key);
        // Safe area só conta para campos visíveis com texto — evita falso-positivo
        // em helpers ocultos/posicionados fora do canvas de propósito.
        const fieldVisible = isVisible(el);
        if (fieldVisible && text) within(rect, `field:${key}`);

        fieldDiagnostics.push({
          key,
          visible: fieldVisible,
          text_length: text.length,
          box: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
          overflow_x,
          overflow_y,
          clipped,
          ends_with_incomplete_phrase: incomplete,
        });
      }

      // placeholders de asset (.asset-missing-placeholder injetado no render)
      const placeholderEls = Array.from(doc.querySelectorAll('.asset-missing-placeholder')) as any[];
      const placeholderLabels = placeholderEls
        .filter(isVisible)
        .map((el) => String(el.getAttribute('data-missing-label') || '').toLowerCase());
      const placeholderForAsset = (assetKey: string): boolean => {
        const map: Record<string, string[]> = {
          photo: ['imagem ausente'],
          photo2: ['segunda imagem ausente'],
          logo: ['logo ausente'],
        };
        const needles = map[assetKey] ?? [];
        return placeholderLabels.some((l) => needles.some((n) => l.includes(n)));
      };

      const assetDiagnostics: any[] = [];
      for (const assetKey of ['logo', 'photo', 'photo2']) {
        const selectorMap: Record<string, string[]> = {
          logo: ['[data-asset-slot="logo"]', '#logo', '.logo-img', '.brand-logo', 'img[id*="logo"]', 'img[class*="logo"]'],
          photo: ['[data-asset-slot="photo"]', '#photo', '.bg-fallback', 'img[id*="photo"]'],
          photo2: ['[data-asset-slot="photo2"]', '#photo2', 'img[id*="photo2"]'],
        };
        let visible = false;
        for (const sel of selectorMap[assetKey] ?? []) {
          const el = doc.querySelector(sel);
          if (el && isVisible(el)) { visible = true; break; }
        }
        assetDiagnostics.push({ key: assetKey, visible, placeholder_visible: placeholderForAsset(assetKey) });
      }

      // logo: visibilidade + amostragem de pixels (white_box_ratio / transparência)
      let logoDiag = { present: false, visible: false, white_box_ratio: -1, transparent_likely: false };
      const logoEl: any =
        doc.querySelector('img[id*="logo"]') ||
        doc.querySelector('img[class*="logo"]') ||
        doc.querySelector('[data-asset-slot="logo"] img') ||
        doc.querySelector('.logo-img');
      if (logoEl) {
        logoDiag.present = true;
        logoDiag.visible = isVisible(logoEl);
        try {
          const iw = logoEl.naturalWidth || logoEl.width || 0;
          const ih = logoEl.naturalHeight || logoEl.height || 0;
          if (logoDiag.visible && iw > 0 && ih > 0) {
            const w = Math.min(iw, 64);
            const h = Math.min(ih, 64);
            const c = doc.createElement('canvas');
            c.width = w; c.height = h;
            const ctx = c.getContext('2d');
            ctx.drawImage(logoEl, 0, 0, w, h);
            const data = ctx.getImageData(0, 0, w, h).data;
            let whitePx = 0, transparentPx = 0;
            const total = w * h;
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
              if (a < 16) transparentPx++;
              else if (r > 240 && g > 240 && b > 240) whitePx++;
            }
            logoDiag.white_box_ratio = total > 0 ? whitePx / total : -1;
            logoDiag.transparent_likely = total > 0 ? transparentPx / total > 0.1 : false;
          }
        } catch {
          logoDiag.white_box_ratio = -1;
        }
      }

      return {
        density_ratio,
        truncated,
        fields: fieldDiagnostics,
        assets: assetDiagnostics,
        logo: logoDiag,
        safe_area_violations: safeAreaViolations,
      };
    },
    { fieldKeys, fields, canvasWidth, canvasHeight },
  );

  return {
    density_status: result.density_ratio < 0.45 ? 'low' : 'ok',
    density_ratio: result.density_ratio,
    truncated_fields: result.truncated,
    visual_diagnostics: {
      canvas: { width: canvasWidth, height: canvasHeight, density_ratio: result.density_ratio },
      fields: result.fields,
      assets: result.assets,
      logo: result.logo,
      placeholder_visible: result.assets.some((a: any) => a.placeholder_visible),
      safe_area_violations: result.safe_area_violations,
    },
  };
}

export async function renderCarousel(slides: RenderSlide[]): Promise<RenderOutcome[]> {
  // Render sequentially to avoid memory spikes with many slides
  const results: RenderOutcome[] = [];
  for (const slide of slides) {
    results.push(await renderSlide(slide));
  }
  return results;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
