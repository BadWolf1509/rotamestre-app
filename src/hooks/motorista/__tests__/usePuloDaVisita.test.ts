import { renderHook, act } from '@testing-library/react-native';

import type { ParadaData } from '@/context/route-status/types';
import { AVISO_ENVIO_PENDENTE } from '@/lib/motorista/filaAcoesParada';

import { usePuloDaVisita } from '../usePuloDaVisita';

const parada = {
  id: 'p1',
  ordem: 1,
  tipo: 'entrega',
  status: 'em_andamento',
  latitude: 0,
  longitude: 0,
  endereco: 'Rua A',
} as ParadaData;

function montar(destino: 'enviada' | 'na_fila') {
  const showSuccess = jest.fn();
  const showError = jest.fn();
  const { result } = renderHook(() =>
    usePuloDaVisita({
      paradas: [parada],
      skipStop: jest.fn().mockResolvedValue(destino),
      showSuccess,
      showError,
    }),
  );
  return { pular: result.current, showSuccess, showError };
}

describe('usePuloDaVisita', () => {
  it('sem rede: o aviso de sucesso diz que o pulo ficou guardado para envio', async () => {
    const { pular, showSuccess } = montar('na_fila');
    await act(async () => {
      await pular(parada, 'cliente_ausente');
    });
    expect(showSuccess).toHaveBeenCalledWith(
      'Parada Pulada',
      expect.stringContaining(AVISO_ENVIO_PENDENTE),
    );
  });

  it('com rede: aviso normal, sem falar de envio pendente', async () => {
    const { pular, showSuccess } = montar('enviada');
    await act(async () => {
      await pular(parada, 'cliente_ausente');
    });
    expect(showSuccess).toHaveBeenCalledWith(
      'Parada Pulada',
      'Cliente ausente',
    );
  });
});
