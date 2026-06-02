import { z } from 'zod';

export const SchemaVersionSchema = z.number().int().positive().default(1);

export const WorkspaceRoleSchema = z.enum(['owner', 'admin', 'editor', 'viewer']);
export const WorkspaceInvitationStatusSchema = z.enum(['pending', 'accepted', 'revoked', 'expired']);
export const BrandStatusSchema = z.enum(['draft', 'active', 'archived']);
export const BrandAssetCategorySchema = z.enum(['logo', 'photo', 'font', 'reference', 'document', 'other']);
export const BrandAssetStatusSchema = z.enum(['uploaded', 'processing', 'ready', 'failed', 'archived']);
export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'changes_requested', 'rejected']);
export const JobRunStatusSchema = z.enum(['queued', 'running', 'completed', 'failed']);
export const CreativeDocumentStatusSchema = z.enum(['draft', 'editing', 'ready_for_approval', 'approved', 'archived']);
export const CreativeRenderStatusSchema = z.enum(['queued', 'rendering', 'ready', 'failed', 'archived']);
export const AssetCollectionScopeSchema = z.enum(['global', 'workspace', 'brand']);
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

export const WorkspaceInvitationSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  email: z.string().email(),
  role: WorkspaceRoleSchema,
  status: WorkspaceInvitationStatusSchema,
  invite_token: z.string().min(16),
  expires_at: z.string(),
  accepted_by: z.string().uuid().nullable().optional(),
  accepted_at: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).default({ schema_version: 1 }),
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

export const RenderCarouselResponseSchema = z.object({
  slides: z.array(z.string()),
  output_format: RenderOutputFormatSchema,
  post_render_qa: z.array(z.record(z.unknown())).optional(),
  count: z.number().int().nonnegative(),
});

export const CreativeElementRoleSchema = z.enum([
  'brand_logo',
  'hero_image',
  'background_image',
  'supporting_image',
  'headline',
  'subtitle',
  'body',
  'cta',
  'badge',
  'disclaimer',
  'icon',
  'shape',
]);

export const CreativeElementSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['text', 'image', 'shape']),
  role: CreativeElementRoleSchema,
  placeholder: z.string().optional(),
  locked: z.boolean().default(false),
  visible: z.boolean().default(true),
  text: z.string().optional(),
  asset_id: z.string().optional(),
  asset_source: z.enum(['brand_asset', 'global_asset', 'workspace_asset', 'external']).optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().default(0),
  style: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
});

export const CreativeSlideSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  elements: z.array(CreativeElementSchema),
  background: z.object({
    color: z.string().optional(),
    asset_id: z.string().optional(),
    asset_source: z.enum(['brand_asset', 'global_asset', 'workspace_asset', 'external']).optional(),
  }).default({}),
});

export const CreativeDocumentJsonSchema = z.object({
  schema_version: SchemaVersionSchema,
  canvas: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    format: z.enum(['instagram_post', 'instagram_story', 'linkedin_post', 'custom']).default('instagram_post'),
  }),
  template_id: z.string().min(1),
  brand_id: z.string().min(1),
  content_item_id: z.string().optional(),
  generated_asset_id: z.string().optional(),
  slides: z.array(CreativeSlideSchema).min(1),
  tokens: z.record(z.string()).default({}),
});

export const AssetCollectionSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid().nullable().optional(),
  brand_id: z.string().uuid().nullable().optional(),
  scope: AssetCollectionScopeSchema,
  name: z.string().min(1),
  slug: z.string().min(1),
  status: z.enum(['active', 'archived']).default('active'),
  metadata: z.record(z.unknown()).default({ schema_version: 1 }),
});

export const GlobalAssetSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid().nullable().optional(),
  collection_id: z.string().uuid().nullable().optional(),
  category: z.enum(['logo', 'photo', 'background', 'icon', 'shape', 'texture', 'mockup', 'other']),
  status: BrandAssetStatusSchema,
  storage_bucket: z.string().default('global-assets'),
  storage_path: z.string().min(1),
  file_name: z.string().min(1),
  mime_type: z.string().min(1),
  metadata: z.record(z.unknown()).default({ schema_version: 1 }),
});

export const TemplatePlaceholderSchema = z.object({
  id: z.string().uuid().optional(),
  workspace_id: z.string().uuid().nullable().optional(),
  template_ref: z.string().min(1),
  placeholder_key: z.string().min(1),
  kind: z.enum(['text', 'image', 'logo', 'color', 'asset']),
  role: CreativeElementRoleSchema,
  required: z.boolean().default(false),
  constraints_json: z.record(z.unknown()).default({ schema_version: 1 }),
});

export const CreativeDocumentSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  content_item_id: z.string().uuid().nullable().optional(),
  generated_asset_id: z.string().uuid().nullable().optional(),
  template_ref: z.string().min(1),
  title: z.string().min(1),
  status: CreativeDocumentStatusSchema,
  document_json: CreativeDocumentJsonSchema,
  metadata: z.record(z.unknown()).default({ schema_version: 1 }),
});

export const CreativeVersionSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  creative_document_id: z.string().uuid(),
  version: z.number().int().positive(),
  status: z.enum(['draft', 'submitted', 'approved', 'archived']).default('draft'),
  document_json: CreativeDocumentJsonSchema,
  change_summary: z.string().nullable().optional(),
});

export const CreativeRenderSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  creative_document_id: z.string().uuid(),
  creative_version_id: z.string().uuid().nullable().optional(),
  generated_asset_id: z.string().uuid().nullable().optional(),
  status: CreativeRenderStatusSchema,
  output_format: RenderOutputFormatSchema,
  storage_bucket: z.string().default('brand-assets'),
  storage_path: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).default({ schema_version: 1 }),
});

export const GeneratedAssetSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  content_item_id: z.string().uuid().nullable().optional(),
  status: z.enum(['draft', 'rendering', 'ready', 'failed', 'archived']),
  storage_bucket: z.string().default('brand-assets'),
  storage_path: z.string().nullable().optional(),
  mime_type: z.string().nullable().optional(),
  render_payload_json: z.record(z.unknown()).default({ schema_version: 1 }),
  metadata: z.record(z.unknown()).default({}),
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

export const GenerateContentPlanInputSchema = z.object({
  workspace_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  requested_by: z.string().uuid(),
  period_start: z.string().min(1),
  period_end: z.string().min(1),
  objective: z.string().optional(),
});

export const GenerateContentPlanOutputSchema = z.object({
  content_plan_id: z.string().uuid(),
  content_item_ids: z.array(z.string().uuid()),
  title: z.string().min(1),
  items_count: z.number().int().nonnegative(),
});

export const GenerateRenderPreviewInputSchema = z.object({
  workspace_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  content_item_id: z.string().uuid(),
  requested_by: z.string().uuid(),
  output_format: RenderOutputFormatSchema.default('png'),
});

export const GenerateRenderPreviewOutputSchema = z.object({
  generated_asset_id: z.string().uuid(),
  generated_asset_ids: z.array(z.string().uuid()).default([]),
  approval_id: z.string().uuid().nullable(),
  approval_ids: z.array(z.string().uuid()).default([]),
  storage_bucket: z.string().min(1),
  storage_path: z.string().min(1),
  storage_paths: z.array(z.string()).default([]),
  mime_type: z.string().min(1),
  output_format: RenderOutputFormatSchema,
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
  target_type: z.enum(['brand_memory', 'content_plan', 'content_item', 'generated_asset', 'creative_document', 'creative_version']),
  target_id: z.string().uuid(),
  status: ApprovalStatusSchema,
  decided_by: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type Workspace = z.infer<typeof WorkspaceSchema>;
export type Member = z.infer<typeof MemberSchema>;
export type WorkspaceInvitation = z.infer<typeof WorkspaceInvitationSchema>;
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
export type RenderCarouselResponse = z.infer<typeof RenderCarouselResponseSchema>;
export type CreativeElement = z.infer<typeof CreativeElementSchema>;
export type CreativeSlide = z.infer<typeof CreativeSlideSchema>;
export type CreativeDocumentJson = z.infer<typeof CreativeDocumentJsonSchema>;
export type AssetCollection = z.infer<typeof AssetCollectionSchema>;
export type GlobalAsset = z.infer<typeof GlobalAssetSchema>;
export type TemplatePlaceholder = z.infer<typeof TemplatePlaceholderSchema>;
export type CreativeDocument = z.infer<typeof CreativeDocumentSchema>;
export type CreativeVersion = z.infer<typeof CreativeVersionSchema>;
export type CreativeRender = z.infer<typeof CreativeRenderSchema>;
export type GeneratedAsset = z.infer<typeof GeneratedAssetSchema>;
export type GenerateBrandMemoryInput = z.infer<typeof GenerateBrandMemoryInputSchema>;
export type GenerateBrandMemoryOutput = z.infer<typeof GenerateBrandMemoryOutputSchema>;
export type GenerateContentPlanInput = z.infer<typeof GenerateContentPlanInputSchema>;
export type GenerateContentPlanOutput = z.infer<typeof GenerateContentPlanOutputSchema>;
export type GenerateRenderPreviewInput = z.infer<typeof GenerateRenderPreviewInputSchema>;
export type GenerateRenderPreviewOutput = z.infer<typeof GenerateRenderPreviewOutputSchema>;
export type JobRun = z.infer<typeof JobRunSchema>;
export type Approval = z.infer<typeof ApprovalSchema>;
