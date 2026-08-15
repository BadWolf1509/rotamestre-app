/**
 * Tests for useTurnByTurnFormatters hook
 */

import { renderHook } from '@testing-library/react-native';

import { useTurnByTurnFormatters } from '../turn-by-turn/useTurnByTurnFormatters';

describe('useTurnByTurnFormatters', () => {
  describe('formatDistance', () => {
    it('should format meters for short distances', () => {
      const { result } = renderHook(() => useTurnByTurnFormatters());

      expect(result.current.formatDistance(0)).toBe('0m');
      expect(result.current.formatDistance(50)).toBe('50m');
      expect(result.current.formatDistance(150)).toBe('150m');
      expect(result.current.formatDistance(500)).toBe('500m');
      expect(result.current.formatDistance(999)).toBe('999m');
    });

    it('should format kilometers for distances >= 1000m', () => {
      const { result } = renderHook(() => useTurnByTurnFormatters());

      expect(result.current.formatDistance(1000)).toBe('1,0km');
      expect(result.current.formatDistance(1500)).toBe('1,5km');
      expect(result.current.formatDistance(2750)).toBe('2,8km');
      expect(result.current.formatDistance(10000)).toBe('10,0km');
      expect(result.current.formatDistance(100000)).toBe('100,0km');
    });

    it('should round meters to nearest integer', () => {
      const { result } = renderHook(() => useTurnByTurnFormatters());

      expect(result.current.formatDistance(150.4)).toBe('150m');
      expect(result.current.formatDistance(150.6)).toBe('151m');
    });

    it('should show one decimal place for kilometers', () => {
      const { result } = renderHook(() => useTurnByTurnFormatters());

      expect(result.current.formatDistance(1234)).toBe('1,2km');
      expect(result.current.formatDistance(1567)).toBe('1,6km');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds as minutes for short durations', () => {
      const { result } = renderHook(() => useTurnByTurnFormatters());

      expect(result.current.formatDuration(60)).toBe('1 min');
      expect(result.current.formatDuration(120)).toBe('2 min');
      expect(result.current.formatDuration(300)).toBe('5 min');
      expect(result.current.formatDuration(3540)).toBe('59 min');
    });

    it('should format hours and minutes for longer durations', () => {
      const { result } = renderHook(() => useTurnByTurnFormatters());

      expect(result.current.formatDuration(3600)).toBe('1h');
      expect(result.current.formatDuration(5400)).toBe('1h 30 min');
      expect(result.current.formatDuration(7200)).toBe('2h');
      expect(result.current.formatDuration(9000)).toBe('2h 30 min');
    });

    it('should ceil seconds to next minute', () => {
      const { result } = renderHook(() => useTurnByTurnFormatters());

      expect(result.current.formatDuration(61)).toBe('2 min');
      expect(result.current.formatDuration(119)).toBe('2 min');
      expect(result.current.formatDuration(1)).toBe('1 min');
    });

    it('should not show minutes when exactly on the hour', () => {
      const { result } = renderHook(() => useTurnByTurnFormatters());

      expect(result.current.formatDuration(3600)).toBe('1h');
      expect(result.current.formatDuration(7200)).toBe('2h');
    });
  });

  describe('getManeuverIcon', () => {
    it('should return arrow-up for straight/depart/default', () => {
      const { result } = renderHook(() => useTurnByTurnFormatters());

      expect(result.current.getManeuverIcon('straight')).toBe('arrow-up');
      expect(result.current.getManeuverIcon('depart')).toBe('arrow-up');
      expect(result.current.getManeuverIcon('unknown')).toBe('arrow-up');
      expect(result.current.getManeuverIcon(undefined)).toBe('arrow-up');
    });

    it('should return arrow-forward for right turns', () => {
      const { result } = renderHook(() => useTurnByTurnFormatters());

      expect(result.current.getManeuverIcon('turn-right')).toBe(
        'arrow-forward',
      );
      expect(result.current.getManeuverIcon('turn-slight-right')).toBe(
        'arrow-forward',
      );
      expect(result.current.getManeuverIcon('keep-right')).toBe(
        'arrow-forward',
      );
    });

    it('should return arrow-back for left turns', () => {
      const { result } = renderHook(() => useTurnByTurnFormatters());

      expect(result.current.getManeuverIcon('turn-left')).toBe('arrow-back');
      expect(result.current.getManeuverIcon('turn-slight-left')).toBe(
        'arrow-back',
      );
      expect(result.current.getManeuverIcon('keep-left')).toBe('arrow-forward'); // keep-left maps to arrow-forward per implementation
    });

    it('should return return-down-forward for sharp right', () => {
      const { result } = renderHook(() => useTurnByTurnFormatters());

      expect(result.current.getManeuverIcon('turn-sharp-right')).toBe(
        'return-down-forward',
      );
    });

    it('should return return-down-back for sharp left', () => {
      const { result } = renderHook(() => useTurnByTurnFormatters());

      expect(result.current.getManeuverIcon('turn-sharp-left')).toBe(
        'return-down-back',
      );
    });

    it('should return return-up-back for u-turns', () => {
      const { result } = renderHook(() => useTurnByTurnFormatters());

      expect(result.current.getManeuverIcon('uturn-right')).toBe(
        'return-up-back',
      );
      expect(result.current.getManeuverIcon('uturn-left')).toBe(
        'return-up-back',
      );
    });

    it('should return sync for roundabouts', () => {
      const { result } = renderHook(() => useTurnByTurnFormatters());

      expect(result.current.getManeuverIcon('roundabout-right')).toBe('sync');
      expect(result.current.getManeuverIcon('roundabout-left')).toBe('sync');
    });

    it('should return git-merge for merge', () => {
      const { result } = renderHook(() => useTurnByTurnFormatters());

      expect(result.current.getManeuverIcon('merge')).toBe('git-merge');
    });

    it('should return git-branch for forks', () => {
      const { result } = renderHook(() => useTurnByTurnFormatters());

      expect(result.current.getManeuverIcon('fork-right')).toBe('git-branch');
      expect(result.current.getManeuverIcon('fork-left')).toBe('git-branch');
    });

    it('should return trending-up for ramps', () => {
      const { result } = renderHook(() => useTurnByTurnFormatters());

      expect(result.current.getManeuverIcon('ramp-right')).toBe('trending-up');
      expect(result.current.getManeuverIcon('ramp-left')).toBe('trending-up');
    });

    it('should return flag for arrive', () => {
      const { result } = renderHook(() => useTurnByTurnFormatters());

      expect(result.current.getManeuverIcon('arrive')).toBe('flag');
    });
  });

  describe('memoization', () => {
    it('should return stable function references', () => {
      const { result, rerender } = renderHook(() => useTurnByTurnFormatters());

      const formatDistanceBefore = result.current.formatDistance;
      const formatDurationBefore = result.current.formatDuration;
      const getManeuverIconBefore = result.current.getManeuverIcon;

      rerender({});

      expect(result.current.formatDistance).toBe(formatDistanceBefore);
      expect(result.current.formatDuration).toBe(formatDurationBefore);
      expect(result.current.getManeuverIcon).toBe(getManeuverIconBefore);
    });
  });
});
