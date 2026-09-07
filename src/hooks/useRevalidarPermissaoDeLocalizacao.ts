/**
 * Reconsulta a permissão de localização quando o app volta ao foreground.
 *
 * POR QUE EXISTE. Os efeitos de permissão deste app rodam uma vez por
 * montagem, e voltar do foreground **não** remonta a Activity — o Android só
 * recria sob pressão de memória. Sem isto, o motorista que toca em "Abrir
 * Configurações", concede a permissão e volta encontra exatamente o estado que
 * deixou: watcher desligado, mapa sem posição, e o aviso ainda na tela pedindo
 * para ativar o que ele acabou de ativar.
 *
 * Usa `getForegroundPermissionsAsync` — o "get", que NÃO abre diálogo. Chamar
 * o "request" aqui transformaria cada retorno ao app num pedido de permissão,
 * que é assédio e faz o Android bloquear mais rápido.
 */
import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { logger } from '@/lib/logger';

export function useRevalidarPermissaoDeLocalizacao(
  aoRevalidar: (concedida: boolean) => void,
): void {
  // O callback vive numa ref: os chamadores passam funções inline, e uma
  // dependência de identidade reinscreveria o listener a cada render.
  const aoRevalidarRef = useRef(aoRevalidar);

  // Declarado ANTES do efeito da inscrição: efeitos rodam na ordem de
  // declaração, então a ref já está atualizada quando o listener monta.
  useEffect(() => {
    aoRevalidarRef.current = aoRevalidar;
  }, [aoRevalidar]);

  useEffect(() => {
    const assinatura = AppState.addEventListener(
      'change',
      (estado: AppStateStatus) => {
        if (estado !== 'active') return;

        void (async () => {
          try {
            const { status } = await Location.getForegroundPermissionsAsync();
            aoRevalidarRef.current(status === 'granted');
          } catch (error) {
            // Não-crítico: se a consulta falhar, o estado anterior permanece.
            // Errar para "continua negado" é o lado seguro — no máximo o
            // motorista toca de novo.
            logger.warn(
              '[useRevalidarPermissaoDeLocalizacao] Falha ao reconsultar',
              error,
            );
          }
        })();
      },
    );

    return () => assinatura.remove();
  }, []);
}
