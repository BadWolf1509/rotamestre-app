import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Alert } from 'react-native';

import { aguardarAppEmPrimeiroPlano } from '@/lib/appEmPrimeiroPlano';
import { isNetworkError } from '@/lib/errorMapping';
import { logarFalha } from '@/lib/logarFalha';
import { logger } from '@/lib/logger';
import { registrarPosicao } from '@/lib/motorista/filaPosicoes';
import { maisRecente } from '@/lib/motorista/posicaoMaisRecente';
import {
  PREFERENCIAS_PADRAO,
  type ModoNavegar,
  type NavigationState,
  type PreferenciasDeNavegacao,
} from '@/lib/motorista/preferenciasNavegacaoPadrao';
import { supabase } from '@/lib/supabase';
import {
  checkLocationPermissions,
  isBackgroundTrackingActive,
} from '@/services/unifiedLocationTracking';
import { defaultTheme } from '@/utils/styles';

// Task name for background location
const LOCATION_TASK = 'background-location-tracking';

// Configuration constants
const GEOFENCE_RADIUS = 50; // raio padrão (m); a tela da web o usa como chegada

interface LocationUpdate {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number;
  heading?: number;
}

/** Coordenadas e endereço da parada-alvo, como o chamador já os tem. */
export interface DestinoDaParada {
  latitude: number;
  longitude: number;
  endereco?: string;
}

function destinoValido(
  destino: DestinoDaParada | undefined,
): destino is DestinoDaParada {
  return (
    !!destino &&
    Number.isFinite(destino.latitude) &&
    Number.isFinite(destino.longitude)
  );
}

export { PREFERENCIAS_PADRAO };
export type { ModoNavegar, NavigationState, PreferenciasDeNavegacao };

class LocationTrackingService {
  private static instance: LocationTrackingService;
  private navigationState: NavigationState | null = null;

  private constructor() {}

  static getInstance(): LocationTrackingService {
    if (!LocationTrackingService.instance) {
      LocationTrackingService.instance = new LocationTrackingService();
    }
    return LocationTrackingService.instance;
  }

  /**
   * Liga o modo navegação para a parada atual — ou, se já estiver ligado, só
   * troca o alvo do geofence.
   *
   * - **Só CONSULTA permissão, nunca pede.** O motorista está dirigindo: o
   *   pedido abria a activity do sistema (e o aviso de segundo plano) no meio
   *   da rua e tirava o app da tela, o que derruba serviço em primeiro plano no
   *   Android 12+. Quem pede é o início da rota (`requestAndStartTracking`).
   * - **Não sobe um 2º serviço em primeiro plano.** Se o rastreamento da rota
   *   (`rotamestre-background-location`) já roda, ele é reaproveitado: o GPS e
   *   a notificação já existem, e as posições já são gravadas por ele. Se o
   *   serviço deste modo já roda (troca de parada), só o alvo muda. Com o
   *   serviço da rota no lugar, o aviso de chegada deste modo não roda — hoje
   *   ele não exibe nada (`sendNotification` é um marcador), e o modo navegação
   *   mede a distância pela tela.
   */
  async startTracking(
    rotaId: string,
    currentStopId: string,
    nextStopId?: string,
    destino?: DestinoDaParada,
  ) {
    try {
      const permissions = await checkLocationPermissions();
      if (!permissions.foreground) {
        throw new Error('Permissão de localização negada');
      }

      if (!permissions.background) {
        logger.warn(
          '[LocationTracking] Background location permission not granted',
        );
      }

      // Load navigation preferences
      const prefs = await this.getNavigationPreferences();

      // O chamador já tem a parada: só vai ao servidor se faltar coordenada.
      // Sem rede a busca volta null, e o "Parada não encontrada" virava um
      // alerta falso de erro de rastreamento (moto g15, modo avião, 24/10).
      let stopData: DestinoDaParada | null = destinoValido(destino)
        ? destino
        : null;
      if (!stopData) {
        const { data, error } = await supabase
          .from('paradas')
          .select('latitude, longitude, endereco')
          .eq('id', currentStopId)
          .single();
        if (data) {
          stopData = data;
        } else if (error && isNetworkError(error)) {
          // Sem rede e sem coordenadas: não é falha de rastreamento. Segue sem
          // geofence; a próxima troca de parada (ou volta da rede) refaz.
          logger.warn(
            '[LocationTracking] Sem rede e sem coordenadas da parada; seguindo sem geofence',
            error,
          );
        } else {
          throw new Error('Parada não encontrada');
        }
      }

      // Update navigation state
      this.navigationState = {
        enabled: true,
        navegarCom: prefs.navegarCom,
        soundAlerts: prefs.soundAlerts ?? true,
        vibrationAlerts: prefs.vibrationAlerts ?? true,
        proximityRadius: prefs.proximityRadius ?? GEOFENCE_RADIUS,
        rotaId,
        currentStopId,
        nextStopId,
        currentStopLocation: stopData
          ? { latitude: stopData.latitude, longitude: stopData.longitude }
          : undefined,
      };

      // Sem alvo não há o que medir: não sobe serviço em primeiro plano.
      if (!stopData) return true;

      // Já há serviço em primeiro plano com GPS: só o alvo mudou.
      const jaRodando =
        (await isBackgroundTrackingActive()) ||
        (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK));
      if (jaRodando) return true;

      // O Android 12+ recusa iniciar serviço em primeiro plano com o app fora
      // da tela — e um pedido de permissão (de outra tela) tira o app da tela
      // por uma fração de segundo.
      await aguardarAppEmPrimeiroPlano();

      // Start background location updates
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 5000, // Update every 5 seconds
        distanceInterval: 10, // Or every 10 meters
        foregroundService: {
          notificationTitle: 'RotaMestre - Navegação Ativa',
          notificationBody: stopData.endereco
            ? `Navegando para ${stopData.endereco}`
            : 'Navegando para a parada',
          notificationColor: defaultTheme.colors.primary,
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      });

      return true;
    } catch (error) {
      logger.error(
        '[LocationTracking] Error starting location tracking',
        error,
      );
      Alert.alert(
        'Erro',
        'Não foi possível iniciar o rastreamento de localização',
      );
      return false;
    }
  }

  // Stop tracking
  async stopTracking() {
    try {
      const hasTask =
        await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
      if (hasTask) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK);
      }

      this.navigationState = null;

      return true;
    } catch (error) {
      logger.error(
        '[LocationTracking] Error stopping location tracking',
        error,
      );
      return false;
    }
  }

  // Check if tracking is active
  async isTracking(): Promise<boolean> {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  }

  /**
   * Grava a posição recebida pela task deste modo. Não há aviso de chegada no
   * nativo: ele não exibia nada (o corpo era vazio), e o modo navegação já
   * avisa por vibração e pulso. Concluir a parada é só do `StopCompletionFlow`.
   */
  async processLocationUpdate(location: LocationUpdate) {
    if (!this.navigationState?.currentStopLocation) return;
    await this.updateDriverPosition(location);
  }

  // Update driver position in database
  private async updateDriverPosition(location: LocationUpdate) {
    if (!this.navigationState?.rotaId) return;

    try {
      // Usuário da sessão local. `getUser()` faria um GET /auth/v1/user a
      // cada posição; o token já é validado pelo RLS do insert.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      // Inserir em motorista_locations para histórico e rastreamento em tempo
      // real. Sem rede, a posição fica guardada no aparelho e sobe em lote com
      // a próxima que conseguir enviar (`filaPosicoes`).
      await registrarPosicao(
        {
          motorista_id: user.id,
          rota_id: this.navigationState.rotaId,
          latitude: location.latitude,
          longitude: location.longitude,
          velocidade: location.speed ? location.speed * 3.6 : null, // m/s para km/h
          precisao: location.accuracy,
          heading: location.heading ?? null,
        },
        location.timestamp,
        '[LocationTracking] Erro ao salvar localização',
      );
    } catch (error) {
      logarFalha('[LocationTracking] Error updating driver position', error);
    }
  }

  /**
   * Converte a chave antiga `autoAdvance` (até a 1.12.8) em `navegarCom`.
   * Desligada significava "abrir o app externo" e vira "externo"; ligada era
   * o padrão e só sai do storage, para o padrão continuar vivo. `navegarCom`
   * já salvo vence. A chave antiga nunca sai daqui.
   */
  private converterChaveAntiga(
    salvas: Partial<NavigationState> & { autoAdvance?: unknown },
  ): Partial<NavigationState> {
    const { autoAdvance, ...resto } = salvas;
    if (resto.navegarCom || autoAdvance !== false) return resto;
    return { ...resto, navegarCom: 'externo' };
  }

  /**
   * O que está REALMENTE salvo, sem os padrões por cima.
   *
   * Existe só para o caminho de escrita. Se `updateNavigationPreferences`
   * mesclasse sobre o objeto já preenchido, gravaria os padrões de hoje no
   * storage — e um padrão que mudasse numa versão futura nunca alcançaria
   * quem tivesse tocado em qualquer ajuste. Guardar só o que a pessoa
   * escolheu mantém os padrões vivos.
   */
  private async lerPreferenciasCruas(): Promise<Partial<NavigationState>> {
    try {
      const prefs = await AsyncStorage.getItem('navigationPreferences');
      return prefs ? this.converterChaveAntiga(JSON.parse(prefs)) : {};
    } catch {
      return {};
    }
  }

  /**
   * Preferências de navegação, SEMPRE completas.
   *
   * POR QUE O DEFAULT MORA AQUI. Isto devolvia `Partial<NavigationState>` e um
   * `{}` quando nada estava salvo, deixando cada consumidor preencher o resto,
   * e as cópias de default que cada um carregava discordavam do serviço: a
   * tela mostrava a opção ligada enquanto `handleNavigateToStop` lia
   * `undefined` e mandava o motorista para o app externo.
   * As cópias foram apagadas: tela e hook leem `PREFERENCIAS_PADRAO`
   * (`@/lib/motorista/preferenciasNavegacaoPadrao`), a mesma tabela daqui.
   *
   * Com o default na fonte, esquecer deixa de ser possível.
   */
  async getNavigationPreferences(): Promise<PreferenciasDeNavegacao> {
    try {
      const prefs = await AsyncStorage.getItem('navigationPreferences');
      const salvas = prefs ? this.converterChaveAntiga(JSON.parse(prefs)) : {};
      return { ...PREFERENCIAS_PADRAO, ...salvas };
    } catch {
      // Storage corrompido cai no padrão, e não em `{}`: devolver vazio aqui
      // seria o mesmo defeito por outro caminho — um consumidor sem default
      // leria "tudo desligado".
      return { ...PREFERENCIAS_PADRAO };
    }
  }

  // Update navigation preferences
  async updateNavigationPreferences(prefs: Partial<NavigationState>) {
    try {
      const current = await this.lerPreferenciasCruas();
      const updated = { ...current, ...prefs };
      await AsyncStorage.setItem(
        'navigationPreferences',
        JSON.stringify(updated),
      );

      // Update current state if tracking
      if (this.navigationState) {
        this.navigationState = { ...this.navigationState, ...prefs };
      }
    } catch (error) {
      logger.error('[LocationTracking] Error updating preferences', error);
    }
  }

  /**
   * "Restaurar Padrões": APAGA o que foi salvo, em vez de gravar os padrões.
   * Gravá-los os congelaria no storage — um padrão alterado numa versão
   * futura nunca alcançaria quem tivesse restaurado (ver
   * `lerPreferenciasCruas`). A leitura já completa tudo com
   * `PREFERENCIAS_PADRAO`.
   */
  async restaurarPreferenciasPadrao() {
    try {
      await AsyncStorage.removeItem('navigationPreferences');

      // A sessão em curso (lida pela task de segundo plano) volta aos padrões.
      if (this.navigationState) {
        this.navigationState = {
          ...this.navigationState,
          ...PREFERENCIAS_PADRAO,
        };
      }
    } catch (error) {
      logger.error('[LocationTracking] Error restoring preferences', error);
    }
  }
}

// Background task definition
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    logger.error('[LocationTracking] Background location error', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = maisRecente(locations);

    if (location) {
      const service = LocationTrackingService.getInstance();
      await service.processLocationUpdate({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy ?? 0,
        timestamp: location.timestamp,
        speed: location.coords.speed ?? undefined,
        heading: location.coords.heading ?? undefined,
      });
    }
  }
});

export default LocationTrackingService.getInstance();
