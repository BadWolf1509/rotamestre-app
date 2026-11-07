/**
 * contarParadasDasRotas (G-6): paginação por `range`, lotes de ids, partida e
 * chegada fora da conta, erro lançado e `signal` repassado.
 */
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));

import {
  contarParadasDasRotas,
  TAMANHO_PAGINA,
} from '../contarParadasDasRotas';

type Linha = {
  id: string;
  rota_id: string;
  status: string;
  is_checkpoint: boolean | null;
};

interface Chamada {
  ids: string[];
  faixa: [number, number];
  sinal: AbortSignal | undefined;
}

/**
 * Banco falso: aplica `in` e `range` sobre as linhas, como o PostgREST
 * (cada resposta já vem no máximo com o tamanho da faixa pedida).
 */
function montar(linhas: Linha[], erroNaChamada?: number) {
  const chamadas: Chamada[] = [];
  mockFrom.mockImplementation(() => {
    let ids: string[] = [];
    let faixa: [number, number] = [0, 0];
    let sinal: AbortSignal | undefined;
    const api = {
      select: () => api,
      in: (_c: string, vs: string[]) => {
        ids = vs;
        return api;
      },
      order: () => api,
      range: (a: number, b: number) => {
        faixa = [a, b];
        return api;
      },
      abortSignal: (s: AbortSignal) => {
        sinal = s;
        return api;
      },
      then: (resolve: (r: unknown) => unknown) => {
        chamadas.push({ ids, faixa, sinal });
        if (erroNaChamada === chamadas.length) {
          return Promise.resolve({
            data: null,
            error: { message: 'falhou' },
          }).then(resolve);
        }
        const filtradas = linhas.filter((l) => ids.includes(l.rota_id));
        return Promise.resolve({
          data: filtradas.slice(faixa[0], faixa[1] + 1),
          error: null,
        }).then(resolve);
      },
    };
    return api;
  });
  return chamadas;
}

const linha = (
  id: string,
  rota_id: string,
  status = 'pendente',
  is_checkpoint: boolean | null = true,
): Linha => ({ id, rota_id, status, is_checkpoint });

beforeEach(() => jest.clearAllMocks());

describe('contarParadasDasRotas', () => {
  it('conta total, concluídas e puladas por rota', async () => {
    montar([
      linha('a', 'r1', 'concluida'),
      linha('b', 'r1', 'pulada'),
      linha('c', 'r1', 'pendente'),
      linha('d', 'r2', 'concluida'),
    ]);
    const mapa = await contarParadasDasRotas(['r1', 'r2']);
    expect(mapa.get('r1')).toEqual({ total: 3, concluidas: 1, puladas: 1 });
    expect(mapa.get('r2')).toEqual({ total: 1, concluidas: 1, puladas: 0 });
  });

  it('página de exatamente 1000 pede a seguinte (pode haver mais)', async () => {
    const linhas = Array.from({ length: TAMANHO_PAGINA }, (_, i) =>
      linha(`p${String(i).padStart(4, '0')}`, 'r1', 'concluida'),
    );
    const chamadas = montar(linhas);

    const mapa = await contarParadasDasRotas(['r1']);

    expect(chamadas).toHaveLength(2);
    expect(chamadas[0].faixa).toEqual([0, TAMANHO_PAGINA - 1]);
    expect(chamadas[1].faixa).toEqual([TAMANHO_PAGINA, 2 * TAMANHO_PAGINA - 1]);
    expect(mapa.get('r1')?.total).toBe(TAMANHO_PAGINA);
  });

  it('1.001 linhas: soma as duas páginas, sem o corte de 1000', async () => {
    const linhas = Array.from({ length: TAMANHO_PAGINA + 1 }, (_, i) =>
      linha(`p${String(i).padStart(4, '0')}`, 'r1', 'concluida'),
    );
    const chamadas = montar(linhas);
    const mapa = await contarParadasDasRotas(['r1']);
    expect(chamadas).toHaveLength(2);
    expect(mapa.get('r1')?.total).toBe(TAMANHO_PAGINA + 1);
  });

  it('120 ids viram 3 lotes de 50, 50 e 20', async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `r${i}`);
    const chamadas = montar(ids.map((r, i) => linha(`p${i}`, r)));

    const mapa = await contarParadasDasRotas(ids);

    expect(chamadas.map((c) => c.ids.length)).toEqual([50, 50, 20]);
    expect(mapa.size).toBe(120);
  });

  it('partida e chegada (is_checkpoint false) não contam; null conta', async () => {
    montar([
      linha('a', 'r1', 'concluida', false),
      linha('b', 'r1', 'concluida', null),
      linha('c', 'r1', 'concluida', true),
      linha('d', 'r1', 'pendente', false),
    ]);
    const mapa = await contarParadasDasRotas(['r1']);
    expect(mapa.get('r1')).toEqual({ total: 2, concluidas: 2, puladas: 0 });
  });

  it('rota sem paradas reais fica fora do mapa', async () => {
    montar([linha('a', 'r1', 'pendente', false)]);
    const mapa = await contarParadasDasRotas(['r1']);
    expect(mapa.has('r1')).toBe(false);
  });

  it('erro em qualquer página é lançado (contador zerado em silêncio é mentira)', async () => {
    const linhas = Array.from({ length: TAMANHO_PAGINA }, (_, i) =>
      linha(`p${String(i).padStart(4, '0')}`, 'r1'),
    );
    montar(linhas, 2);
    await expect(contarParadasDasRotas(['r1'])).rejects.toEqual({
      message: 'falhou',
    });
  });

  it('repassa o signal a todas as consultas', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `r${i}`);
    const chamadas = montar(ids.map((r, i) => linha(`p${i}`, r)));
    const controle = new AbortController();

    await contarParadasDasRotas(ids, controle.signal);

    expect(chamadas).toHaveLength(2);
    expect(chamadas.every((c) => c.sinal === controle.signal)).toBe(true);
  });

  it('sem signal, não chama abortSignal', async () => {
    const chamadas = montar([linha('a', 'r1')]);
    await contarParadasDasRotas(['r1']);
    expect(chamadas[0].sinal).toBeUndefined();
  });

  it('lista vazia não consulta nada', async () => {
    montar([]);
    const mapa = await contarParadasDasRotas([]);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mapa.size).toBe(0);
  });
});
