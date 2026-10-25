/**
 * Desativar motorista com rota aberta é recusado pelo banco (Migration 54,
 * `alternar_motorista_na_unidade`). A recusa sai como P0001 com:
 * - MESSAGE: a frase em português (o app antigo a mostra como está);
 * - HINT: a sentinela abaixo, que identifica o caso sem depender do texto;
 * - DETAIL: JSON com as rotas `pendente`/`em_andamento` desta loja.
 *
 * O supabase-js entrega o corpo do PostgREST como objeto cru
 * (`{ code, message, details, hint }`); com `.throwOnError()` lança um
 * `PostgrestError`, que estende Error e carrega os mesmos campos — por isso
 * Error não é excluído aqui.
 */
export const SENTINELA_ROTA_ABERTA = 'MOTORISTA_COM_ROTA_ABERTA';

export interface RotaAbertaDoMotorista {
  id: string;
  /** Coluna `date` ('2026-10-24'): exibir com formatDateBR, nunca new Date(). */
  data: string;
  status: string;
}

function ehRotaAberta(item: unknown): item is RotaAbertaDoMotorista {
  if (!item || typeof item !== 'object') return false;
  const { id, data, status } = item as Record<string, unknown>;
  return (
    typeof id === 'string' &&
    typeof data === 'string' &&
    typeof status === 'string'
  );
}

/**
 * Se o erro é a recusa por rota aberta, devolve as rotas (lista vazia quando o
 * DETAIL não se lê — continua sendo bloqueio). Qualquer outro erro: null.
 */
export function rotasAbertasDoErro(
  error: unknown,
): RotaAbertaDoMotorista[] | null {
  if (!error || typeof error !== 'object') return null;
  const { code, hint, details } = error as {
    code?: unknown;
    hint?: unknown;
    details?: unknown;
  };
  if (code !== 'P0001' || hint !== SENTINELA_ROTA_ABERTA) return null;

  try {
    const lista: unknown =
      typeof details === 'string' ? JSON.parse(details) : null;
    return Array.isArray(lista) ? lista.filter(ehRotaAberta) : [];
  } catch {
    // DETAIL ilegível: o bloqueio vale, só não há lista para mostrar.
    return [];
  }
}
