/**
 * Partida e chegada da rota no mapa: quantos pinos e de que tipo.
 *
 * Fonte única dos seis mapas (web do gestor e aba Mapa, nativo, os dois
 * mini-mapas da Início e as duas navegações). Antes, cada um desenhava a seu
 * modo — cinco desenhos para o mesmo ponto, com a bandeira querendo dizer
 * partida num mapa e chegada no outro — e, como partida e chegada saem do
 * mesmo "Endereço da sede" (100% das rotas em 08/11/2026), o pino da chegada
 * cobria o da partida.
 *
 * Coincidindo (até `RAIO_MESMO_LOCAL_METROS`, o mesmo raio da visita
 * combinada), vira um pino de **sede**; separados, um de partida e um de
 * chegada. O desenho fica em `PinoDaUnidade` (nativo) e
 * `criarElementoDoPinoDaUnidade` (web).
 */
import { distanciaMetros } from '@/lib/geo/distancia';
import { RAIO_MESMO_LOCAL_METROS } from '@/lib/route-optimization/agrupamento';

export type TipoPontoDaUnidade = 'sede' | 'partida' | 'chegada';

export interface PontoComCoordenada {
  id: string;
  ordem: number;
  latitude?: number | null;
  longitude?: number | null;
  endereco: string;
}

export interface PontoDaUnidade<T extends PontoComCoordenada> {
  tipo: TipoPontoDaUnidade;
  /** Onde o pino fica (na sede, é a partida). */
  ponto: T;
  /** Os pontos que este pino representa (na sede, partida e chegada). */
  membros: T[];
}

interface EspecDoPonto {
  titulo: string;
  subtitulo: string;
  ionicon: 'home' | 'flag' | 'location';
  /** Path SVG (viewBox 0 0 24 24) do mesmo ícone, para os mapas web. */
  svgPath: string;
}

export const ESPEC_DO_PONTO: Record<TipoPontoDaUnidade, EspecDoPonto> = {
  sede: {
    titulo: 'Sede da unidade',
    subtitulo: 'Partida e chegada da rota',
    ionicon: 'home',
    svgPath: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  },
  partida: {
    titulo: 'Ponto de partida',
    subtitulo: 'Início da rota',
    ionicon: 'flag',
    svgPath: 'M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z',
  },
  chegada: {
    titulo: 'Ponto de chegada',
    subtitulo: 'Fim da rota',
    ionicon: 'location',
    svgPath:
      'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
  },
};

type ComCoordenada<T> = T & { latitude: number; longitude: number };

function temCoordenada<T extends PontoComCoordenada>(
  p: T,
): p is ComCoordenada<T> {
  return p.latitude != null && p.longitude != null;
}

/**
 * Pinos da unidade para os pontos de partida/chegada (`is_checkpoint` de
 * unidade). A partida é a de menor `ordem` e a chegada a de maior; ponto sem
 * coordenada não vira pino.
 */
export function pontosDaUnidade<T extends PontoComCoordenada>(
  checkpoints: T[],
  raioMetros: number = RAIO_MESMO_LOCAL_METROS,
): PontoDaUnidade<T>[] {
  const comCoord = checkpoints
    .filter(temCoordenada)
    .sort((a, b) => a.ordem - b.ordem);
  if (comCoord.length === 0) return [];

  const partida = comCoord[0];
  if (comCoord.length === 1) {
    return [{ tipo: 'partida', ponto: partida, membros: [partida] }];
  }

  const chegada = comCoord[comCoord.length - 1];
  if (distanciaMetros(partida, chegada) <= raioMetros) {
    return [{ tipo: 'sede', ponto: partida, membros: [partida, chegada] }];
  }
  return [
    { tipo: 'partida', ponto: partida, membros: [partida] },
    { tipo: 'chegada', ponto: chegada, membros: [chegada] },
  ];
}

/** `Sede da unidade, Av. X` — leitor de tela e `aria-label`. */
export function rotuloAcessivelDoPonto(
  p: PontoDaUnidade<PontoComCoordenada>,
): string {
  return `${ESPEC_DO_PONTO[p.tipo].titulo}, ${p.ponto.endereco}`;
}

/** O pino que representa o ponto `id` (a sede contém partida e chegada). */
export function pontoQueContem<T extends PontoComCoordenada>(
  pontos: PontoDaUnidade<T>[],
  id: string | null | undefined,
): PontoDaUnidade<T> | undefined {
  if (!id) return undefined;
  return pontos.find((p) => p.membros.some((m) => m.id === id));
}

/**
 * Navegação: os pinos da unidade sem o que contém a parada atual — ela já é o
 * destino desenhado. Voltando à sede, a sede inteira sai (tirar só a chegada
 * deixaria a partida no mesmo ponto, um segundo alvo sobre o destino).
 */
export function pontosDaUnidadeForaDoDestino<T extends PontoComCoordenada>(
  partida: T | null | undefined,
  chegada: T | null | undefined,
  idDoDestino: string | null | undefined,
): PontoDaUnidade<T>[] {
  const checkpoints = [partida, chegada].filter((p): p is T => p != null);
  return pontosDaUnidade(checkpoints).filter(
    (p) => !p.membros.some((m) => m.id === idDoDestino),
  );
}
