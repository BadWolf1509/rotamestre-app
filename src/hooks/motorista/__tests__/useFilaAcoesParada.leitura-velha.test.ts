/**
 * M8-4: duas leituras em voo — a mais velha resolvendo por último não pode
 * sobrescrever o estado da mais nova.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  lerDescartesDaFila,
  lerFilaAcoesParada,
  ouvirFilaAcoesParada,
  type AcaoParada,
} from '@/lib/motorista/filaAcoesParada';

import { useFilaAcoesParada } from '../useFilaAcoesParada';

jest.mock('@/lib/motorista/filaAcoesParada', () => ({
  dispensarDescartes: jest.fn(),
  lerDescartesDaFila: jest.fn(),
  lerFilaAcoesParada: jest.fn(),
  ouvirFilaAcoesParada: jest.fn(),
}));

const acao = (paradaId: string): AcaoParada =>
  ({ id: paradaId, paradaId, motoristaId: 'mot-1' }) as unknown as AcaoParada;

function adiavel<T>() {
  let resolver: (v: T) => void = () => undefined;
  const promessa = new Promise<T>((r) => {
    resolver = r;
  });
  return { promessa, resolver };
}

it('leitura mais velha que resolve por último não sobrescreve a mais nova', async () => {
  let aviso: () => void = () => undefined;
  (ouvirFilaAcoesParada as jest.Mock).mockImplementation((cb: () => void) => {
    aviso = cb;
    return () => undefined;
  });
  (lerDescartesDaFila as jest.Mock).mockResolvedValue([]);
  const velha = adiavel<AcaoParada[]>();
  const nova = adiavel<AcaoParada[]>();
  (lerFilaAcoesParada as jest.Mock)
    .mockReturnValueOnce(velha.promessa)
    .mockReturnValueOnce(nova.promessa);

  const { result } = renderHook(() => useFilaAcoesParada('mot-1'));
  // 2ª leitura dispara por um evento da fila enquanto a 1ª segue em voo.
  act(() => {
    aviso();
  });

  await act(async () => {
    nova.resolver([acao('nova')]);
  });
  await waitFor(() => expect(result.current.acoes).toHaveLength(1));
  await act(async () => {
    velha.resolver([acao('velha-1'), acao('velha-2')]);
  });

  expect(result.current.acoes.map((a) => a.paradaId)).toEqual(['nova']);
});
