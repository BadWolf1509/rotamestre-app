/**
 * Tests for useTurnByTurnState hook
 *
 * Pure state management hook - no external mocks needed
 */
import { renderHook, act } from '@testing-library/react-native';

import { useTurnByTurnState } from '../useTurnByTurnState';

const origin = { latitude: -23.5505, longitude: -46.6333 };

describe('useTurnByTurnState', () => {
  describe('initial state', () => {
    it('initializes userLocation from origin', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      expect(result.current.userLocation).toEqual(origin);
    });

    it('initializes numeric values to defaults', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      expect(result.current.speed).toBe(0);
      expect(result.current.heading).toBe(0);
      expect(result.current.distanceToTurn).toBe(0);
      expect(result.current.remainingDistance).toBe(0);
      expect(result.current.remainingTime).toBe(0);
      expect(result.current.progress).toBe(0);
    });

    it('initializes instructions as null', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      expect(result.current.currentInstruction).toBeNull();
      expect(result.current.nextInstruction).toBeNull();
    });

    it('initializes routeCoordinates as empty array', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      expect(result.current.routeCoordinates).toEqual([]);
    });

    it('initializes boolean preferences from constants', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      expect(result.current.voiceEnabled).toBe(true);
      expect(result.current.preventScreenSleep).toBe(true);
      expect(result.current.vibrationAlerts).toBe(true);
      expect(result.current.proximityRadius).toBe(30);
    });

    it('initializes loading state', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isRouteReady).toBe(false);
    });

    it('initializes mapView to heading-up', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      expect(result.current.mapView).toBe('heading-up');
    });
  });

  describe('setters', () => {
    it('updates userLocation', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));
      const newLocation = { latitude: -22.9, longitude: -43.2 };

      act(() => { result.current.setUserLocation(newLocation); });

      expect(result.current.userLocation).toEqual(newLocation);
    });

    it('updates speed', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      act(() => { result.current.setSpeed(60); });

      expect(result.current.speed).toBe(60);
    });

    it('updates heading', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      act(() => { result.current.setHeading(180); });

      expect(result.current.heading).toBe(180);
    });

    it('updates currentInstruction', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));
      const instruction = { text: 'Vire à direita', distance: 100, maneuver: 'turn-right' };

      act(() => { result.current.setCurrentInstruction(instruction as any); });

      expect(result.current.currentInstruction).toEqual(instruction);
    });

    it('updates nextInstruction', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));
      const instruction = { text: 'Vire à esquerda', distance: 200, maneuver: 'turn-left' };

      act(() => { result.current.setNextInstruction(instruction as any); });

      expect(result.current.nextInstruction).toEqual(instruction);
    });

    it('updates distanceToTurn', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      act(() => { result.current.setDistanceToTurn(150); });

      expect(result.current.distanceToTurn).toBe(150);
    });

    it('updates routeCoordinates', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));
      const coords = [
        { latitude: -23.55, longitude: -46.63 },
        { latitude: -23.56, longitude: -46.64 },
      ];

      act(() => { result.current.setRouteCoordinates(coords); });

      expect(result.current.routeCoordinates).toEqual(coords);
    });

    it('updates remainingDistance', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      act(() => { result.current.setRemainingDistance(5000); });

      expect(result.current.remainingDistance).toBe(5000);
    });

    it('updates remainingTime', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      act(() => { result.current.setRemainingTime(600); });

      expect(result.current.remainingTime).toBe(600);
    });

    it('updates progress', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      act(() => { result.current.setProgress(0.75); });

      expect(result.current.progress).toBe(0.75);
    });

    it('updates voiceEnabled', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      act(() => { result.current.setVoiceEnabled(false); });

      expect(result.current.voiceEnabled).toBe(false);
    });

    it('updates isLoading', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      act(() => { result.current.setIsLoading(false); });

      expect(result.current.isLoading).toBe(false);
    });

    it('updates isRouteReady', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      act(() => { result.current.setIsRouteReady(true); });

      expect(result.current.isRouteReady).toBe(true);
    });

    it('updates proximityRadius', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      act(() => { result.current.setProximityRadius(50); });

      expect(result.current.proximityRadius).toBe(50);
    });

    it('updates preventScreenSleep', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      act(() => { result.current.setPreventScreenSleep(false); });

      expect(result.current.preventScreenSleep).toBe(false);
    });

    it('updates vibrationAlerts', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      act(() => { result.current.setVibrationAlerts(false); });

      expect(result.current.vibrationAlerts).toBe(false);
    });

    it('updates mapView', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      act(() => { result.current.setMapView('north-up'); });

      expect(result.current.mapView).toBe('north-up');
    });
  });

  describe('refs', () => {
    it('hasArrivedRef defaults to false', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      expect(result.current.hasArrivedRef.current).toBe(false);
    });

    it('voiceEnabledRef tracks initial voiceEnabled state', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      expect(result.current.voiceEnabledRef.current).toBe(true);
    });

    it('lastProcessedLocationRef defaults to null', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      expect(result.current.lastProcessedLocationRef.current).toBeNull();
    });

    it('lastAnimatedLocationRef defaults to null', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      expect(result.current.lastAnimatedLocationRef.current).toBeNull();
    });

    it('lastAnimatedHeadingRef defaults to 0', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      expect(result.current.lastAnimatedHeadingRef.current).toBe(0);
    });

    it('refs are mutable', () => {
      const { result } = renderHook(() => useTurnByTurnState({ origin }));

      result.current.hasArrivedRef.current = true;
      expect(result.current.hasArrivedRef.current).toBe(true);

      result.current.lastProcessedLocationRef.current = { lat: -23.5, lng: -46.6 };
      expect(result.current.lastProcessedLocationRef.current).toEqual({ lat: -23.5, lng: -46.6 });
    });
  });

  describe('different origins', () => {
    it('uses provided origin as initial userLocation', () => {
      const customOrigin = { latitude: -22.9068, longitude: -43.1729 };
      const { result } = renderHook(() => useTurnByTurnState({ origin: customOrigin }));

      expect(result.current.userLocation).toEqual(customOrigin);
    });
  });
});
