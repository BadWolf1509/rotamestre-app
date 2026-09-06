/**
 * Marcador de "conclusão de parada em voo" — sobrevive à recriação da Activity.
 *
 * POR QUE EXISTE. Em 05/09/2026, no smoke test em aparelho (moto g15, 3,7 GB,
 * 128 MB livres), concluir uma parada com foto TIRADA PELA CÂMERA falhou assim:
 * a foto foi tirada e confirmada, o app voltou — e o modal de conclusão tinha
 * sumido, a aba voltara para Início e nada foi gravado. Sem erro na tela. O
 * motorista só descobre pelo contador de paradas.
 *
 * A causa não é o processo morrer: o pid era o mesmo e o bundle JS não
 * recarregou. O Android **recria a Activity** sob pressão de memória (o
 * `lowmemorykiller` matou a própria câmera logo em seguida), e o React Native
 * remonta a árvore React ao reanexar a root view. Estado de componente evapora;
 * o contexto JS, não. Por isso o marcador vai para o AsyncStorage: ele precisa
 * atravessar tanto a remontagem quanto a morte do processo.
 *
 * A foto em si é recuperada por `ImagePicker.getPendingResultAsync()`, que a
 * própria doc do expo-image-picker manda usar ("Make sure that you handle
 * MainActivity destruction on Android"). Este módulo guarda **para qual parada**
 * a foto era — sem isso não dá para reabrir o fluxo certo.
 *
 * A validade curta existe para não ressuscitar um fluxo que o motorista já
 * abandonou: voltar ao app horas depois e ver um modal de conclusão abrir
 * sozinho é pior que refazer.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/lib/logger';

const STORAGE_KEY = '@rotamestre:conclusao_em_voo';

/** Depois disto o fluxo é considerado abandonado, não interrompido. */
export const VALIDADE_MS = 15 * 60 * 1000;

export interface ConclusaoEmVoo {
  paradaId: string;
  rotaId: string;
  /** `Date.now()` de quando a câmera foi aberta. */
  em: number;
}

/** Chamar ANTES de abrir a câmera — depois pode não haver "depois". */
export async function marcarConclusaoEmVoo(
  paradaId: string,
  rotaId: string,
  agora: number = Date.now(),
): Promise<void> {
  const marcador: ConclusaoEmVoo = { paradaId, rotaId, em: agora };

  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(marcador));
  } catch (error) {
    // Não-crítico: sem o marcador o fluxo volta a se perder numa recriação,
    // que é o comportamento que já existia. Não vale abortar a foto por isso.
    logger.warn('[ConclusaoEmVoo] Não foi possível marcar', error);
  }
}

/**
 * Devolve o marcador se ele ainda vale, e `null` caso contrário. Marcador
 * ilegível ou vencido é apagado aqui mesmo — lixo que sobra vira modal
 * abrindo sozinho depois.
 */
export async function lerConclusaoEmVoo(
  agora: number = Date.now(),
): Promise<ConclusaoEmVoo | null> {
  let bruto: string | null = null;

  try {
    bruto = await AsyncStorage.getItem(STORAGE_KEY);
  } catch (error) {
    logger.warn('[ConclusaoEmVoo] Não foi possível ler o marcador', error);
    return null;
  }

  if (!bruto) return null;

  let marcador: Partial<ConclusaoEmVoo> | null = null;
  try {
    marcador = JSON.parse(bruto) as Partial<ConclusaoEmVoo>;
  } catch {
    // Escrita truncada por morte do processo no meio: descarta e segue.
    await limparConclusaoEmVoo();
    return null;
  }

  const completo =
    typeof marcador?.paradaId === 'string' &&
    typeof marcador?.rotaId === 'string' &&
    typeof marcador?.em === 'number';

  if (!completo) {
    await limparConclusaoEmVoo();
    return null;
  }

  if (agora - (marcador.em as number) > VALIDADE_MS) {
    await limparConclusaoEmVoo();
    return null;
  }

  return marcador as ConclusaoEmVoo;
}

/**
 * Decide se o marcador ainda descreve um fluxo que vale reabrir, e devolve a
 * parada em questão.
 *
 * Fica separado da tela de propósito: é aqui que mora o julgamento (rota
 * trocada, parada resolvida noutro aparelho, rota encerrada), e julgamento
 * dentro de `useEffect` só se testa montando a tela inteira.
 */
export function paradaParaReabrir<P extends { id: string; status: string }>(
  marcador: ConclusaoEmVoo | null,
  rota: { id: string; status: string } | null,
  paradas: P[],
): P | null {
  if (!marcador || !rota) return null;

  // Marcador de outra rota: o motorista trocou de rota entre a foto e a volta.
  if (marcador.rotaId !== rota.id) return null;

  // Rota encerrada ou ainda não iniciada não aceita conclusão — reabrir o
  // modal só produziria erro na cara do motorista.
  if (rota.status !== 'em_andamento') return null;

  const parada = paradas.find((p) => p.id === marcador.paradaId);
  if (!parada) return null;

  // Já resolvida (pelo gestor, por outro aparelho, ou por um retry que passou):
  // não há o que concluir.
  if (parada.status === 'concluida' || parada.status === 'pulada') return null;

  return parada;
}

/** Chamar quando o fluxo termina — por sucesso, cancelamento ou recuperação. */
export async function limparConclusaoEmVoo(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    logger.warn('[ConclusaoEmVoo] Não foi possível limpar o marcador', error);
  }
}
