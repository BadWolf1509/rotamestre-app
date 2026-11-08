/**
 * Pino da sede/partida/chegada nos mapas web (MapLibre `Marker` com elemento
 * HTML): o mapa do gestor e a aba Mapa, o mini-mapa da Início e a navegação.
 *
 * Elemento HTML, não camada de símbolo: a fonte do estilo (Noto Sans Bold, da
 * OpenFreeMap) não tem glifo de ícone nem de emoji — o "🚀"/"🏁" saía em
 * branco e virou "I"/"F", que não se explicavam. Só os mapas web importam
 * este arquivo; o nativo usa `PinoDaUnidade`. Sem sufixo `.web` de propósito:
 * o nativo nunca deve resolver para ele.
 */
import { boxShadow } from '@/utils/color';

import { CORES_SOBRE_O_MAPA } from './coresSobreOMapa';
import {
  ESPEC_DO_PONTO,
  rotuloAcessivelDoPonto,
  type PontoComCoordenada,
  type PontoDaUnidade,
} from './pontosDaUnidade';

export function criarElementoDoPinoDaUnidade(
  ponto: PontoDaUnidade<PontoComCoordenada>,
  tamanho: number,
  aoClicar?: () => void,
): HTMLDivElement {
  const el = document.createElement('div');
  const icone = Math.round(tamanho * 0.57);

  el.dataset.tipo = ponto.tipo;
  el.setAttribute('aria-label', rotuloAcessivelDoPonto(ponto));
  Object.assign(el.style, {
    width: `${tamanho}px`,
    height: `${tamanho}px`,
    borderRadius: `${Math.round(tamanho * 0.22)}px`,
    background: CORES_SOBRE_O_MAPA.sede,
    border: `2px solid ${CORES_SOBRE_O_MAPA.branco}`,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: boxShadow(0, 1, 3, 0, CORES_SOBRE_O_MAPA.sombra, 0.3),
  });
  el.innerHTML = `<svg width="${icone}" height="${icone}" viewBox="0 0 24 24" fill="${CORES_SOBRE_O_MAPA.branco}" aria-hidden="true"><path d="${ESPEC_DO_PONTO[ponto.tipo].svgPath}"/></svg>`;

  if (aoClicar) {
    el.setAttribute('role', 'button');
    el.style.cursor = 'pointer';
    el.addEventListener('click', (evento) => {
      // O clique no mapa fecharia o popup que este clique abre.
      evento.stopPropagation();
      aoClicar();
    });
  }

  return el;
}
