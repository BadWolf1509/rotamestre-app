/**
 * Soltar a parada sem mudar a ordem não grava nada.
 *
 * Toque longo na alça e soltar sem mexer (ou arrastar e devolver ao lugar)
 * termina o arrasto com a mesma ordem. O fim do arrasto chamava `onReorder`
 * mesmo assim: no moto g15 (dev client, 05/11/2026) o RPC gravou a ordem igual
 * e o modal Reordenar fechou sozinho, como se o gestor tivesse salvo.
 */
import { act, renderHook } from '@testing-library/react-native';

import { useReorderState } from '../DraggableStopList/useReorderState';

import type { Parada } from '../types';

function p(id: string, ordem: number): Parada {
  return {
    id,
    ordem,
    endereco: `Rua ${id}`,
    tipo: 'entrega',
    status: 'pendente',
    latitude: -7,
    longitude: -34,
    is_checkpoint: true,
  };
}

const A = p('a', 1);
const B = p('b', 2);
const C = p('c', 3);

function montar(paradas: Parada[]) {
  const onReorder = jest.fn().mockResolvedValue(undefined);
  const hook = renderHook(() =>
    useReorderState({ paradas, onReorder, rotaStatus: 'pendente' }),
  );
  return { ...hook, onReorder };
}

describe('useReorderState: fim do arrasto sem mudar a ordem', () => {
  it('não chama onReorder quando a ordem é a mesma', async () => {
    const { result, onReorder } = montar([A, B, C]);

    await act(() => result.current.handleDragEnd([A, B, C]));

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('chama onReorder quando a ordem mudou', async () => {
    const { result, onReorder } = montar([A, B, C]);

    await act(() => result.current.handleDragEnd([B, A, C]));

    expect(onReorder).toHaveBeenCalledTimes(1);
  });
});
