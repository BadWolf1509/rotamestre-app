import { defaultTheme } from '@/utils/styles.base';

const claro = defaultTheme.colors;

/**
 * Cores fixas para o que fica SOBRE o mapa (pinos, chip, botões, rota
 * desenhada).
 *
 * O estilo do mapa é sempre claro, mas `colors.white`/`colors.black` do tema
 * se invertem no escuro (`white` vira cinza-escuro): a borda dos pinos sumia e o
 * número saía escuro. Por isso nada aqui vem do tema ativo: é a paleta clara,
 * a mesma em que o mapa é desenhado. Vale para o mini-mapa da Início, o modo
 * navegação (nativo e web), o mapa web do gestor e o `MotoristaMarker`. O mapa
 * NATIVO do gestor (`src/components/map/mobile/`: `styles.ts`, `ParadaMarker.tsx`,
 * `CheckpointMarker.tsx`) ainda usa o tema: item pendente.
 */
export const CORES_SOBRE_O_MAPA = {
  branco: claro.white,
  sombra: claro.black,
  marca: claro.primary,
  proxima: claro.warning,
  pendente: claro.gray500,
  concluida: claro.success,
  usuario: claro.info,
  erro: claro.error,
  // Modo navegação: contorno do checkpoint e pino de parada não-próxima.
  contorno: claro.gray200,
  apagada: claro.gray400,
  // Texto secundário do popup do mapa web: o popup do MapLibre tem fundo
  // sempre branco, e o `textSecondary` do escuro (#d1d5db) some nele.
  textoSecundario: claro.textSecondary,
} as const;

/**
 * Cores de status dos pinos (`getMarkerColorExpression`), da paleta clara:
 * no escuro, as variantes mudam (primary vira #7a9bdf) e perdem o contraste
 * com o número branco do pino.
 */
export const CORES_DE_STATUS_SOBRE_O_MAPA = {
  primary: claro.primary,
  successDark: claro.successDark,
  warningDark: claro.warningDark,
  errorDark: claro.errorDark,
  gray500: claro.gray500,
} as const;
