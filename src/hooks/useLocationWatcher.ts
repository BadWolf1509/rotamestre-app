/**
 * Dono único do ciclo de vida de um `Location.watchPositionAsync`.
 *
 * POR QUE EXISTE. Cinco arquivos deste repo criavam a assinatura dentro de
 * uma função `async` e a guardavam numa variável do escopo do efeito. Como a
 * atribuição fica depois de um `await`, o cleanup lê `null` quando a
 * desmontagem ganha a corrida — e a assinatura criada em seguida nunca é
 * removida. Um watcher `BestForNavigation` órfão consome GPS até o processo
 * morrer.
 *
 * E a corrida não era rara: as deps do efeito do watcher em
 * `TurnByTurnNavigation` incluíam `destination`, um literal inline vindo de
 * `NavigationMode`, que ganhava identidade nova a cada tick de GPS. O efeito
 * remontava uma vez por segundo, dirigindo.
 *
 * A SUTILEZA: a flag `cancelado` sozinha não resolve. Sem o `s.remove()` no
 * ramo cancelado, a assinatura nasce órfã do mesmo jeito — só que agora com
 * um `if` que dá a impressão de tratar o caso.
 */
import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';

import { logger } from '@/lib/logger';

export interface OpcoesDoWatcher {
  accuracy: Location.LocationAccuracy;
  timeInterval: number;
  distanceInterval: number;
}

export interface ParametrosDoWatcher {
  /** `false` não cria watcher; o cleanup do ciclo anterior já removeu o antigo. */
  enabled: boolean;
  options: OpcoesDoWatcher;
  onLocation: (location: Location.LocationObject) => void;
}

export function useLocationWatcher({
  enabled,
  options,
  onLocation,
}: ParametrosDoWatcher): void {
  // O callback vive numa ref, e não nas dependências: os chamadores passam
  // funções inline, e uma dependência de identidade recriaria o watcher a
  // cada render — que é o defeito que este hook existe para não ter.
  const onLocationRef = useRef(onLocation);

  // Declarado ANTES do efeito do watcher: efeitos rodam na ordem de
  // declaração, então a ref já está atualizada quando o watcher monta.
  useEffect(() => {
    onLocationRef.current = onLocation;
  }, [onLocation]);

  // Mesmo motivo, para as opções: os chamadores passam literais.
  const { accuracy, timeInterval, distanceInterval } = options;

  useEffect(() => {
    if (!enabled) return;

    let cancelado = false;
    let sub: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const s = await Location.watchPositionAsync(
          { accuracy, timeInterval, distanceInterval },
          (location) => onLocationRef.current(location),
        );
        if (cancelado) {
          // A metade que faltava nos cinco call sites originais.
          s.remove();
          return;
        }
        sub = s;
      } catch (error) {
        logger.warn('[useLocationWatcher] Falha ao iniciar o watcher', error);
      }
    })();

    return () => {
      cancelado = true;
      try {
        sub?.remove();
      } catch (error) {
        // expo-location: remove() não se comporta bem na web.
        logger.warn('[useLocationWatcher] Falha ao remover o watcher', error);
      }
    };
  }, [enabled, accuracy, timeInterval, distanceInterval]);
}
