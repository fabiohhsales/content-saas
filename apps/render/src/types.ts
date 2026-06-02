export interface RenderFields {
  eyebrow?: string;
  headline?: string;
  body?: string;
  cta?: string;
  highlight_box?: string;
  list_items?: string; // pipe-separated, e.g. "Item 1|Item 2|Item 3"
  brand_letter?: string; // watermark letter, defaults to first char of brand name
  brand_name?: string; // brand text shown in the header (white-label). Empty = logo only.
  [key: string]: string | string[] | undefined;
}

export interface RenderAssets {
  photo?: string;   // base64 JPEG or PNG
  photo2?: string;  // second photo (before/after)
  logo?: string;    // base64 PNG
}

export interface RenderShapeAccent {
  type: 'line' | 'triangle' | 'circle';
  placement:
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
    | 'bottom-right';
}

export interface RenderGradientOverlay {
  preset?: 'none' | 'dark' | 'light' | 'accent';
  start?: string;
  end?: string;
  angle?: number;
  opacity?: number;
}

export interface RenderDecorators {
  divider_type?: 'none' | 'solid' | 'accent' | 'subtle';
  shape_accents?: RenderShapeAccent[];
  gradient_overlay?: 'none' | 'dark' | 'light' | 'accent' | RenderGradientOverlay;
}

// CSS custom properties injected as <style>:root{...}</style> before setContent.
// Keys must start with `--` (for example, --primary or --bg-dark). Values are
// validated CSS color values. Templates using `var(--token, #fallback)` receive
// client overrides; templates without tokens keep their hardcoded CSS.
export type DesignTokens = Record<string, string>;

export interface RenderSlide {
  template_id: string;
  fields: RenderFields;
  assets: RenderAssets;
  design_tokens?: DesignTokens;
  decorators?: RenderDecorators;
  output_format?: 'png' | 'jpg';
}

export interface RenderCarouselRequest {
  slides: RenderSlide[];
}

export interface DynamicTemplateSource {
  html: string;
  css?: string;
  schema: TemplateSchema;
}

export interface RenderDynamicRequest extends RenderSlide {
  template_source: DynamicTemplateSource;
}

export interface CreativeRenderElement {
  id: string;
  type: 'text' | 'image' | 'shape';
  role: string;
  placeholder?: string;
  locked?: boolean;
  visible?: boolean;
  text?: string;
  asset_id?: string;
  asset_source?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  style?: Record<string, string | number | boolean | null>;
}

export interface CreativeRenderSlide {
  id: string;
  name?: string;
  elements: CreativeRenderElement[];
  background?: {
    color?: string;
    asset_id?: string;
    asset_source?: string;
  };
}

export interface CreativeRenderDocument {
  schema_version: number;
  canvas: {
    width: number;
    height: number;
    format: string;
  };
  template_id: string;
  brand_id: string;
  slides: CreativeRenderSlide[];
  tokens?: Record<string, string>;
}

export interface CreativeRenderRequest {
  document: CreativeRenderDocument;
  asset_urls?: Record<string, string>;
  output_format?: 'png' | 'jpg';
}

export interface RenderCarouselResponse {
  slides: string[]; // base64 PNG array
  count: number;
}

export interface TemplateSchemaField {
  max_chars: number;
  required: boolean;
  type?: string;
  min_items?: number;
  max_items?: number;
}

export interface TemplateSchemaAssetSlot {
  required: boolean;
  accepted_types: string[];
}

export interface TemplateSchema {
  template_id: string;
  format: string | {
    type?: string;
    width?: number;
    height?: number;
  };
  fields: Record<string, TemplateSchemaField>;
  asset_slots?: Record<string, TemplateSchemaAssetSlot>;
}
