/**
 * Nome do motorista que saiu da loja (vínculo inativo): a RLS de `usuarios`
 * esconde o embed, e a RPC `nomes_motoristas_das_rotas` (Migration 72) devolve
 * só o nome, para o gestor ativo da loja da rota.
 */
import { logger } from '@/lib/logger';

import {
  buscarNomesForaDaLoja,
  TETO_IDS_POR_CHAMADA,
} from '../nomesMotoristasForaDaLoja';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
  isSupabaseConfigured: true,
}));
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

beforeEach(() => {
  mockRpc.mockReset();
  (logger.warn as jest.Mock).mockClear();
});

describe('buscarNomesForaDaLoja', () => {
  it('não chama a RPC quando toda rota tem nome visível ou não tem motorista', async () => {
    const nomes = await buscarNomesForaDaLoja([
      { id: 'r1', motorista_id: 'm1', nomeVisivel: 'Ana' },
      { id: 'r2', motorista_id: null, nomeVisivel: null },
      { id: 'r3' },
    ]);

    expect(mockRpc).not.toHaveBeenCalled();
    expect(nomes.size).toBe(0);
  });

  it('chama com os ids das rotas ocultas, sem repetir, e devolve o Map', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { rota_id: 'r1', nome: 'Bia' },
        { rota_id: 'r3', nome: 'Caio' },
      ],
      error: null,
    });

    const nomes = await buscarNomesForaDaLoja([
      { id: 'r1', motorista_id: 'm9', nomeVisivel: null },
      { id: 'r2', motorista_id: 'm1', nomeVisivel: 'Ana' },
      { id: 'r3', motorista_id: 'm8' },
      { id: 'r1', motorista_id: 'm9', nomeVisivel: '' },
    ]);

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('nomes_motoristas_das_rotas', {
      p_rota_ids: ['r1', 'r3'],
    });
    expect(Object.fromEntries(nomes)).toEqual({ r1: 'Bia', r3: 'Caio' });
  });

  it('divide em chamadas de até 1000 ids', async () => {
    expect(TETO_IDS_POR_CHAMADA).toBe(1000);
    mockRpc.mockImplementation(
      (_nome: string, { p_rota_ids }: { p_rota_ids: string[] }) =>
        Promise.resolve({
          data: p_rota_ids.map((id) => ({ rota_id: id, nome: `N-${id}` })),
          error: null,
        }),
    );
    const ocultas = Array.from({ length: 1001 }, (_, i) => ({
      id: `r${i}`,
      motorista_id: 'm9',
    }));

    const nomes = await buscarNomesForaDaLoja(ocultas);

    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc.mock.calls[0][1].p_rota_ids).toHaveLength(1000);
    expect(mockRpc.mock.calls[1][1].p_rota_ids).toEqual(['r1000']);
    expect(nomes.size).toBe(1001);
    expect(nomes.get('r1000')).toBe('N-r1000');
  });

  it('erro da RPC: logger.warn e Map vazio', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: '42883', message: 'função inexistente' },
    });

    const nomes = await buscarNomesForaDaLoja([
      { id: 'r1', motorista_id: 'm9' },
    ]);

    expect(nomes.size).toBe(0);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('exceção (rede) também vira logger.warn e Map vazio', async () => {
    mockRpc.mockRejectedValue(new Error('rede'));

    const nomes = await buscarNomesForaDaLoja([
      { id: 'r1', motorista_id: 'm9' },
    ]);

    expect(nomes.size).toBe(0);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('ignora linha fora do formato esperado', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { rota_id: 'r1', nome: 'Bia' },
        { rota_id: 'r2', nome: null },
        { rota_id: 'r3', nome: '' },
      ],
      error: null,
    });

    const nomes = await buscarNomesForaDaLoja([
      { id: 'r1', motorista_id: 'm9' },
      { id: 'r2', motorista_id: 'm9' },
      { id: 'r3', motorista_id: 'm9' },
    ]);

    expect(Object.fromEntries(nomes)).toEqual({ r1: 'Bia' });
  });
});
