/**
 * Registra uma falha no nível certo: falha de rede é ESPERADA (túnel, modo
 * avião, sinal fraco) e vira `warn`; o resto segue `error`.
 *
 * POR QUE EXISTE. Sem rede, o motorista em campo gerava `logger.error` — e o
 * toast vermelho do dev — a cada busca da rota, cálculo de distância e envio de
 * localização, todos com fallback e todos esperados. O ruído escondia o erro
 * de verdade (ex.: 4xx de schema), que continua `error`.
 *
 * A classificação é a de `isNetworkError` (`errorMapping`), a mesma que o app já
 * usa para decidir "sem conexão" na tela.
 */
import { isNetworkError } from './errorMapping';
import { logger } from './logger';

export function logarFalha(mensagem: string, erro: unknown): void {
  if (isNetworkError(erro)) {
    logger.warn(mensagem, erro);
  } else {
    logger.error(mensagem, erro);
  }
}
