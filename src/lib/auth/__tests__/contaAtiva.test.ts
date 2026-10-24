/**
 * "Conta ativa" = tem algum vínculo ativo com uma loja (e, para motorista,
 * `usuarios.ativo` não é false). Só a RESPOSTA do servidor pode dizer que
 * não: sem resposta (erro, offline) a conta segue como ativa, para não
 * transformar o modo offline da 1.14.4 em bloqueio.
 */
import { supabase } from '../../supabase';
import { contaEstaAtiva } from '../contaAtiva';

jest.mock('../../logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockFrom = supabase.from as jest.Mock;

function vinculos(resposta: { data?: unknown; error?: unknown }) {
  const eq = jest.fn().mockResolvedValue({ data: null, error: null, ...resposta });
  const select = jest.fn().mockReturnValue({ eq });
  mockFrom.mockReturnValue({ select });
  return { select, eq };
}

const motorista = { id: 'm1', papel: 'motorista', ativo: true } as never;
const gestor = { id: 'g1', papel: 'gestor', ativo: true } as never;

beforeEach(() => jest.clearAllMocks());

describe('contaEstaAtiva', () => {
  it('motorista com um vínculo ativo está ativo, e a consulta é pelos vínculos dele', async () => {
    const { select, eq } = vinculos({
      data: [{ ativo: false }, { ativo: true }],
    });
    await expect(contaEstaAtiva(motorista)).resolves.toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('usuario_unidades');
    expect(select).toHaveBeenCalledWith('ativo');
    expect(eq).toHaveBeenCalledWith('usuario_id', 'm1');
  });

  it('desativado em todas as lojas não está ativo', async () => {
    vinculos({ data: [{ ativo: false }, { ativo: false }] });
    await expect(contaEstaAtiva(motorista)).resolves.toBe(false);
  });

  it('sem nenhum vínculo não está ativo', async () => {
    vinculos({ data: [] });
    await expect(contaEstaAtiva(gestor)).resolves.toBe(false);
  });

  it('motorista com usuarios.ativo=false não está ativo, mesmo com vínculo ativo', async () => {
    vinculos({ data: [{ ativo: true }] });
    await expect(
      contaEstaAtiva({ id: 'm1', papel: 'motorista', ativo: false } as never),
    ).resolves.toBe(false);
  });

  it('gestor com vínculo ativo não é afetado por usuarios.ativo=false', async () => {
    vinculos({ data: [{ ativo: true }] });
    await expect(
      contaEstaAtiva({ id: 'g1', papel: 'gestor', ativo: false } as never),
    ).resolves.toBe(true);
  });

  it('erro na consulta não bloqueia (sem resposta não dá para afirmar)', async () => {
    vinculos({ error: { message: 'Network request failed' } });
    await expect(contaEstaAtiva(motorista)).resolves.toBe(true);
  });

  it('consulta que lança (offline) não bloqueia', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('offline');
    });
    await expect(contaEstaAtiva(motorista)).resolves.toBe(true);
  });

  it('resposta sem lista não bloqueia', async () => {
    vinculos({ data: null });
    await expect(contaEstaAtiva(motorista)).resolves.toBe(true);
  });
});
