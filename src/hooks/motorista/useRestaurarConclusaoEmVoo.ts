/**
 * Reabre a conclusão de parada que a recriação da Activity interrompeu.
 *
 * Vive num hook, e não dentro de uma tela, porque DUAS telas concluem parada:
 * `_screens/inicio.tsx` (card principal) e `_screens/checkpoints.tsx` (lista).
 * Isso não é detalhe: quando o Android recria a Activity, a navegação volta
 * para a rota inicial — medido no aparelho, o app reaparece na **Início**. Uma
 * versão anterior desta correção só restaurava no `checkpoints`, e por isso não
 * restaurava nada no caminho que o motorista de fato percorre.
 *
 * Ver `src/lib/motorista/conclusaoEmVoo.ts` para o diagnóstico do bug.
 */
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import {
  lerConclusaoEmVoo,
  limparConclusaoEmVoo,
  paradaParaReabrir,
  type ConclusaoEmVoo,
} from '@/lib/motorista/conclusaoEmVoo';

/**
 * Marcador já restaurado, no escopo do MÓDULO e não do componente — o contexto
 * JS sobrevive à remontagem, o estado de componente não, e é exatamente isso
 * que precisamos lembrar. Sem esta trava, Início e Paradas (quando ambas estão
 * montadas) reabririam o modal para o mesmo marcador.
 *
 * A chave inclui o instante: uma segunda interrupção gera marcador novo e volta
 * a ser restaurável.
 */
let marcadorJaRestaurado: string | null = null;

const chaveDo = (marcador: ConclusaoEmVoo) =>
  `${marcador.paradaId}:${marcador.em}`;

/** Só para testes: zera a trava de módulo entre casos. */
export function _resetTravaDeRestauracao(): void {
  marcadorJaRestaurado = null;
}

export function useRestaurarConclusaoEmVoo<
  P extends { id: string; status: string },
>(
  rota: { id: string; status: string } | null,
  paradas: P[],
  aoRestaurar: (parada: P) => void,
): void {
  // `aoRestaurar` costuma ser recriada a cada render; guardar numa ref evita
  // que o efeito rode de novo só por isso.
  const aoRestaurarRef = useRef(aoRestaurar);
  aoRestaurarRef.current = aoRestaurar;

  useEffect(() => {
    // O bug é da recriação de Activity do Android. No web e no iOS não há o
    // que restaurar, e `getPendingResultAsync` não existe.
    if (Platform.OS !== 'android') return;
    // Sem rota/paradas carregadas ainda não dá para julgar o marcador.
    if (!rota || paradas.length === 0) return;

    let cancelado = false;

    const restaurar = async () => {
      const marcador = await lerConclusaoEmVoo();
      if (cancelado || !marcador) return;
      if (marcadorJaRestaurado === chaveDo(marcador)) return;

      const parada = paradaParaReabrir(marcador, rota, paradas);

      if (!parada) {
        // Rota trocada, rota encerrada, parada resolvida noutro aparelho: o
        // marcador perdeu o sentido. Apagar aqui evita o modal reabrir do nada
        // numa próxima montagem.
        await limparConclusaoEmVoo();
        return;
      }

      if (cancelado) return;

      // Marca ANTES de abrir: se a outra tela estiver montada e ler o mesmo
      // marcador, encontra a trava fechada.
      marcadorJaRestaurado = chaveDo(marcador);
      aoRestaurarRef.current(parada);
    };

    restaurar();

    return () => {
      cancelado = true;
    };
  }, [rota, paradas]);
}
