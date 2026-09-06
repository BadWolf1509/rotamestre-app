/**
 * Reabre o wizard de incidente que a recriação da Activity interrompeu.
 *
 * POR QUE EXISTE, e por que quase ficou de fora. O `IncidentReportWizard` já
 * salvava e restaurava o rascunho — mas o efeito de restauração vive DENTRO
 * dele, e o wizard só monta quando `showIncidentWizard` é true. Esse estado é
 * de componente: some na remontagem. Resultado medido no aparelho em
 * 05/09/2026: o rascunho ia para o disco e voltava certinho, e ninguém o
 * buscava — o motorista reaparecia na Início como se nada tivesse acontecido.
 *
 * É a mesma lacuna que o fluxo de conclusão teve (ver
 * `useRestaurarConclusaoEmVoo`): persistir não basta se ninguém monta quem lê.
 */
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import {
  lerRascunhoIncidente,
  limparRascunhoIncidente,
  type RascunhoIncidente,
} from '@/lib/motorista/rascunhoIncidente';

/**
 * Rascunho já reaberto, no escopo do MÓDULO: Início e Paradas montam o mesmo
 * wizard, e sem a trava as duas o abririam para o mesmo rascunho. A chave
 * inclui o instante, então uma segunda interrupção volta a ser restaurável.
 */
let rascunhoJaReaberto: string | null = null;

const chaveDo = (rascunho: RascunhoIncidente) =>
  `${rascunho.paradaId}:${rascunho.em}`;

/** Só para testes: zera a trava de módulo entre casos. */
export function _resetTravaDeRestauracaoIncidente(): void {
  rascunhoJaReaberto = null;
}

export function useRestaurarRascunhoIncidente<P extends { id: string }>(
  rota: { id: string } | null,
  paradas: P[],
  aoRestaurar: (parada: P) => void,
): void {
  const aoRestaurarRef = useRef(aoRestaurar);
  aoRestaurarRef.current = aoRestaurar;

  useEffect(() => {
    // O bug é da recriação de Activity do Android.
    if (Platform.OS !== 'android') return;
    if (!rota || paradas.length === 0) return;

    let cancelado = false;

    const restaurar = async () => {
      const rascunho = await lerRascunhoIncidente();
      if (cancelado || !rascunho) return;
      if (rascunhoJaReaberto === chaveDo(rascunho)) return;

      const parada = paradas.find((p) => p.id === rascunho.paradaId);

      // Rota trocada ou parada que saiu da rota: o rascunho perdeu o contexto.
      // Apagar aqui evita o wizard abrir do nada numa próxima montagem.
      if (rascunho.rotaId !== rota.id || !parada) {
        await limparRascunhoIncidente();
        return;
      }

      if (cancelado) return;

      // Marca ANTES de abrir, para a outra tela achar a trava fechada.
      rascunhoJaReaberto = chaveDo(rascunho);
      aoRestaurarRef.current(parada);
    };

    restaurar();

    return () => {
      cancelado = true;
    };
  }, [rota, paradas]);
}
