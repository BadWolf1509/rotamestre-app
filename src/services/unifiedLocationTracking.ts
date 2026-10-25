/**
 * Serviço Unificado de Rastreamento de Localização
 *
 * Gerencia o rastreamento de localização do motorista em todos os cenários:
 * - App aberto (foreground): Alta precisão, updates frequentes
 * - App em background: Foreground Service (Android) / Background Modes (iOS)
 * - App fechado: Mantém tracking via Foreground Service (Android)
 *
 * @see https://docs.expo.dev/versions/latest/sdk/location/
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Alert } from 'react-native';

import { aguardarAppEmPrimeiroPlano } from '@/lib/appEmPrimeiroPlano';
import { lerSessao } from '@/lib/auth/sessao';
import { logarFalha } from '@/lib/logarFalha';
import { logger } from '@/lib/logger';
import { CHAVE_CONTEXTO_RASTREAMENTO } from '@/lib/motorista/contextoRastreamento';
import { registrarPosicao } from '@/lib/motorista/filaPosicoes';
import { pedirPermissao } from '@/lib/permissoes';
import { supabase } from '@/lib/supabase';
import { defaultTheme } from '@/utils/styles';

// ========================================
// CONSTANTES
// ========================================
const BACKGROUND_LOCATION_TASK = 'rotamestre-background-location';
const TRACKING_CONTEXT_KEY = CHAVE_CONTEXTO_RASTREAMENTO;

// Configurações de tracking
const CONFIG = {
  // Foreground (app aberto)
  foreground: {
    accuracy: Location.Accuracy.High,
    timeInterval: 10000, // 10 segundos
    distanceInterval: 20, // 20 metros
  },
  // Background (app minimizado/fechado)
  background: {
    accuracy: Location.Accuracy.Balanced, // Economia de bateria
    distanceInterval: 50, // 50 metros mínimo
    deferredUpdatesInterval: 30000, // 30 segundos
    deferredUpdatesDistance: 100, // 100 metros
  },
};

// ========================================
// TIPOS
// ========================================
export interface TrackingContext {
  rotaId: string;
  motoristaId: string;
  motoristaNome: string;
  startedAt: string;
}

export interface LocationPermissions {
  foreground: boolean;
  background: boolean;
}

// ========================================
// TASK DE BACKGROUND (escopo global)
// ========================================
// IMPORTANTE: Esta definição deve estar no escopo global do módulo
// e será executada quando o módulo for importado
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    logger.error('[BackgroundLocation] Task error', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = maisRecente(locations);

    if (location) {
      await saveLocationToDatabase(location, 'background');
    }
  }
});

/**
 * A leitura mais recente do lote entregue à task (pelo horário do GPS, sem
 * depender da ordem do array).
 *
 * POR QUE SÓ ELA (e não todas). O sistema agrupa leituras (no iOS, a cada
 * 30 s / 100 m; no Android, com 50 m de intervalo, o lote quase sempre tem
 * uma). Gravar a primeira deixava o marcador do gestor, que segue o último
 * INSERT, atrás de onde o motorista já estava. Gravar todas daria um trajeto
 * mais fiel, mas multiplicaria INSERTs e linhas por entrega e mudaria a
 * contagem das conferências da rota (uma por posição gravada); um ponto a
 * cada ~100 m já desenha o trajeto.
 */
function maisRecente(
  locations: Location.LocationObject[] | undefined,
): Location.LocationObject | undefined {
  if (!locations?.length) return undefined;
  return locations.reduce((recente, atual) =>
    atual.timestamp > recente.timestamp ? atual : recente,
  );
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

/**
 * Salva localização no banco de dados
 */
async function saveLocationToDatabase(
  location: Location.LocationObject,
  fonte: 'foreground' | 'background',
): Promise<void> {
  try {
    const contextStr = await AsyncStorage.getItem(TRACKING_CONTEXT_KEY);
    if (!contextStr) {
      return;
    }

    const context: TrackingContext = JSON.parse(contextStr);

    // Sem rede, a posição fica guardada no aparelho e sobe em lote com a
    // próxima que conseguir enviar (`filaPosicoes`).
    const destino = await registrarPosicao(
      {
        motorista_id: context.motoristaId,
        rota_id: context.rotaId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        velocidade: location.coords.speed ? location.coords.speed * 3.6 : null, // m/s -> km/h
        precisao: location.coords.accuracy,
        heading: location.coords.heading,
        fonte, // Identificar origem do update
      },
      location.timestamp,
      '[LocationTracking] Erro ao salvar',
    );

    posicoesAteConferir--;
    const desdeAUltima = POSICOES_ENTRE_CONFERENCIAS - posicoesAteConferir;
    const recusaConfere =
      destino === 'perdida' &&
      desdeAUltima >= POSICOES_MINIMAS_ENTRE_CONFERENCIAS;
    if (recusaConfere || posicoesAteConferir <= 0) {
      await conferirRotaDoContexto(context);
    }
  } catch (err) {
    logarFalha('[LocationTracking] Erro', err);
  }
}

// ========================================
// CONFERÊNCIA DA ROTA RASTREADA (MOT-1)
// ========================================

/**
 * Posições entre duas conferências da rota pela task de segundo plano.
 *
 * POR QUE EXISTE. Só o `completeRoute` deste aparelho parava a task. A rota
 * que terminava em outro lugar (web, outro aparelho, expiração, reatribuição)
 * seguia rastreada, e a tela, que agora também desliga
 * (`useGarantirRastreamentoDaRota`), pode nem abrir: 4 rotas concluídas com
 * 131 a 555 posições gravadas até ~21 h depois do fim.
 *
 * POR QUE 20. A configuração de segundo plano entrega uma posição a cada
 * 50 m (no iOS, agrupadas a cada 30 s / 100 m): 20 posições são ~1 km
 * rodado, de 1,5 a 10 min. Contar POSIÇÕES, e não tempo, limita
 * diretamente o que importa — o vazamento depois do fim fica em no máximo
 * 20 linhas por processo — e motorista parado não gasta consulta. 10
 * dobraria a carga (um SELECT a cada 10 INSERTs) para ganhar poucos
 * minutos; 60 deixaria vazar ~3 km de trajeto de quem já não está em rota.
 * A primeira posição de cada processo (e de cada novo rastreamento) confere
 * logo: é o caso da task restaurada horas depois do fim.
 */
export const POSICOES_ENTRE_CONFERENCIAS = 20;

/**
 * Espaçamento mínimo, em posições, entre uma conferência e a próxima
 * disparada por posição recusada (`perdida`).
 *
 * POR QUE EXISTE. Na sessão anônima permanente (refresh token revogado) toda
 * posição é recusada, e a rota nunca é dada como acabada (a sessão não se
 * confirma): sem espaçamento, cada posição fazia INSERT + SELECT +
 * `lerSessao` até o app abrir.
 *
 * POR QUE 5. ~250 m, de 20 s a 2,5 min. Corta esse custo a um quinto e
 * mantém a resposta ao 42501 de uma rota reatribuída em até 5 posições,
 * quatro vezes antes da contagem de 20. Por TEMPO (ex.: 60 s) exigiria o
 * relógio e mediria outra coisa que a contagem principal; 1 (sem
 * espaçamento) é o defeito; 10 já se aproxima da contagem de 20 e o gatilho
 * por recusa deixaria de valer a pena.
 */
export const POSICOES_MINIMAS_ENTRE_CONFERENCIAS = 5;

/** Começa em 0: a primeira posição do processo confere. */
let posicoesAteConferir = 0;
let conferenciaEmVoo: Promise<void> | null = null;

/**
 * Confere se a rota do contexto ainda está em andamento e com este motorista;
 * se não estiver, para o rastreamento. Gatilhos: a contagem acima e a
 * posição que o banco recusou (`perdida`). Desde a Migration 48 o INSERT
 * com a rota de outro motorista volta 42501 — mas um 42501 também vem de
 * token vencido, então a recusa SÓ dispara a conferência, nunca para.
 * Sem rede (ou qualquer dúvida), não para.
 */
function conferirRotaDoContexto(context: TrackingContext): Promise<void> {
  posicoesAteConferir = POSICOES_ENTRE_CONFERENCIAS;
  if (conferenciaEmVoo) return conferenciaEmVoo;
  const conferencia = (async () => {
    if (!(await rotaDoContextoAcabou(context))) return;
    // O motorista pode ter iniciado outra rota enquanto a consulta voava.
    const atual = await getTrackingContext();
    if (atual?.rotaId !== context.rotaId) return;
    logger.warn(
      '[LocationTracking] Rota rastreada não está mais em andamento; parando',
      context.rotaId,
    );
    await stopBackgroundTracking();
  })().finally(() => {
    conferenciaEmVoo = null;
  });
  conferenciaEmVoo = conferencia;
  return conferencia;
}

/** A sessão lida agora é a deste motorista. */
async function sessaoDoMotorista(motoristaId: string): Promise<boolean> {
  const { session } = await lerSessao();
  return session?.user?.id === motoristaId;
}

/** true só com certeza de que a rota acabou ou não é mais deste motorista. */
async function rotaDoContextoAcabou(context: TrackingContext): Promise<boolean> {
  try {
    // Lida ANTES do SELECT também: ver o caso "sem linha" abaixo.
    const sessaoAntes = await sessaoDoMotorista(context.motoristaId);
    const { data, error } = await supabase
      .from('rotas')
      .select('status, motorista_id')
      .eq('id', context.rotaId)
      .maybeSingle<{ status: string; motorista_id: string | null }>();
    if (error) {
      // Sem rede ou recusa passageira: na dúvida, segue rastreando.
      logarFalha('[LocationTracking] Falha ao conferir a rota rastreada', error);
      return false;
    }
    if (data) {
      return (
        data.status !== 'em_andamento' ||
        data.motorista_id !== context.motoristaId
      );
    }
    // Sem linha: rota apagada, ou reatribuída (a RLS de `rotas` esconde a
    // de outro motorista). Mas a consulta que sai anônima (refresh do token
    // falhou) também volta vazia, sem erro — só a sessão deste motorista
    // confirmada torna o "vazio" uma resposta. Antes E depois do SELECT: só
    // depois, um token renovado logo após a consulta anônima confirmaria um
    // vazio que não era resposta sobre este motorista.
    return sessaoAntes && (await sessaoDoMotorista(context.motoristaId));
  } catch (err) {
    logarFalha('[LocationTracking] Falha ao conferir a rota rastreada', err);
    return false;
  }
}

// ========================================
// API PÚBLICA
// ========================================

/**
 * Solicita permissões de localização
 * Retorna objeto com status de cada tipo de permissão
 */
export async function requestLocationPermissions(): Promise<LocationPermissions> {
  const currentForeground = await Location.getForegroundPermissionsAsync();
  let foregroundGranted = currentForeground.status === 'granted';
  if (!foregroundGranted) {
    // `pedirPermissao` só entra quando o `get` acima ainda não confirmou —
    // evita reabrir o diálogo do sistema à toa, e preserva o `canAskAgain`
    // que a chamada direta descartava.
    const resultado = await pedirPermissao(() =>
      Location.requestForegroundPermissionsAsync(),
    );
    foregroundGranted = resultado.concedida;
  }

  if (!foregroundGranted) {
    return { foreground: false, background: false };
  }

  const currentBackground = await Location.getBackgroundPermissionsAsync();
  if (currentBackground.status === 'granted') {
    return { foreground: true, background: true };
  }

  // Exigência de divulgação destacada do Google Play: explicar, dentro do app
  // e antes do diálogo do Android, o uso quando o app não está em uso.
  const acceptedDisclosure = await showBackgroundLocationDisclosure();
  if (!acceptedDisclosure) {
    return { foreground: true, background: false };
  }

  const { concedida: backgroundGranted } = await pedirPermissao(() =>
    Location.requestBackgroundPermissionsAsync(),
  );

  return { foreground: foregroundGranted, background: backgroundGranted };
}

export function showBackgroundLocationDisclosure(): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (value: boolean) => {
      if (!resolved) {
        resolved = true;
        resolve(value);
      }
    };

    Alert.alert(
      'Localização durante a rota',
      'Durante uma rota ativa, o Rota Mestre coleta e envia sua localização mesmo quando o app está fechado ou não está em uso. Isso mantém a navegação funcionando e permite que o gestor da sua empresa acompanhe a entrega em tempo real. A coleta para quando a rota é pausada ou encerrada.',
      [
        {
          text: 'Agora não',
          style: 'cancel',
          onPress: () => finish(false),
        },
        {
          text: 'Continuar',
          onPress: () => finish(true),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => finish(false),
      },
    );
  });
}

/**
 * Verifica status atual das permissões
 */
export async function checkLocationPermissions(): Promise<LocationPermissions> {
  const { status: foregroundStatus } =
    await Location.getForegroundPermissionsAsync();
  const { status: backgroundStatus } =
    await Location.getBackgroundPermissionsAsync();

  return {
    foreground: foregroundStatus === 'granted',
    background: backgroundStatus === 'granted',
  };
}

/**
 * Na primeira conferência de cada processo, a task já registrada é registrada
 * de novo — ver `garantirRastreamentoDaRota`. `true` depois de qualquer início
 * bem-sucedido neste processo.
 */
let taskConfirmadaNesteProcesso = false;

/**
 * Registra a task com o serviço em primeiro plano. Registrar uma task que já
 * existe não a duplica: o `expo-task-manager` só atualiza as opções, e o
 * `expo-location` sobe o serviço se ele não estiver rodando.
 */
async function iniciarTask(): Promise<void> {
  // Configuração do tracking
  const options: Location.LocationTaskOptions = {
    accuracy: CONFIG.background.accuracy,
    distanceInterval: CONFIG.background.distanceInterval,
    deferredUpdatesInterval: CONFIG.background.deferredUpdatesInterval,
    deferredUpdatesDistance: CONFIG.background.deferredUpdatesDistance,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,

    // iOS: Tipo de atividade para otimização
    activityType: Location.ActivityType.AutomotiveNavigation,

    // Android: Foreground Service com notificação persistente
    foregroundService: {
      notificationTitle: '🚗 RotaMestre - Em rota',
      notificationBody: `Rastreando entrega`,
      notificationColor: defaultTheme.colors.primary,
    },
  };

  // #570: o pedido de permissão do `requestAndStartTracking` tira o app da
  // tela por uma fração de segundo, e o Android 12+ recusa o serviço em
  // primeiro plano iniciado nessa janela.
  await aguardarAppEmPrimeiroPlano();
  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, options);
  taskConfirmadaNesteProcesso = true;
}

/**
 * Inicia o rastreamento em background
 * Chamado quando o motorista inicia uma rota
 */
export async function startBackgroundTracking(
  context: TrackingContext,
): Promise<boolean> {
  try {
    // Verificar permissões
    const permissions = await checkLocationPermissions();
    if (!permissions.foreground) {
      logger.warn('[LocationTracking] Sem permissão de foreground');
      return false;
    }

    // Salvar contexto para uso na task de background
    await AsyncStorage.setItem(TRACKING_CONTEXT_KEY, JSON.stringify(context));

    // Verificar se já está rastreando
    const isTracking = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
    if (isTracking) {
      return true;
    }

    // Se não tem permissão de background, apenas salvar contexto
    // O hook useDriverLocationBroadcast cuidará do foreground
    if (!permissions.background) {
      return true;
    }

    await iniciarTask();

    return true;
  } catch (err) {
    logger.error('[LocationTracking] Erro ao iniciar', err);
    return false;
  }
}

/**
 * Para o rastreamento em background
 * Chamado quando o motorista finaliza ou pausa a rota
 */
export async function stopBackgroundTracking(): Promise<void> {
  try {
    const isTracking = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
    if (isTracking) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch (err) {
    logger.error('[LocationTracking] Erro ao parar', err);
  } finally {
    // Mesmo se parar a task falhar: o contexto é o que diz DE QUEM é a
    // posição, e uma task que sobrou não pode seguir com o de quem saiu.
    taskConfirmadaNesteProcesso = false;
    // O próximo rastreamento confere já na primeira posição, também quando
    // parar falhou: senão herdaria a contagem da rota anterior.
    posicoesAteConferir = 0;
    try {
      await AsyncStorage.removeItem(TRACKING_CONTEXT_KEY);
    } catch (err) {
      logger.error('[LocationTracking] Erro ao apagar o contexto', err);
    }
  }
}

/**
 * Verifica se o rastreamento em background está ativo
 */
export async function isBackgroundTrackingActive(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
  } catch (error) {
    logger.warn(
      '[LocationTracking] Falha ao verificar task de localização',
      error,
    );
    return false;
  }
}

/**
 * Obtém o contexto de rastreamento atual
 */
export async function getTrackingContext(): Promise<TrackingContext | null> {
  try {
    const contextStr = await AsyncStorage.getItem(TRACKING_CONTEXT_KEY);
    return contextStr ? JSON.parse(contextStr) : null;
  } catch (error) {
    logger.warn(
      '[LocationTracking] Falha ao ler contexto de localização',
      error,
    );
    return null;
  }
}

/**
 * Atualiza o contexto de rastreamento
 * Útil para atualizar informações sem reiniciar o tracking
 */
export async function updateTrackingContext(
  updates: Partial<TrackingContext>,
): Promise<void> {
  try {
    const current = await getTrackingContext();
    if (current) {
      await AsyncStorage.setItem(
        TRACKING_CONTEXT_KEY,
        JSON.stringify({ ...current, ...updates }),
      );
    }
  } catch (err) {
    logger.error('[LocationTracking] Erro ao atualizar contexto', err);
  }
}

export type ResultadoGarantia =
  /** A task já estava registrada; nada foi iniciado. */
  | 'ativo'
  /** A task tinha sumido e foi religada sem pedir nada ao motorista. */
  | 'religado'
  /** Falta "Permitir o tempo todo": só o fluxo que o motorista aciona pede. */
  | 'sem-segundo-plano'
  /** Sem localização nenhuma — o aviso da Início já cobre esse caso. */
  | 'sem-permissao'
  | 'falhou';

/**
 * Garante o rastreamento em segundo plano de uma rota que JÁ está em
 * andamento, sem pedir nada.
 *
 * POR QUE EXISTE. Só o `startRoute` ligava a task. Num reinício normal ela
 * sobrevive (o `expo-task-manager` a restaura), mas numa reinstalação ou
 * limpeza de dados no meio da rota a task e o contexto somem juntos e nada os
 * religava: medido em 08/09/2026, nenhum serviço de localização rodando e o
 * gestor sem a posição do motorista, em silêncio.
 *
 * Roda na abertura e em cada volta ao primeiro plano, então é só consulta:
 * nunca chama `request…PermissionsAsync` nem a divulgação destacada — essa
 * fica no `requestAndStartTracking`, que só o toque do motorista dispara.
 */
export async function garantirRastreamentoDaRota(
  context: TrackingContext,
): Promise<ResultadoGarantia> {
  try {
    // A mesma rota mantém o contexto gravado (o `startedAt` é o original);
    // contexto ausente ou de outra rota é trocado.
    const gravado = await getTrackingContext();
    const contexto = gravado?.rotaId === context.rotaId ? gravado : context;

    const jaRodando = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
    if (jaRodando) {
      if (contexto !== gravado) {
        await AsyncStorage.setItem(
          TRACKING_CONTEXT_KEY,
          JSON.stringify(contexto),
        );
      }
      // Registrada não quer dizer rodando: num reinício a frio (force-stop,
      // reboot, processo morto) o `expo-task-manager` restaura a task antes de
      // o app estar na tela, e o `expo-location` recusa o serviço ("Foreground
      // location task cannot be started while the app is in the
      // background!"). Medido em 21/10/2026: task restaurada, nenhum
      // `LocationTaskService`. Registrar de novo, com o app ativo, sobe o
      // serviço — uma vez por processo basta, ele não cai sem o processo.
      if (!taskConfirmadaNesteProcesso) {
        const permissoes = await checkLocationPermissions();
        if (permissoes.foreground && permissoes.background) {
          await iniciarTask();
        }
      }
      return 'ativo';
    }

    const permissoes = await checkLocationPermissions();
    if (!permissoes.foreground) return 'sem-permissao';
    if (!permissoes.background) {
      // Grava o contexto mesmo assim: o broadcast de primeiro plano o usa.
      await AsyncStorage.setItem(
        TRACKING_CONTEXT_KEY,
        JSON.stringify(contexto),
      );
      return 'sem-segundo-plano';
    }

    // `startBackgroundTracking` devolve `false` quando o Android recusa o
    // serviço (a exceção é logada lá dentro).
    return (await startBackgroundTracking(contexto)) ? 'religado' : 'falhou';
  } catch (error) {
    logger.warn('[LocationTracking] Falha ao garantir o rastreamento', error);
    return 'falhou';
  }
}

/**
 * Solicita permissões e inicia tracking com UI amigável
 * Mostra alertas explicativos para o usuário
 */
export async function requestAndStartTracking(
  context: TrackingContext,
): Promise<{ started: boolean; hasBackgroundPermission: boolean }> {
  // Solicitar permissões
  const permissions = await requestLocationPermissions();

  if (!permissions.foreground) {
    Alert.alert(
      'Permissão Necessária',
      'O RotaMestre precisa acessar sua localização para rastrear as entregas. Por favor, ative a localização nas configurações.',
      [{ text: 'OK' }],
    );
    return { started: false, hasBackgroundPermission: false };
  }

  // Iniciar tracking
  const started = await startBackgroundTracking(context);

  if (started && !permissions.background) {
    // Informar limitação
    Alert.alert(
      'Rastreamento Limitado',
      'Sem permissão de localização em segundo plano, o gestor só poderá acompanhar sua rota enquanto o app estiver aberto.\n\nPara rastreamento contínuo, ative "Sempre" nas configurações de localização.',
      [{ text: 'Entendi' }],
    );
  }

  return { started, hasBackgroundPermission: permissions.background };
}

// Tipos já exportados no início do arquivo:
// - TrackingContext (linha 45)
// - LocationPermissions (linha 52)
