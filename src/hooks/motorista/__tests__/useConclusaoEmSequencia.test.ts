import { act, renderHook } from '@testing-library/react-native';

import type { ParadaData } from '@/context/route-status/types';
import { useInicioModals } from '@/hooks/motorista/useInicioModals';

import { useConclusaoEmSequencia } from '../useConclusaoEmSequencia';

const LAT = -7.115;
const LON = -34.861;
const LONGE = 0.01; // ~1,1 km

function parada(
  ordem: number,
  extra: Partial<ParadaData> & { dLat?: number } = {},
): ParadaData {
  const { dLat = 0, ...resto } = extra;
  return {
    id: `p${ordem}`,
    endereco: `Rua ${ordem}`,
    ordem,
    status: 'pendente',
    tipo: 'entrega',
    latitude: LAT + dLat,
    longitude: LON,
    ...resto,
  };
}

describe('useConclusaoEmSequencia', () => {
  const entrega = parada(3);
  const retirada = parada(4, { tipo: 'retirada' });
  const entrega2 = parada(5);

  function montar(paradas: ParadaData[]) {
    const abrirConclusao = jest.fn();
    const hook = renderHook(
      (props: { paradas: ParadaData[] }) =>
        useConclusaoEmSequencia({ paradas: props.paradas, abrirConclusao }),
      { initialProps: { paradas } },
    );
    return { abrirConclusao, ...hook };
  }

  it('abre a primeira e anuncia o serviço seguinte do mesmo local', () => {
    const { result, abrirConclusao } = montar([entrega, retirada]);
    expect(result.current.contexto).toBeNull();

    act(() => result.current.iniciar(entrega));

    expect(abrirConclusao).toHaveBeenCalledTimes(1);
    expect(abrirConclusao).toHaveBeenCalledWith(entrega);
    expect(result.current.contexto).toBe(
      'Mais 1 serviço neste local: Retirada',
    );
  });

  it('ao concluir o primeiro, abre o próximo e some o aviso', () => {
    const { result, abrirConclusao } = montar([entrega, retirada]);
    act(() => result.current.iniciar(entrega));

    act(() => result.current.aoConcluir(entrega.id));

    expect(abrirConclusao).toHaveBeenCalledTimes(2);
    expect(abrirConclusao).toHaveBeenLastCalledWith(retirada);
    expect(result.current.contexto).toBeNull();
  });

  it('ao concluir o último, não abre mais nada', () => {
    const { result, abrirConclusao } = montar([entrega, retirada]);
    act(() => result.current.iniciar(entrega));
    act(() => result.current.aoConcluir(entrega.id));
    abrirConclusao.mockClear();

    act(() => result.current.aoConcluir(retirada.id));

    expect(abrirConclusao).not.toHaveBeenCalled();
    expect(result.current.contexto).toBeNull();
  });

  it('parada avulsa: abre e não reabre ao concluir', () => {
    const avulsa = parada(3);
    const longe = parada(4, { dLat: LONGE });
    const { result, abrirConclusao } = montar([avulsa, longe]);

    act(() => result.current.iniciar(avulsa));
    expect(result.current.contexto).toBeNull();
    act(() => result.current.aoConcluir(avulsa.id));

    expect(abrirConclusao).toHaveBeenCalledTimes(1);
    expect(abrirConclusao).toHaveBeenCalledWith(avulsa);
  });

  it('cancelar (sem aoConcluir) não reabre nada', () => {
    const { result, abrirConclusao } = montar([entrega, retirada]);

    act(() => result.current.iniciar(entrega));

    expect(abrirConclusao).toHaveBeenCalledTimes(1);
  });

  it('três serviços no local: lista os dois restantes e segue um a um', () => {
    const { result, abrirConclusao } = montar([entrega, retirada, entrega2]);

    act(() => result.current.iniciar(entrega));
    expect(result.current.contexto).toBe(
      'Mais 2 serviços neste local: Retirada + Entrega',
    );

    act(() => result.current.aoConcluir(entrega.id));
    expect(abrirConclusao).toHaveBeenLastCalledWith(retirada);
    expect(result.current.contexto).toBe('Mais 1 serviço neste local: Entrega');

    act(() => result.current.aoConcluir(retirada.id));
    expect(abrirConclusao).toHaveBeenLastCalledWith(entrega2);
    expect(result.current.contexto).toBeNull();
  });

  it('usa a fila capturada no iniciar, não as paradas já recarregadas', () => {
    const { result, abrirConclusao, rerender } = montar([entrega, retirada]);
    act(() => result.current.iniciar(entrega));

    // onSuccess dispara antes do reload; depois dele a rota chega com a
    // entrega concluída e (num caso extremo) sem a retirada à vista.
    rerender({ paradas: [{ ...entrega, status: 'concluida' }] });
    act(() => result.current.aoConcluir(entrega.id));

    expect(abrirConclusao).toHaveBeenLastCalledWith(retirada);
  });

  it('só abre o próximo depois que o modal fechou (remonta com estado limpo)', () => {
    const paradas = [entrega, retirada];
    const { result } = renderHook(() => {
      const modals = useInicioModals();
      const sequencia = useConclusaoEmSequencia({
        paradas,
        abrirConclusao: modals.openCompletionFlow,
      });
      return { modals, sequencia };
    });
    const visibilidade: boolean[] = [];

    act(() => result.current.sequencia.iniciar(entrega));
    visibilidade.push(result.current.modals.showCompletionFlow);

    // Ordem do StopCompletionFlow: onSuccess e, em seguida, onClose.
    // A tela só chama aoConcluir depois do refresh, já com o modal fechado.
    act(() => result.current.modals.closeCompletionFlow());
    visibilidade.push(result.current.modals.showCompletionFlow);
    act(() => result.current.sequencia.aoConcluir(entrega.id));
    visibilidade.push(result.current.modals.showCompletionFlow);

    expect(visibilidade).toEqual([true, false, true]);
    expect(result.current.modals.selectedParadaForCompletion).toEqual(retirada);
  });
});
