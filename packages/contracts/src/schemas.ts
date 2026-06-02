import { z } from 'zod';

export const SchemaVersionSchema = z.number().int().positive().default(1);

export const WorkspaceRoleSchema = z.enum(['owner', 'admin', 'editor', 'viewer']);
export const BrandStatusSchema = z.enum(['draft', 'active', 'archived']);
export const BrandAssetCategorySchema = z.enum(['logo', 'photo', 'font', 'reference', 'document', 'other']);
export const BrandAssetStatusSchema = z.enum(['uploaded', 'processing', 'ready', 'failed', 'archived']);
export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'changes_requested', 'rejected']);
export const JobRunStatusSchema = z.enum(['queued', 'running', 'completed', 'failed']);
export const ContentItemStatusSchema = z.enum([
  'draft',
  'generating',
  'awaiting_approval',
  'changes_requested',
  'approved',
  'published',
  'cancelled',
]);

export const WorkspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2),
  slug: z.string().min(2),
  created_by: z.string().uuid().nullable().optional(),
});

export const MemberSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: WorkspaceRoleSchema,
});

export const BrandSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  name: z.string().min(2),
  slug: z.string().min(2),
  status: BrandStatusSchema.default('draft'),
  industry: z.string().optional().nullable(),
  positioning: z.string().optional().nullable(),
  voice_notes: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).default({}),
});

export const BrandAssetSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  category: BrandAssetCategorySchema,
  status: BrandAssetStatusSchema,
  storage_bucket: z.string().default('brand-assets'),
  storage_path: z.string().min(1),
  file_name: z.string().min(1),
  mime_type: z.string().min(1),
  size_bytes: z.number().int().nonnegative(),
  metadata: z.record(z.unknown()).default({}),
});

export const BrandMemoryJsonSchema = z.object({
  schema_version: SchemaVersionSchema,
  summary: z.string().min(1),
  positioning: z.string().min(1),
  target_audience: z.string().default(''),
  voice: z.object({
    tone: z.string().default(''),
    adjectives: z.array(z.string()).default([]),
    forbidden_words: z.array(z.string()).default([]),
    preferred_words: z.array(z.string()).default([]),
  }),
  visual_identity: z.object({
    primary_colors: z.array(z.string()).default([]),
    typography: z.record(z.unknown()).default({}),
    asset_inventory: z.record(z.unknown()).default({}),
  }),
  content_rules: z.array(z.string()).default([]),
  restrictions: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
});

export const BrandMemorySchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  version: z.number().int().positive(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  memory_json: BrandMemoryJsonSchema,
  generated_by_job_run_id: z.string().uuid().nullable().optional(),
});

export const TemplateFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  max_chars: z.number().int().positive(),
  required: z.boolean(),
  type: z.string().optional(),
});

export const TemplateSchema = z.object({
  id: z.string().uuid().optional(),
  workspace_id: z.string().uuid().nullable().optional(),
  template_id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['carrossel', 'post_unico', 'stories', 'reels', 'institucional']),
  schema_json: z.object({
    schema_version: SchemaVersionSchema,
    fields: z.array(TemplateFieldSchema),
    asset_slots: z.record(z.unknown()).default({}),
  }),
  render_contract_json: z.record(z.unknown()).default({}),
});

export const ContentPlanSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  title: z.string().min(1),
  period_start: z.string(),
  period_end: z.string(),
  status: z.enum(['draft', 'generating', 'awaiting_approval', 'approved', 'archived']),
  plan_json: z.record(z.unknown()).default({ schema_version: 1 }),
});

export const ContentItemSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  content_plan_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  status: ContentItemStatusSchema,
  scheduled_for: z.string().nullable().optional(),
  copy_json: z.record(z.unknown()).default({ schema_version: 1 }),
});

export const RenderOutputFormatSchema = z.enum(['png', 'jpg']).default('png');
export type RenderOutputFormat = z.infer<typeof RenderOutputFormatSchema>;

export const RenderSlideSchema = z.object({
  template_id: z.string().min(1),
  fields: z.record(z.union([z.string(), z.array(z.string()), z.undefined()])),
  assets: z.record(z.string().optional()).default({}),
  design_tokens: z.record(z.string()).optional(),
  decorators: z.record(z.unknown()).optional(),
  output_format: RenderOutputFormatSchema.optional(),
});

export const RenderRequestSchema = RenderSlideSchema;

export const RenderResponseSchema = z.object({
  slide: z.string(),
  output_format: RenderOutputFormatSchema,
  post_render_qa: z.record(z.unknown()).optional(),
});

export const GenerateBrandMemoryInputSchema = z.object({
  workspace_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  requested_by: z.string().uuid(),
});

export const GenerateBrandMemoryOutputSchema = z.object({
  brand_memory_id: z.string().uuid(),
  version: z.number().int().positive(),
  summary: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export const JobRunSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  brand_id: z.string().uuid().nullable().optional(),
  job_name: z.string().min(1),
  status: JobRunStatusSchema,
  input_json: z.record(z.unknown()).default({}),
  output_json: z.record(z.unknown()).nullable().optional(),
  error_json: z.record(z.unknown()).nullable().optional(),
});

export const ApprovalSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  target_type: z.enum(['brand_memory', 'content_plan', 'content_item', 'generated_asset']),
  target_id: z.string().uuid(),
  status: ApprovalStatusSchema,
  decided_by: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type Workspace = z.infer<typeof WorkspaceSchema>;
export type Member = z.infer<typeof MemberSchema>;
export type Brand = z.infer<typeof BrandSchema>;
export type BrandAsset = z.infer<typeof BrandAssetSchema>;
export type BrandAssetCategory = z.infer<typeof BrandAssetCategorySchema>;
export type BrandMemory = z.infer<typeof BrandMemorySchema>;
export type BrandMemoryJson = z.infer<typeof BrandMemoryJsonSchema>;
export type Template = z.infer<typeof TemplateSchema>;
export type ContentPlan = z.infer<typeof ContentPlanSchema>;
export type ContentItem = z.infer<typeof ContentItemSchema>;
export type RenderSlide = z.infer<typeof RenderSlideSchema>;
export type RenderRequest = z.infer<typeof RenderRequestSchema>;
export type RenderResponse = z.infer<typeof RenderResponseSchema>;
export type GenerateBrandMemoryInput = z.infer<typeof GenerateBrandMemoryInputSchema>;
export type GenerateBrandMemoryOutput = z.infer<typeof GenerateBrandMemoryOutputSchema>;
export type JobRun = z.infer<typeof JobRunSchema>;
export type Approval = z.infer<typeof ApprovalSchema>;
