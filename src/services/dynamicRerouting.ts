/**
 * Dynamic Route Rerouting Service
 *
 * ⚠️ SUSPENDED FOR MVP - High API costs
 *
 * This service provides real-time route optimization using Google Maps APIs:
 * - Distance Matrix API: Traffic data between waypoints (~$5-10 per 1000 requests)
 * - Directions API: Optimized waypoint ordering (~$5 per 1000 requests)
 *
 * Current Status: DISABLED (commented out in inicio.tsx)
 * Reason: API costs too high for MVP phase
 *
 * Alternative solutions to consider:
 * 1. Client-side optimization using Haversine distance (free, less accurate)
 * 2. Batch optimization once per day during off-peak hours
 * 3. Only optimize routes with 5+ stops
 * 4. Use cached traffic patterns instead of real-time data
 *
 * To re-enable:
 * 1. Uncomment useEffect in app/motorista/inicio.tsx (lines 106-125)
 * 2. Deploy Edge Functions: supabase functions deploy google-directions --no-verify-jwt
 * 3. Set GOOGLE_MAPS_API_KEY in Supabase dashboard
 * 4. Monitor API usage and costs in Google Cloud Console
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// Types
interface Stop {
  id: string;
  ordem: number;
  latitude: number;
  longitude: number;
  endereco: string;
  status: string;
  prioridade?: 'alta' | 'media' | 'baixa';
}

interface TrafficData {
  duration: number; // seconds
  distance: number; // meters
  trafficLevel: 'low' | 'medium' | 'heavy';
}

interface RouteOptimization {
  originalDuration: number;
  optimizedDuration: number;
  timeSaved: number;
  newOrder: Stop[];
  reason: string;
  confidence: number; // 0-100
}

interface OptimizationSettings {
  enabled: boolean;
  checkInterval: number; // minutes
  minTimeSaving: number; // minutes
  autoAccept: boolean;
  considerPriority: boolean;
  avoidHighTraffic: boolean;
}

class DynamicReroutingService {
  private static instance: DynamicReroutingService;
  private googleMapsApiKey: string;
  private settings: OptimizationSettings;
  private lastCheckTime: number = 0;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private currentRouteId: string | null = null;

  private constructor() {
    this.googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    this.settings = {
      enabled: true,
      checkInterval: 5, // 5 minutes
      minTimeSaving: 5, // 5 minutes minimum to suggest reroute
      autoAccept: false,
      considerPriority: true,
      avoidHighTraffic: true,
    };
  }

  static getInstance(): DynamicReroutingService {
    if (!DynamicReroutingService.instance) {
      DynamicReroutingService.instance = new DynamicReroutingService();
    }
    return DynamicReroutingService.instance;
  }

  // Initialize monitoring for a route
  async startMonitoring(routeId: string, stops: Stop[]) {
    this.currentRouteId = routeId;
    await this.loadSettings();

    if (!this.settings.enabled) {
      console.log('Dynamic rerouting is disabled');
      return;
    }

    // Clear existing interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Start periodic checks
    this.checkInterval = setInterval(
      () => this.checkForOptimization(stops),
      this.settings.checkInterval * 60 * 1000
    );

    // Do initial check
    await this.checkForOptimization(stops);
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.currentRouteId = null;
  }

  // Check if route can be optimized
  async checkForOptimization(stops: Stop[]): Promise<RouteOptimization | null> {
    try {
      // Filter only pending stops
      const pendingStops = stops.filter(s => s.status === 'pendente');

      if (pendingStops.length < 2) {
        return null; // No optimization needed for single stop
      }

      // Get current traffic conditions for all segments
      const currentRoute = await this.calculateRouteDuration(pendingStops);

      // Try different permutations (limited for performance)
      const optimizations = await this.findOptimalRoute(pendingStops);

      if (!optimizations || optimizations.length === 0) {
        return null;
      }

      // Get best optimization
      const bestOptimization = optimizations.reduce((best, current) =>
        current.duration < best.duration ? current : best
      );

      // Calculate time saved
      const timeSaved = (currentRoute.duration - bestOptimization.duration) / 60; // Convert to minutes

      // Check if optimization is worth it
      if (timeSaved < this.settings.minTimeSaving) {
        return null;
      }

      // Build optimization result
      const result: RouteOptimization = {
        originalDuration: currentRoute.duration,
        optimizedDuration: bestOptimization.duration,
        timeSaved: Math.round(timeSaved),
        newOrder: bestOptimization.route,
        reason: this.getOptimizationReason(currentRoute, bestOptimization),
        confidence: this.calculateConfidence(timeSaved),
      };

      // Log optimization
      await this.logOptimization(result);

      return result;
    } catch (error) {
      console.error('Error checking for optimization:', error);
      return null;
    }
  }

  // Calculate route duration with current traffic
  private async calculateRouteDuration(stops: Stop[]): Promise<{ duration: number; route: Stop[] }> {
    if (stops.length === 0) {
      return { duration: 0, route: [] };
    }

    let totalDuration = 0;

    for (let i = 0; i < stops.length - 1; i++) {
      const origin = stops[i];
      const destination = stops[i + 1];

      const traffic = await this.getTrafficData(origin, destination);
      totalDuration += traffic.duration;
    }

    return { duration: totalDuration, route: stops };
  }

  // Get traffic data between two points
  private async getTrafficData(origin: Stop, destination: Stop): Promise<TrafficData> {
    try {
      let data;

      if (Platform.OS === 'web') {
        // Use Supabase Edge Function to avoid CORS
        const { data: edgeData, error } = await supabase.functions.invoke('google-distance-matrix', {
          body: {
            origins: `${origin.latitude},${origin.longitude}`,
            destinations: `${destination.latitude},${destination.longitude}`,
            mode: 'driving',
            departureTime: 'now',
          },
        });

        if (error) throw error;
        data = edgeData;
      } else {
        // Mobile: call Google API directly
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?` +
          `origins=${origin.latitude},${origin.longitude}` +
          `&destinations=${destination.latitude},${destination.longitude}` +
          `&mode=driving` +
          `&departure_time=now` +
          `&traffic_model=best_guess` +
          `&key=${this.googleMapsApiKey}`;

        const response = await fetch(url);
        data = await response.json();
      }

      if (data.rows && data.rows[0] && data.rows[0].elements[0]) {
        const element = data.rows[0].elements[0];

        // Calculate traffic level based on duration difference
        const normalDuration = element.duration?.value || 0;
        const trafficDuration = element.duration_in_traffic?.value || normalDuration;
        const trafficRatio = trafficDuration / normalDuration;

        let trafficLevel: 'low' | 'medium' | 'heavy' = 'low';
        if (trafficRatio > 1.5) {
          trafficLevel = 'heavy';
        } else if (trafficRatio > 1.2) {
          trafficLevel = 'medium';
        }

        return {
          duration: trafficDuration,
          distance: element.distance?.value || 0,
          trafficLevel,
        };
      }

      // Fallback if API fails
      return {
        duration: 600, // 10 minutes default
        distance: 5000, // 5km default
        trafficLevel: 'low',
      };
    } catch (error) {
      console.error('Error getting traffic data:', error);
      // Return default values
      return {
        duration: 600,
        distance: 5000,
        trafficLevel: 'low',
      };
    }
  }

  // Find optimal route using different algorithms
  private async findOptimalRoute(stops: Stop[]): Promise<Array<{ duration: number; route: Stop[] }>> {
    const optimizations: Array<{ duration: number; route: Stop[] }> = [];

    // 1. Try nearest neighbor algorithm
    const nearestNeighbor = await this.nearestNeighborRoute(stops);
    if (nearestNeighbor) {
      optimizations.push(nearestNeighbor);
    }

    // 2. Try priority-based ordering (if enabled)
    if (this.settings.considerPriority) {
      const priorityBased = await this.priorityBasedRoute(stops);
      if (priorityBased) {
        optimizations.push(priorityBased);
      }
    }

    // 3. Try Google's optimized waypoints
    const googleOptimized = await this.googleOptimizedRoute(stops);
    if (googleOptimized) {
      optimizations.push(googleOptimized);
    }

    return optimizations;
  }

  // Nearest neighbor algorithm
  private async nearestNeighborRoute(stops: Stop[]): Promise<{ duration: number; route: Stop[] } | null> {
    if (stops.length < 2) return null;

    const route: Stop[] = [];
    const remaining = [...stops];
    let current = remaining.shift()!; // Start with first stop
    route.push(current);

    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      // Find nearest unvisited stop
      for (let i = 0; i < remaining.length; i++) {
        const distance = this.calculateDistance(
          current.latitude,
          current.longitude,
          remaining[i].latitude,
          remaining[i].longitude
        );

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      current = remaining[nearestIndex];
      route.push(current);
      remaining.splice(nearestIndex, 1);
    }

    return await this.calculateRouteDuration(route);
  }

  // Priority-based routing
  private async priorityBasedRoute(stops: Stop[]): Promise<{ duration: number; route: Stop[] } | null> {
    // Sort by priority, then by distance from origin
    const priorityOrder = { 'alta': 0, 'media': 1, 'baixa': 2 };

    const sorted = [...stops].sort((a, b) => {
      const priorityA = priorityOrder[a.prioridade || 'media'];
      const priorityB = priorityOrder[b.prioridade || 'media'];

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // If same priority, sort by order
      return a.ordem - b.ordem;
    });

    return await this.calculateRouteDuration(sorted);
  }

  // Use Google's waypoint optimization
  private async googleOptimizedRoute(stops: Stop[]): Promise<{ duration: number; route: Stop[] } | null> {
    if (stops.length < 2) return null;

    try {
      const origin = `${stops[0].latitude},${stops[0].longitude}`;
      const destination = `${stops[stops.length - 1].latitude},${stops[stops.length - 1].longitude}`;

      const waypoints = stops.slice(1, -1)
        .map(s => `${s.latitude},${s.longitude}`)
        .join('|');

      let data;

      if (Platform.OS === 'web') {
        // Use Supabase Edge Function to avoid CORS
        const { data: edgeData, error } = await supabase.functions.invoke('google-directions', {
          body: {
            origin,
            destination,
            waypoints: `optimize:true|${waypoints}`,
            mode: 'driving',
            departureTime: 'now',
          },
        });

        if (error) throw error;
        data = edgeData;
      } else {
        // Mobile: call Google API directly
        const url = `https://maps.googleapis.com/maps/api/directions/json?` +
          `origin=${origin}` +
          `&destination=${destination}` +
          `&waypoints=optimize:true|${waypoints}` +
          `&mode=driving` +
          `&departure_time=now` +
          `&traffic_model=best_guess` +
          `&key=${this.googleMapsApiKey}`;

        const response = await fetch(url);
        data = await response.json();
      }

      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        const waypointOrder = route.waypoint_order || [];

        // Reorder stops based on Google's optimization
        const optimizedStops = [stops[0]];
        for (const index of waypointOrder) {
          optimizedStops.push(stops[index + 1]);
        }
        optimizedStops.push(stops[stops.length - 1]);

        // Calculate total duration
        const duration = route.legs.reduce((sum: number, leg: any) =>
          sum + (leg.duration_in_traffic?.value || leg.duration?.value || 0), 0
        );

        return { duration, route: optimizedStops };
      }
    } catch (error) {
      console.error('Error getting Google optimized route:', error);
    }

    return null;
  }

  // Calculate distance between two points
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

  // Get optimization reason
  private getOptimizationReason(current: any, optimized: any): string {
    const reasons = [];

    if (optimized.duration < current.duration * 0.7) {
      reasons.push('Evitando congestionamento pesado');
    } else if (optimized.duration < current.duration * 0.85) {
      reasons.push('Rota mais eficiente encontrada');
    } else {
      reasons.push('Pequena otimização de tempo');
    }

    if (this.settings.considerPriority) {
      reasons.push('Priorizando entregas urgentes');
    }

    return reasons.join('. ');
  }

  // Calculate confidence score
  private calculateConfidence(timeSaved: number): number {
    // Base confidence on time saved
    let confidence = Math.min(timeSaved * 10, 100);

    // Adjust based on time of day (rush hour = more confidence)
    const hour = new Date().getHours();
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      confidence = Math.min(confidence * 1.2, 100);
    }

    return Math.round(confidence);
  }

  // Log optimization for analytics
  private async logOptimization(optimization: RouteOptimization) {
    try {
      await supabase.from('logs').insert({
        tipo: 'route_optimization',
        descricao: `Otimização sugerida: ${optimization.timeSaved} minutos economizados`,
        detalhes: {
          routeId: this.currentRouteId,
          originalDuration: optimization.originalDuration,
          optimizedDuration: optimization.optimizedDuration,
          timeSaved: optimization.timeSaved,
          reason: optimization.reason,
          confidence: optimization.confidence,
        },
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error logging optimization:', error);
    }
  }

  // Load settings from storage
  async loadSettings() {
    try {
      const stored = await AsyncStorage.getItem('dynamicReroutingSettings');
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  // Update settings
  async updateSettings(settings: Partial<OptimizationSettings>) {
    this.settings = { ...this.settings, ...settings };
    try {
      await AsyncStorage.setItem('dynamicReroutingSettings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  // Get current settings
  getSettings(): OptimizationSettings {
    return { ...this.settings };
  }

  // Apply optimization (update stop order in database)
  async applyOptimization(routeId: string, newOrder: Stop[]) {
    try {
      // Update order for each stop
      const updates = newOrder.map((stop, index) =>
        supabase
          .from('paradas')
          .update({ ordem: index + 1 })
          .eq('id', stop.id)
          .eq('rota_id', routeId)
      );

      await Promise.all(updates);

      // Log the change
      await supabase.from('logs').insert({
        tipo: 'route_reordered',
        descricao: 'Ordem das paradas otimizada',
        detalhes: {
          routeId,
          newOrder: newOrder.map(s => ({ id: s.id, ordem: s.ordem })),
        },
        created_at: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      console.error('Error applying optimization:', error);
      return false;
    }
  }
}

export default DynamicReroutingService.getInstance();
