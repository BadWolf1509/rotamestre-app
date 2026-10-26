import NetInfo from '@react-native-community/netinfo';

import { _resetRedeObservada, registrarFalhaDeRede } from '../redeObservada';
import { PRAZO_NETINFO_MS, semRedeConfirmada } from '../semRede';

const fetchNetInfo = NetInfo.fetch as jest.Mock;

afterEach(() => {
  fetchNetInfo.mockReset();
  fetchNetInfo.mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  });
});

/**
 * "Sem rede" só quando o NetInfo AFIRMA `isConnected === false` (modo avião é
 * confiável). "Conectado", `null` ou falha do NetInfo não provam nada: quem
 * chama segue para a requisição e os prazos de sempre.
 */
describe('semRedeConfirmada', () => {
  it('NetInfo desconectado: true, sem esperar prazo nenhum', async () => {
    jest.useFakeTimers();
    try {
      fetchNetInfo.mockResolvedValue({ isConnected: false, type: 'none' });
      // Nenhum avanço de relógio: se dependesse de timer, ficaria pendente.
      await expect(semRedeConfirmada()).resolves.toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('NetInfo conectado: false (não prova rede, mas não é "sem rede")', async () => {
    fetchNetInfo.mockResolvedValue({ isConnected: true, type: 'wifi' });
    await expect(semRedeConfirmada()).resolves.toBe(false);
  });

  it('isConnected null (ainda verificando): false', async () => {
    fetchNetInfo.mockResolvedValue({ isConnected: null, type: 'unknown' });
    await expect(semRedeConfirmada()).resolves.toBe(false);
  });

  it('NetInfo falha: false (não dá para afirmar)', async () => {
    fetchNetInfo.mockRejectedValue(new Error('módulo nativo indisponível'));
    await expect(semRedeConfirmada()).resolves.toBe(false);
  });

  it('NetInfo sem resposta: false no prazo de guarda, sem travar quem chama', async () => {
    jest.useFakeTimers();
    try {
      fetchNetInfo.mockReturnValue(new Promise(() => {}));
      const resposta = semRedeConfirmada();
      jest.advanceTimersByTime(PRAZO_NETINFO_MS);
      await expect(resposta).resolves.toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});

/**
 * Wi-Fi sem internet: o NetInfo diz "conectado", mas o fetch do Supabase já
 * falhou. A falha observada basta — nem pergunta ao NetInfo.
 */
describe('semRedeConfirmada com rede caída observada', () => {
  afterEach(() => _resetRedeObservada());

  it('rede caída observada responde true sem consultar o NetInfo', async () => {
    fetchNetInfo.mockResolvedValue({ isConnected: true, type: 'wifi' });
    registrarFalhaDeRede();
    await expect(semRedeConfirmada()).resolves.toBe(true);
    expect(fetchNetInfo).not.toHaveBeenCalled();
  });
});
