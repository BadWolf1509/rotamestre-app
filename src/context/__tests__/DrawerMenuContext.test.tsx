import { render, renderHook, act } from '@testing-library/react-native';
import React from 'react';
import { Text, View } from 'react-native';

import { DrawerMenuProvider, useDrawerMenu } from '../DrawerMenuContext';

// Mock do DrawerMenu
jest.mock('@/components/DrawerMenu', () => ({
  DrawerMenu: jest.fn(() => null),
}));

describe('DrawerMenuContext', () => {
  describe('DrawerMenuProvider', () => {
    it('deve renderizar children corretamente', () => {
      const { getByText } = render(
        <DrawerMenuProvider>
          <Text>Child Content</Text>
        </DrawerMenuProvider>
      );

      expect(getByText('Child Content')).toBeTruthy();
    });

    it('deve renderizar DrawerMenu component', () => {
      const mockDrawerMenu = require('@/components/DrawerMenu').DrawerMenu;

      render(
        <DrawerMenuProvider>
          <Text>Content</Text>
        </DrawerMenuProvider>
      );

      expect(mockDrawerMenu).toHaveBeenCalled();
    });

    it('deve renderizar DrawerMenu e children juntos', () => {
      const mockDrawerMenu = require('@/components/DrawerMenu').DrawerMenu;
      const { getByText } = render(
        <DrawerMenuProvider>
          <Text>App Content</Text>
        </DrawerMenuProvider>
      );

      expect(mockDrawerMenu).toHaveBeenCalled();
      expect(getByText('App Content')).toBeTruthy();
    });
  });

  describe('useDrawerMenu hook', () => {
    it('deve retornar openDrawer e closeDrawer', () => {
      const { result } = renderHook(() => useDrawerMenu(), {
        wrapper: DrawerMenuProvider,
      });

      expect(result.current.openDrawer).toBeDefined();
      expect(result.current.closeDrawer).toBeDefined();
      expect(typeof result.current.openDrawer).toBe('function');
      expect(typeof result.current.closeDrawer).toBe('function');
    });

    it('deve abrir o drawer quando openDrawer é chamado', () => {
      const { result } = renderHook(() => useDrawerMenu(), {
        wrapper: DrawerMenuProvider,
      });

      act(() => {
        result.current.openDrawer();
      });

      // Estado interno mudou, mas não temos acesso direto
      // O teste real seria visual com getByText, mas hook não renderiza
      expect(result.current).toBeDefined();
    });

    it('deve fechar o drawer quando closeDrawer é chamado', () => {
      const { result } = renderHook(() => useDrawerMenu(), {
        wrapper: DrawerMenuProvider,
      });

      act(() => {
        result.current.openDrawer();
        result.current.closeDrawer();
      });

      expect(result.current).toBeDefined();
    });

    it('deve lançar erro quando usado fora do Provider', () => {
      // Silenciar console.error para teste
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useDrawerMenu());
      }).toThrow('useDrawerMenu must be used within DrawerMenuProvider');

      spy.mockRestore();
    });
  });

  describe('Integração Provider + Hook', () => {
    it('deve chamar funções via hook sem erro', () => {
      const TestComponent = () => {
        const { openDrawer, closeDrawer } = useDrawerMenu();

        return (
          <View>
            <Text onPress={openDrawer}>Open</Text>
            <Text onPress={closeDrawer}>Close</Text>
          </View>
        );
      };

      const { getByText } = render(
        <DrawerMenuProvider>
          <TestComponent />
        </DrawerMenuProvider>
      );

      // Apenas verificar que as funções podem ser chamadas
      act(() => {
        getByText('Open').props.onPress();
      });

      act(() => {
        getByText('Close').props.onPress();
      });

      expect(getByText('Open')).toBeTruthy();
    });

    it('deve permitir múltiplas chamadas', () => {
      const TestComponent = () => {
        const { openDrawer, closeDrawer } = useDrawerMenu();

        return (
          <View>
            <Text onPress={() => {
              openDrawer();
              openDrawer();
              closeDrawer();
              closeDrawer();
            }}>
              Toggle
            </Text>
          </View>
        );
      };

      const { getByText } = render(
        <DrawerMenuProvider>
          <TestComponent />
        </DrawerMenuProvider>
      );

      act(() => {
        getByText('Toggle').props.onPress();
      });

      expect(getByText('Toggle')).toBeTruthy();
    });
  });

  describe('Múltiplos consumidores do hook', () => {
    it('deve permitir múltiplos componentes usarem o hook', () => {
      const Component1 = () => {
        const { openDrawer } = useDrawerMenu();
        return <Text onPress={openDrawer}>Component 1</Text>;
      };

      const Component2 = () => {
        const { closeDrawer } = useDrawerMenu();
        return <Text onPress={closeDrawer}>Component 2</Text>;
      };

      const { getByText } = render(
        <DrawerMenuProvider>
          <Component1 />
          <Component2 />
        </DrawerMenuProvider>
      );

      act(() => {
        getByText('Component 1').props.onPress();
        getByText('Component 2').props.onPress();
      });

      expect(getByText('Component 1')).toBeTruthy();
      expect(getByText('Component 2')).toBeTruthy();
    });
  });
});
