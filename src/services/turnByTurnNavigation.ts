import { decode } from '@mapbox/polyline';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// Types
export interface NavigationInstruction {
  distance: number; // meters
  duration: number; // seconds
  instruction: string;
  maneuver: string;
  location: {
    latitude: number;
    longitude: number;
  };
  voiceInstruction?: string;
}

export interface NavigationRoute {
  distance: number; // meters
  duration: number; // seconds
  polyline: string;
  instructions: NavigationInstruction[];
}

interface DirectionsAPIResponse {
  routes: Array<{
    overview_polyline: {
      points: string;
    };
    legs: Array<{
      distance: { value: number };
      duration: { value: number };
      steps: Array<{
        distance: { value: number };
        duration: { value: number };
        html_instructions: string;
        maneuver?: string;
        polyline: { points: string };
        start_location: {
          lat: number;
          lng: number;
        };
      }>;
    }>;
  }>;
}

class TurnByTurnNavigationService {
  private static instance: TurnByTurnNavigationService;
  private currentRoute: NavigationRoute | null = null;
  private currentInstructionIndex: number = 0;
  private voiceEnabled: boolean = true;
  private lastSpokenInstruction: number = -1;
  private googleMapsApiKey: string = '';

  private constructor() {
    // Load API key from env
    this.googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  }

  static getInstance(): TurnByTurnNavigationService {
    if (!TurnByTurnNavigationService.instance) {
      TurnByTurnNavigationService.instance = new TurnByTurnNavigationService();
    }
    return TurnByTurnNavigationService.instance;
  }

  // Get directions from Google Directions API
  async getDirections(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    waypoints?: Array<{ latitude: number; longitude: number }>
  ): Promise<NavigationRoute | null> {
    try {
      // Build URL
      const originStr = `${origin.latitude},${origin.longitude}`;
      const destStr = `${destination.latitude},${destination.longitude}`;

      let waypointsParam: string | undefined;
      if (waypoints && waypoints.length > 0) {
        const waypointsStr = waypoints
          .map(w => `${w.latitude},${w.longitude}`)
          .join('|');
        waypointsParam = `optimize:true|${waypointsStr}`;
      }

      let data: DirectionsAPIResponse;

      if (Platform.OS === 'web') {
        // Web: usar Edge Function para evitar CORS
        const { data: edgeData, error } = await supabase.functions.invoke('google-directions', {
          body: {
            origin: originStr,
            destination: destStr,
            waypoints: waypointsParam,
            mode: 'driving',
          },
        });

        if (error) throw error;
        data = edgeData;
      } else {
        // Mobile: chamar API diretamente (sem CORS)
        let url = `https://maps.googleapis.com/maps/api/directions/json?` +
          `origin=${originStr}&destination=${destStr}` +
          `&mode=driving&language=pt-BR&key=${this.googleMapsApiKey}`;

        if (waypointsParam) {
          url += `&waypoints=${waypointsParam}`;
        }

        const response = await fetch(url);
        data = await response.json();
      }

      if (!data.routes || data.routes.length === 0) {
        throw new Error('Nenhuma rota encontrada');
      }

      const route = data.routes[0];
      const leg = route.legs[0];

      // Process instructions
      const instructions: NavigationInstruction[] = leg.steps.map(step => ({
        distance: step.distance.value,
        duration: step.duration.value,
        instruction: this.cleanHtmlInstructions(step.html_instructions),
        maneuver: step.maneuver || 'straight',
        location: {
          latitude: step.start_location.lat,
          longitude: step.start_location.lng,
        },
        voiceInstruction: this.generateVoiceInstruction(
          this.cleanHtmlInstructions(step.html_instructions),
          step.distance.value,
          step.maneuver
        ),
      }));

      // Create route object
      this.currentRoute = {
        distance: leg.distance.value,
        duration: leg.duration.value,
        polyline: route.overview_polyline.points,
        instructions,
      };

      this.currentInstructionIndex = 0;
      return this.currentRoute;
    } catch (error) {
      console.error('Error getting directions:', error);
      return null;
    }
  }

  // Clean HTML from instructions
  private cleanHtmlInstructions(html: string): string {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');
  }

  // Generate voice-optimized instruction
  private generateVoiceInstruction(
    instruction: string,
    distance: number,
    maneuver?: string
  ): string {
    // Format distance for voice
    const distanceText = this.formatDistanceForVoice(distance);

    // Translate common maneuvers to Portuguese
    const maneuverMap: { [key: string]: string } = {
      'turn-left': 'vire à esquerda',
      'turn-right': 'vire à direita',
      'turn-sharp-left': 'vire acentuadamente à esquerda',
      'turn-sharp-right': 'vire acentuadamente à direita',
      'turn-slight-left': 'pegue à esquerda',
      'turn-slight-right': 'pegue à direita',
      'straight': 'continue em frente',
      'roundabout-left': 'na rotatória, pegue à esquerda',
      'roundabout-right': 'na rotatória, pegue à direita',
      'merge': 'entre na via',
      'fork-left': 'mantenha-se à esquerda',
      'fork-right': 'mantenha-se à direita',
      'ferry': 'pegue a balsa',
      'uturn-left': 'faça o retorno à esquerda',
      'uturn-right': 'faça o retorno à direita',
    };

    // Build voice instruction
    let voiceText = `Em ${distanceText}, `;

    if (maneuver && maneuverMap[maneuver]) {
      voiceText += maneuverMap[maneuver];
    } else {
      // Use the cleaned instruction if no specific maneuver
      voiceText += instruction.toLowerCase();
    }

    return voiceText;
  }

  // Format distance for voice output
  private formatDistanceForVoice(meters: number): string {
    if (meters < 50) {
      return 'agora';
    } else if (meters < 100) {
      return `${Math.round(meters / 10) * 10} metros`;
    } else if (meters < 1000) {
      return `${Math.round(meters / 50) * 50} metros`;
    } else {
      const km = meters / 1000;
      if (km < 10) {
        return `${km.toFixed(1).replace('.', ',')} quilômetros`;
      } else {
        return `${Math.round(km)} quilômetros`;
      }
    }
  }

  // Get current instruction based on location
  getCurrentInstruction(): NavigationInstruction | null {
    if (!this.currentRoute || this.currentInstructionIndex >= this.currentRoute.instructions.length) {
      return null;
    }

    return this.currentRoute.instructions[this.currentInstructionIndex];
  }

  // Get next instruction
  getNextInstruction(): NavigationInstruction | null {
    if (!this.currentRoute || this.currentInstructionIndex + 1 >= this.currentRoute.instructions.length) {
      return null;
    }

    return this.currentRoute.instructions[this.currentInstructionIndex + 1];
  }

  // Update navigation based on current position
  async updateNavigation(
    currentLocation: { latitude: number; longitude: number },
    speed: number = 0
  ): Promise<{
    currentInstruction: NavigationInstruction | null;
    nextInstruction: NavigationInstruction | null;
    shouldSpeak: boolean;
    distanceToNextTurn: number;
  }> {
    if (!this.currentRoute) {
      return {
        currentInstruction: null,
        nextInstruction: null,
        shouldSpeak: false,
        distanceToNextTurn: 0,
      };
    }

    const currentInstruction = this.getCurrentInstruction();
    const nextInstruction = this.getNextInstruction();

    if (!currentInstruction) {
      return {
        currentInstruction: null,
        nextInstruction: null,
        shouldSpeak: false,
        distanceToNextTurn: 0,
      };
    }

    // Calculate distance to next instruction point
    const distanceToNextTurn = this.calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      currentInstruction.location.latitude,
      currentInstruction.location.longitude
    );

    // Determine if we should speak instruction
    let shouldSpeak = false;

    // Speak at different distances based on speed
    const speakDistances = this.getSpeakDistances(speed);

    if (this.voiceEnabled && this.lastSpokenInstruction !== this.currentInstructionIndex) {
      for (const distance of speakDistances) {
        if (distanceToNextTurn <= distance && distanceToNextTurn > distance - 50) {
          shouldSpeak = true;
          break;
        }
      }
    }

    // Check if we've passed the instruction point
    if (distanceToNextTurn < 20) {
      // Move to next instruction
      this.currentInstructionIndex++;
      this.lastSpokenInstruction = -1; // Reset for next instruction
    }

    return {
      currentInstruction,
      nextInstruction,
      shouldSpeak,
      distanceToNextTurn,
    };
  }

  // Get speak distances based on speed
  private getSpeakDistances(speedKmh: number): number[] {
    if (speedKmh > 80) {
      // Highway speeds - speak earlier
      return [800, 400, 100];
    } else if (speedKmh > 50) {
      // Normal speeds
      return [500, 200, 50];
    } else {
      // City speeds
      return [300, 100, 30];
    }
  }

  // Speak instruction
  async speakInstruction(instruction: string) {
    if (!this.voiceEnabled) return;

    try {
      // Check if already speaking
      const isSpeaking = await Speech.isSpeakingAsync();
      if (isSpeaking) {
        await Speech.stop();
      }

      // Speak the instruction
      await Speech.speak(instruction, {
        language: 'pt-BR',
        pitch: 1.0,
        rate: 0.9,
        volume: 1.0,
      });

      // Mark as spoken
      this.lastSpokenInstruction = this.currentInstructionIndex;
    } catch (error) {
      console.error('Error speaking instruction:', error);
    }
  }

  // Calculate distance between two points
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const EARTH_RADIUS = 6371000;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS * c;
  }

  // Decode polyline to coordinates
  decodePolyline(encoded: string): Array<{ latitude: number; longitude: number }> {
    const decoded = decode(encoded, 5);
    return decoded.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
  }

  // Set voice enabled/disabled
  setVoiceEnabled(enabled: boolean) {
    this.voiceEnabled = enabled;
  }

  // Reset navigation
  reset() {
    this.currentRoute = null;
    this.currentInstructionIndex = 0;
    this.lastSpokenInstruction = -1;
  }

  // Get route polyline coordinates
  getRouteCoordinates(): Array<{ latitude: number; longitude: number }> {
    if (!this.currentRoute) return [];
    return this.decodePolyline(this.currentRoute.polyline);
  }

  // Get progress percentage
  getProgress(): number {
    if (!this.currentRoute) return 0;
    const total = this.currentRoute.instructions.length;
    if (total === 0) return 100;
    return Math.round((this.currentInstructionIndex / total) * 100);
  }

  // Get remaining distance
  getRemainingDistance(): number {
    if (!this.currentRoute) return 0;

    let remaining = 0;
    for (let i = this.currentInstructionIndex; i < this.currentRoute.instructions.length; i++) {
      remaining += this.currentRoute.instructions[i].distance;
    }

    return remaining;
  }

  // Get remaining time
  getRemainingTime(): number {
    if (!this.currentRoute) return 0;

    let remaining = 0;
    for (let i = this.currentInstructionIndex; i < this.currentRoute.instructions.length; i++) {
      remaining += this.currentRoute.instructions[i].duration;
    }

    return remaining;
  }
}

export default TurnByTurnNavigationService.getInstance();
