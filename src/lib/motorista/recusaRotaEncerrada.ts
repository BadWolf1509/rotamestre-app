/**
 * Recusa do banco por rota encerrada.
 *
 * A trava da Migration 75 (status da rota) e a de parada de rota encerrada
 * sobem `RAISE EXCEPTION` (código P0001) com um marcador que contém
 * "ENCERRADA" (ex.: `ROTA_ENCERRADA`). Outro P0001 (gatilho com outra regra)
 * não casa: só o marcador separa as recusas.
 */
export const MENSAGEM_RETOMAR_ROTA_ENCERRADA =
  'Esta rota já foi encerrada. A parada não pode mais ser retomada; fale com o gestor se precisar refazê-la.';

interface ErroComCodigo {
  code?: string;
  message?: string;
  originalError?: unknown;
}

export function ehRecusaPorRotaEncerrada(erro: unknown): boolean {
  if (!erro || typeof erro !== 'object') return false;
  const e = erro as ErroComCodigo;
  const original =
    e.originalError && typeof e.originalError === 'object'
      ? (e.originalError as ErroComCodigo)
      : undefined;
  const codigo = e.code ?? original?.code;
  if (codigo !== 'P0001') return false;
  const textos = [e.message, original?.message];
  return textos.some((t) => typeof t === 'string' && /ENCERRADA/i.test(t));
}
