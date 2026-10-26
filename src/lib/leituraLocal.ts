/**
 * Leitura do AsyncStorage para quem vai GRAVAR em seguida (OFF-4).
 *
 * POR QUE EXISTE. As filas do aparelho (concluir/pular, índice de fotos,
 * posições) liam com `try { … } catch { return [] }` e logo depois regravavam
 * a lista inteira. Uma leitura que FALHA — no Android, `CursorWindow` cheio
 * com uma fila grande, que falha sempre — virava "fila vazia", e a gravação
 * seguinte apagava tudo o que estava guardado.
 *
 * Aqui os dois casos se separam:
 *
 * - **O `getItem` lançou:** o dado pode estar lá, inteiro. Lança
 *   `FalhaDeLeituraLocal` e quem chamou NÃO grava; o erro sobe até a tela.
 *   Alternativa descartada: ler de novo antes de gravar — o `CursorWindow`
 *   cheio falha toda vez.
 * - **O JSON é inválido:** o dado já está perdido para o app. Copia o bruto
 *   para `<chave>:quarentena` (para diagnóstico), avisa no log e devolve o
 *   vazio, para a fila voltar a funcionar. Se nem a quarentena grava, lança:
 *   não se apaga o que não se conseguiu guardar.
 *
 * Leituras só para EXIBIR continuam com o vazio na falha — lançar ali
 * espalharia `try` pela UI sem proteger dado nenhum.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from './logger';

/**
 * A leitura do aparelho falhou; quem ia gravar desiste. A mensagem leva a
 * sentinela `ARMAZENAMENTO_ILEGIVEL`, que `errorMapping` traduz para "Não
 * ficou salvo". A chave fica em `chave`, fora da mensagem: o nome
 * `…offline…` casaria com o padrão de erro de rede.
 */
export class FalhaDeLeituraLocal extends Error {
  readonly chave: string;
  readonly causa: unknown;

  constructor(chave: string, causa: unknown) {
    super(
      'ARMAZENAMENTO_ILEGIVEL: o aparelho não conseguiu ler o que estava guardado',
    );
    this.name = 'FalhaDeLeituraLocal';
    this.chave = chave;
    this.causa = causa;
  }
}

/**
 * Lê o JSON de `chave` para regravá-lo. Sem nada guardado, devolve `vazio`.
 * Lança `FalhaDeLeituraLocal` se o `getItem` lançar.
 */
export async function lerJsonParaGravar<T>(
  chave: string,
  vazio: T,
): Promise<T> {
  let bruto: string | null;
  try {
    bruto = await AsyncStorage.getItem(chave);
  } catch (error) {
    throw new FalhaDeLeituraLocal(chave, error);
  }
  if (!bruto) return vazio;

  try {
    return (JSON.parse(bruto) as T | null) ?? vazio;
  } catch (error) {
    logger.warn(
      `[LeituraLocal] JSON inválido em ${chave}; bruto em quarentena`,
      error,
    );
    try {
      await AsyncStorage.setItem(`${chave}:quarentena`, bruto);
    } catch (erroQuarentena) {
      throw new FalhaDeLeituraLocal(chave, erroQuarentena);
    }
    return vazio;
  }
}
