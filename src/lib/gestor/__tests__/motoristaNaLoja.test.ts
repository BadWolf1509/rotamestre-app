/**
 * motoristaNaLoja — RPC da loja, edição, auditoria e mensagem de erro do
 * motorista. A lib relança o erro ORIGINAL (o bloqueio por rota aberta e o
 * P0001 dependem do objeto do PostgREST) e nunca mostra toast.
 */
import { logUserAction, updateUsuario } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

import {
  alternarMotoristaNaLoja,
  editarDadosMotorista,
  mensagemErroMotorista,
} from '../motoristaNaLoja';

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
}));
jest.mock('@/lib/queries', () => ({
  updateUsuario: jest.fn(),
  logUserAction: jest.fn(),
}));

const rpc = supabase.rpc as jest.Mock;
const from = supabase.from as jest.Mock;
const updateUsuarioMock = updateUsuario as jest.Mock;
const logUserActionMock = logUserAction as jest.Mock;

const MSG_TELEFONE =
  'Já existe um motorista ativo com este telefone. Confira se ele já tem conta.';

beforeEach(() => {
  jest.clearAllMocks();
  logUserActionMock.mockResolvedValue(undefined);
});

describe('alternarMotoristaNaLoja', () => {
  const base = {
    motoristaId: 'm1',
    motoristaNome: 'Ana',
    unidadeId: 'u1',
    ativo: false,
  };

  it('chama só a RPC da loja, com os três parâmetros', async () => {
    rpc.mockResolvedValue({ data: 'vinculo', error: null });
    await alternarMotoristaNaLoja(base);
    expect(rpc).toHaveBeenCalledWith('alternar_motorista_na_unidade', {
      p_motorista_id: 'm1',
      p_unidade_id: 'u1',
      p_ativo: false,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('devolve vinculo quando a RPC diz vinculo, e pessoa no resto', async () => {
    rpc.mockResolvedValueOnce({ data: 'vinculo', error: null });
    await expect(alternarMotoristaNaLoja(base)).resolves.toBe('vinculo');
    rpc.mockResolvedValueOnce({ data: 'pessoa', error: null });
    await expect(alternarMotoristaNaLoja(base)).resolves.toBe('pessoa');
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(alternarMotoristaNaLoja(base)).resolves.toBe('pessoa');
  });

  it('relança o erro ORIGINAL (bloqueio por rota aberta)', async () => {
    const erro = { code: 'P0001', message: 'rota aberta…' };
    rpc.mockResolvedValue({ data: null, error: erro });
    await expect(
      alternarMotoristaNaLoja({ ...base, gestorId: 'g1' }),
    ).rejects.toBe(erro);
    expect(logUserActionMock).not.toHaveBeenCalled();
  });

  it('grava motorista_desativado / motorista_ativado com o gestor', async () => {
    rpc.mockResolvedValue({ data: 'pessoa', error: null });
    await alternarMotoristaNaLoja({ ...base, ativo: false, gestorId: 'g1' });
    expect(logUserActionMock).toHaveBeenCalledWith(
      'g1',
      'motorista_desativado',
      {
        motorista_id: 'm1',
        motorista_nome: 'Ana',
      },
    );
    await alternarMotoristaNaLoja({ ...base, ativo: true, gestorId: 'g1' });
    expect(logUserActionMock).toHaveBeenLastCalledWith(
      'g1',
      'motorista_ativado',
      { motorista_id: 'm1', motorista_nome: 'Ana' },
    );
  });

  it('sem gestorId não grava log e não lança', async () => {
    rpc.mockResolvedValue({ data: 'pessoa', error: null });
    await expect(alternarMotoristaNaLoja(base)).resolves.toBe('pessoa');
    expect(logUserActionMock).not.toHaveBeenCalled();
  });

  it('rejeição do log não vira unhandled rejection nem derruba a operação', async () => {
    rpc.mockResolvedValue({ data: 'pessoa', error: null });
    logUserActionMock.mockRejectedValue(new Error('log fora'));
    await expect(
      alternarMotoristaNaLoja({ ...base, gestorId: 'g1' }),
    ).resolves.toBe('pessoa');
    await Promise.resolve();
  });
});

describe('editarDadosMotorista', () => {
  it('manda só nome e telefone aparados; telefone vazio vira null', async () => {
    updateUsuarioMock.mockResolvedValue({ success: true, data: {} });
    const r = await editarDadosMotorista({
      motoristaId: 'm1',
      nome: ' Ana ',
      telefone: '  ',
    });
    expect(updateUsuarioMock).toHaveBeenCalledWith('m1', {
      nome: 'Ana',
      telefone: null,
    });
    expect(r).toEqual({ nome: 'Ana', telefone: null });
  });

  it('relança originalError (P0001 da trava de outra loja)', async () => {
    const original = { code: 'P0001', message: 'só nome e telefone' };
    updateUsuarioMock.mockResolvedValue({
      success: false,
      error: { originalError: original, message: 'x' },
    });
    await expect(
      editarDadosMotorista({ motoristaId: 'm1', nome: 'Ana', gestorId: 'g1' }),
    ).rejects.toBe(original);
    expect(logUserActionMock).not.toHaveBeenCalled();
  });

  it('grava motorista_editado', async () => {
    updateUsuarioMock.mockResolvedValue({ success: true, data: {} });
    await editarDadosMotorista({
      motoristaId: 'm1',
      nome: 'Ana',
      telefone: '8399',
      gestorId: 'g1',
    });
    expect(logUserActionMock).toHaveBeenCalledWith('g1', 'motorista_editado', {
      motorista_id: 'm1',
      motorista_nome: 'Ana',
    });
  });
});

describe('mensagemErroMotorista', () => {
  it('colisão do índice de telefone (Error)', () => {
    expect(
      mensagemErroMotorista(
        new Error('duplicate key usuarios_motorista_telefone_unico'),
        'padrão',
      ),
    ).toBe(MSG_TELEFONE);
  });

  it('colisão do índice de telefone (objeto do Postgres)', () => {
    expect(
      mensagemErroMotorista(
        {
          code: '23505',
          message: 'violates unique "usuarios_motorista_telefone_unico"',
        },
        'padrão',
      ),
    ).toBe(MSG_TELEFONE);
  });

  it('regra do banco (P0001) vira a própria frase', () => {
    expect(
      mensagemErroMotorista({ code: 'P0001', message: 'Regra X' }, 'padrão'),
    ).toBe('Regra X');
  });

  it('o resto cai no padrão', () => {
    expect(mensagemErroMotorista(new Error('boom'), 'padrão')).toBe('padrão');
  });
});
