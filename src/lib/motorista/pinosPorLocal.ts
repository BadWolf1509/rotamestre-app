/**
 * Um pino por local no mapa: serviços no mesmo ponto (entrega + retirada)
 * aparecem juntos, rotulados com as ordens ("3+4"). Quem chama passa só
 * paradas reais: `agruparPorLocal` não filtra checkpoint.
 */

import { agruparPorLocal } from './visitaNoLocal';

type ParadaDoPino = {
  id: string;
  ordem: number;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
};

export interface PinoPorLocal<T extends ParadaDoPino> {
  /** Dá id, cor e posição ao pino. */
  principal: T;
  /** Todos os serviços do local, por `ordem`. */
  membros: T[];
  rotulo: string;
}

export function rotuloDoPino(membros: Array<{ ordem: number }>): string {
  return membros.map((m) => m.ordem).join('+');
}

/** A primeira ainda a fazer; sem nenhuma, a primeira do grupo. */
function escolherPrincipal<T extends ParadaDoPino>(membros: T[]): T {
  return (
    membros.find(
      (m) => m.status === 'pendente' || m.status === 'em_andamento',
    ) ?? membros[0]
  );
}

export function montarPinosPorLocal<T extends ParadaDoPino>(
  paradasReais: T[],
): Array<PinoPorLocal<T>> {
  return agruparPorLocal(paradasReais).map((membros) => ({
    principal: escolherPrincipal(membros),
    membros,
    rotulo: rotuloDoPino(membros),
  }));
}

export interface PinoDoMiniMap<T extends ParadaDoPino> extends PinoPorLocal<T> {
  /** Id do 1º membro: estável quando a principal muda de uma para outra. */
  chave: string;
  /** Grupo que contém a primeira parada restante. */
  isNext: boolean;
}

/** Pinos numerados do mini-mapa: só as paradas restantes, já em ordem. */
export function montarPinosDoMiniMap<T extends ParadaDoPino>(
  restantes: T[],
): Array<PinoDoMiniMap<T>> {
  const primeiraId = restantes[0]?.id;
  return montarPinosPorLocal(restantes).map((pino) => ({
    ...pino,
    chave: pino.membros[0].id,
    isNext: pino.membros.some((m) => m.id === primeiraId),
  }));
}
