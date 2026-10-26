/**
 * Dispensar o aviso de ação descartada com a lista de descartes ilegível
 * (OFF-4): `dispensarDescartes` da fila lança `FalhaDeLeituraLocal` em vez de
 * gravar por cima. O botão do aviso chama `void dispensarAvisosDeEnvio()` —
 * a rejeição não pode escapar sem tratamento; o hook a registra.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';

import { logger } from '@/lib/logger';
import { _resetFilaAcoesParada } from '@/lib/motorista/filaAcoesParada';

import { useFilaAcoesParada } from '../useFilaAcoesParada';

jest.mock('@/lib/supabase');
jest.mock('@/lib/logger');

const CHAVE_DESCARTES = '@rotamestre:fila_acoes_parada_descartes';

beforeEach(() => {
  jest.clearAllMocks();
  _resetFilaAcoesParada();
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async (k: string) => {
    if (k === CHAVE_DESCARTES) throw new Error('CursorWindow cheio');
    return null;
  });
});

it('lista de descartes ilegível: dispensar não rejeita, registra e não grava', async () => {
  const { result } = renderHook(() => useFilaAcoesParada('mot-1'));

  await act(async () => {
    await expect(result.current.dispensarDescartes()).resolves.toBeUndefined();
  });

  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('dispensar'),
    expect.objectContaining({ name: 'FalhaDeLeituraLocal' }),
  );
  expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
    CHAVE_DESCARTES,
    expect.anything(),
  );
});
