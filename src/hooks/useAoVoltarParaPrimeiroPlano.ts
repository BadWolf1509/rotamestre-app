/**
 * Chama `aoVoltar` quando o app volta ao primeiro plano.
 *
 * POR QUE EXISTE. Com o app em segundo plano o socket do Realtime cai, e o
 * evento que passou nesse intervalo não é reenviado na reconexão: a tela do
 * gestor ficava com o dado de quando ele saiu (DP-2). Quem assina Realtime
 * revalida aqui, além de no `SUBSCRIBED` da reconexão.
 *
 * Só na transição (de `background`/`inactive` para `active`): um `active`
 * repetido não é volta. O callback vive numa ref — os chamadores passam função
 * inline, e como dependência ela reinscreveria o listener a cada render.
 */
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export function useAoVoltarParaPrimeiroPlano(
  aoVoltar: () => void,
  ativo = true,
): void {
  const aoVoltarRef = useRef(aoVoltar);

  // Declarado antes do efeito da inscrição: efeitos rodam em ordem.
  useEffect(() => {
    aoVoltarRef.current = aoVoltar;
  }, [aoVoltar]);

  useEffect(() => {
    if (!ativo) return;
    let anterior: AppStateStatus | null = AppState.currentState ?? null;
    const assinatura = AppState.addEventListener(
      'change',
      (estado: AppStateStatus) => {
        const voltou = estado === 'active' && anterior !== 'active';
        anterior = estado;
        if (voltou) aoVoltarRef.current();
      },
    );
    return () => assinatura.remove();
  }, [ativo]);
}
