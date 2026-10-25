/**
 * Reordenação ainda não salva × realtime (I2 da revisão final).
 *
 * A tela da rota grava um array NOVO de paradas a cada evento do realtime
 * (o motorista conclui qualquer parada, UPDATE em `rotas`, reconexão). O
 * preview da reordenação na web não pode voltar ao original por isso: o
 * gestor perderia, sem aviso, a ordem que acabou de montar.
 */
import { act, renderHook } from '@testing-library/react-native';

import { useReorderState } from '../DraggableStopList/useReorderState';

import type { Parada } from '../types';

function p(id: string, ordem: number, extra: Partial<Parada> = {}): Parada {
  return {
    id,
    ordem,
    endereco: `Rua ${id}`,
    tipo: 'entrega',
    status: 'pendente',
    latitude: -7,
    longitude: -34,
    is_checkpoint: true,
    ...extra,
  };
}

const ORIGINAL = [p('a', 1), p('b', 2), p('c', 3), p('d', 4)];

/** Mesmo conteúdo, objetos e array novos, como vem do realtime. */
const copia = (paradas: Parada[]) => paradas.map((x) => ({ ...x }));

function montar(paradas: Parada[]) {
  const onReorder = jest.fn().mockResolvedValue(undefined);
  const hook = renderHook(
    ({ lista }: { lista: Parada[] }) =>
      useReorderState({
        paradas: lista,
        onReorder,
        rotaStatus: 'em_andamento',
      }),
    { initialProps: { lista: paradas } },
  );
  return { ...hook, onReorder };
}

const ids = (lista: Parada[]) => lista.map((x) => x.id);

describe('useReorderState: preview não salvo × realtime', () => {
  it('evento com a mesma composição (array novo) mantém a ordem do gestor', () => {
    const { result, rerender } = montar(ORIGINAL);

    act(() => result.current.moveDown(0)); // b a c d
    act(() => result.current.moveDown(2)); // b a d c
    expect(ids(result.current.currentWebList)).toEqual(['b', 'a', 'd', 'c']);

    rerender({ lista: copia(ORIGINAL) });

    expect(ids(result.current.currentWebList)).toEqual(['b', 'a', 'd', 'c']);
    expect(result.current.hasChanges).toBe(true);
    expect(result.current.aviso).toBeNull();
  });

  it('parada concluída pelo motorista durante a edição vira fixa, e o resto da ordem fica', async () => {
    const { result, rerender, onReorder } = montar(ORIGINAL);

    act(() => result.current.moveDown(0)); // b a c d
    act(() => result.current.moveDown(2)); // b a d c

    const comAConcluida = copia(ORIGINAL).map((x) =>
      x.id === 'a' ? { ...x, status: 'concluida' as const } : x,
    );
    rerender({ lista: comAConcluida });

    expect(ids(result.current.fixedParadas)).toEqual(['a']);
    expect(ids(result.current.currentWebList)).toEqual(['b', 'd', 'c']);
    expect(result.current.hasChanges).toBe(true);
    expect(result.current.aviso).toContain('Rua a');

    await act(async () => {
      await result.current.saveChanges();
    });

    expect(onReorder).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'a', status: 'concluida' }),
      expect.objectContaining({ id: 'b', ordem: 2 }),
      expect.objectContaining({ id: 'd', ordem: 3 }),
      expect.objectContaining({ id: 'c', ordem: 4 }),
    ]);
  });

  it('o preview mostra os dados novos das paradas, não a cópia velha', () => {
    const { result, rerender } = montar(ORIGINAL);

    act(() => result.current.moveDown(0)); // b a c d

    rerender({
      lista: copia(ORIGINAL).map((x) =>
        x.id === 'c' ? { ...x, endereco: 'Rua nova' } : x,
      ),
    });

    expect(result.current.currentWebList[2]).toMatchObject({
      id: 'c',
      endereco: 'Rua nova',
    });
  });
});
