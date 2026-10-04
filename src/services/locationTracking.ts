import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Alert } from 'react-native';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { requestLocationPermissions } from '@/services/unifiedLocationTracking';
import { defaultTheme } from '@/utils/styles';

// Task name for background location
const LOCATION_TASK = 'background-location-tracking';

// Configuration constants
const GEOFENCE_RADIUS = 50; // meters to consider "arrived" at stop
const MIN_ACCURACY = 50; // minimum accuracy in meters to consider position valid

interface LocationUpdate {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number;
  heading?: number;
}

interface NavigationState {
  enabled: boolean;
  autoAdvance: boolean;
  soundAlerts: boolean;
  vibrationAlerts: boolean;
  proximityRadius: number;
  // Extended preferences from NavigationSettings
  showSpeedometer?: boolean;
  preventScreenSleep?: boolean;
  // Unified preferences (migrated from configuracoes.tsx)
  preferredNavApp?: 'waze' | 'google_maps' | 'apple_maps' | 'default';
  // Navigation session state
  rotaId?: string;
  currentStopId?: string;
  nextStopId?: string;
  currentStopLocation?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * As preferências com todas as chaves obrigatórias — o que
 * `getNavigationPreferences` devolve.
 */
export type PreferenciasDeNavegacao = NavigationState &
  Required<
    Pick<
      NavigationState,
      'showSpeedometer' | 'preventScreenSleep' | 'preferredNavApp'
    >
  >;

/**
 * Fonte única dos padrões. Antes existiam duas cópias, em componentes
 * diferentes; elas concordavam por sorte, não por construção.
 */
export const PREFERENCIAS_PADRAO: PreferenciasDeNavegacao = {
  enabled: true,
  autoAdvance: true,
  soundAlerts: true,
  vibrationAlerts: true,
  proximityRadius: 50,
  showSpeedometer: true,
  preventScreenSleep: true,
  preferredNavApp: 'default',
};

class LocationTrackingService {
  private static instance: LocationTrackingService;
  private navigationState: NavigationState | null = null;
  /** Parada cuja chegada já foi anunciada — evita repetir a cada leitura de GPS. */
  private chegadaAnunciadaPara: string | null = null;
  private lastNotificationTime: number = 0;

  private constructor() {}

  static getInstance(): LocationTrackingService {
    if (!LocationTrackingService.instance) {
      LocationTrackingService.instance = new LocationTrackingService();
    }
    return LocationTrackingService.instance;
  }

  // Initialize and start tracking
  async startTracking(
    rotaId: string,
    currentStopId: string,
    nextStopId?: string,
  ) {
    try {
      const permissions = await requestLocationPermissions();
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

      // Get current stop details
      const { data: stopData } = await supabase
        .from('paradas')
        .select('latitude, longitude, endereco')
        .eq('id', currentStopId)
        .single();

      if (!stopData) {
        throw new Error('Parada não encontrada');
      }

      // Update navigation state
      this.navigationState = {
        enabled: true,
        autoAdvance: prefs.autoAdvance ?? true,
        soundAlerts: prefs.soundAlerts ?? true,
        vibrationAlerts: prefs.vibrationAlerts ?? true,
        proximityRadius: prefs.proximityRadius ?? GEOFENCE_RADIUS,
        rotaId,
        currentStopId,
        nextStopId,
        currentStopLocation: {
          latitude: stopData.latitude,
          longitude: stopData.longitude,
        },
      };

      // Save state to AsyncStorage for background task
      await AsyncStorage.setItem(
        'navigationState',
        JSON.stringify(this.navigationState),
      );

      // Start background location updates
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 5000, // Update every 5 seconds
        distanceInterval: 10, // Or every 10 meters
        foregroundService: {
          notificationTitle: 'RotaMestre - Navegação Ativa',
          notificationBody: `Navegando para ${stopData.endereco}`,
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
      this.chegadaAnunciadaPara = null;
      await AsyncStorage.removeItem('navigationState');

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

  // Process location update
  async processLocationUpdate(location: LocationUpdate) {
    if (!this.navigationState?.currentStopLocation) return;

    const distance = this.calculateDistance(
      location.latitude,
      location.longitude,
      this.navigationState.currentStopLocation.latitude,
      this.navigationState.currentStopLocation.longitude,
    );

    // Update driver position in database
    await this.updateDriverPosition(location);

    // Check if arrived at stop
    if (
      distance <= this.navigationState.proximityRadius &&
      location.accuracy <= MIN_ACCURACY
    ) {
      await this.handleArrival(distance);
    } else {
      // Saiu do raio: uma nova chegada volta a ser anunciada.
      this.chegadaAnunciadaPara = null;

      // Send proximity notifications
      await this.handleProximityNotifications(distance);
    }
  }

  /**
   * Chegada à parada: AVISA, e nada mais.
   *
   * Até 02/10/2026 isto agendava, 5 s depois, um `autoAdvanceToNextStop` que
   * gravava `status: 'concluida'` SEM foto, avançava para a próxima parada e,
   * na última, concluía a ROTA. Ficou inofensivo por meses só porque o UPDATE
   * falhava (mandava a coluna inexistente `auto_concluida`); o #480 consertou
   * o UPDATE e o #495 tornou o modo navegação alcançável, e os dois saíram
   * juntos na 1.12.6. Resultado medido: 28 entregas de um motorista sem
   * comprovante entre 08/09 e 01/10, concluídas por geofence — nos dias que a
   * retenção de logs alcança, a correlação com o `PATCH ...&select=id` deste
   * caminho foi 7 de 7.
   *
   * Concluir exige comprovante, e o comprovante exige o motorista: quem
   * conclui é o `StopCompletionFlow`, pela tela. O avanço para a próxima
   * parada continua acontecendo — mas DEPOIS dessa conclusão, quando a tela
   * troca a parada atual e reinicia o rastreamento para a nova.
   *
   * `autoAdvance` segue existindo como preferência: é ela que leva o botão
   * Navegar para o modo navegação interno em vez do app externo.
   */
  private async handleArrival(distance: number) {
    const paradaAtual = this.navigationState?.currentStopId ?? null;
    if (!paradaAtual || this.chegadaAnunciadaPara === paradaAtual) return;
    this.chegadaAnunciadaPara = paradaAtual;

    await this.sendNotification(
      '📍 Você chegou!',
      `Você está a ${Math.round(distance)}m do destino`,
      true,
    );
  }

  // Send proximity notifications
  private async handleProximityNotifications(distance: number) {
    const now = Date.now();

    // Only send notifications every 30 seconds
    if (now - this.lastNotificationTime < 30000) return;

    if (distance < 100) {
      await this.sendNotification(
        '📍 Muito próximo!',
        `Você está a ${Math.round(distance)}m do destino`,
        false,
      );
      this.lastNotificationTime = now;
    } else if (distance < 500) {
      await this.sendNotification(
        '🚗 Aproximando...',
        `${Math.round(distance)}m até o destino`,
        false,
      );
      this.lastNotificationTime = now;
    }
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

      // Inserir em motorista_locations para histórico e rastreamento em tempo real
      const { error } = await supabase.from('motorista_locations').insert({
        motorista_id: user.id,
        rota_id: this.navigationState.rotaId,
        latitude: location.latitude,
        longitude: location.longitude,
        velocidade: location.speed ? location.speed * 3.6 : null, // m/s para km/h
        precisao: location.accuracy,
        heading: location.heading,
      });

      if (error) {
        logger.error('[LocationTracking] Erro ao salvar localização', error);
      }
    } catch (error) {
      logger.error('[LocationTracking] Error updating driver position', error);
    }
  }

  // Calculate distance between two points (Haversine formula)
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // Send notification (placeholder - would use expo-notifications)
  private async sendNotification(
    _title: string,
    _body: string,
    _priority: boolean,
  ) {
    // In a real implementation, would use expo-notifications
  }

  /**
   * Preferências de navegação, SEMPRE completas.
   *
   * POR QUE O DEFAULT MORA AQUI. Isto devolvia `Partial<NavigationState>` e um
   * `{}` quando nada estava salvo, deixando cada consumidor preencher o resto.
   * Dois deles carregavam tabelas de default SEPARADAS
   * (`DEFAULT_SETTINGS` em `NavigationSettings`, `DEFAULT_PREFERENCES` em
   * `useNavigationModeLogic`) e outros não aplicavam default nenhum.
   *
   * O efeito foi medido em aparelho: a tela de Configurações mostrava "Avanço
   * Automático" LIGADO — default dela — enquanto `handleNavigateToStop` lia
   * `prefs.autoAdvance` cru, recebia `undefined` e mandava o motorista para o
   * app de navegação externo. A navegação interna ficava inalcançável, e a
   * tela afirmava que estava ligada. Nenhum teste pegava, porque cada lado
   * estava certo sozinho.
   *
   * Com o default na fonte, esquecer deixa de ser possível.
   */
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
      return prefs ? JSON.parse(prefs) : {};
    } catch {
      return {};
    }
  }

  async getNavigationPreferences(): Promise<PreferenciasDeNavegacao> {
    try {
      const prefs = await AsyncStorage.getItem('navigationPreferences');
      const salvas = prefs ? JSON.parse(prefs) : {};
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
        await AsyncStorage.setItem(
          'navigationState',
          JSON.stringify(this.navigationState),
        );
      }
    } catch (error) {
      logger.error('[LocationTracking] Error updating preferences', error);
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
    const location = locations[0];

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
