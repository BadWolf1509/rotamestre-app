/**
 * Uso de bateria "Restrito" no Android: o app não roda em segundo plano.
 *
 * POR QUE EXISTE. Medido no moto g15 (22/10/2026): com o uso de bateria do app
 * em "Restrito" (`appops RUN_ANY_IN_BACKGROUND: ignore`), o Android mata o
 * serviço de localização e descarta o push (GCM `result=CANCELLED`) — o gestor
 * perde o motorista sem nenhum sinal na tela.
 *
 * POR QUE UM MÓDULO NATIVO PRÓPRIO (`modules/restricao-segundo-plano`). Só o
 * `ActivityManager.isBackgroundRestricted()` (API 28+) responde a pergunta. O
 * `expo-battery` expõe `isIgnoringBatteryOptimizations`, que dá o mesmo
 * resultado para "Otimizado" (o padrão de toda instalação) e "Restrito": o
 * aviso apareceria para todo motorista. E a tela de bateria do app
 * (`VIEW_ADVANCED_POWER_USAGE_DETAIL`) precisa de URI de dados, que o
 * `Linking.sendIntent` do RN não passa.
 *
 * O módulo é opcional: um binário sem ele (iOS, web, ou uma OTA sobre binário
 * antigo) responde "sem restrição" e abre as configurações gerais do app.
 */
import { requireOptionalNativeModule } from 'expo';
import { Linking, Platform } from 'react-native';

import { logger } from '@/lib/logger';

interface ModuloRestricaoSegundoPlano {
  estaRestrito(): boolean;
  abrirUsoDeBateria(): Promise<void>;
}

function obterModulo(): ModuloRestricaoSegundoPlano | null {
  if (Platform.OS !== 'android') return null;
  return requireOptionalNativeModule<ModuloRestricaoSegundoPlano>(
    'RestricaoSegundoPlano',
  );
}

export function appComSegundoPlanoRestrito(): boolean {
  const modulo = obterModulo();
  if (!modulo) return false;
  try {
    return modulo.estaRestrito();
  } catch (erro) {
    logger.warn('[Bateria] Falha ao consultar a restrição', erro);
    return false;
  }
}

export async function abrirUsoDeBateriaDoApp(): Promise<void> {
  const modulo = obterModulo();
  if (modulo) {
    try {
      await modulo.abrirUsoDeBateria();
      return;
    } catch (erro) {
      logger.warn('[Bateria] Tela de bateria do app indisponível', erro);
    }
  }
  await Linking.openSettings();
}
