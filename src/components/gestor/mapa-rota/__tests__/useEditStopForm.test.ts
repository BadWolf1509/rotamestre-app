/**
 * useEditStopForm - salvar confere o que o banco fez (G4)
 *
 * Editar agia sobre dado velho e sem conferir retorno: se o motorista tinha
 * concluído a parada, o UPDATE podia afetar zero linhas (ou o gatilho da
 * Migration 53 recusar) e a tela dizia "atualizada" mesmo assim.
 */

import { act, renderHook } from '@testing-library/react-native';

import { useEditStopForm } from '../useEditStopForm';

import type { Parada } from '../types';

const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

jest.mock('@/lib/photon', () => ({
  photonService: { geocodeAddress: jest.fn() },
}));

const mockRecalcular = jest.fn();
const mockNotificar = jest.fn();
jest.mock('@/lib/routeUtils', () => ({
  recalcularRota: (...args: unknown[]) => mockRecalcular(...args),
  notificarMotoristaRotaEditada: (...args: unknown[]) => mockNotificar(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const parada: Parada = {
  id: 'p1',
  ordem: 1,
  endereco: 'Rua A, 1',
  tipo: 'entrega',
  status: 'pendente',
  latitude: -7.1,
  longitude: -34.8,
  destinatario: 'Ana',
};

/** `.update(...).eq('id', ...).eq('status', 'pendente').select('id')` */
function cadeiaUpdate(resultado: { data: unknown; error: unknown }) {
  const select = jest.fn().mockResolvedValue(resultado);
  const eqStatus = jest.fn().mockReturnValue({ select });
  const eqId = jest.fn().mockReturnValue({ eq: eqStatus });
  const update = jest.fn().mockReturnValue({ eq: eqId });
  return { update, eqId, eqStatus, select };
}

function montar(extra: Partial<Parameters<typeof useEditStopForm>[0]> = {}) {
  const onSave = jest.fn();
  const onDesatualizada = jest.fn();
  const hook = renderHook(() =>
    useEditStopForm({
      visible: true,
      parada,
      rotaId: 'rota-1',
      enderecoUnidade: { latitude: -7, longitude: -34 },
      allParadas: [parada],
      onSave,
      onDesatualizada,
      usuarioId: 'u-1',
      motoristaId: 'm-1',
      ...extra,
    }),
  );
  return { ...hook, onSave, onDesatualizada };
}

describe('useEditStopForm: salvar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecalcular.mockResolvedValue({ success: true });
    mockNotificar.mockResolvedValue({ success: true });
  });

  it('só atualiza parada ainda pendente e pede as linhas afetadas', async () => {
    const cadeia = cadeiaUpdate({ data: [{ id: 'p1' }], error: null });
    mockFrom.mockImplementation((tabela: string) =>
      tabela === 'paradas'
        ? { update: cadeia.update }
        : { insert: jest.fn().mockResolvedValue({ error: null }) },
    );
    const { result, onSave } = montar();

    await act(async () => {
      await result.current.handleSave();
    });

    expect(cadeia.eqId).toHaveBeenCalledWith('id', 'p1');
    expect(cadeia.eqStatus).toHaveBeenCalledWith('status', 'pendente');
    expect(cadeia.select).toHaveBeenCalledWith('id');
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it('zero linhas (a parada foi concluída): erro explicado, nada é gravado ou avisado', async () => {
    const cadeia = cadeiaUpdate({ data: [], error: null });
    mockFrom.mockImplementation((tabela: string) => {
      if (tabela === 'paradas') return { update: cadeia.update };
      throw new Error(`não devia tocar em ${tabela}`);
    });
    const { result, onSave, onDesatualizada } = montar();

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.error).toBe(
      'Esta parada não pode mais ser editada: o motorista já a iniciou ou finalizou, ou ela não existe mais. A tela foi atualizada.',
    );
    expect(onSave).not.toHaveBeenCalled();
    expect(onDesatualizada).toHaveBeenCalledTimes(1);
    expect(mockRecalcular).not.toHaveBeenCalled();
    expect(mockNotificar).not.toHaveBeenCalled();
    expect(result.current.isSaving).toBe(false);
  });

  it('o banco recusa (PARADA_CONCLUIDA_IMUTAVEL): mostra o motivo em português, sem o código', async () => {
    const cadeia = cadeiaUpdate({
      data: null,
      error: {
        code: 'P0001',
        message:
          'PARADA_CONCLUIDA_IMUTAVEL: a parada já foi concluída; endereço e tipo não podem mudar.',
      },
    });
    mockFrom.mockImplementation(() => ({ update: cadeia.update }));
    const { result, onSave, onDesatualizada } = montar();

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.error).toBe(
      'Esta parada já foi concluída pelo motorista: o endereço e o tipo não podem mais ser alterados.',
    );
    expect(result.current.error).not.toMatch(/PARADA_|P0001/);
    expect(onSave).not.toHaveBeenCalled();
    expect(onDesatualizada).toHaveBeenCalledTimes(1);
  });

  it('erro qualquer do banco segue com a mensagem genérica', async () => {
    const cadeia = cadeiaUpdate({
      data: null,
      error: { message: 'connection reset' },
    });
    mockFrom.mockImplementation(() => ({ update: cadeia.update }));
    const { result, onSave, onDesatualizada } = montar();

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.error).toBe(
      'Erro ao salvar parada. Tente novamente.',
    );
    expect(onSave).not.toHaveBeenCalled();
    expect(onDesatualizada).not.toHaveBeenCalled();
  });
});
