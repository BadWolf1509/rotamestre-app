import { Ionicons } from '@expo/vector-icons';
import { render, fireEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

import {
  DesktopPageLayout,
  BreadcrumbItem,
  UserMenuItem,
} from '../DesktopPageLayout';

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

// Mock NotificationModalContext
jest.mock('@/context/NotificationModalContext', () => ({
  useNotificationModal: jest.fn(() => ({
    isOpen: false,
    openModal: jest.fn(),
    closeModal: jest.fn(),
  })),
}));

// Mock useNotifications hook (now uses context)
jest.mock('@/hooks/useNotifications', () => ({
  useNotifications: jest.fn(() => ({
    notificacoes: [],
    naoLidas: 0,
    loading: false,
    hasMore: false,
    marcarComoLida: jest.fn(),
    marcarTodasComoLidas: jest.fn(),
    refresh: jest.fn(),
    loadMore: jest.fn(),
  })),
}));

// Mock useUnistyles
jest.mock('@/utils/styles', () => {
  const mockTheme = {
    colors: {
      primary: '#0066cc',
      white: '#fff',
      gray50: '#f9fafb',
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray300: '#d1d5db',
      gray400: '#9ca3af',
      gray500: '#6b7280',
      gray600: '#4b5563',
      gray700: '#374151',
      gray900: '#111827',
      error: '#dc2626',
      black: '#000',
      background: '#fff',
      surface: '#fff',
      text: '#000',
      textSecondary: '#6b7280',
      border: '#e5e7eb',
    },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    typography: { xs: 12, sm: 14, base: 16 },
    borderRadius: { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 },
    shadows: { sm: {}, md: {} },
    components: {
      pageLayout: {
        contentPadding: 32,
        headerTitleFontSize: 24,
        headerSubtitleFontSize: 14,
        breadcrumbFontSize: 13,
      },
      statsCard: {
        padding: 20,
        radius: 12,
        valueFontSize: 28,
        labelFontSize: 13,
        labelLetterSpacing: 0.5,
        iconSize: 20,
        iconContainerSize: 32,
        iconContainerRadius: 8,
        changeFontSize: 13,
      },
    },
  };

  return {
    StyleSheet: {
      create: (fn: any) => fn(mockTheme),
    },
    useUnistyles: jest.fn(() => ({
      theme: mockTheme,
    })),
  };
});

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
};

describe('DesktopPageLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  describe('Renderização Básica', () => {
    it('deve renderizar título e children', () => {
      const { getByText } = render(
        <DesktopPageLayout title="Test Title">
          <Text>Page Content</Text>
        </DesktopPageLayout>
      );

      expect(getByText('Test Title')).toBeTruthy();
      expect(getByText('Page Content')).toBeTruthy();
    });

    it('deve renderizar subtitle quando fornecido', () => {
      const { getByText } = render(
        <DesktopPageLayout title="Title" subtitle="Subtitle Text">
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      expect(getByText('Subtitle Text')).toBeTruthy();
    });

    it('não deve renderizar subtitle quando não fornecido', () => {
      const { queryByText } = render(
        <DesktopPageLayout title="Title">
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      // Não deve haver subtitle
      expect(queryByText('Subtitle Text')).toBeNull();
    });
  });

  describe('Loading State', () => {
    it('deve renderizar loading quando loading=true', () => {
      const { getByText, UNSAFE_getByType } = render(
        <DesktopPageLayout title="Title" loading={true}>
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      expect(getByText('Carregando...')).toBeTruthy();
      const { ActivityIndicator } = require('react-native');
      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });

    it('deve renderizar texto de loading customizado', () => {
      const { getByText } = render(
        <DesktopPageLayout title="Title" loading={true} loadingText="Processando...">
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      expect(getByText('Processando...')).toBeTruthy();
    });

    it('não deve renderizar children quando loading=true', () => {
      const { queryByText } = render(
        <DesktopPageLayout title="Title" loading={true}>
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      expect(queryByText('Content')).toBeNull();
    });

    it('não deve renderizar título quando loading=true', () => {
      const { queryByText } = render(
        <DesktopPageLayout title="Title" loading={true}>
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      expect(queryByText('Title')).toBeNull();
    });
  });

  describe('Breadcrumbs', () => {
    it('deve renderizar breadcrumbs quando fornecidos', () => {
      const breadcrumbs: BreadcrumbItem[] = [
        { label: 'Home', route: '/' },
        { label: 'Settings', route: '/settings' },
        { label: 'Profile' },
      ];

      const { getByText } = render(
        <DesktopPageLayout title="Title" breadcrumbs={breadcrumbs}>
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      expect(getByText('Home')).toBeTruthy();
      expect(getByText('Settings')).toBeTruthy();
      expect(getByText('Profile')).toBeTruthy();
    });

    it('deve navegar ao clicar em breadcrumb com route', () => {
      const breadcrumbs: BreadcrumbItem[] = [{ label: 'Home', route: '/' }];

      const { getByText } = render(
        <DesktopPageLayout title="Title" breadcrumbs={breadcrumbs}>
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      const breadcrumb = getByText('Home');
      fireEvent.press(breadcrumb);

      expect(mockRouter.push).toHaveBeenCalledWith('/');
    });

    it('não deve renderizar breadcrumbs quando array vazio', () => {
      const { queryByText } = render(
        <DesktopPageLayout title="Title" breadcrumbs={[]}>
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      // Verificar que não há elementos de breadcrumb
      expect(queryByText('Home')).toBeNull();
    });

    it('deve renderizar separadores entre breadcrumbs', () => {
      const breadcrumbs: BreadcrumbItem[] = [
        { label: 'Home', route: '/' },
        { label: 'Profile' },
      ];

      const { UNSAFE_getAllByType } = render(
        <DesktopPageLayout title="Title" breadcrumbs={breadcrumbs}>
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      const icons = UNSAFE_getAllByType(Ionicons);
      // Deve ter pelo menos 1 separador (chevron-forward)
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Back Button', () => {
    it('deve renderizar botão de voltar quando showBackButton=true', () => {
      const { UNSAFE_getAllByType } = render(
        <DesktopPageLayout title="Title" showBackButton={true}>
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      const icons = UNSAFE_getAllByType(Ionicons);
      const backIcon = icons.find((icon) => icon.props.name === 'arrow-back');
      expect(backIcon).toBeTruthy();
    });

    it('deve chamar onBack quando fornecido', () => {
      const mockOnBack = jest.fn();
      const { UNSAFE_getAllByType } = render(
        <DesktopPageLayout title="Title" showBackButton={true} onBack={mockOnBack}>
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      const icons = UNSAFE_getAllByType(Ionicons);
      const backIcon = icons.find((icon) => icon.props.name === 'arrow-back');

      // Clicar no parent (TouchableOpacity) do ícone
      fireEvent.press(backIcon!.parent!);

      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });

    it('deve chamar router.back() quando onBack não fornecido', () => {
      const { UNSAFE_getAllByType } = render(
        <DesktopPageLayout title="Title" showBackButton={true}>
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      const icons = UNSAFE_getAllByType(Ionicons);
      const backIcon = icons.find((icon) => icon.props.name === 'arrow-back');

      fireEvent.press(backIcon!.parent!);

      expect(mockRouter.back).toHaveBeenCalledTimes(1);
    });

    it('não deve renderizar botão de voltar quando showBackButton=false', () => {
      const { UNSAFE_queryAllByType } = render(
        <DesktopPageLayout title="Title" showBackButton={false}>
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      const icons = UNSAFE_queryAllByType(Ionicons);
      const backIcon = icons.find((icon) => icon.props.name === 'arrow-back');
      expect(backIcon).toBeUndefined();
    });
  });

  describe('Action Buttons', () => {
    it('deve renderizar action buttons quando fornecidos', () => {
      const actions = [
        { label: 'Save', onPress: jest.fn() },
        { label: 'Cancel', onPress: jest.fn(), variant: 'secondary' as const },
      ];

      const { getByText } = render(
        <DesktopPageLayout title="Title" actions={actions}>
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      expect(getByText('Save')).toBeTruthy();
      expect(getByText('Cancel')).toBeTruthy();
    });

    it('deve chamar onPress ao clicar no action button', () => {
      const mockOnPress = jest.fn();
      const actions = [{ label: 'Save', onPress: mockOnPress }];

      const { getByText } = render(
        <DesktopPageLayout title="Title" actions={actions}>
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      fireEvent.press(getByText('Save'));

      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it('deve renderizar ícone quando action tem icon', () => {
      const actions = [
        { label: 'Save', icon: 'save' as keyof typeof Ionicons.glyphMap, onPress: jest.fn() },
      ];

      const { UNSAFE_getAllByType } = render(
        <DesktopPageLayout title="Title" actions={actions}>
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      const icons = UNSAFE_getAllByType(Ionicons);
      const saveIcon = icons.find((icon) => icon.props.name === 'save');
      expect(saveIcon).toBeTruthy();
    });

    it('deve renderizar botão com disabled=true', () => {
      const mockOnPress = jest.fn();
      const actions = [{ label: 'Save', onPress: mockOnPress, disabled: true }];

      const { getByText } = render(
        <DesktopPageLayout title="Title" actions={actions}>
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      // Verificar que o botão foi renderizado
      expect(getByText('Save')).toBeTruthy();
    });

    it('deve renderizar button primary (default)', () => {
      const actions = [{ label: 'Primary', onPress: jest.fn() }];

      const { getByText } = render(
        <DesktopPageLayout title="Title" actions={actions}>
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      expect(getByText('Primary')).toBeTruthy();
    });

    it('deve renderizar button secondary', () => {
      const actions = [{ label: 'Secondary', onPress: jest.fn(), variant: 'secondary' as const }];

      const { getByText } = render(
        <DesktopPageLayout title="Title" actions={actions}>
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      expect(getByText('Secondary')).toBeTruthy();
    });

    it('deve renderizar button ghost', () => {
      const actions = [{ label: 'Ghost', onPress: jest.fn(), variant: 'ghost' as const }];

      const { getByText } = render(
        <DesktopPageLayout title="Title" actions={actions}>
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      expect(getByText('Ghost')).toBeTruthy();
    });
  });

  describe('User Menu', () => {
    let mockDocument: any;

    beforeEach(() => {
      // Mock document for web-specific code
      mockDocument = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };
      (global as any).document = mockDocument;
    });

    afterEach(() => {
      // Keep document mock during cleanup to prevent errors
      jest.clearAllMocks();
    });

    afterAll(() => {
      // Clean up document mock after all tests
      delete (global as any).document;
    });

    it('deve renderizar userMenuTrigger quando fornecido', () => {
      const userMenuItems: UserMenuItem[] = [
        { label: 'Profile', icon: 'person', onPress: jest.fn() },
      ];

      const { getByText } = render(
        <DesktopPageLayout
          title="Title"
          userMenuTrigger={<Text>User Menu</Text>}
          userMenuItems={userMenuItems}
        >
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      expect(getByText('User Menu')).toBeTruthy();
    });

    it('não deve renderizar menu quando userMenuItems vazio', () => {
      const { queryByText } = render(
        <DesktopPageLayout
          title="Title"
          userMenuTrigger={<Text>User Menu</Text>}
          userMenuItems={[]}
        >
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      expect(queryByText('User Menu')).toBeNull();
    });

    it('deve abrir menu ao clicar no trigger', () => {
      const userMenuItems: UserMenuItem[] = [
        { label: 'Profile', icon: 'person', onPress: jest.fn() },
      ];

      const { getByText } = render(
        <DesktopPageLayout
          title="Title"
          userMenuTrigger={<Text>User Menu</Text>}
          userMenuItems={userMenuItems}
        >
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      // Clicar no trigger - deve abrir o menu
      fireEvent.press(getByText('User Menu'));

      // Menu deve estar aberto (Profile renderizado)
      expect(getByText('Profile')).toBeTruthy();
    });

    it('deve fechar menu ao clicar novamente no trigger', () => {
      const userMenuItems: UserMenuItem[] = [
        { label: 'Profile', icon: 'person', onPress: jest.fn() },
      ];

      const { getByText, queryByText } = render(
        <DesktopPageLayout
          title="Title"
          userMenuTrigger={<Text>User Menu</Text>}
          userMenuItems={userMenuItems}
        >
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      // Abrir menu
      fireEvent.press(getByText('User Menu'));
      expect(getByText('Profile')).toBeTruthy();

      // Clicar novamente no trigger
      fireEvent.press(getByText('User Menu'));

      // Menu deve estar fechado
      expect(queryByText('Profile')).toBeNull();
    });

    it('deve chamar onPress do menu item ao clicar', () => {
      const mockOnPress = jest.fn();
      const userMenuItems: UserMenuItem[] = [
        { label: 'Profile', icon: 'person', onPress: mockOnPress },
      ];

      const { getByText } = render(
        <DesktopPageLayout
          title="Title"
          userMenuTrigger={<Text>User Menu</Text>}
          userMenuItems={userMenuItems}
        >
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      // Abrir menu
      fireEvent.press(getByText('User Menu'));

      // Clicar no item
      fireEvent.press(getByText('Profile'));

      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it('deve fechar menu após clicar em item', () => {
      const userMenuItems: UserMenuItem[] = [
        { label: 'Profile', icon: 'person', onPress: jest.fn() },
      ];

      const { getByText, queryByText } = render(
        <DesktopPageLayout
          title="Title"
          userMenuTrigger={<Text>User Menu</Text>}
          userMenuItems={userMenuItems}
        >
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      // Abrir menu
      fireEvent.press(getByText('User Menu'));
      expect(getByText('Profile')).toBeTruthy();

      // Clicar no item
      fireEvent.press(getByText('Profile'));

      // Menu deve estar fechado
      expect(queryByText('Profile')).toBeNull();
    });

    it('deve renderizar menu item com ícone', () => {
      const userMenuItems: UserMenuItem[] = [
        { label: 'Profile', icon: 'person', onPress: jest.fn() },
      ];

      const { getByText, UNSAFE_getAllByType } = render(
        <DesktopPageLayout
          title="Title"
          userMenuTrigger={<Text>User Menu</Text>}
          userMenuItems={userMenuItems}
        >
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      // Abrir menu
      fireEvent.press(getByText('User Menu'));

      const icons = UNSAFE_getAllByType(Ionicons);
      const personIcon = icons.find((icon) => icon.props.name === 'person');
      expect(personIcon).toBeTruthy();
    });

    it('deve renderizar menu item destructive', () => {
      const userMenuItems: UserMenuItem[] = [
        { label: 'Logout', icon: 'log-out', onPress: jest.fn(), destructive: true },
      ];

      const { getByText } = render(
        <DesktopPageLayout
          title="Title"
          userMenuTrigger={<Text>User Menu</Text>}
          userMenuItems={userMenuItems}
        >
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      // Abrir menu
      fireEvent.press(getByText('User Menu'));

      expect(getByText('Logout')).toBeTruthy();
    });

    it('deve renderizar trigger como função', () => {
      const userMenuItems: UserMenuItem[] = [
        { label: 'Profile', onPress: jest.fn() },
      ];

      const { getByText } = render(
        <DesktopPageLayout
          title="Title"
          userMenuTrigger={(isOpen) => <Text>{isOpen ? 'Close' : 'Open'}</Text>}
          userMenuItems={userMenuItems}
        >
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      // Estado inicial (fechado)
      expect(getByText('Open')).toBeTruthy();

      // Abrir menu
      fireEvent.press(getByText('Open'));
      expect(getByText('Close')).toBeTruthy();
    });

    it('deve adicionar event listener quando menu abre', () => {
      const userMenuItems: UserMenuItem[] = [
        { label: 'Profile', onPress: jest.fn() },
      ];

      const { getByText } = render(
        <DesktopPageLayout
          title="Title"
          userMenuTrigger={<Text>User Menu</Text>}
          userMenuItems={userMenuItems}
        >
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      // Abrir menu
      fireEvent.press(getByText('User Menu'));

      // Verificar que event listener foi adicionado
      expect((global as any).document.addEventListener).toHaveBeenCalledWith(
        'mousedown',
        expect.any(Function)
      );
    });

    it('deve remover event listener quando componente desmonta', () => {
      const userMenuItems: UserMenuItem[] = [
        { label: 'Profile', onPress: jest.fn() },
      ];

      const { getByText, unmount } = render(
        <DesktopPageLayout
          title="Title"
          userMenuTrigger={<Text>User Menu</Text>}
          userMenuItems={userMenuItems}
        >
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      // Abrir menu
      fireEvent.press(getByText('User Menu'));

      // Desmontar componente
      unmount();

      // Verificar que event listener foi removido
      expect((global as any).document.removeEventListener).toHaveBeenCalledWith(
        'mousedown',
        expect.any(Function)
      );
    });

    it('deve renderizar múltiplos menu items', () => {
      const userMenuItems: UserMenuItem[] = [
        { label: 'Profile', icon: 'person', onPress: jest.fn() },
        { label: 'Settings', icon: 'settings', onPress: jest.fn() },
        { label: 'Logout', icon: 'log-out', onPress: jest.fn(), destructive: true },
      ];

      const { getByText } = render(
        <DesktopPageLayout
          title="Title"
          userMenuTrigger={<Text>User Menu</Text>}
          userMenuItems={userMenuItems}
        >
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      // Abrir menu
      fireEvent.press(getByText('User Menu'));

      expect(getByText('Profile')).toBeTruthy();
      expect(getByText('Settings')).toBeTruthy();
      expect(getByText('Logout')).toBeTruthy();
    });
  });

  describe('Header Extra', () => {
    it('deve renderizar headerExtra quando fornecido', () => {
      const { getByText } = render(
        <DesktopPageLayout title="Title" headerExtra={<Text>Extra Content</Text>}>
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      expect(getByText('Extra Content')).toBeTruthy();
    });
  });

  describe('Layout Props', () => {
    it('deve aplicar fullWidth quando fullWidth=true', () => {
      const { getByText } = render(
        <DesktopPageLayout title="Title" fullWidth={true}>
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      expect(getByText('Content')).toBeTruthy();
    });

    it('deve aplicar noPadding quando noPadding=true', () => {
      const { getByText } = render(
        <DesktopPageLayout title="Title" noPadding={true}>
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      expect(getByText('Content')).toBeTruthy();
    });

    it('deve passar scrollViewProps para ScrollView', () => {
      const { UNSAFE_getByType } = render(
        <DesktopPageLayout
          title="Title"
          scrollViewProps={{ testID: 'custom-scroll', bounces: false }}
        >
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      const { ScrollView } = require('react-native');
      const scrollView = UNSAFE_getByType(ScrollView);

      expect(scrollView.props.testID).toBe('custom-scroll');
      expect(scrollView.props.bounces).toBe(false);
    });

    it('deve passar contentContainerStyle via scrollViewProps', () => {
      const customStyle = { paddingTop: 100 };

      const { UNSAFE_getByType } = render(
        <DesktopPageLayout
          title="Title"
          scrollViewProps={{ contentContainerStyle: customStyle }}
        >
          <Text>Content</Text>
        </DesktopPageLayout>
      );

      const { ScrollView } = require('react-native');
      const scrollView = UNSAFE_getByType(ScrollView);

      // Verificar que contentContainerStyle foi aplicado
      expect(scrollView.props.contentContainerStyle).toContainEqual(
        expect.objectContaining(customStyle)
      );
    });
  });

  describe('Renderização Completa', () => {
    it('deve renderizar todos os elementos juntos', async () => {
      const breadcrumbs: BreadcrumbItem[] = [{ label: 'Home', route: '/' }];
      const actions = [{ label: 'Save', onPress: jest.fn() }];
      const userMenuItems: UserMenuItem[] = [{ label: 'Profile', onPress: jest.fn() }];

      const { getByText } = render(
        <DesktopPageLayout
          title="Complete Page"
          subtitle="With all features"
          breadcrumbs={breadcrumbs}
          actions={actions}
          showBackButton={true}
          headerExtra={<Text>Extra</Text>}
          userMenuTrigger={<Text>Menu</Text>}
          userMenuItems={userMenuItems}
        >
          <Text>Page Content</Text>
        </DesktopPageLayout>
      );

      expect(getByText('Home')).toBeTruthy();
      expect(getByText('Complete Page')).toBeTruthy();
      expect(getByText('With all features')).toBeTruthy();
      expect(getByText('Save')).toBeTruthy();
      expect(getByText('Extra')).toBeTruthy();
      expect(getByText('Menu')).toBeTruthy();
      expect(getByText('Page Content')).toBeTruthy();
    });
  });
});
