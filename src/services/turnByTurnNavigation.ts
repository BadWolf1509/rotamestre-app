import * as Speech from 'expo-speech';

import {
  getRoute,
  decodePolyline as osrmDecodePolyline,
  calculateHaversineDistance,
  type Coordinate,
} from '@/lib/osrm';

/**
 * Turn-by-Turn Navigation Service
 *
 * MIGRADO PARA OSRM (Open Source Routing Machine)
 * - Custo: GRATUITO (vs ~R$900/mês do Google Routes API)
 * - Cache: 5 minutos (gerenciado pelo serviço OSRM)
 * - Rate limit: 1 req/segundo (gerenciado pelo serviço OSRM)
 *
 * @see src/lib/osrm.ts
 */

// Re-export for backwards compatibility
export { calculateHaversineDistance } from '@/lib/osrm';

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

class TurnByTurnNavigationService {
  private static instance: TurnByTurnNavigationService;
  private currentRoute: NavigationRoute | null = null;
  private currentInstructionIndex: number = 0;
  private voiceEnabled: boolean = true;
  private lastSpokenInstruction: number = -1;

  private constructor() {
    // OSRM não precisa de API key (é gratuito!)
  }

  static getInstance(): TurnByTurnNavigationService {
    if (!TurnByTurnNavigationService.instance) {
      TurnByTurnNavigationService.instance = new TurnByTurnNavigationService();
    }
    return TurnByTurnNavigationService.instance;
  }

  // Get directions from OSRM (gratuito!)
  async getDirections(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    waypoints?: Array<{ latitude: number; longitude: number }>
  ): Promise<NavigationRoute | null> {
    try {
      // Usar OSRM em vez de Google (R$900/mês de economia!)
      const osrmRoute = await getRoute(
        origin as Coordinate,
        destination as Coordinate,
        waypoints as Coordinate[],
        { steps: true }
      );

      if (!osrmRoute) {
        throw new Error('Nenhuma rota encontrada');
      }

      // Convert OSRM steps to NavigationInstruction format
      const instructions: NavigationInstruction[] = osrmRoute.steps.map(step => ({
        distance: step.distance,
        duration: step.duration,
        instruction: step.instruction,
        maneuver: step.maneuver,
        location: step.location,
        voiceInstruction: this.generateVoiceInstruction(
          step.instruction,
          step.distance,
          step.maneuver
        ),
      }));

      // Create route object
      this.currentRoute = {
        distance: osrmRoute.distance,
        duration: osrmRoute.duration,
        polyline: osrmRoute.polyline,
        instructions,
      };

      this.currentInstructionIndex = 0;
      return this.currentRoute;
    } catch (error) {
      console.error('Error getting directions from OSRM:', error);
      return null;
    }
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

  // Calculate distance between two points (uses OSRM utility)
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    return calculateHaversineDistance(lat1, lon1, lat2, lon2);
  }

  // Decode polyline to coordinates (uses OSRM utility)
  decodePolyline(encoded: string): Array<{ latitude: number; longitude: number }> {
    return osrmDecodePolyline(encoded);
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

  // Get progress percentage (by instruction count)
  getProgress(): number {
    if (!this.currentRoute) return 0;
    const total = this.currentRoute.instructions.length;
    if (total === 0) return 100;
    return Math.round((this.currentInstructionIndex / total) * 100);
  }

  // Get progress percentage by distance traveled (more accurate)
  getProgressByDistance(): number {
    if (!this.currentRoute) return 0;

    const totalDistance = this.currentRoute.distance;
    if (totalDistance === 0) return 100;

    const remainingDistance = this.getRemainingDistance();
    const traveled = totalDistance - remainingDistance;

    return Math.round((traveled / totalDistance) * 100);
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
