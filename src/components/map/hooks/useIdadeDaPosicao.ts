/**
 * Idade da posição do motorista ("há 12 min"), que anda sozinha.
 *
 * O texto antigo era calculado só quando chegava posição nova: o motorista
 * sem sinal ficava "agora" para sempre, justo quando a idade importa. Aqui um
 * relógio de 30 s recalcula; como o texto vai ao estado, o tick que não o
 * muda não re-renderiza (o React descarta o mesmo valor). O timer é limpo ao
 * desmontar e não existe sem posição.
 */
import { useEffect, useState } from 'react';

import {
  formatarIdadeDaPosicao,
  INTERVALO_IDADE_DA_POSICAO_MS,
} from '@/lib/motorista/posicaoDoMotorista';

function calcular(timestamp: string | null | undefined): string {
  return timestamp ? formatarIdadeDaPosicao(timestamp, Date.now()) : '';
}

export function useIdadeDaPosicao(
  timestamp: string | null | undefined,
): string {
  const [texto, setTexto] = useState(() => calcular(timestamp));
  const [timestampDoTexto, setTimestampDoTexto] = useState(timestamp);

  // Posição nova: recalcula já neste render, sem esperar o próximo tick.
  if (timestamp !== timestampDoTexto) {
    setTimestampDoTexto(timestamp);
    setTexto(calcular(timestamp));
  }

  useEffect(() => {
    if (!timestamp) return;
    const relogio = setInterval(() => {
      setTexto(calcular(timestamp));
    }, INTERVALO_IDADE_DA_POSICAO_MS);
    return () => clearInterval(relogio);
  }, [timestamp]);

  return texto;
}
