/**
 * useMapaRotaModals - Tests
 */

import { renderHook, act } from '@testing-library/react-native';

import { useMapaRotaModals } from '../useMapaRotaModals';

describe('useMapaRotaModals', () => {
  describe('initial state', () => {
    it('returns all modals as closed initially', () => {
      const { result } = renderHook(() => useMapaRotaModals());

      expect(result.current.showCancelModal).toBe(false);
      expect(result.current.showReactivateModal).toBe(false);
      expect(result.current.showChangeDriverModal).toBe(false);
      expect(result.current.showRemoveStopModal).toBe(false);
      expect(result.current.showEditStopModal).toBe(false);
      expect(result.current.showAddStopModal).toBe(false);
      expect(result.current.showReorderModal).toBe(false);
      expect(result.current.showReorderConfirmClose).toBe(false);
    });
  });

  describe('cancel modal', () => {
    it('opens cancel modal', () => {
      const { result } = renderHook(() => useMapaRotaModals());

      act(() => {
        result.current.openCancelModal();
      });

      expect(result.current.showCancelModal).toBe(true);
    });

    it('closes cancel modal', () => {
      const { result } = renderHook(() => useMapaRotaModals());

      act(() => {
        result.current.openCancelModal();
      });

      act(() => {
        result.current.closeCancelModal();
      });

      expect(result.current.showCancelModal).toBe(false);
    });
  });

  describe('reactivate modal', () => {
    it('opens reactivate modal', () => {
      const { result } = renderHook(() => useMapaRotaModals());

      act(() => {
        result.current.openReactivateModal();
      });

      expect(result.current.showReactivateModal).toBe(true);
    });

    it('closes reactivate modal', () => {
      const { result } = renderHook(() => useMapaRotaModals());

      act(() => {
        result.current.openReactivateModal();
        result.current.closeReactivateModal();
      });

      expect(result.current.showReactivateModal).toBe(false);
    });
  });

  describe('change driver modal', () => {
    it('opens change driver modal', () => {
      const { result } = renderHook(() => useMapaRotaModals());

      act(() => {
        result.current.openChangeDriverModal();
      });

      expect(result.current.showChangeDriverModal).toBe(true);
    });

    it('closes change driver modal', () => {
      const { result } = renderHook(() => useMapaRotaModals());

      act(() => {
        result.current.openChangeDriverModal();
        result.current.closeChangeDriverModal();
      });

      expect(result.current.showChangeDriverModal).toBe(false);
    });
  });

  describe('remove stop modal', () => {
    it('opens remove stop modal', () => {
      const { result } = renderHook(() => useMapaRotaModals());

      act(() => {
        result.current.openRemoveStopModal();
      });

      expect(result.current.showRemoveStopModal).toBe(true);
    });

    it('closes remove stop modal', () => {
      const { result } = renderHook(() => useMapaRotaModals());

      act(() => {
        result.current.openRemoveStopModal();
        result.current.closeRemoveStopModal();
      });

      expect(result.current.showRemoveStopModal).toBe(false);
    });
  });

  describe('edit stop modal', () => {
    it('opens edit stop modal', () => {
      const { result } = renderHook(() => useMapaRotaModals());

      act(() => {
        result.current.openEditStopModal();
      });

      expect(result.current.showEditStopModal).toBe(true);
    });

    it('closes edit stop modal', () => {
      const { result } = renderHook(() => useMapaRotaModals());

      act(() => {
        result.current.openEditStopModal();
        result.current.closeEditStopModal();
      });

      expect(result.current.showEditStopModal).toBe(false);
    });
  });

  describe('add stop modal', () => {
    it('opens add stop modal', () => {
      const { result } = renderHook(() => useMapaRotaModals());

      act(() => {
        result.current.openAddStopModal();
      });

      expect(result.current.showAddStopModal).toBe(true);
    });

    it('closes add stop modal', () => {
      const { result } = renderHook(() => useMapaRotaModals());

      act(() => {
        result.current.openAddStopModal();
        result.current.closeAddStopModal();
      });

      expect(result.current.showAddStopModal).toBe(false);
    });
  });

  describe('reorder modal', () => {
    it('opens reorder modal', () => {
      const { result } = renderHook(() => useMapaRotaModals());

      act(() => {
        result.current.openReorderModal();
      });

      expect(result.current.showReorderModal).toBe(true);
    });

    it('closes reorder modal', () => {
      const { result } = renderHook(() => useMapaRotaModals());

      act(() => {
        result.current.openReorderModal();
        result.current.closeReorderModal();
      });

      expect(result.current.showReorderModal).toBe(false);
    });
  });

  describe('reorder confirm close modal', () => {
    it('opens reorder confirm close modal', () => {
      const { result } = renderHook(() => useMapaRotaModals());

      act(() => {
        result.current.openReorderConfirmClose();
      });

      expect(result.current.showReorderConfirmClose).toBe(true);
    });

    it('closes reorder confirm close modal', () => {
      const { result } = renderHook(() => useMapaRotaModals());

      act(() => {
        result.current.openReorderConfirmClose();
        result.current.closeReorderConfirmClose();
      });

      expect(result.current.showReorderConfirmClose).toBe(false);
    });
  });
});
