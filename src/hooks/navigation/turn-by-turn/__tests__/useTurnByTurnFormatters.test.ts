import { renderHook } from '@testing-library/react-native';

import { useTurnByTurnFormatters } from '../useTurnByTurnFormatters';

describe('useTurnByTurnFormatters', () => {
  const { result } = renderHook(() => useTurnByTurnFormatters());
  const { formatDistance, formatDuration, getManeuverIcon } = result.current;

  // ==========================================================================
  // formatDistance
  // ==========================================================================

  describe('formatDistance', () => {
    it('formats 0 meters', () => {
      expect(formatDistance(0)).toBe('0m');
    });

    it('formats small distance in meters', () => {
      expect(formatDistance(50)).toBe('50m');
    });

    it('formats 500 meters', () => {
      expect(formatDistance(500)).toBe('500m');
    });

    it('formats 999 meters (below km threshold)', () => {
      expect(formatDistance(999)).toBe('999m');
    });

    it('rounds fractional meters', () => {
      expect(formatDistance(150.7)).toBe('151m');
    });

    it('formats exactly 1000 meters as km', () => {
      expect(formatDistance(1000)).toBe('1.0km');
    });

    it('formats 1500 meters as 1.5km', () => {
      expect(formatDistance(1500)).toBe('1.5km');
    });

    it('formats 10000 meters as 10.0km', () => {
      expect(formatDistance(10000)).toBe('10.0km');
    });

    it('formats decimal km with 1 decimal place', () => {
      expect(formatDistance(2750)).toBe('2.8km');
    });
  });

  // ==========================================================================
  // formatDuration
  // ==========================================================================

  describe('formatDuration', () => {
    it('formats 0 seconds as 0 min', () => {
      expect(formatDuration(0)).toBe('0 min');
    });

    it('formats 30 seconds as 1 min (ceil)', () => {
      expect(formatDuration(30)).toBe('1 min');
    });

    it('formats 60 seconds as 1 min', () => {
      expect(formatDuration(60)).toBe('1 min');
    });

    it('formats 90 seconds as 2 min (ceil)', () => {
      expect(formatDuration(90)).toBe('2 min');
    });

    it('formats 59 minutes', () => {
      expect(formatDuration(59 * 60)).toBe('59 min');
    });

    it('formats exactly 1 hour', () => {
      expect(formatDuration(3600)).toBe('1h');
    });

    it('formats 1 hour 30 minutes', () => {
      expect(formatDuration(5400)).toBe('1h 30 min');
    });

    it('formats exactly 2 hours', () => {
      expect(formatDuration(7200)).toBe('2h');
    });

    it('formats 2 hours 15 minutes', () => {
      expect(formatDuration(8100)).toBe('2h 15 min');
    });

    it('formats large duration', () => {
      expect(formatDuration(36000)).toBe('10h');
    });
  });

  // ==========================================================================
  // getManeuverIcon
  // ==========================================================================

  describe('getManeuverIcon', () => {
    it('returns arrow-up for undefined', () => {
      expect(getManeuverIcon(undefined)).toBe('arrow-up');
    });

    it('returns arrow-forward for turn-right', () => {
      expect(getManeuverIcon('turn-right')).toBe('arrow-forward');
    });

    it('returns arrow-forward for turn-slight-right', () => {
      expect(getManeuverIcon('turn-slight-right')).toBe('arrow-forward');
    });

    it('returns arrow-back for turn-left', () => {
      expect(getManeuverIcon('turn-left')).toBe('arrow-back');
    });

    it('returns arrow-back for turn-slight-left', () => {
      expect(getManeuverIcon('turn-slight-left')).toBe('arrow-back');
    });

    it('returns return-down-forward for turn-sharp-right', () => {
      expect(getManeuverIcon('turn-sharp-right')).toBe('return-down-forward');
    });

    it('returns return-down-back for turn-sharp-left', () => {
      expect(getManeuverIcon('turn-sharp-left')).toBe('return-down-back');
    });

    it('returns return-up-back for uturn-right', () => {
      expect(getManeuverIcon('uturn-right')).toBe('return-up-back');
    });

    it('returns return-up-back for uturn-left', () => {
      expect(getManeuverIcon('uturn-left')).toBe('return-up-back');
    });

    it('returns sync for roundabout-right', () => {
      expect(getManeuverIcon('roundabout-right')).toBe('sync');
    });

    it('returns sync for roundabout-left', () => {
      expect(getManeuverIcon('roundabout-left')).toBe('sync');
    });

    it('returns git-merge for merge', () => {
      expect(getManeuverIcon('merge')).toBe('git-merge');
    });

    it('returns git-branch for fork-right', () => {
      expect(getManeuverIcon('fork-right')).toBe('git-branch');
    });

    it('returns git-branch for fork-left', () => {
      expect(getManeuverIcon('fork-left')).toBe('git-branch');
    });

    it('returns trending-up for ramp-right', () => {
      expect(getManeuverIcon('ramp-right')).toBe('trending-up');
    });

    it('returns trending-up for ramp-left', () => {
      expect(getManeuverIcon('ramp-left')).toBe('trending-up');
    });

    it('returns arrow-forward for keep-right', () => {
      expect(getManeuverIcon('keep-right')).toBe('arrow-forward');
    });

    it('returns arrow-forward for keep-left', () => {
      expect(getManeuverIcon('keep-left')).toBe('arrow-forward');
    });

    it('returns flag for arrive', () => {
      expect(getManeuverIcon('arrive')).toBe('flag');
    });

    it('returns arrow-up for depart', () => {
      expect(getManeuverIcon('depart')).toBe('arrow-up');
    });

    it('returns arrow-up for straight', () => {
      expect(getManeuverIcon('straight')).toBe('arrow-up');
    });

    it('returns arrow-up for unknown maneuver (default)', () => {
      expect(getManeuverIcon('unknown-maneuver')).toBe('arrow-up');
    });
  });
});
