/**
 * Espera o app voltar ao primeiro plano antes de iniciar serviço em primeiro
 * plano.
 *
 * POR QUE EXISTE. O Android 12+ recusa iniciar serviço em primeiro plano com o
 * app fora da tela — e um pedido de permissão (de qualquer tela) tira o app da
 * tela por uma fração de segundo (`onHostPause` no logcat). Foi assim que o
 * rastreamento da navegação falhava ao entrar (#570).
 *
 * Mora em `lib`, e não num dos dois serviços de localização, porque os dois
 * precisam dela e `locationTracking.ts` já importa `unifiedLocationTracking.ts`.
 */
import { AppState } from 'react-native';

/** Teto da espera: se o app não voltar, tenta assim mesmo (e falha como antes). */
const ESPERA_MAXIMA_PRIMEIRO_PLANO_MS = 5000;

export function aguardarAppEmPrimeiroPlano(): Promise<void> {
  if (AppState.currentState === 'active') return Promise.resolve();
  return new Promise((resolve) => {
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') concluir();
    });
    const prazo = setTimeout(concluir, ESPERA_MAXIMA_PRIMEIRO_PLANO_MS);
    function concluir() {
      clearTimeout(prazo);
      assinatura.remove();
      resolve();
    }
  });
}
