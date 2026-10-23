/**
 * excluirRota — a única porta de exclusão de rota do gestor (dashboard
 * desktop e Gestão de Rotas). Roda contra o banco falso em memória
 * (`bancoFalsoRotas`), que reproduz a FK `ON DELETE SET NULL` de
 * `logs.rota_id` e o trigger `prevent_duplicate_log`.
 */
import {
  bancoFalso,
  resetarBancoFalso,
} from '@/__tests__/helpers/bancoFalsoRotas';

import {
  excluirRota,
  ExclusaoRotaError,
  textoConfirmacaoExclusao,
} from '../excluirRota';

jest.mock(
  '@/lib/supabase',
  () => require('@/__tests__/helpers/bancoFalsoRotas').moduloSupabaseFalso,
);

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

beforeEach(() => {
  resetarBancoFalso([
    { id: 'r1', status: 'pendente', data: '2026-10-20', motorista_id: 'm1' },
    { id: 'r2', status: 'concluida', data: '2026-10-19', motorista_id: 'm1' },
    {
      id: 'r3',
      status: 'em_andamento',
      data: '2026-10-22',
      motorista_id: 'm2',
    },
  ]);
});

describe('excluirRota', () => {
  it('apaga a rota e deixa o log rota_excluida gravado (rota_id zerado pela FK, id em detalhes)', async () => {
    await excluirRota({ rotaId: 'r1', usuarioId: 'g1', motoristaNome: 'Ana' });

    expect(bancoFalso.rotas.map((r) => r.id)).toEqual(['r2', 'r3']);
    expect(bancoFalso.logs).toHaveLength(1);
    expect(bancoFalso.logs[0]).toMatchObject({
      usuario_id: 'g1',
      rota_id: null,
      evento: 'rota_excluida',
      detalhes: {
        rota_id: 'r1',
        data: '2026-10-20',
        motorista_id: 'm1',
        motorista_nome: 'Ana',
        status_anterior: 'pendente',
      },
    });
  });

  // Guarda a escolha de NÃO gravar com rota_id nulo: com nulo, o
  // prevent_duplicate_log descartaria o 2º log (verificado em vermelho
  // trocando `rota_id: rota.id` por `rota_id: null` no INSERT).
  it('duas exclusões seguidas do mesmo gestor gravam os dois logs (dedup de 5 s não colide)', async () => {
    await excluirRota({ rotaId: 'r1', usuarioId: 'g1' });
    await excluirRota({ rotaId: 'r2', usuarioId: 'g1' });

    expect(
      bancoFalso.logs.filter((l) => l.evento === 'rota_excluida'),
    ).toHaveLength(2);
  });

  it('recusa rota em andamento reconsultando o servidor', async () => {
    await expect(
      excluirRota({ rotaId: 'r3', usuarioId: 'g1' }),
    ).rejects.toMatchObject({ motivo: 'em_andamento' });

    expect(bancoFalso.rotas.some((r) => r.id === 'r3')).toBe(true);
    expect(bancoFalso.logs).toHaveLength(0);
  });

  it('rota que sumiu (ou não é visível) vira erro "nao_encontrada", sem log', async () => {
    await expect(
      excluirRota({ rotaId: 'nao-existe', usuarioId: 'g1' }),
    ).rejects.toBeInstanceOf(ExclusaoRotaError);
    expect(bancoFalso.logs).toHaveLength(0);
  });

  it('DELETE que não apaga nada (RLS) é erro, não sucesso — e o log registra a falha', async () => {
    bancoFalso.falharDelete = true;

    await expect(
      excluirRota({ rotaId: 'r1', usuarioId: 'g1' }),
    ).rejects.toMatchObject({ motivo: 'nao_excluida' });

    expect(bancoFalso.rotas.some((r) => r.id === 'r1')).toBe(true);
    expect(bancoFalso.logs.map((l) => l.evento)).toEqual([
      'rota_excluida',
      'rota_exclusao_falhou',
    ]);
  });
});

describe('excluirRota — corrida e falhas', () => {
  it('motorista inicia a rota entre a consulta e o DELETE: recusa como em andamento e nada é apagado', async () => {
    bancoFalso.aposConsultar = () => {
      const r1 = bancoFalso.rotas.find((r) => r.id === 'r1');
      if (r1) r1.status = 'em_andamento';
    };

    await expect(
      excluirRota({ rotaId: 'r1', usuarioId: 'g1' }),
    ).rejects.toMatchObject({ motivo: 'em_andamento' });

    expect(bancoFalso.rotas.some((r) => r.id === 'r1')).toBe(true);
    expect(bancoFalso.logs.map((l) => l.evento)).toEqual([
      'rota_excluida',
      'rota_exclusao_falhou',
    ]);
  });

  it('sentinela ROTA_EM_ANDAMENTO do banco (Migration 41) vira mensagem amigável', async () => {
    bancoFalso.erroDelete = {
      code: 'P0001',
      message:
        'ROTA_EM_ANDAMENTO: a rota está em andamento e não pode ser excluída.',
    };

    const erro = await excluirRota({ rotaId: 'r1', usuarioId: 'g1' }).catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(ExclusaoRotaError);
    expect((erro as ExclusaoRotaError).motivo).toBe('em_andamento');
    expect((erro as Error).message).not.toMatch(/ROTA_EM_ANDAMENTO/);
  });

  it('DELETE com erro real (rede): repassa o erro e registra a falha no log', async () => {
    const erroRede = { code: '', message: 'Failed to fetch' };
    bancoFalso.erroDelete = erroRede;

    await expect(excluirRota({ rotaId: 'r1', usuarioId: 'g1' })).rejects.toBe(
      erroRede,
    );

    expect(bancoFalso.rotas.some((r) => r.id === 'r1')).toBe(true);
    expect(bancoFalso.logs.map((l) => l.evento)).toEqual([
      'rota_excluida',
      'rota_exclusao_falhou',
    ]);
  });

  it('falha ao gravar o log aborta a exclusão (sem rastro, sem DELETE)', async () => {
    bancoFalso.falharLog = true;

    await expect(
      excluirRota({ rotaId: 'r1', usuarioId: 'g1' }),
    ).rejects.toMatchObject({ message: 'falha ao gravar log' });

    expect(bancoFalso.rotas.some((r) => r.id === 'r1')).toBe(true);
  });
});

describe('textoConfirmacaoExclusao', () => {
  it('rota concluída: avisa que perde paradas e comprovantes, sem prometer apagar as fotos', () => {
    // As fotos ficam no Storage (o DELETE em cascata não apaga objetos);
    // o que some é o registro das paradas e o vínculo com os comprovantes.
    const { titulo, mensagem } = textoConfirmacaoExclusao({
      status: 'concluida',
    });
    expect(titulo).toMatch(/concluída/);
    expect(mensagem).toMatch(/comprovantes de entrega/);
    expect(mensagem).not.toMatch(/fotos e registros/);
    expect(mensagem).not.toMatch(/apaga também todas/);
  });

  it('rota pendente: confirmação comum, sem falar de comprovante', () => {
    const { mensagem } = textoConfirmacaoExclusao({
      status: 'pendente',
      motoristaNome: null,
      paradasCount: 3,
    });
    expect(mensagem).not.toMatch(/comprovantes/);
    expect(mensagem).toContain('Motorista: Sem motorista');
    expect(mensagem).toContain('Paradas: 3');
  });
});
