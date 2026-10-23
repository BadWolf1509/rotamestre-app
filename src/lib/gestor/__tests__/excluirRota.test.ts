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

describe('textoConfirmacaoExclusao', () => {
  it('rota concluída: avisa que apaga os comprovantes de entrega', () => {
    const { titulo, mensagem } = textoConfirmacaoExclusao({
      status: 'concluida',
    });
    expect(titulo).toMatch(/concluída/);
    expect(mensagem).toMatch(/comprovantes de entrega/);
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
