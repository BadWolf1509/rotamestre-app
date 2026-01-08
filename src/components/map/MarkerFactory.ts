/* global google */

/**
 * Factory functions for creating Google Maps markers
 * Supports both AdvancedMarkerElement and legacy Marker
 */

import { getStatusColor, getStatusLabel } from '@/components/map/infoWindowBuilders';
import type { Theme } from '@/utils/styles';
import { MAP_WEB_SHADOWS } from '@/utils/webTokens';

interface Parada {
  id: string;
  ordem: number;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  is_checkpoint?: boolean;
}

/**
 * Add interactive styles and keyboard handlers to marker
 */
export function addMarkerInteractivity(
  wrapper: HTMLDivElement,
  onClick: (() => void) | undefined,
  focusColor: string
): void {
  // Smooth transition for visual effects
  wrapper.style.transition = 'transform 0.15s ease, box-shadow 0.15s ease';

  // Hover effect - larger scale
  wrapper.addEventListener('mouseenter', () => {
    wrapper.style.transform = 'scale(1.15)';
    wrapper.style.boxShadow = MAP_WEB_SHADOWS.markerHover;
  });

  wrapper.addEventListener('mouseleave', () => {
    wrapper.style.transform = 'scale(1)';
    wrapper.style.boxShadow = MAP_WEB_SHADOWS.markerDefault;
  });

  // Visual feedback on click (press effect)
  wrapper.addEventListener('mousedown', () => {
    wrapper.style.transform = 'scale(0.95)';
  });

  wrapper.addEventListener('mouseup', () => {
    wrapper.style.transform = 'scale(1.15)';
  });

  // Keyboard handlers - Enter/Space activate the marker
  wrapper.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // Visual feedback
      wrapper.style.transform = 'scale(0.95)';
      setTimeout(() => {
        wrapper.style.transform = 'scale(1)';
      }, 100);
      // Trigger click
      onClick?.();
    }
  });

  // Focus ring for keyboard navigation
  wrapper.addEventListener('focus', () => {
    wrapper.style.outline = `3px solid ${focusColor}`;
    wrapper.style.outlineOffset = '2px';
  });

  wrapper.addEventListener('blur', () => {
    wrapper.style.outline = 'none';
  });
}

/**
 * Create checkpoint marker content (departure/arrival point)
 */
export function createCheckpointMarkerContent(
  theme: Theme,
  isPartida: boolean,
  onClick?: () => void
): HTMLDivElement {
  const { colors } = theme;
  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.alignItems = 'center';
  wrapper.style.cursor = 'pointer';
  wrapper.style.transition = 'transform 0.15s ease, filter 0.15s ease';
  wrapper.style.filter = MAP_WEB_SHADOWS.checkpoint;

  // Accessibility - distinguish PARTIDA from CHEGADA
  const checkpointLabel = isPartida ? 'Ponto de Partida' : 'Ponto de Chegada';
  wrapper.setAttribute('role', 'button');
  wrapper.setAttribute('aria-label', checkpointLabel);
  wrapper.setAttribute('tabindex', '0');

  // Icon: flag for PARTIDA, home for CHEGADA
  const iconSvg = isPartida
    ? `<path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z" fill="white"/>`
    : `<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="white"/>`;

  // Compact blue pin with distinct icon
  wrapper.innerHTML = `
    <div style="
      width: 28px;
      height: 28px;
      border-radius: 6px 6px 6px 2px;
      background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid ${colors.white};
      box-shadow: ${MAP_WEB_SHADOWS.markerDefault};
    ">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        ${iconSvg}
      </svg>
    </div>
  `;

  // Interactivity
  wrapper.addEventListener('mouseenter', () => {
    wrapper.style.transform = 'scale(1.15)';
    wrapper.style.filter = MAP_WEB_SHADOWS.checkpointHover;
  });

  wrapper.addEventListener('mouseleave', () => {
    wrapper.style.transform = 'scale(1)';
    wrapper.style.filter = MAP_WEB_SHADOWS.checkpoint;
  });

  wrapper.addEventListener('mousedown', () => {
    wrapper.style.transform = 'scale(0.9)';
  });

  wrapper.addEventListener('mouseup', () => {
    wrapper.style.transform = 'scale(1.15)';
  });

  // Keyboard handlers
  wrapper.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      wrapper.style.transform = 'scale(0.9)';
      setTimeout(() => {
        wrapper.style.transform = 'scale(1)';
      }, 100);
      onClick?.();
    }
  });

  wrapper.addEventListener('focus', () => {
    wrapper.style.outline = `2px solid ${colors.primary}`;
    wrapper.style.outlineOffset = '2px';
  });

  wrapper.addEventListener('blur', () => {
    wrapper.style.outline = 'none';
  });

  return wrapper;
}

/**
 * Create normal parada marker content (numbered circle)
 */
export function createParadaMarkerContent(
  parada: Parada,
  theme: Theme,
  onClick?: () => void
): HTMLDivElement {
  const { colors } = theme;
  const wrapper = document.createElement('div');
  wrapper.style.width = '34px';
  wrapper.style.height = '34px';
  wrapper.style.borderRadius = '17px';
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'center';
  wrapper.style.justifyContent = 'center';
  wrapper.style.backgroundColor = getStatusColor(parada.status);
  wrapper.style.color = colors.white;
  wrapper.style.fontWeight = '700';
  wrapper.style.fontSize = '14px';
  wrapper.style.border = `2px solid ${colors.white}`;
  wrapper.style.boxShadow = MAP_WEB_SHADOWS.markerDefault;
  wrapper.style.cursor = 'pointer';

  // Accessibility
  wrapper.setAttribute('role', 'button');
  wrapper.setAttribute('aria-label', `Parada ${parada.ordem}, ${parada.endereco}, ${getStatusLabel(parada.status)}`);
  wrapper.setAttribute('tabindex', '0');

  const label = document.createElement('span');
  label.textContent = String(parada.ordem);
  label.setAttribute('aria-hidden', 'true');
  wrapper.appendChild(label);

  // Add interactivity (hover, keyboard, click feedback)
  addMarkerInteractivity(wrapper, onClick, colors.primary);

  return wrapper;
}

/**
 * Create marker content based on parada type
 */
export function createMarkerContent(
  parada: Parada,
  theme: Theme,
  onClick?: () => void,
  isPartida?: boolean
): HTMLDivElement {
  // Checkpoint (partida/chegada): Blue pin with distinct icons
  if (parada.is_checkpoint === false) {
    return createCheckpointMarkerContent(theme, isPartida ?? false, onClick);
  }

  // Normal parada: Circle with number
  return createParadaMarkerContent(parada, theme, onClick);
}

/**
 * Create fallback checkpoint marker for legacy Marker API
 */
export function createFallbackCheckpointIcon(
  theme: Theme,
  _isPartida: boolean
): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: theme.colors.primary,
    fillOpacity: 1,
    strokeColor: theme.colors.white,
    strokeWeight: 2,
    scale: 12,
  };
}

/**
 * Create fallback parada marker for legacy Marker API
 */
export function createFallbackParadaIcon(
  parada: Parada,
  theme: Theme
): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: getStatusColor(parada.status),
    fillOpacity: 1,
    strokeColor: theme.colors.white,
    strokeWeight: 2,
    scale: 16,
  };
}
