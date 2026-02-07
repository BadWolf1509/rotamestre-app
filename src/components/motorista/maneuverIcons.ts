import type { IconName } from '@/types/icons';

/** All OSRM maneuver type strings that have a dedicated icon mapping. */
export type ManeuverType =
  | 'turn-left'
  | 'turn-right'
  | 'turn-sharp-left'
  | 'turn-sharp-right'
  | 'turn-slight-left'
  | 'turn-slight-right'
  | 'straight'
  | 'continue'
  | 'depart'
  | 'arrive'
  | 'merge'
  | 'on-ramp'
  | 'off-ramp'
  | 'fork-left'
  | 'fork-right'
  | 'roundabout'
  | 'rotary'
  | 'roundabout-turn'
  | 'uturn'
  | 'uturn-left'
  | 'uturn-right'
  | 'ferry'
  | 'notification'
  | 'end-of-road'
  | 'new-name';

/**
 * Maps OSRM maneuver types to Ionicons icon names.
 * Used by TurnByTurnNavigation for the instruction bar icons.
 */
export const MANEUVER_ICONS: Record<ManeuverType, IconName> = {
  // Turns
  'turn-left': 'arrow-back',
  'turn-right': 'arrow-forward',
  'turn-sharp-left': 'return-up-back',
  'turn-sharp-right': 'return-up-forward',
  'turn-slight-left': 'chevron-back',
  'turn-slight-right': 'chevron-forward',

  // Straight
  'straight': 'arrow-up',
  'continue': 'arrow-up',
  'depart': 'navigate',
  'arrive': 'flag',

  // Merges and exits
  'merge': 'git-merge',
  'on-ramp': 'trending-up',
  'off-ramp': 'exit-outline',
  'fork-left': 'git-branch',
  'fork-right': 'git-branch',

  // Roundabouts
  'roundabout': 'sync',
  'rotary': 'sync',
  'roundabout-turn': 'sync',

  // U-turns
  'uturn': 'refresh',
  'uturn-left': 'refresh',
  'uturn-right': 'refresh',

  // Special
  'ferry': 'boat',
  'notification': 'information-circle',
  'end-of-road': 'stop-circle',
  'new-name': 'arrow-up',
};
