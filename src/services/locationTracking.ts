import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Alert } from 'react-native';

import { supabase } from '@/lib/supabase';
import { defaultTheme } from '@/utils/styles';

// Task name for background location
const LOCATION_TASK = 'background-location-tracking';

// Configuration constants
const GEOFENCE_RADIUS = 50; // meters to consider "arrived" at stop
const AUTO_ADVANCE_DELAY = 5000; // 5 seconds after arrival
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
  rotaId?: string;
  currentStopId?: string;
  nextStopId?: string;
  currentStopLocation?: {
    latitude: number;
    longitude: number;
  };
}

class LocationTrackingService {
  private static instance: LocationTrackingService;
  private navigationState: NavigationState | null = null;
  private arrivalTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastNotificationTime: number = 0;

  private constructor() {}

  static getInstance(): LocationTrackingService {
    if (!LocationTrackingService.instance) {
      LocationTrackingService.instance = new LocationTrackingService();
    }
    return LocationTrackingService.instance;
  }

  // Initialize and start tracking
  async startTracking(rotaId: string, currentStopId: string, nextStopId?: string) {
    try {
      // Request permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        throw new Error('Permissão de localização negada');
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        console.warn('Background location permission not granted');
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
      await AsyncStorage.setItem('navigationState', JSON.stringify(this.navigationState));

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

      console.log('Location tracking started');
      return true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      Alert.alert('Erro', 'Não foi possível iniciar o rastreamento de localização');
      return false;
    }
  }

  // Stop tracking
  async stopTracking() {
    try {
      const hasTask = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
      if (hasTask) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK);
      }

      this.navigationState = null;
      await AsyncStorage.removeItem('navigationState');

      if (this.arrivalTimeout) {
        clearTimeout(this.arrivalTimeout);
        this.arrivalTimeout = null;
      }

      console.log('Location tracking stopped');
      return true;
    } catch (error) {
      console.error('Error stopping location tracking:', error);
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
      this.navigationState.currentStopLocation.longitude
    );

    // Update driver position in database
    await this.updateDriverPosition(location);

    // Check if arrived at stop
    if (distance <= this.navigationState.proximityRadius && location.accuracy <= MIN_ACCURACY) {
      await this.handleArrival(distance);
    } else {
      // Cancel arrival timeout if moved away
      if (this.arrivalTimeout) {
        clearTimeout(this.arrivalTimeout);
        this.arrivalTimeout = null;
      }

      // Send proximity notifications
      await this.handleProximityNotifications(distance);
    }
  }

  // Handle arrival at stop
  private async handleArrival(distance: number) {
    if (!this.navigationState || this.arrivalTimeout) return;

    console.log(`Arrived at stop! Distance: ${distance}m`);

    // Notify arrival
    if (this.navigationState.vibrationAlerts) {
      // Vibration pattern: long-short-short
      // Note: Expo doesn't have vibration API, would need expo-haptics
    }

    // Show notification
    await this.sendNotification(
      '📍 Você chegou!',
      `Você está a ${Math.round(distance)}m do destino`,
      true
    );

    // Auto-advance after delay if enabled
    if (this.navigationState.autoAdvance) {
      this.arrivalTimeout = setTimeout(async () => {
        await this.autoAdvanceToNextStop();
      }, AUTO_ADVANCE_DELAY);
    }
  }

  // Auto advance to next stop
  private async autoAdvanceToNextStop() {
    if (!this.navigationState?.currentStopId || !this.navigationState?.rotaId) return;

    try {
      // Buscar informações completas da parada atual para o log
      const { data: paradaAtual } = await supabase
        .from('paradas')
        .select('id, endereco, tipo, ordem, vinculo_parada_id')
        .eq('id', this.navigationState.currentStopId)
        .single();

      // Mark current stop as completed
      await supabase
        .from('paradas')
        .update({
          status: 'concluida',
          concluida_em: new Date().toISOString(),
          auto_concluida: true,
        })
        .eq('id', this.navigationState.currentStopId);

      // Criar log para auto-conclusão
      const { data: { user } } = await supabase.auth.getUser();
      if (user && paradaAtual) {
        await supabase.from('logs').insert({
          usuario_id: user.id,
          rota_id: this.navigationState.rotaId,
          parada_id: this.navigationState.currentStopId,
          evento: 'parada_concluida',
          detalhes: {
            endereco: paradaAtual.endereco,
            tipo: paradaAtual.tipo,
            ordem: paradaAtual.ordem,
            vinculo_parada_id: paradaAtual.vinculo_parada_id || null,
            tem_vinculo: !!paradaAtual.vinculo_parada_id,
            auto_concluida: true,
            metodo: 'localizacao_automatica',
          },
        });
      }

      // Get next pending stop
      const { data: nextStop } = await supabase
        .from('paradas')
        .select('id, latitude, longitude, endereco')
        .eq('rota_id', this.navigationState.rotaId)
        .eq('status', 'pendente')
        .order('ordem')
        .limit(1)
        .single();

      if (nextStop) {
        // Update navigation state
        this.navigationState.currentStopId = nextStop.id;
        this.navigationState.currentStopLocation = {
          latitude: nextStop.latitude,
          longitude: nextStop.longitude,
        };

        // Get following stop
        const { data: followingStop } = await supabase
          .from('paradas')
          .select('id')
          .eq('rota_id', this.navigationState.rotaId)
          .eq('status', 'pendente')
          .neq('id', nextStop.id)
          .order('ordem')
          .limit(1)
          .single();

        this.navigationState.nextStopId = followingStop?.id;

        // Save updated state
        await AsyncStorage.setItem('navigationState', JSON.stringify(this.navigationState));

        // Notify user
        await this.sendNotification(
          '✅ Parada concluída!',
          `Próxima parada: ${nextStop.endereco}`,
          true
        );

        console.log('Auto-advanced to next stop:', nextStop.id);
      } else {
        // No more stops - route complete
        await this.handleRouteComplete();
      }
    } catch (error) {
      console.error('Error auto-advancing:', error);
    }
  }

  // Handle route completion
  private async handleRouteComplete() {
    if (!this.navigationState?.rotaId) return;

    try {
      await supabase
        .from('rotas')
        .update({
          status: 'concluida',
          concluida_em: new Date().toISOString(),
        })
        .eq('id', this.navigationState.rotaId);

      await this.sendNotification(
        '🎉 Rota Concluída!',
        'Parabéns! Todas as entregas foram realizadas.',
        true
      );

      await this.stopTracking();
    } catch (error) {
      console.error('Error completing route:', error);
    }
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
        false
      );
      this.lastNotificationTime = now;
    } else if (distance < 500) {
      await this.sendNotification(
        '🚗 Aproximando...',
        `${Math.round(distance)}m até o destino`,
        false
      );
      this.lastNotificationTime = now;
    }
  }

  // Update driver position in database
  private async updateDriverPosition(location: LocationUpdate) {
    if (!this.navigationState?.rotaId) return;

    try {
      await supabase
        .from('rotas')
        .update({
          ultima_localizacao: {
            latitude: location.latitude,
            longitude: location.longitude,
            timestamp: location.timestamp,
            accuracy: location.accuracy,
            speed: location.speed,
            heading: location.heading,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.navigationState.rotaId);
    } catch (error) {
      console.error('Error updating driver position:', error);
    }
  }

  // Calculate distance between two points (Haversine formula)
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
  private async sendNotification(title: string, body: string, _priority: boolean) {
    // In a real implementation, would use expo-notifications
    console.log(`Notification: ${title} - ${body}`);
  }

  // Get navigation preferences
  async getNavigationPreferences(): Promise<Partial<NavigationState>> {
    try {
      const prefs = await AsyncStorage.getItem('navigationPreferences');
      return prefs ? JSON.parse(prefs) : {};
    } catch {
      return {};
    }
  }

  // Update navigation preferences
  async updateNavigationPreferences(prefs: Partial<NavigationState>) {
    try {
      const current = await this.getNavigationPreferences();
      const updated = { ...current, ...prefs };
      await AsyncStorage.setItem('navigationPreferences', JSON.stringify(updated));

      // Update current state if tracking
      if (this.navigationState) {
        this.navigationState = { ...this.navigationState, ...prefs };
        await AsyncStorage.setItem('navigationState', JSON.stringify(this.navigationState));
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
    }
  }
}

// Background task definition
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }

  if (data) {
    const { locations } = data as any;
    const location = locations[0];

    if (location) {
      const service = LocationTrackingService.getInstance();
      await service.processLocationUpdate({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
        speed: location.coords.speed,
        heading: location.coords.heading,
      });
    }
  }
});

export default LocationTrackingService.getInstance();
