/**
 * Banco FALSO em memória para testar a exclusão de rota sem mock de
 * chamada: reproduz as regras do banco real que importam (medidas em
 * produção em 22/10/2026).
 *
 * - `logs_rota_id_fkey` é `ON DELETE SET NULL`: INSERT em `logs` com
 *   `rota_id` de rota inexistente é recusado (23503); DELETE da rota zera o
 *   `rota_id` dos logs dela.
 * - `prevent_duplicate_log`: descarta, sem erro, o log com mesmo
 *   rota_id + evento + usuário + parada (janela de 5 s; aqui, sempre).
 * - DELETE com `.select('id')` devolve as linhas apagadas; `falharDelete`
 *   simula a RLS recusando (0 linhas, sem erro).
 *
 * Uso: `jest.mock('@/lib/supabase', () =>
 *   require('@/__tests__/helpers/bancoFalsoRotas').moduloSupabaseFalso)`.
 */

export type RotaFalsa = {
  id: string;
  status: string;
  data: string;
  motorista_id: string | null;
};
export type LogFalso = {
  usuario_id: string;
  rota_id: string | null;
  evento: string;
  detalhes: Record<string, unknown>;
};

export const bancoFalso: {
  rotas: RotaFalsa[];
  logs: LogFalso[];
  falharDelete: boolean;
} = { rotas: [], logs: [], falharDelete: false };

export function resetarBancoFalso(rotas: RotaFalsa[]): void {
  bancoFalso.rotas = rotas.map((r) => ({ ...r }));
  bancoFalso.logs = [];
  bancoFalso.falharDelete = false;
}

function rotasQuery() {
  const filtros: ((r: RotaFalsa) => boolean)[] = [];
  let modo: 'select' | 'delete' = 'select';
  const api = {
    select: () => api,
    delete: () => {
      modo = 'delete';
      return api;
    },
    eq: (col: keyof RotaFalsa, v: unknown) => {
      filtros.push((r) => r[col] === v);
      return api;
    },
    neq: (col: keyof RotaFalsa, v: unknown) => {
      filtros.push((r) => r[col] !== v);
      return api;
    },
    maybeSingle: async () => {
      const achou = bancoFalso.rotas.filter((r) => filtros.every((f) => f(r)));
      return { data: achou[0] ?? null, error: null };
    },
    then: (resolve: (v: unknown) => void) => {
      if (modo !== 'delete') throw new Error('fake: select sem maybeSingle');
      if (bancoFalso.falharDelete) {
        resolve({ data: [], error: null });
        return;
      }
      const apagadas = bancoFalso.rotas.filter((r) =>
        filtros.every((f) => f(r)),
      );
      bancoFalso.rotas = bancoFalso.rotas.filter((r) => !apagadas.includes(r));
      for (const log of bancoFalso.logs) {
        if (apagadas.some((a) => a.id === log.rota_id)) log.rota_id = null;
      }
      resolve({ data: apagadas.map((a) => ({ id: a.id })), error: null });
    },
  };
  return api;
}

function logsQuery() {
  return {
    insert: async (log: LogFalso) => {
      if (log.rota_id && !bancoFalso.rotas.some((r) => r.id === log.rota_id)) {
        return {
          error: { code: '23503', message: 'violates logs_rota_id_fkey' },
        };
      }
      const duplicado = bancoFalso.logs.some(
        (l) =>
          l.rota_id === log.rota_id &&
          l.evento === log.evento &&
          l.usuario_id === log.usuario_id &&
          l.detalhes.parada_id === log.detalhes.parada_id,
      );
      if (!duplicado) bancoFalso.logs.push({ ...log });
      return { error: null };
    },
  };
}

export const moduloSupabaseFalso = {
  supabase: {
    from: (tabela: string) => (tabela === 'rotas' ? rotasQuery() : logsQuery()),
  },
  isSupabaseConfigured: true,
};
