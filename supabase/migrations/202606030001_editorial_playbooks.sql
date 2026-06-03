create table public.editorial_playbooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  slug text not null,
  name text not null,
  vertical text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  playbook_json jsonb not null check ((playbook_json->>'schema_version') is not null),
  metadata jsonb not null default '{"schema_version":1}'::jsonb check ((metadata->>'schema_version') is not null),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index editorial_playbooks_global_slug_key
  on public.editorial_playbooks (slug)
  where workspace_id is null;

create unique index editorial_playbooks_workspace_slug_key
  on public.editorial_playbooks (workspace_id, slug)
  where workspace_id is not null;

create index editorial_playbooks_workspace_status_idx on public.editorial_playbooks (workspace_id, status);
create index editorial_playbooks_vertical_status_idx on public.editorial_playbooks (vertical, status);

create table public.brand_playbooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  playbook_id uuid not null references public.editorial_playbooks(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'archived')),
  editorial_profile_json jsonb not null default '{"schema_version":1}'::jsonb check ((editorial_profile_json->>'schema_version') is not null),
  metadata jsonb not null default '{"schema_version":1}'::jsonb check ((metadata->>'schema_version') is not null),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index brand_playbooks_active_brand_key
  on public.brand_playbooks (brand_id)
  where status = 'active';

create index brand_playbooks_workspace_brand_idx on public.brand_playbooks (workspace_id, brand_id, status);
create index brand_playbooks_playbook_idx on public.brand_playbooks (playbook_id);

alter table public.editorial_playbooks enable row level security;
alter table public.brand_playbooks enable row level security;

create policy "members can read editorial playbooks"
  on public.editorial_playbooks for select
  using (
    workspace_id is null
    or public.is_workspace_member(workspace_id)
  );

create policy "workspace editors can create editorial playbooks"
  on public.editorial_playbooks for insert
  with check (
    workspace_id is not null
    and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[])
  );

create policy "workspace editors can update editorial playbooks"
  on public.editorial_playbooks for update
  using (
    workspace_id is not null
    and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[])
  )
  with check (
    workspace_id is not null
    and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[])
  );

create policy "members can read brand playbooks"
  on public.brand_playbooks for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace editors can manage brand playbooks"
  on public.brand_playbooks for all
  using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]))
  with check (
    public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[])
    and exists (
      select 1
      from public.brands b
      where b.id = brand_id
        and b.workspace_id = brand_playbooks.workspace_id
    )
    and exists (
      select 1
      from public.editorial_playbooks ep
      where ep.id = playbook_id
        and ep.status = 'active'
        and (ep.workspace_id is null or ep.workspace_id = brand_playbooks.workspace_id)
    )
  );

insert into public.editorial_playbooks (
  id,
  workspace_id,
  slug,
  name,
  vertical,
  status,
  playbook_json,
  metadata
) values (
  '00000000-0000-4000-8000-000000000901',
  null,
  'transplante-capilar',
  'Transplante capilar',
  'transplante_capilar',
  'active',
  '{
    "schema_version": 1,
    "version": 1,
    "vertical": "transplante_capilar",
    "positioning": "Transplante capilar bem feito nao cria outra pessoa; recupera a melhor versao do paciente com naturalidade, seguranca, planejamento e acompanhamento.",
    "audience_diagnosis": "Pessoas considerando transplante capilar chegam com medo de dor, cicatriz, artificialidade, resultado incerto, area doadora insuficiente, preco inadequado e duvidas sobre avaliacao, pre, cirurgia e pos-operatorio.",
    "core_questions": ["Transplante capilar doi?", "Vai ficar artificial?", "Fica cicatriz?", "Meu cabelo transplantado pode cair?", "Quanto tempo demora para ver resultado?", "Minha area doadora e suficiente?", "Qual a diferenca entre FUE, FUT e No Shave?", "Como funciona a avaliacao?"],
    "voice": {
      "tone": ["medico e acessivel", "seguro sem arrogancia", "educativo sem ser professoral", "acolhedor", "comercial sem sensacionalismo", "direto e humano"],
      "avoid": ["milagre", "garantido", "100%", "perfeito", "sem risco", "ultimas vagas", "preco imperdivel", "resultado garantido"]
    },
    "editorial_pillars": [
      {"key":"duvidas_objecoes","name":"Duvidas e objecoes","description":"Responder perguntas diretas do lead com explicacao simples e CTA para avaliacao.","ideal_format":"Pergunta forte + resposta curta + explicacao + CTA.","examples":["Transplante capilar doi?","O cabelo transplantado cai?"]},
      {"key":"mitos_verdades","name":"Mitos e verdades","description":"Desmontar crencas populares e fake news com correcao tecnica.","ideal_format":"Mito forte + correcao tecnica + orientacao pratica.","examples":["Bone causa queda?","Todo transplante fica artificial?"]},
      {"key":"evolucao_resultado","name":"Antes e depois / evolucao","description":"Mostrar evolucao de caso com carater educativo, sem prometer resultado.","ideal_format":"Estagio do resultado + o que ainda evolui + ressalva de avaliacao individual.","examples":["3 meses","6 meses","12 meses"]},
      {"key":"tecnica_processo","name":"Tecnica e processo","description":"Explicar procedimento, FUE, planejamento, area doadora, direcao dos fios e pos-operatorio.","ideal_format":"Por tras do resultado existe metodo.","examples":["O que e FUE?","Como a hairline e planejada?"]},
      {"key":"autoridade_bastidores","name":"Autoridade medica e bastidores","description":"Mostrar medico, equipe, estrutura, avaliacao, acompanhamento e rotina conectados ao beneficio do paciente.","ideal_format":"Bastidor + criterio tecnico + impacto na seguranca do paciente.","examples":["Marcacao da hairline","lavagem pos-operatoria"]},
      {"key":"alertas_seguranca","name":"Alertas e seguranca","description":"Proteger o paciente de decisoes ruins, preco baixo demais e procedimentos sem criterio.","ideal_format":"Alerta sobrio + criterios objetivos + CTA para avaliacao responsavel.","examples":["Cuidado com transplante so pelo preco","Como escolher uma clinica?"]},
      {"key":"autoestima_identificacao","name":"Autoestima e identificacao","description":"Conectar cabelo, identidade e confianca sem melodrama.","ideal_format":"Frase de identificacao + acolhimento + solucao responsavel.","examples":["Entradas afetando confianca","recuperar sua versao natural"]},
      {"key":"topo_funil","name":"Topo de funil","description":"Conteudos leves, curiosos e compartilhaveis com orientacao util.","ideal_format":"Gancho curioso + explicacao util + ponte para avaliacao.","examples":["genetica materna ou paterna","sinais iniciais de calvicie"]},
      {"key":"conversao","name":"Fundo de funil / conversao","description":"Reduzir friccao de quem esta quase chamando no WhatsApp.","ideal_format":"Explicar proximo passo + diminuir inseguranca + CTA claro.","examples":["Como funciona a avaliacao?","Por que preco depende de avaliacao?"]}
    ],
    "funnel_distribution": {"topo":35,"meio":35,"fundo":20,"institucional":10},
    "formats": [
      {"key":"reels_curto","name":"Reels curto","structure":["Hook de 1 linha","Resposta direta","Explicacao em 2 ou 3 blocos","Fechamento com CTA"]},
      {"key":"carrossel","name":"Carrossel","structure":["Capa com promessa clara","Problema ou mito","Explicacao tecnica","Exemplo pratico","Cuidados ou alerta","CTA"]},
      {"key":"post_unico","name":"Post estatico","structure":["Frase forte","Contexto curto","CTA responsavel"]},
      {"key":"legenda","name":"Legenda","structure":["Primeira frase forte","Explicacao clara","CTA","Hashtags sobrias"]}
    ],
    "headline_formulas": ["O que ninguem te explica sobre [tema]","Antes de fazer transplante capilar, entenda isso","Transplante capilar nao e so colocar cabelo","O erro de escolher transplante so pelo preco","Com 6 meses, esse ainda nao e o resultado final","Por que a linha frontal define a naturalidade?"],
    "ctas": {
      "recommended": ["Agende uma avaliacao.","Envie suas fotos para uma pre-avaliacao.","Fale com a equipe pelo WhatsApp.","Entenda qual tecnica faz sentido para o seu caso."],
      "forbidden": ["Garanta seu resultado.","Resolva sua calvicie de uma vez.","Ultimas vagas.","Resultado perfeito.","Transplante sem risco.","100% indolor.","Preco imperdivel."]
    },
    "compliance_rules": ["Manter carater educativo e linguagem sobria.","Nao prometer resultado, ausencia total de dor, risco, cicatriz ou complicacoes.","Nao afirmar que todos sao candidatos.","Nao transformar antes/depois em promessa.","Nao criar urgencia falsa.","Incentivar avaliacao individual."],
    "quality_criteria": ["A headline responde uma dor real?","O conteudo educa ou so enfeita?","Existe promessa exagerada?","Esta claro para qual etapa do funil serve?","Tem CTA coerente?","O paciente entende o proximo passo?"]
  }'::jsonb,
  '{"schema_version":1,"seeded":true,"source":"promptizacao_editorial"}'::jsonb
) on conflict do nothing;
