/**
 * motoristas-gestor Barrel Export - Tests
 */

import {
  useMotoristasForm,
  useMotoristasModals,
  useMotoristasOperations,
} from '../index';

import type {
  UseMotoristasFormReturn,
  UseMotoristasModalsReturn,
  UseMotoristasOperationsReturn,
} from '../index';

describe('motoristas-gestor/index', () => {
  describe('hook exports', () => {
    it('exports useMotoristasForm', () => {
      expect(useMotoristasForm).toBeDefined();
      expect(typeof useMotoristasForm).toBe('function');
    });

    it('exports useMotoristasModals', () => {
      expect(useMotoristasModals).toBeDefined();
      expect(typeof useMotoristasModals).toBe('function');
    });

    it('exports useMotoristasOperations', () => {
      expect(useMotoristasOperations).toBeDefined();
      expect(typeof useMotoristasOperations).toBe('function');
    });
  });

  describe('type exports', () => {
    it('exports UseMotoristasFormReturn type that can be used', () => {
      // This is a compile-time check - if types are exported correctly,
      // this will compile without errors
      const formReturn: Partial<UseMotoristasFormReturn> = {
        loading: false,
      };
      expect(formReturn.loading).toBe(false);
    });

    it('exports UseMotoristasModalsReturn type that can be used', () => {
      const modalsReturn: Partial<UseMotoristasModalsReturn> = {
        showAddModal: false,
        showEditModal: false,
      };
      expect(modalsReturn.showAddModal).toBe(false);
    });

    it('exports UseMotoristasOperationsReturn type that can be used', () => {
      const operationsReturn: Partial<UseMotoristasOperationsReturn> = {
        motoristas: [],
        loading: false,
      };
      expect(operationsReturn.motoristas).toEqual([]);
    });
  });
});
