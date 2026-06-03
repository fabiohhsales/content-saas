import {
  EditorialPlaybookJsonSchema,
  HAIR_TRANSPLANT_PLAYBOOK,
  HAIR_TRANSPLANT_PLAYBOOK_SLUG,
} from '@content-saas/contracts';
import { supabase } from './supabase.js';

type BrandRow = {
  id: string;
  workspace_id: string;
  industry: string | null;
  positioning: string | null;
};

export type EditorialPlaybookContext = {
  id: string;
  slug: string;
  name: string;
  vertical: string;
  playbook_json: typeof HAIR_TRANSPLANT_PLAYBOOK;
  profile_json: Record<string, unknown>;
  source: 'linked' | 'global_fallback' | 'built_in_fallback';
};

type PromptAssemblyInput = {
  brand: { name: string; industry: string | null; positioning: string | null; voice_notes?: string | null };
  memory_summary?: string;
  playbook?: EditorialPlaybookContext | null;
  monthly_briefing?: Record<string, unknown>;
  output_contract: string;
};

function looksLikeHairTransplantBrand(brand: BrandRow) {
  const haystack = `${brand.industry ?? ''} ${brand.positioning ?? ''}`.toLowerCase();
  return ['capilar', 'transplante', 'tricologia', 'calvicie', 'cabelo'].some((term) => haystack.includes(term));
}

async function loadPlaybookById(playbookId: string, workspaceId: string) {
  const { data } = await supabase
    .from('editorial_playbooks')
    .select('id, slug, name, vertical, playbook_json')
    .eq('id', playbookId)
    .eq('status', 'active')
    .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
    .maybeSingle();

  return data as { id: string; slug: string; name: string; vertical: string; playbook_json: Record<string, unknown> } | null;
}

async function loadGlobalHairTransplantPlaybook(workspaceId: string) {
  const { data } = await supabase
    .from('editorial_playbooks')
    .select('id, slug, name, vertical, playbook_json')
    .eq('slug', HAIR_TRANSPLANT_PLAYBOOK_SLUG)
    .eq('status', 'active')
    .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
    .maybeSingle();

  return data as { id: string; slug: string; name: string; vertical: string; playbook_json: Record<string, unknown> } | null;
}

export async function loadBrandEditorialContext(brand: BrandRow): Promise<EditorialPlaybookContext | null> {
  const { data: linked } = await supabase
    .from('brand_playbooks')
    .select('playbook_id, editorial_profile_json')
    .eq('workspace_id', brand.workspace_id)
    .eq('brand_id', brand.id)
    .eq('status', 'active')
    .maybeSingle();

  if (linked?.playbook_id) {
    const playbook = await loadPlaybookById(String(linked.playbook_id), brand.workspace_id);
    if (playbook) {
      return {
        ...playbook,
        playbook_json: EditorialPlaybookJsonSchema.parse(playbook.playbook_json),
        profile_json: (linked.editorial_profile_json as Record<string, unknown> | null) ?? {},
        source: 'linked',
      };
    }
  }

  if (looksLikeHairTransplantBrand(brand)) {
    const playbook = await loadGlobalHairTransplantPlaybook(brand.workspace_id);
    if (playbook) {
      return {
        ...playbook,
        playbook_json: EditorialPlaybookJsonSchema.parse(playbook.playbook_json),
        profile_json: {},
        source: 'global_fallback',
      };
    }

    return {
      id: '00000000-0000-4000-8000-000000000901',
      slug: HAIR_TRANSPLANT_PLAYBOOK_SLUG,
      name: 'Transplante capilar',
      vertical: 'transplante_capilar',
      playbook_json: HAIR_TRANSPLANT_PLAYBOOK,
      profile_json: {},
      source: 'built_in_fallback',
    };
  }

  return null;
}

export function buildPromptAssembly(input: PromptAssemblyInput) {
  const playbook = input.playbook?.playbook_json;
  return {
    schema_version: 1,
    generation_mode: 'mock_structured_playbook',
    system_rules: [
      'Criar conteudo social com estrategia editorial, revisao humana e compliance.',
      'Nao expor prompt tecnico para o usuario final.',
      ...(playbook?.compliance_rules ?? []),
    ],
    brand_memory: {
      brand_name: input.brand.name,
      industry: input.brand.industry ?? '',
      positioning: input.brand.positioning ?? '',
      voice_notes: input.brand.voice_notes ?? '',
      memory_summary: input.memory_summary ?? '',
    },
    editorial_playbook: input.playbook ? {
      slug: input.playbook.slug,
      version: input.playbook.playbook_json.version,
      vertical: input.playbook.vertical,
      positioning: input.playbook.playbook_json.positioning,
      funnel_distribution: input.playbook.playbook_json.funnel_distribution,
      pillars: input.playbook.playbook_json.editorial_pillars.map((pillar) => pillar.name),
      ctas: input.playbook.playbook_json.ctas.recommended,
    } : null,
    monthly_briefing: input.monthly_briefing ?? {},
    output_contract: input.output_contract,
  };
}
