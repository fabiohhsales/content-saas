'use client';

import { useMemo, useState } from 'react';
import type { CreativeDocumentJson } from '@content-saas/contracts';
import { updateCreativeElement } from '../actions';

type AssetRow = {
  id: string;
  category: string;
  status: string;
  file_name: string;
  mime_type: string;
  storage_bucket?: string;
  storage_path?: string;
  metadata?: Record<string, any>;
  signedUrl?: string | null;
};

type PlaceholderRow = {
  id?: string;
  template_ref: string;
  placeholder_key: string;
  kind: string;
  role: string;
  required: boolean;
  constraints_json?: Record<string, any>;
};

type VersionRow = {
  id: string;
  version: number;
  status: string;
  change_summary: string | null;
  created_at: string;
};

type EditorialContext = {
  funnel_stage?: string;
  editorial_pillar?: string;
  headline?: string;
  central_idea?: string;
  cta?: string;
  compliance_notes?: string[];
};

type TemplateLike = {
  name?: string;
  recommended_use?: string;
};

type EditableElement = CreativeDocumentJson['slides'][number]['elements'][number] & {
  slide_id: string;
  slide_name?: string;
};

type EditorClientProps = {
  documentId: string;
  document: CreativeDocumentJson;
  template: TemplateLike;
  brandAssets: AssetRow[];
  globalAssets: AssetRow[];
  placeholders: PlaceholderRow[];
  versions: VersionRow[];
  editorialContext?: EditorialContext | null;
};

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    editing: 'Em edicao',
    ready_for_approval: 'Pronto para aprovacao',
    approved: 'Aprovado',
    archived: 'Arquivado',
    submitted: 'Enviado',
  };
  return labels[status] ?? status;
}

function formatDate(value?: string) {
  if (!value) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function styleNumber(value: unknown, fallback: number) {
  return typeof value === 'number' ? value : fallback;
}

function assetLabel(asset?: AssetRow) {
  if (!asset) return 'Sem asset aplicado';
  return `${asset.file_name} - ${asset.category}`;
}

function assetRef(assetSource?: string, assetId?: string) {
  return assetSource && assetId ? `${assetSource}:${assetId}` : '';
}

function elementLabel(element: EditableElement) {
  return element.placeholder ?? element.role ?? element.id;
}

function selectedKeyFor(element: EditableElement) {
  return `${element.slide_id}:${element.id}`;
}

export function EditorClient({
  documentId,
  document,
  template,
  brandAssets,
  globalAssets,
  placeholders,
  versions,
  editorialContext,
}: EditorClientProps) {
  const [selectedKey, setSelectedKey] = useState('');
  const slide = document.slides[0]!;
  const canvas = document.canvas;

  const allAssets = useMemo(() => [...brandAssets, ...globalAssets], [brandAssets, globalAssets]);
  const assetsById = useMemo(() => allAssets.reduce<Record<string, AssetRow>>((acc, asset) => {
    acc[asset.id] = asset;
    return acc;
  }, {}), [allAssets]);
  const editableElements = useMemo(() => document.slides.flatMap((currentSlide) => currentSlide.elements.map((element): EditableElement => ({
    ...element,
    slide_id: currentSlide.id,
    ...(currentSlide.name ? { slide_name: currentSlide.name } : {}),
  }))), [document]);

  const selectedElement = editableElements.find((element) => selectedKeyFor(element) === selectedKey) ?? editableElements[0];
  const selectedElementKey = selectedElement ? selectedKeyFor(selectedElement) : '';
  const backgroundAsset = slide.background.asset_id ? assetsById[slide.background.asset_id] : null;

  return (
    <section className="editor-workbench">
      <aside className="editor-sidebar grid">
        <section className="panel grid">
          <div>
            <small className="muted">Template</small>
            <h2>{template.name ?? document.template_id}</h2>
            <p className="muted">{template.recommended_use ?? 'Template pronto para revisao visual.'}</p>
          </div>
          <div>
            <small className="muted">Placeholders criticos</small>
            <div className="grid" style={{ marginTop: 8 }}>
              {placeholders.map((placeholder) => (
                <button
                  className="layer-button"
                  type="button"
                  key={placeholder.placeholder_key}
                  onClick={() => {
                    const match = editableElements.find((element) => element.placeholder === placeholder.placeholder_key || element.role === placeholder.role);
                    if (match) setSelectedKey(selectedKeyFor(match));
                  }}
                >
                  <strong>{placeholder.placeholder_key}</strong>
                  <span>{placeholder.kind} - {placeholder.role} - {placeholder.required ? 'obrigatorio' : 'opcional'}</span>
                </button>
              ))}
              {placeholders.length === 0 ? <p className="muted">Sem placeholders cadastrados para este template.</p> : null}
            </div>
          </div>
        </section>

        <section className="panel grid">
          <div>
            <small className="muted">Camadas</small>
            <h2>{editableElements.length} elementos</h2>
          </div>
          <div className="layers-list">
            {editableElements.map((element) => {
              const key = selectedKeyFor(element);
              return (
                <button
                  className={`layer-button ${key === selectedElementKey ? 'selected' : ''}`}
                  type="button"
                  key={key}
                  onClick={() => setSelectedKey(key)}
                >
                  <strong>{elementLabel(element)}</strong>
                  <span>{element.type} - {element.locked ? 'travado' : 'editavel'} - {element.visible ? 'visivel' : 'oculto'}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel grid">
          <div>
            <small className="muted">Historico</small>
            <h2>Versoes</h2>
          </div>
          {versions.map((version) => (
            <article className="mini-card" key={version.id}>
              <strong>v{version.version} - {statusLabel(version.status)}</strong>
              <p className="muted">{version.change_summary ?? 'Sem resumo.'}</p>
              <small className="muted">{formatDate(version.created_at)}</small>
            </article>
          ))}
          {versions.length === 0 ? <p className="muted">Nenhuma versao salva ainda.</p> : null}
        </section>
      </aside>

      <main className="editor-stage panel">
        <div className="stage-toolbar">
          <div>
            <small className="muted">{canvas.format} - {canvas.width}x{canvas.height}</small>
            <h2>{slide.name ?? 'Slide 1'}</h2>
          </div>
          <span className="muted">{document.slides.length} slide(s)</span>
        </div>
        <div
          className="creative-canvas interactive"
          style={{
            aspectRatio: `${canvas.width} / ${canvas.height}`,
            background: slide.background.color ?? document.tokens.background_color ?? '#f7f7f4',
          }}
        >
          {backgroundAsset?.signedUrl ? <img className="creative-background" alt="" src={backgroundAsset.signedUrl} /> : null}
          {slide.elements.filter((element) => element.visible).map((element) => {
            const asset = element.asset_id ? assetsById[element.asset_id] : undefined;
            const key = `${slide.id}:${element.id}`;
            const baseStyle = {
              left: `${(element.x / canvas.width) * 100}%`,
              top: `${(element.y / canvas.height) * 100}%`,
              width: `${(element.width / canvas.width) * 100}%`,
              height: `${(element.height / canvas.height) * 100}%`,
              transform: `rotate(${element.rotation}deg)`,
            };
            const selected = key === selectedElementKey;

            if (element.type === 'image') {
              return (
                <button
                  className={`creative-element image selectable ${selected ? 'selected' : ''}`}
                  style={baseStyle}
                  key={element.id}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                >
                  {asset?.signedUrl ? <img alt={asset.file_name} src={asset.signedUrl} /> : <span>{element.placeholder ?? element.role}</span>}
                </button>
              );
            }

            if (element.type === 'shape') {
              return (
                <button
                  className={`creative-element shape selectable ${selected ? 'selected' : ''}`}
                  style={{ ...baseStyle, background: String(element.style.color ?? '#d0d5dd') }}
                  key={element.id}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  aria-label={elementLabel({ ...element, slide_id: slide.id })}
                />
              );
            }

            return (
              <button
                className={`creative-element text selectable ${selected ? 'selected' : ''}`}
                style={{
                  ...baseStyle,
                  color: String(element.style.color ?? document.tokens.text_color ?? '#1f2933'),
                  fontSize: `${Math.max(14, styleNumber(element.style.font_size, 32) * 0.44)}px`,
                  fontWeight: Number(element.style.font_weight ?? 400),
                }}
                key={element.id}
                type="button"
                onClick={() => setSelectedKey(key)}
              >
                {element.text}
              </button>
            );
          })}
        </div>
      </main>

      <aside className="editor-inspector grid">
        {editorialContext ? (
          <section className="panel grid">
            <div>
              <small className="muted">Contexto editorial</small>
              <h2>{editorialContext.headline ?? 'Direcao do conteudo'}</h2>
              <p className="muted">{editorialContext.central_idea ?? 'Use o briefing editorial para revisar texto, CTA e imagem.'}</p>
            </div>
            <div className="summary-tags">
              {editorialContext.funnel_stage ? <span>{editorialContext.funnel_stage}</span> : null}
              {editorialContext.editorial_pillar ? <span>{editorialContext.editorial_pillar}</span> : null}
            </div>
            {editorialContext.cta ? <p><strong>CTA:</strong> {editorialContext.cta}</p> : null}
            {editorialContext.compliance_notes?.length ? (
              <div>
                <small className="muted">Compliance</small>
                {editorialContext.compliance_notes.slice(0, 3).map((note) => (
                  <p className="muted" key={note}>{note}</p>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {selectedElement ? (
          <form action={updateCreativeElement.bind(null, documentId)} className="panel grid">
            <div>
              <small className="muted">Selecionado</small>
              <h2>{elementLabel(selectedElement)}</h2>
              <p className="muted">{selectedElement.type} - {selectedElement.role} - {selectedElement.locked ? 'travado' : 'editavel'}</p>
            </div>
            <input type="hidden" name="slide_id" value={selectedElement.slide_id} />
            <input type="hidden" name="element_id" value={selectedElement.id} />
            <input type="hidden" name="element_type" value={selectedElement.type} />

            {selectedElement.type === 'text' ? (
              <label>
                Texto
                <textarea name="text" defaultValue={selectedElement.text ?? ''} />
              </label>
            ) : (
              <div className="grid">
                <p className="muted">Asset aplicado: {assetLabel(selectedElement.asset_id ? assetsById[selectedElement.asset_id] : undefined)}</p>
                <label>
                  Trocar asset
                  <select name="asset_ref" defaultValue={assetRef(selectedElement.asset_source, selectedElement.asset_id)}>
                    <option value="">Sem asset</option>
                    {brandAssets.map((asset) => (
                      <option value={`brand_asset:${asset.id}`} key={asset.id}>{asset.file_name} - marca - {asset.category}</option>
                    ))}
                    {globalAssets.map((asset) => (
                      <option value={`global_asset:${asset.id}`} key={asset.id}>{asset.file_name} - global - {asset.category}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <div className="grid two compact-fields" aria-disabled={selectedElement.locked}>
              <label>
                X
                <input name="x" type="number" step="1" defaultValue={Math.round(selectedElement.x)} disabled={selectedElement.locked} />
              </label>
              <label>
                Y
                <input name="y" type="number" step="1" defaultValue={Math.round(selectedElement.y)} disabled={selectedElement.locked} />
              </label>
              <label>
                Largura
                <input name="width" type="number" step="1" min="1" defaultValue={Math.round(selectedElement.width)} disabled={selectedElement.locked} />
              </label>
              <label>
                Altura
                <input name="height" type="number" step="1" min="1" defaultValue={Math.round(selectedElement.height)} disabled={selectedElement.locked} />
              </label>
              <label>
                Rotacao
                <input name="rotation" type="number" step="1" defaultValue={Math.round(selectedElement.rotation)} disabled={selectedElement.locked} />
              </label>
            </div>

            {selectedElement.locked ? <p className="muted">Layout travado pelo template; texto ou asset ainda podem ser revisados quando aplicavel.</p> : null}

            <label>
              Resumo da mudanca
              <input name="change_summary" placeholder="Ex.: ajustei headline, troquei logo ou reposicionei foto" />
            </label>
            <button className="secondary" type="submit">Salvar versao</button>
          </form>
        ) : (
          <section className="panel">
            <h2>Nenhum elemento editavel</h2>
            <p className="muted">Este documento nao possui elementos no contrato visual atual.</p>
          </section>
        )}

        <section className="panel grid">
          <div>
            <small className="muted">Assets da marca</small>
            <h2>Biblioteca</h2>
          </div>
          {brandAssets.map((asset) => (
            <button
              className="asset-row-button"
              type="button"
              key={asset.id}
              onClick={() => {
                const firstImage = editableElements.find((element) => ['image', 'shape'].includes(element.type));
                if (firstImage) setSelectedKey(selectedKeyFor(firstImage));
              }}
            >
              {asset.signedUrl ? <img alt={asset.file_name} src={asset.signedUrl} /> : <span />}
              <span>
                <strong>{asset.file_name}</strong>
                <small>{asset.category} - {asset.mime_type}</small>
              </span>
            </button>
          ))}
        </section>

        <section className="panel grid">
          <div>
            <small className="muted">Biblioteca global</small>
            <h2>Elementos</h2>
          </div>
          {globalAssets.map((asset) => (
            <button
              className="asset-row-button"
              type="button"
              key={asset.id}
              onClick={() => {
                const firstImage = editableElements.find((element) => ['image', 'shape'].includes(element.type));
                if (firstImage) setSelectedKey(selectedKeyFor(firstImage));
              }}
            >
              {asset.signedUrl ? <img alt={asset.file_name} src={asset.signedUrl} /> : <span />}
              <span>
                <strong>{asset.file_name}</strong>
                <small>{asset.category} - {Array.isArray(asset.metadata?.tags) ? asset.metadata.tags.join(', ') : 'curado'}</small>
              </span>
            </button>
          ))}
        </section>
      </aside>
    </section>
  );
}
