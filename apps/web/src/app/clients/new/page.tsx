import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getCurrentWorkspace } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo';
import { createBrand } from '../../brands/actions';

export default async function NewClientPage() {
  const { membership } = await getCurrentWorkspace();
  if (!membership) redirect('/onboarding');

  return (
    <AppShell>
      <div className="toolbar">
        <div>
          <small className="muted">Novo cliente</small>
          <h1>Setup inicial</h1>
          <p className="muted">Cadastre a base do cliente primeiro. Depois o painel interno guia identidade, assets, templates e estrategia.</p>
        </div>
        <Link className="button secondary" href="/clients">Voltar para clientes</Link>
      </div>

      <section className="client-onboarding-shell">
        <form action={createBrand} className="panel grid client-onboarding-form">
          {isDemoMode() ? <p className="muted">No demo, este formulario abre o cliente ficticio preenchido.</p> : null}
          <div className="grid two">
            <label>
              Nome do cliente
              <input name="name" required minLength={2} placeholder="Clinica Aurora" />
            </label>
            <label>
              Segmento
              <input name="industry" placeholder="Saude, estetica, varejo..." />
            </label>
          </div>
          <div className="grid two compact-fields">
            <label>
              Cor primaria RGB/HEX
              <input name="primary_color" type="color" defaultValue="#0f766e" />
            </label>
            <label>
              Cor secundaria RGB/HEX
              <input name="secondary_color" type="color" defaultValue="#115e59" />
            </label>
          </div>
          <label>
            Fonte base
            <select name="font_family" defaultValue="Arial">
              <option value="Arial">Arial</option>
              <option value="Inter">Inter</option>
              <option value="Helvetica">Helvetica</option>
              <option value="Georgia">Georgia</option>
              <option value="Montserrat">Montserrat</option>
              <option value="Poppins">Poppins</option>
            </select>
          </label>
          <label>
            Posicionamento
            <textarea name="positioning" placeholder="Como esse cliente quer ser percebido?" />
          </label>
          <label>
            Voz e restricoes
            <textarea name="voice_notes" placeholder="Tom, palavras proibidas, promessas que devem ser evitadas..." />
          </label>
          <label>
            Observacoes visuais
            <textarea name="visual_notes" placeholder="Uso de logo, estilo de foto, preferencias de capa, referencias..." />
          </label>
          <button type="submit">Criar cliente e abrir painel</button>
        </form>

        <aside className="panel setup-aside">
          <small className="muted">Proximo passo</small>
          <h2>O painel do cliente assume daqui</h2>
          <p className="muted">Depois de criar, voce sobe logo, capa, fotos, fonte, vincula templates e gera o cronograma no mesmo fluxo.</p>
          <div className="setup-path">
            <span>Perfil</span>
            <span>Identidade</span>
            <span>Assets</span>
            <span>Templates</span>
            <span>Estrategia</span>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
