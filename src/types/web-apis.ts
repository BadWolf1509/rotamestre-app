/**
 * Type definitions for non-standard Web APIs used in the app.
 *
 * These APIs are available in most modern browsers but not included
 * in TypeScript's standard lib.dom.d.ts.
 */

/** Web Battery Status API (navigator.getBattery()) */
export interface BatteryManager extends EventTarget {
  readonly charging: boolean;
  readonly chargingTime: number;
  readonly dischargingTime: number;
  readonly level: number;
}

export interface NavigatorWithBattery extends Navigator {
  getBattery(): Promise<BatteryManager>;
}

/** Web User Activation API (navigator.userActivation) */
export interface NavigatorWithUserActivation extends Navigator {
  readonly userActivation: {
    readonly hasBeenActive: boolean;
    readonly isActive: boolean;
  };
}

/** Safari/older browser webkit AudioContext prefix */
export interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}
