/**
 * Aviso de uso de bateria "Restrito" durante a rota em andamento.
 *
 * Com a restrição, o Android mata o serviço de localização e descarta o push
 * assim que o app sai da tela (ver `src/lib/restricaoSegundoPlano.ts`). Confere
 * na montagem e a cada volta ao primeiro plano — é assim que o aviso some
 * quando o motorista volta das configurações já sem a restrição.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import {
  abrirUsoDeBateriaDoApp,
  appComSegundoPlanoRestrito,
} from '@/lib/restricaoSegundoPlano';

interface Opcoes {
  /** Rota em andamento: fora dela, o segundo plano não importa. */
  ativa: boolean;
}

export interface BateriaRestrita {
  avisoVisivel: boolean;
  abrirConfiguracoes: () => Promise<void>;
  dispensar: () => void;
}

export function useBateriaRestrita({ ativa }: Opcoes): BateriaRestrita {
  const [restrito, setRestrito] = useState(false);
  // Dispensar vale enquanto a tela vive: sem isto, cada volta ao primeiro
  // plano (bloquear/desbloquear a tela já conta) reabriria o aviso.
  const [dispensado, setDispensado] = useState(false);

  const verificar = useCallback(() => {
    setRestrito(ativa && appComSegundoPlanoRestrito());
  }, [ativa]);

  useEffect(() => {
    verificar();
  }, [verificar]);

  useEffect(() => {
    if (!ativa) return;
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') verificar();
    });
    return () => assinatura.remove();
  }, [ativa, verificar]);

  const dispensar = useCallback(() => setDispensado(true), []);

  const avisoVisivel = restrito && !dispensado;

  return useMemo(
    () => ({
      avisoVisivel,
      abrirConfiguracoes: abrirUsoDeBateriaDoApp,
      dispensar,
    }),
    [avisoVisivel, dispensar],
  );
}
