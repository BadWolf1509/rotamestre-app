/**
 * @jest-environment jsdom
 */

/**
 * Tests for usePipDrag hook
 *
 * Tests mouse/touch drag, snap-to-edge, and swipe-to-close gesture
 */
import { renderHook, act } from '@testing-library/react-native';

import { EDGE_PADDING, PIP_WIDTH, PIP_HEIGHT, SWIPE_DOWN_THRESHOLD } from '../constants';
import { usePipDrag } from '../usePipDrag';

// Default options factory
function createOptions(overrides: Partial<Parameters<typeof usePipDrag>[0]> = {}) {
  const positionRef = { current: { x: EDGE_PADDING, y: EDGE_PADDING } };
  return {
    isExpanded: false,
    viewport: { width: 1024, height: 768 },
    positionRef,
    setPosition: jest.fn((pos) => { positionRef.current = pos; }),
    onClose: jest.fn(),
    savePosition: jest.fn(),
    ...overrides,
  };
}

describe('usePipDrag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('starts with isDragging false', () => {
      const options = createOptions();
      const { result } = renderHook(() => usePipDrag(options));

      expect(result.current.isDragging).toBe(false);
    });

    it('returns handler functions', () => {
      const options = createOptions();
      const { result } = renderHook(() => usePipDrag(options));

      expect(typeof result.current.handleMouseDown).toBe('function');
      expect(typeof result.current.handleTouchStart).toBe('function');
      expect(typeof result.current.snapToEdge).toBe('function');
    });
  });

  describe('snapToEdge', () => {
    it('snaps to left edge when PiP is on the left half', () => {
      const options = createOptions();
      // Position PiP on the left side
      options.positionRef.current = { x: 50, y: 100 };

      const { result } = renderHook(() => usePipDrag(options));

      act(() => { result.current.snapToEdge(); });

      expect(options.setPosition).toHaveBeenCalledWith(
        expect.objectContaining({ x: EDGE_PADDING }),
      );
    });

    it('snaps to right edge when PiP is on the right half', () => {
      const options = createOptions();
      // Position PiP on the right side (center past midpoint)
      options.positionRef.current = { x: 800, y: 100 };

      const { result } = renderHook(() => usePipDrag(options));

      act(() => { result.current.snapToEdge(); });

      const expectedX = options.viewport.width - PIP_WIDTH - EDGE_PADDING;
      expect(options.setPosition).toHaveBeenCalledWith(
        expect.objectContaining({ x: expectedX }),
      );
    });

    it('clamps Y to minimum (EDGE_PADDING)', () => {
      const options = createOptions();
      options.positionRef.current = { x: 50, y: -50 };

      const { result } = renderHook(() => usePipDrag(options));

      act(() => { result.current.snapToEdge(); });

      expect(options.setPosition).toHaveBeenCalledWith(
        expect.objectContaining({ y: EDGE_PADDING }),
      );
    });

    it('clamps Y to maximum (viewport - PIP_HEIGHT - padding - 60)', () => {
      const options = createOptions();
      options.positionRef.current = { x: 50, y: 9999 };

      const { result } = renderHook(() => usePipDrag(options));

      act(() => { result.current.snapToEdge(); });

      const maxY = options.viewport.height - PIP_HEIGHT - EDGE_PADDING - 60;
      expect(options.setPosition).toHaveBeenCalledWith(
        expect.objectContaining({ y: maxY }),
      );
    });

    it('saves snapped position', () => {
      const options = createOptions();
      options.positionRef.current = { x: 50, y: 100 };

      const { result } = renderHook(() => usePipDrag(options));

      act(() => { result.current.snapToEdge(); });

      expect(options.savePosition).toHaveBeenCalled();
    });

    it('updates positionRef', () => {
      const options = createOptions();
      options.positionRef.current = { x: 50, y: 100 };

      const { result } = renderHook(() => usePipDrag(options));

      act(() => { result.current.snapToEdge(); });

      expect(options.positionRef.current.x).toBe(EDGE_PADDING);
    });
  });

  describe('mouse drag', () => {
    it('starts drag on mousedown', () => {
      const options = createOptions();
      const { result } = renderHook(() => usePipDrag(options));

      const event = {
        clientX: 100,
        clientY: 100,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any;

      act(() => { result.current.handleMouseDown(event); });

      expect(result.current.isDragging).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('does not start drag when expanded', () => {
      const options = createOptions({ isExpanded: true });
      const { result } = renderHook(() => usePipDrag(options));

      const event = {
        clientX: 100,
        clientY: 100,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any;

      act(() => { result.current.handleMouseDown(event); });

      expect(result.current.isDragging).toBe(false);
    });

    it('adds window event listeners when dragging starts', () => {
      const options = createOptions();
      const addSpy = jest.spyOn(window, 'addEventListener');
      const { result } = renderHook(() => usePipDrag(options));

      const event = {
        clientX: 100,
        clientY: 100,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any;

      act(() => { result.current.handleMouseDown(event); });

      expect(addSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(addSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));

      addSpy.mockRestore();
    });

    it('removes window event listeners when drag ends', () => {
      const options = createOptions();
      const addSpy = jest.spyOn(window, 'addEventListener');
      const removeSpy = jest.spyOn(window, 'removeEventListener');
      const { result } = renderHook(() => usePipDrag(options));

      // Start drag
      const downEvent = {
        clientX: 100,
        clientY: 100,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any;

      act(() => { result.current.handleMouseDown(downEvent); });

      // Get the registered mouseup handler from addEventListener calls
      const mouseUpCall = addSpy.mock.calls.find(
        (call) => call[0] === 'mouseup',
      );
      const mouseUpHandler = mouseUpCall?.[1] as Function;
      expect(mouseUpHandler).toBeDefined();

      // Call it directly to simulate mouseup
      act(() => { mouseUpHandler(); });

      // After mouseup, isDragging becomes false → effect cleanup removes listeners
      expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });

  describe('touch drag', () => {
    it('starts drag on touchstart', () => {
      const options = createOptions();
      const { result } = renderHook(() => usePipDrag(options));

      const event = {
        touches: [{ clientX: 100, clientY: 100 }],
        stopPropagation: jest.fn(),
      } as any;

      act(() => { result.current.handleTouchStart(event); });

      expect(result.current.isDragging).toBe(true);
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('does not start touch drag when expanded', () => {
      const options = createOptions({ isExpanded: true });
      const { result } = renderHook(() => usePipDrag(options));

      const event = {
        touches: [{ clientX: 100, clientY: 100 }],
        stopPropagation: jest.fn(),
      } as any;

      act(() => { result.current.handleTouchStart(event); });

      expect(result.current.isDragging).toBe(false);
    });

    it('adds touch event listeners when dragging starts', () => {
      const options = createOptions();
      const addSpy = jest.spyOn(window, 'addEventListener');
      const { result } = renderHook(() => usePipDrag(options));

      const event = {
        touches: [{ clientX: 100, clientY: 100 }],
        stopPropagation: jest.fn(),
      } as any;

      act(() => { result.current.handleTouchStart(event); });

      expect(addSpy).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: true });
      expect(addSpy).toHaveBeenCalledWith('touchend', expect.any(Function));

      addSpy.mockRestore();
    });
  });

  describe('swipe-to-close', () => {
    it('calls onClose when swiped down past threshold', () => {
      const options = createOptions();
      options.positionRef.current = { x: 50, y: 50 };
      const addSpy = jest.spyOn(window, 'addEventListener');

      const { result } = renderHook(() => usePipDrag(options));

      // Start drag
      const downEvent = {
        clientX: 100,
        clientY: 100,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any;

      act(() => { result.current.handleMouseDown(downEvent); });

      // Simulate position change (dragged down past threshold)
      options.positionRef.current = {
        x: 50,
        y: 50 + SWIPE_DOWN_THRESHOLD + 10,
      };

      // Get and call the registered mouseup handler
      const mouseUpCall = addSpy.mock.calls.find((c) => c[0] === 'mouseup');
      const mouseUpHandler = mouseUpCall?.[1] as Function;

      act(() => { mouseUpHandler(); });

      expect(options.onClose).toHaveBeenCalled();
      addSpy.mockRestore();
    });

    it('snaps to edge when swipe is below threshold', () => {
      const options = createOptions();
      options.positionRef.current = { x: 50, y: 50 };
      const addSpy = jest.spyOn(window, 'addEventListener');

      const { result } = renderHook(() => usePipDrag(options));

      // Start drag
      const downEvent = {
        clientX: 100,
        clientY: 100,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any;

      act(() => { result.current.handleMouseDown(downEvent); });

      // Small move (below threshold)
      options.positionRef.current = { x: 50, y: 60 };

      const mouseUpCall = addSpy.mock.calls.find((c) => c[0] === 'mouseup');
      const mouseUpHandler = mouseUpCall?.[1] as Function;

      act(() => { mouseUpHandler(); });

      expect(options.onClose).not.toHaveBeenCalled();
      expect(options.savePosition).toHaveBeenCalled();
      addSpy.mockRestore();
    });
  });

  describe('boundary detection', () => {
    it('handles small viewport correctly', () => {
      const options = createOptions({
        viewport: { width: 400, height: 300 },
      });
      options.positionRef.current = { x: 300, y: 200 };

      const { result } = renderHook(() => usePipDrag(options));

      act(() => { result.current.snapToEdge(); });

      const expectedX = 400 - PIP_WIDTH - EDGE_PADDING;
      const maxY = 300 - PIP_HEIGHT - EDGE_PADDING - 60;
      const expectedY = Math.max(EDGE_PADDING, Math.min(maxY, 200));

      expect(options.setPosition).toHaveBeenCalledWith({ x: expectedX, y: expectedY });
    });

    it('snap determines side by center of PiP', () => {
      const options = createOptions();
      // Place PiP so its center is exactly at viewport midpoint
      const centerPosition = options.viewport.width / 2 - PIP_WIDTH / 2;
      options.positionRef.current = { x: centerPosition, y: 100 };

      const { result } = renderHook(() => usePipDrag(options));

      act(() => { result.current.snapToEdge(); });

      // center = centerPosition + PIP_WIDTH/2 = viewport.width/2
      // Since centerX is NOT strictly less than viewport.width/2, it snaps to right
      const expectedX = options.viewport.width - PIP_WIDTH - EDGE_PADDING;
      expect(options.setPosition).toHaveBeenCalledWith(
        expect.objectContaining({ x: expectedX }),
      );
    });
  });

  describe('cleanup', () => {
    it('adds listeners while dragging and cleans up on unmount', () => {
      const options = createOptions();
      const addSpy = jest.spyOn(window, 'addEventListener');
      const removeSpy = jest.spyOn(window, 'removeEventListener');
      const { result, unmount } = renderHook(() => usePipDrag(options));

      // Start drag
      const event = {
        clientX: 100,
        clientY: 100,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any;

      act(() => { result.current.handleMouseDown(event); });

      // Verify listeners were added
      expect(addSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(addSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(addSpy).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: true });
      expect(addSpy).toHaveBeenCalledWith('touchend', expect.any(Function));

      unmount();

      // Verify cleanup
      expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('touchend', expect.any(Function));

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });
});
