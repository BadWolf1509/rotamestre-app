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

const mockMarcarOtimizacao = jest.fn();
jest.mock('@/lib/gestor/otimizacaoRota', () => ({
  marcarOtimizacaoAlterada: (...args: unknown[]) =>
    mockMarcarOtimizacao(...args),
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

describe('useEditStopForm: rota otimizada vira otimizada_alterada (G12)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecalcular.mockResolvedValue({ success: true });
    mockNotificar.mockResolvedValue({ success: true });
    mockMarcarOtimizacao.mockResolvedValue(true);
    const cadeia = cadeiaUpdate({ data: [{ id: 'p1' }], error: null });
    mockFrom.mockImplementation((tabela: string) =>
      tabela === 'paradas'
        ? { update: cadeia.update }
        : { insert: jest.fn().mockResolvedValue({ error: null }) },
    );
  });

  it('mudou o endereço (coordenadas): marca', async () => {
    const { result } = montar();

    act(() => {
      result.current.handleAddressSelect('Rua B, 2', 'x', {
        latitude: -7.2,
        longitude: -34.9,
      });
    });
    await act(async () => {
      await result.current.handleSave();
    });

    expect(mockMarcarOtimizacao).toHaveBeenCalledWith('rota-1');
  });

  it('mudou o tipo: marca', async () => {
    const { result } = montar();

    act(() => result.current.form.setValue('tipo', 'retirada'));
    await act(async () => {
      await result.current.handleSave();
    });

    expect(mockMarcarOtimizacao).toHaveBeenCalledWith('rota-1');
  });

  it('mudou só destinatário/observações: o trajeto é o mesmo, não marca', async () => {
    const { result } = montar();

    act(() => {
      result.current.form.setValue('destinatario', 'Bia');
      result.current.form.setValue('observacoes', 'portão azul');
    });
    await act(async () => {
      await result.current.handleSave();
    });

    expect(mockMarcarOtimizacao).not.toHaveBeenCalled();
  });

  it('o banco recusou a edição (zero linhas): não marca', async () => {
    const cadeia = cadeiaUpdate({ data: [], error: null });
    mockFrom.mockImplementation(() => ({ update: cadeia.update }));
    const { result } = montar();

    act(() => result.current.form.setValue('tipo', 'retirada'));
    await act(async () => {
      await result.current.handleSave();
    });

    expect(mockMarcarOtimizacao).not.toHaveBeenCalled();
  });
});

describe('useEditStopForm: trocar o tipo mexe no vínculo retirada -> entrega (G7)', () => {
  const retirada: Parada = {
    ...parada,
    id: 'r1',
    tipo: 'retirada',
    endereco: 'Rua da Coleta, 1',
  };
  const entrega: Parada = {
    ...parada,
    id: 'e1',
    ordem: 2,
    tipo: 'entrega',
    endereco: 'Rua da Entrega, 2',
    vinculo_parada_id: 'r1',
  };

  let updates: { valores: Record<string, unknown>; ids?: unknown }[];
  // Resposta do UPDATE que solta o vínculo das entregas dependentes.
  let resultadoDependentes: { data: unknown; error: unknown };

  beforeEach(() => {
    jest.clearAllMocks();
    updates = [];
    resultadoDependentes = { data: [{ id: 'e1' }], error: null };
    mockRecalcular.mockResolvedValue({ success: true });
    mockNotificar.mockResolvedValue({ success: true });
    mockMarcarOtimizacao.mockResolvedValue(true);
    mockFrom.mockImplementation((tabela: string) => {
      if (tabela !== 'paradas') {
        return { insert: jest.fn().mockResolvedValue({ error: null }) };
      }
      return {
        update: (valores: Record<string, unknown>) => {
          const registro: { valores: Record<string, unknown>; ids?: unknown } =
            { valores };
          updates.push(registro);
          // Só o vínculo: `.update({ vinculo_parada_id: null }).in('id', ids)`
          if (Object.keys(valores).join() === 'vinculo_parada_id') {
            return {
              in: (_col: string, ids: unknown) => {
                registro.ids = ids;
                return {
                  select: () => Promise.resolve(resultadoDependentes),
                };
              },
            };
          }
          return {
            eq: () => ({
              eq: () => ({
                select: () =>
                  Promise.resolve({ data: [{ id: 'x' }], error: null }),
              }),
            }),
          };
        },
      };
    });
  });

  it('retirada com entrega vinculada virando entrega: pede confirmação e não grava nada ainda', async () => {
    const { result, onSave } = montar({
      parada: retirada,
      allParadas: [retirada, entrega],
    });

    act(() => result.current.form.setValue('tipo', 'entrega'));
    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.confirmacaoVinculo).toContain('Rua da Entrega, 2');
    expect(mockFrom).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('confirmando: grava o tipo e solta o vínculo das entregas dependentes', async () => {
    const { result, onSave } = montar({
      parada: retirada,
      allParadas: [retirada, entrega],
    });

    act(() => result.current.form.setValue('tipo', 'entrega'));
    await act(async () => {
      await result.current.handleSave();
    });
    await act(async () => {
      await result.current.confirmarSalvarComVinculo();
    });

    expect(updates[0].valores).toEqual(
      expect.objectContaining({ tipo: 'entrega' }),
    );
    expect(updates[1]).toEqual({
      valores: { vinculo_parada_id: null },
      ids: ['e1'],
    });
    expect(result.current.confirmacaoVinculo).toBeNull();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  async function confirmarRetiradaVirandoEntrega() {
    const hook = montar({
      parada: retirada,
      allParadas: [retirada, entrega],
    });
    act(() => hook.result.current.form.setValue('tipo', 'entrega'));
    await act(async () => {
      await hook.result.current.handleSave();
    });
    await act(async () => {
      await hook.result.current.confirmarSalvarComVinculo();
    });
    return hook;
  }

  it('vínculo das entregas solto com sucesso: onSave sem o aviso de vínculo', async () => {
    const { onSave } = await confirmarRetiradaVirandoEntrega();

    expect(onSave).toHaveBeenCalledWith({ routeRecalculationFailed: false });
  });

  it('o UPDATE que solta o vínculo falhou: a edição vale, mas onSave avisa que o vínculo não foi desfeito', async () => {
    resultadoDependentes = { data: null, error: { message: 'queda' } };

    const { onSave } = await confirmarRetiradaVirandoEntrega();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      routeRecalculationFailed: false,
      vinculoNaoDesfeito: true,
    });
  });

  it('o UPDATE do vínculo não afetou linha nenhuma (RLS): também avisa', async () => {
    resultadoDependentes = { data: [], error: null };

    const { onSave } = await confirmarRetiradaVirandoEntrega();

    expect(onSave).toHaveBeenCalledWith({
      routeRecalculationFailed: false,
      vinculoNaoDesfeito: true,
    });
  });

  it('voltar da confirmação: não grava e fecha o aviso', async () => {
    const { result, onSave } = montar({
      parada: retirada,
      allParadas: [retirada, entrega],
    });

    act(() => result.current.form.setValue('tipo', 'entrega'));
    await act(async () => {
      await result.current.handleSave();
    });
    act(() => result.current.cancelarConfirmacaoVinculo());

    expect(result.current.confirmacaoVinculo).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('entrega vinculada virando retirada: confirma e grava com o vínculo zerado', async () => {
    const { result, onSave } = montar({
      parada: entrega,
      allParadas: [retirada, entrega],
    });

    act(() => result.current.form.setValue('tipo', 'retirada'));
    await act(async () => {
      await result.current.handleSave();
    });
    expect(result.current.confirmacaoVinculo).toContain('Rua da Coleta, 1');

    await act(async () => {
      await result.current.confirmarSalvarComVinculo();
    });

    expect(updates[0].valores).toEqual(
      expect.objectContaining({ tipo: 'retirada', vinculo_parada_id: null }),
    );
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('retirada sem entrega vinculada virando entrega: salva direto, sem confirmação', async () => {
    const { result, onSave } = montar({
      parada: retirada,
      allParadas: [retirada],
    });

    act(() => result.current.form.setValue('tipo', 'entrega'));
    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.confirmacaoVinculo).toBeNull();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(updates).toHaveLength(1);
  });
});

describe('useEditStopForm: validação Zod e erro cruzado (G14)', () => {
  const geocode = jest.requireMock('@/lib/photon').photonService
    .geocodeAddress as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRecalcular.mockResolvedValue({ success: true });
    mockNotificar.mockResolvedValue({ success: true });
    mockMarcarOtimizacao.mockResolvedValue(true);
    const cadeia = cadeiaUpdate({ data: [{ id: 'p1' }], error: null });
    mockFrom.mockImplementation((tabela: string) =>
      tabela === 'paradas'
        ? { update: cadeia.update }
        : { insert: jest.fn().mockResolvedValue({ error: null }) },
    );
  });

  it('endereço apagado: erro no campo, e nada vai ao banco', async () => {
    const { result, onSave } = montar();

    act(() => result.current.handleAddressChange(''));
    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.errors.endereco?.message).toBe(
      'Informe um endereço válido.',
    );
    expect(mockFrom).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('telefone incompleto: erro no campo telefone', async () => {
    const { result, onSave } = montar();

    act(() => result.current.handlePhoneChange('11999'));
    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.errors.telefone?.message).toBe(
      'Telefone deve ter DDD e 10 ou 11 dígitos.',
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it('digitar outro endereço zera as coordenadas; sem achar no geocoder, o erro mora em endereco', async () => {
    geocode.mockResolvedValue(null);
    const { result, onSave } = montar();

    act(() => result.current.handleAddressChange('Rua Que Não Existe, 99'));
    await act(async () => {
      await result.current.handleSave();
    });

    expect(geocode).toHaveBeenCalledWith('Rua Que Não Existe, 99');
    expect(result.current.errors.endereco?.message).toMatch(
      /Não foi possível encontrar as coordenadas/,
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it('escolher uma sugestão com coordenadas limpa o erro preso em endereco (clearErrors)', async () => {
    geocode.mockResolvedValue(null);
    const { result, onSave } = montar();

    act(() => result.current.handleAddressChange('Rua Que Não Existe, 99'));
    await act(async () => {
      await result.current.handleSave();
    });
    expect(result.current.errors.endereco).toBeDefined();

    act(() => {
      result.current.handleAddressSelect('Rua Real, 10', 'x', {
        latitude: -7.3,
        longitude: -34.7,
      });
    });

    expect(result.current.errors.endereco).toBeUndefined();

    await act(async () => {
      await result.current.handleSave();
    });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('digitar de volta o endereço original restaura as coordenadas dele (não geocodifica)', async () => {
    const { result, onSave } = montar();

    act(() => result.current.handleAddressChange('Rua B, 2'));
    act(() => result.current.handleAddressChange(parada.endereco));
    await act(async () => {
      await result.current.handleSave();
    });

    expect(geocode).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
