/**
 * InfoWindow/Callout Builders para componentes de mapa
 *
 * Funções utilitárias para construir conteúdo de InfoWindows (web) e Callouts (mobile).
 * Centralizadas para manter consistência visual e facilitar manutenção.
 */

import { escapeHtml, INFO_WINDOW_ANIMATION_CSS, INFO_WINDOW_COLORS } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface ParadaInfo {
  id: string;
  ordem: number;
  endereco: string;
  status: string;
  destinatario?: string;
  telefone?: string;
  tipo?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getStatusColor(status?: string): string {
  switch (status) {
    case 'concluida':
      return '#10b981'; // verde
    case 'em_andamento':
      return '#f7a02a'; // laranja marca RotaMestre
    case 'cancelada':
      return '#ef4444'; // vermelho
    default:
      return '#f59e0b'; // amarelo (pendente)
  }
}

export function getStatusLabel(status?: string): string {
  switch (status) {
    case 'concluida':
      return 'Concluída';
    case 'em_andamento':
      return 'Em andamento';
    case 'pendente':
      return 'Pendente';
    default:
      return status || '';
  }
}

// ============================================================================
// Parada Builders
// ============================================================================

/**
 * Cria o elemento DOM para o header do InfoWindow de uma parada normal.
 * Inclui badge colorido com número + título "Parada X".
 */
export function buildParadaHeader(parada: ParadaInfo): HTMLElement {
  const statusColor = getStatusColor(parada.status);

  const container = document.createElement('div');
  container.style.cssText = 'display:flex;align-items:center;gap:8px;font-family:sans-serif;';

  // Badge com número da parada (cor baseada no status)
  const badge = document.createElement('div');
  badge.style.cssText = `
    width:24px;
    height:24px;
    border-radius:50%;
    background:${statusColor};
    display:flex;
    align-items:center;
    justify-content:center;
    flex-shrink:0;
    color:white;
    font-weight:700;
    font-size:12px;
  `;
  badge.textContent = String(parada.ordem);

  // Título "Parada X"
  const titleSpan = document.createElement('span');
  titleSpan.style.cssText = `font-weight:700;font-size:14px;color:${INFO_WINDOW_COLORS.text.primary};`;
  titleSpan.textContent = `Parada ${parada.ordem}`;

  container.appendChild(badge);
  container.appendChild(titleSpan);

  return container;
}

/**
 * Cria o HTML do corpo do InfoWindow de uma parada normal.
 * Inclui endereço, badges de status/tipo, destinatário, telefone e botão.
 */
export function buildInfoContent(parada: ParadaInfo): string {
  const statusLabel = getStatusLabel(parada.status);
  const statusColor = getStatusColor(parada.status);
  const { text, background } = INFO_WINDOW_COLORS;

  return `
    <style>
      ${INFO_WINDOW_ANIMATION_CSS}
      .info-window-content {
        animation: infoWindowFadeIn 0.2s ease-out;
      }
      .go-to-btn:hover {
        background: ${background.border} !important;
      }
    </style>
    <div class="info-window-content" role="region" aria-label="Detalhes da parada ${parada.ordem}" style="max-width:240px;font-family:sans-serif;">
      <div style="font-size:13px;margin-bottom:8px;line-height:18px;">${escapeHtml(parada.endereco)}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
        <span style="padding:4px 8px;border-radius:12px;background:${statusColor}15;color:${statusColor};font-weight:600;font-size:12px;">${statusLabel}</span>
        ${parada.tipo ? `<span style="padding:4px 8px;border-radius:12px;background:#e0f2fe;color:${text.primary};font-weight:600;font-size:12px;text-transform:capitalize;">${escapeHtml(parada.tipo)}</span>` : ''}
      </div>
      ${parada.destinatario ? `<div style="font-size:12px;color:${text.secondary};margin-bottom:4px;"><strong>Destinatário:</strong> ${escapeHtml(parada.destinatario)}</div>` : ''}
      ${parada.telefone ? `<div style="font-size:12px;color:${text.secondary};margin-bottom:6px;"><strong>Telefone:</strong> ${escapeHtml(parada.telefone)}</div>` : ''}
      <button id="go-to-${parada.id}" class="go-to-btn" aria-label="Ver parada ${parada.ordem} na lista de paradas" style="margin-top:4px;padding:8px 10px;border-radius:10px;border:1px solid ${background.border};background:${background.surface};color:${text.primary};cursor:pointer;font-weight:600;font-size:12px;transition:background 0.15s ease;">Ver na lista</button>
    </div>
  `;
}

// ============================================================================
// Checkpoint Builders
// ============================================================================

/**
 * Cria o elemento DOM para o header do InfoWindow de um checkpoint (PARTIDA/CHEGADA).
 * Inclui ícone colorido + título.
 */
export function buildCheckpointHeader(isPartida: boolean): HTMLElement {
  const title = isPartida ? 'PARTIDA' : 'CHEGADA';
  const iconPath = isPartida
    ? 'M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z' // Flag
    : 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z'; // Home

  const container = document.createElement('div');
  container.style.cssText = 'display:flex;align-items:center;gap:8px;font-family:sans-serif;';

  const iconWrapper = document.createElement('div');
  iconWrapper.style.cssText = `
    width:24px;
    height:24px;
    border-radius:5px;
    background:linear-gradient(135deg,${INFO_WINDOW_COLORS.brand.primary} 0%,${INFO_WINDOW_COLORS.brand.primaryDark} 100%);
    display:flex;
    align-items:center;
    justify-content:center;
    flex-shrink:0;
  `;

  iconWrapper.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="${iconPath}" fill="white"/>
    </svg>
  `;

  const titleSpan = document.createElement('span');
  titleSpan.style.cssText = `font-weight:700;font-size:14px;color:${INFO_WINDOW_COLORS.brand.primary};letter-spacing:0.5px;`;
  titleSpan.textContent = title;

  container.appendChild(iconWrapper);
  container.appendChild(titleSpan);

  return container;
}

/**
 * Cria o HTML do corpo do InfoWindow de um checkpoint.
 * Inclui nome da unidade (opcional), endereço e botão de copiar.
 */
export function buildCheckpointInfoContent(parada: ParadaInfo, unidadeNome?: string): string {
  const { text, background } = INFO_WINDOW_COLORS;

  return `
    <style>
      ${INFO_WINDOW_ANIMATION_CSS}
      .checkpoint-info-window {
        animation: infoWindowFadeIn 0.2s ease-out;
      }
      .copy-btn:hover {
        background: ${background.border} !important;
      }
      .copy-btn:active {
        transform: scale(0.95);
      }
    </style>
    <div class="checkpoint-info-window" style="max-width:220px;font-family:sans-serif;">
      ${unidadeNome ? `<div style="font-size:13px;font-weight:600;color:${text.primary};margin-bottom:4px;">${escapeHtml(unidadeNome)}</div>` : ''}
      <div style="font-size:13px;color:${text.secondary};line-height:18px;margin-bottom:10px;">${escapeHtml(parada.endereco)}</div>
      <button id="copy-checkpoint-${parada.id}" class="copy-btn" aria-label="Copiar endereço para área de transferência" style="
        width:100%;
        padding:8px 12px;
        border-radius:8px;
        border:1px solid ${background.border};
        background:${background.surface};
        color:${text.secondary};
        cursor:pointer;
        font-weight:500;
        font-size:12px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        transition:background 0.15s ease, transform 0.1s ease;
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor"/>
        </svg>
        Copiar endereço
      </button>
    </div>
  `;
}

// ============================================================================
// Motorista Builders
// ============================================================================

/**
 * Cria o elemento DOM para o header do InfoWindow do motorista.
 * Inclui ícone colorido + nome do motorista.
 */
export function buildMotoristaHeader(motoristaNome: string, markerColor: string): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = 'display:flex;align-items:center;gap:8px;font-family:sans-serif;';

  // Ícone de van de entrega em círculo colorido
  const iconWrapper = document.createElement('div');
  iconWrapper.style.cssText = `
    width:24px;
    height:24px;
    border-radius:50%;
    background:${markerColor};
    display:flex;
    align-items:center;
    justify-content:center;
    flex-shrink:0;
  `;
  // Ícone de van de entrega (local_shipping)
  iconWrapper.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="white"/>
    </svg>
  `;

  // Nome do motorista
  const titleSpan = document.createElement('span');
  titleSpan.style.cssText = `font-weight:700;font-size:14px;color:${INFO_WINDOW_COLORS.text.primary};`;
  titleSpan.textContent = motoristaNome || 'Motorista';

  container.appendChild(iconWrapper);
  container.appendChild(titleSpan);

  return container;
}

/**
 * Cria o HTML do corpo do InfoWindow do motorista.
 * Inclui velocidade atual e tempo desde última atualização.
 */
export function buildMotoristaInfoContent(
  speed: number | null,
  lastUpdate: string,
  markerColor: string
): string {
  const speedText = speed !== null ? `${Math.round(speed)} km/h` : 'N/A';

  return `
    <style>
      ${INFO_WINDOW_ANIMATION_CSS}
      .motorista-info-window {
        animation: infoWindowFadeIn 0.2s ease-out;
      }
    </style>
    <div class="motorista-info-window" style="font-family:sans-serif;min-width:140px;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
        <span style="padding:4px 8px;border-radius:12px;background:${markerColor}20;color:${markerColor};font-weight:600;font-size:12px;">${speedText}</span>
      </div>
      <div style="font-size:12px;color:${INFO_WINDOW_COLORS.text.secondary};">
        Atualizado ${lastUpdate}
      </div>
    </div>
  `;
}
