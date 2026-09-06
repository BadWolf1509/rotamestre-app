/**
 * Rascunho do wizard de incidente — sobrevive à recriação da Activity.
 *
 * Mesmo defeito que atingia a conclusão com foto (ver `conclusaoEmVoo.ts`): o
 * Android recria a Activity enquanto a câmera está aberta, o React Native
 * remonta a árvore, e o estado de componente evapora. Aqui dói mais: o wizard
 * tem 4 passos, e o motorista perde categoria, descrição e foto de uma vez —
 * depois de já ter parado o carro para reportar.
 *
 * Guarda o rascunho inteiro, não só a foto. Recuperar a imagem e devolver o
 * motorista para o passo 1, com a descrição em branco, seria consertar a menor
 * metade do problema.
 *
 * A foto em si, quando a câmera foi quem provocou a recriação, volta por
 * `ImagePicker.getPendingResultAsync()`; `cameraAberta` marca esse caso.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/lib/logger';

const STORAGE_KEY = '@rotamestre:rascunho_incidente';

/** Depois disto o reporte é considerado abandonado, não interrompido. */
export const VALIDADE_RASCUNHO_MS = 15 * 60 * 1000;

export interface RascunhoIncidente {
  paradaId: string;
  rotaId: string;
  passo: number;
  categoria: string;
  descricao: string;
  /** URI da foto já escolhida. Fica no cache do app e sobrevive à remontagem. */
  fotoUri: string;
  /** true entre abrir a câmera e receber o resultado. */
  cameraAberta: boolean;
  em: number;
}

export async function salvarRascunhoIncidente(
  rascunho: RascunhoIncidente,
): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rascunho));
  } catch (error) {
    // Não-crítico: sem rascunho o wizard volta a se perder numa recriação, que
    // é o comportamento que já existia. Não vale abortar o reporte por isso.
    logger.warn('[RascunhoIncidente] Não foi possível salvar', error);
  }
}

/**
 * Devolve o rascunho se ainda vale. Ilegível ou vencido é apagado aqui mesmo —
 * lixo que sobra vira wizard abrindo sozinho depois.
 */
export async function lerRascunhoIncidente(
  agora: number = Date.now(),
): Promise<RascunhoIncidente | null> {
  let bruto: string | null = null;

  try {
    bruto = await AsyncStorage.getItem(STORAGE_KEY);
  } catch (error) {
    logger.warn('[RascunhoIncidente] Não foi possível ler', error);
    return null;
  }

  if (!bruto) return null;

  let rascunho: Partial<RascunhoIncidente> | null = null;
  try {
    rascunho = JSON.parse(bruto) as Partial<RascunhoIncidente>;
  } catch {
    // Escrita truncada por morte do processo no meio: descarta e segue.
    await limparRascunhoIncidente();
    return null;
  }

  const temIdentidade =
    typeof rascunho?.paradaId === 'string' &&
    typeof rascunho?.rotaId === 'string' &&
    typeof rascunho?.em === 'number';

  if (!temIdentidade) {
    await limparRascunhoIncidente();
    return null;
  }

  if (agora - (rascunho.em as number) > VALIDADE_RASCUNHO_MS) {
    await limparRascunhoIncidente();
    return null;
  }

  return rascunho as RascunhoIncidente;
}

/** Chamar quando o reporte termina — por envio, cancelamento ou recuperação. */
export async function limparRascunhoIncidente(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    logger.warn('[RascunhoIncidente] Não foi possível limpar', error);
  }
}
