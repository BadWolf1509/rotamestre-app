/**
 * useTurnByTurnState
 *
 * Hook managing the core state for Turn-by-Turn navigation
 */

import React, { useRef, useState } from 'react';

import type { NavigationInstruction } from '@/services/turnByTurnNavigation';

import {
  DEFAULT_PREVENT_SCREEN_SLEEP,
  DEFAULT_PROXIMITY_RADIUS,
  DEFAULT_VIBRATION_ALERTS,
  DEFAULT_VOICE_ENABLED,
} from './constants';

import type { Coordinate, TurnByTurnSetters, TurnByTurnState } from './types';

interface UseTurnByTurnStateOptions {
  /** Initial origin location */
  origin: Coordinate;
}

interface UseTurnByTurnStateReturn extends TurnByTurnState, TurnByTurnSetters {
  /** Ref to track if arrival has been triggered */
  hasArrivedRef: React.MutableRefObject<boolean>;
  /** Ref to track voice enabled state (for async callbacks) */
  voiceEnabledRef: React.MutableRefObject<boolean>;
  /** Ref to track last processed location */
  lastProcessedLocationRef: React.MutableRefObject<{ lat: number; lng: number } | null>;
  /** Ref to track last animated location */
  lastAnimatedLocationRef: React.MutableRefObject<{ lat: number; lng: number } | null>;
  /** Ref to track last animated heading */
  lastAnimatedHeadingRef: React.MutableRefObject<number>;
}

/**
 * Hook that manages all state for Turn-by-Turn navigation
 */
export function useTurnByTurnState({
  origin,
}: UseTurnByTurnStateOptions): UseTurnByTurnStateReturn {
  // User preferences state
  const [proximityRadius, setProximityRadius] = useState(DEFAULT_PROXIMITY_RADIUS);
  const [preventScreenSleep, setPreventScreenSleep] = useState(DEFAULT_PREVENT_SCREEN_SLEEP);
  const [vibrationAlerts, setVibrationAlerts] = useState(DEFAULT_VIBRATION_ALERTS);
  const [voiceEnabled, setVoiceEnabled] = useState(DEFAULT_VOICE_ENABLED);

  // Navigation state
  const [userLocation, setUserLocation] = useState<Coordinate>(origin);
  const [speed, setSpeed] = useState(0);
  const [heading, setHeading] = useState(0);
  const [currentInstruction, setCurrentInstruction] = useState<NavigationInstruction | null>(null);
  const [nextInstruction, setNextInstruction] = useState<NavigationInstruction | null>(null);
  const [distanceToTurn, setDistanceToTurn] = useState(0);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [remainingDistance, setRemainingDistance] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRouteReady, setIsRouteReady] = useState(false);
  const [mapView, setMapView] = useState<'north-up' | 'heading-up'>('heading-up');

  // Refs for preventing race conditions and multiple triggers
  const hasArrivedRef = useRef(false);
  const voiceEnabledRef = useRef(voiceEnabled);
  const lastProcessedLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastAnimatedLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastAnimatedHeadingRef = useRef(0);

  return {
    // State
    userLocation,
    speed,
    heading,
    currentInstruction,
    nextInstruction,
    distanceToTurn,
    routeCoordinates,
    remainingDistance,
    remainingTime,
    progress,
    voiceEnabled,
    isLoading,
    isRouteReady,
    proximityRadius,
    preventScreenSleep,
    vibrationAlerts,
    mapView,

    // Setters
    setUserLocation,
    setSpeed,
    setHeading,
    setCurrentInstruction,
    setNextInstruction,
    setDistanceToTurn,
    setRouteCoordinates,
    setRemainingDistance,
    setRemainingTime,
    setProgress,
    setVoiceEnabled,
    setIsLoading,
    setIsRouteReady,
    setProximityRadius,
    setPreventScreenSleep,
    setVibrationAlerts,
    setMapView,

    // Refs
    hasArrivedRef,
    voiceEnabledRef,
    lastProcessedLocationRef,
    lastAnimatedLocationRef,
    lastAnimatedHeadingRef,
  };
}
