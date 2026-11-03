import { defaultTheme } from '@/utils/styles.base';

const claro = defaultTheme.colors;

/**
 * Cores fixas para o que fica SOBRE o mapa (pinos, chip, botões, rota
 * desenhada).
 *
 * O estilo do mapa é sempre claro, mas `colors.white`/`colors.black` do tema
 * se invertem no escuro (`white` vira cinza-escuro): a borda dos pinos sumia e o
 * número saía escuro. Por isso nada aqui vem do tema ativo: é a paleta clara,
 * a mesma em que o mapa é desenhado. Vale para qualquer mapa: mini-mapa da
 * Início, navegação do motorista e mapa do gestor (`MotoristaMarker`).
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
} as const;
