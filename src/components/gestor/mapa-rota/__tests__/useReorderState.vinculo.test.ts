/**
 * Reordenar respeitando o vínculo retirada -> entrega (G7): a entrega não pode
 * ir antes da sua retirada. Recusa e avisa, em vez de gravar a ordem e deixar o
 * motorista receber a entrega antes de coletar.
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

const R1 = p('r1', 1, { tipo: 'retirada' });
const E1 = p('e1', 2, { vinculo_parada_id: 'r1' });
const E2 = p('e2', 3);

function montar(paradas: Parada[]) {
  const onReorder = jest.fn().mockResolvedValue(undefined);
  const hook = renderHook(() =>
    useReorderState({ paradas, onReorder, rotaStatus: 'pendente' }),
  );
  return { ...hook, onReorder };
}

describe('useReorderState: vínculo retirada -> entrega', () => {
  it('subir a entrega acima da retirada vinculada é recusado, com aviso', () => {
    const { result } = montar([R1, E1, E2]);

    act(() => result.current.moveUp(1));

    expect(result.current.currentWebList.map((x) => x.id)).toEqual([
      'r1',
      'e1',
      'e2',
    ]);
    expect(result.current.hasChanges).toBe(false);
    expect(result.current.aviso).toMatch(/depende de/);
    expect(result.current.aviso).toContain('Rua r1');
  });

  it('descer a retirada para depois da entrega vinculada também é recusado', () => {
    const { result } = montar([R1, E1, E2]);

    act(() => result.current.moveDown(0));

    expect(result.current.hasChanges).toBe(false);
    expect(result.current.aviso).not.toBeNull();
  });

  it('mover paradas sem relação passa, e limpa o aviso anterior', () => {
    const { result } = montar([R1, E1, E2]);

    act(() => result.current.moveUp(1));
    expect(result.current.aviso).not.toBeNull();
    act(() => result.current.moveDown(1));

    expect(result.current.currentWebList.map((x) => x.id)).toEqual([
      'r1',
      'e2',
      'e1',
    ]);
    expect(result.current.hasChanges).toBe(true);
    expect(result.current.aviso).toBeNull();
  });

  it('retirada já concluída (fixa) não segura a entrega: pode subir ao topo', () => {
    const concluida = p('r1', 1, { tipo: 'retirada', status: 'concluida' });
    const e1 = p('e1', 2, { vinculo_parada_id: 'r1' });
    const { result } = montar([concluida, e1, p('e2', 3)]);

    act(() => result.current.moveDown(0));

    expect(result.current.aviso).toBeNull();
    expect(result.current.hasChanges).toBe(true);
  });

  it('arrastar (mobile) a entrega para antes da retirada: não chama onReorder, avisa e pede reset da lista', async () => {
    const { result, onReorder } = montar([R1, E1, E2]);
    const antes = result.current.resetToken;

    await act(async () => {
      await result.current.handleDragEnd([E1, R1, E2]);
    });

    expect(onReorder).not.toHaveBeenCalled();
    expect(result.current.aviso).toMatch(/depende de/);
    expect(result.current.resetToken).toBe(antes + 1);
  });

  it('arrastar sem violar grava normalmente', async () => {
    const { result, onReorder } = montar([R1, E1, E2]);

    await act(async () => {
      await result.current.handleDragEnd([R1, E2, E1]);
    });

    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(result.current.aviso).toBeNull();
  });

  it('rota que já veio com a ordem quebrada não trava mexer nas outras paradas', () => {
    const quebrada = [E1, R1, E2];
    const { result } = montar(quebrada.map((x, i) => ({ ...x, ordem: i + 1 })));

    act(() => result.current.moveDown(1));

    expect(result.current.hasChanges).toBe(true);
    expect(result.current.aviso).toBeNull();
  });

  it('cancelar as alterações limpa o aviso', () => {
    const { result } = montar([R1, E1, E2]);

    act(() => result.current.moveUp(1));
    act(() => result.current.cancelChanges());

    expect(result.current.aviso).toBeNull();
  });
});
