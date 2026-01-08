/**
 * useMotoristasModals - Tests
 */

import { renderHook, act } from '@testing-library/react-native';

import { useMotoristasModals } from '../useMotoristasModals';

import type { MotoristaDetalhado } from '../../useMotoristasGestor';

const mockMotorista: MotoristaDetalhado = {
  id: 'driver-1',
  email: 'driver@test.com',
  nome: 'João Silva',
  telefone: '11999999999',
  papel: 'motorista',
  ativo: true,
  unidade_id: 'unit-1',
  created_at: new Date().toISOString(),
  nome_unidade: 'Unidade Teste',
};

describe('useMotoristasModals', () => {
  describe('initial state', () => {
    it('returns all modals as closed initially', () => {
      const { result } = renderHook(() => useMotoristasModals());

      expect(result.current.showAddModal).toBe(false);
      expect(result.current.showEditModal).toBe(false);
      expect(result.current.showConfirmModal).toBe(false);
    });

    it('returns null for motorista states initially', () => {
      const { result } = renderHook(() => useMotoristasModals());

      expect(result.current.motoristaEditando).toBeNull();
      expect(result.current.motoristaParaToggle).toBeNull();
    });
  });

  describe('openAddModal', () => {
    it('opens add modal', () => {
      const { result } = renderHook(() => useMotoristasModals());

      act(() => {
        result.current.openAddModal();
      });

      expect(result.current.showAddModal).toBe(true);
    });

    it('calls onOpenAdd callback when provided', () => {
      const onOpenAdd = jest.fn();
      const { result } = renderHook(() => useMotoristasModals({ onOpenAdd }));

      act(() => {
        result.current.openAddModal();
      });

      expect(onOpenAdd).toHaveBeenCalled();
    });
  });

  describe('openEditModal', () => {
    it('opens edit modal with motorista data', () => {
      const { result } = renderHook(() => useMotoristasModals());

      act(() => {
        result.current.openEditModal(mockMotorista);
      });

      expect(result.current.showEditModal).toBe(true);
      expect(result.current.motoristaEditando).toEqual(mockMotorista);
    });

    it('calls onOpenEdit callback when provided', () => {
      const onOpenEdit = jest.fn();
      const { result } = renderHook(() => useMotoristasModals({ onOpenEdit }));

      act(() => {
        result.current.openEditModal(mockMotorista);
      });

      expect(onOpenEdit).toHaveBeenCalledWith(mockMotorista);
    });
  });

  describe('openConfirmModal', () => {
    it('opens confirm modal with motorista data', () => {
      const { result } = renderHook(() => useMotoristasModals());

      act(() => {
        result.current.openConfirmModal(mockMotorista);
      });

      expect(result.current.showConfirmModal).toBe(true);
      expect(result.current.motoristaParaToggle).toEqual(mockMotorista);
    });
  });

  describe('closeAllModals', () => {
    it('closes all modals and resets state', () => {
      const { result } = renderHook(() => useMotoristasModals());

      // Open all modals first
      act(() => {
        result.current.openAddModal();
        result.current.openEditModal(mockMotorista);
        result.current.openConfirmModal(mockMotorista);
      });

      // Close all modals
      act(() => {
        result.current.closeAllModals();
      });

      expect(result.current.showAddModal).toBe(false);
      expect(result.current.showEditModal).toBe(false);
      expect(result.current.showConfirmModal).toBe(false);
      expect(result.current.motoristaEditando).toBeNull();
      expect(result.current.motoristaParaToggle).toBeNull();
    });
  });

  describe('setters', () => {
    it('setShowAddModal works', () => {
      const { result } = renderHook(() => useMotoristasModals());

      act(() => {
        result.current.setShowAddModal(true);
      });

      expect(result.current.showAddModal).toBe(true);
    });

    it('setShowEditModal works', () => {
      const { result } = renderHook(() => useMotoristasModals());

      act(() => {
        result.current.setShowEditModal(true);
      });

      expect(result.current.showEditModal).toBe(true);
    });

    it('setShowConfirmModal works', () => {
      const { result } = renderHook(() => useMotoristasModals());

      act(() => {
        result.current.setShowConfirmModal(true);
      });

      expect(result.current.showConfirmModal).toBe(true);
    });

    it('setMotoristaEditando works', () => {
      const { result } = renderHook(() => useMotoristasModals());

      act(() => {
        result.current.setMotoristaEditando(mockMotorista);
      });

      expect(result.current.motoristaEditando).toEqual(mockMotorista);
    });

    it('setMotoristaParaToggle works', () => {
      const { result } = renderHook(() => useMotoristasModals());

      act(() => {
        result.current.setMotoristaParaToggle(mockMotorista);
      });

      expect(result.current.motoristaParaToggle).toEqual(mockMotorista);
    });
  });
});
