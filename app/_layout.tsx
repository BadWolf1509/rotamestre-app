import {
  NunitoSans_300Light,
  NunitoSans_400Regular,
  NunitoSans_500Medium,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
  NunitoSans_800ExtraBold,
} from '@expo-google-fonts/nunito-sans';
import { Viga_400Regular } from '@expo-google-fonts/viga';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { Platform, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { Sidebar } from '@/components/gestor/dashboard/_components/desktop/Sidebar';
import { NotificationDataProvider } from '@/context/NotificationDataContext';
import { NotificationModalProvider } from '@/context/NotificationModalContext';
import { useResponsive } from '@/hooks/useResponsive';
import { useUser } from '@/hooks/useUser';
import { initializeNotifications } from '@/lib/notifications';
import { setupOfflineSync } from '@/lib/offline';
import {
  applyThemePreferences,
  getThemePreferences,
  type ThemeContrastPreference,
  type ThemeDensityPreference,
  type ThemePreference,
} from '@/lib/themePreference';
import { configureLogBox } from '@/utils/configureLogBox';
// NOTA: Unistyles é configurado automaticamente em @/utils/styles (linha 312)
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// Configurar LogBox para ignorar warnings de desenvolvimento conhecidos
configureLogBox();

// Prevenir auto-hide do splash screen enquanto fontes carregam
SplashScreen.preventAutoHideAsync();

/**
 * Wrapper condicional que renderiza Sidebar apenas para gestor em desktop
 * nas rotas específicas (/gestor, /perfil, /unidade)
 */
function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const { userData } = useUser();
  const { isDesktop } = useResponsive();
  const pathname = usePathname();

  // Rotas onde o Sidebar deve aparecer para gestores
  // REMOVIDO /gestor pois gestor/_layout.tsx já renderiza sua própria Sidebar
  const gestorRoutes = ['/perfil', '/unidade'];

  // Mostrar Sidebar se:
  // 1. Usuário é gestor
  // 2. Está em desktop (width >= 1024px)
  // 3. Está em uma das rotas específicas (exceto /gestor que tem seu próprio layout)
  const showSidebar =
    userData?.papel === 'gestor' &&
    isDesktop &&
    gestorRoutes.some(route => pathname.startsWith(route));

  if (showSidebar) {
    return (
      <View style={styles.desktopLayout}>
        <Sidebar userData={userData} />
        <View style={styles.content}>
          {children}
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

// Check for E2E environment using multiple detection methods
// NOTE: This is intentionally NOT evaluated at module level
// because in CI, the module loads before the browser navigates to the e2e URL
function detectE2EEnvironment(): boolean {
  if (typeof window === 'undefined') return false;

  // Method 1: Check for Playwright-injected window flag
  if ((window as any).__PLAYWRIGHT_E2E__ === true) return true;

  // Method 2: Check for localStorage flag (set by global-setup)
  try {
    if (localStorage.getItem('e2e_mode') === 'true') return true;
  } catch {
    // localStorage may not be available
  }

  // Method 3: Check navigator.webdriver (Playwright/Selenium sets this)
  if ((navigator as any).webdriver === true) return true;

  // Method 4: Check for headless browser patterns in userAgent (case-insensitive)
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('headlesschrome') || ua.includes('headless')) return true;

  // Method 5: Check URL param for E2E (most reliable in CI)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('e2e') === 'true') return true;
  } catch {
    // URL parsing may fail in some environments
  }

  return false;
}

export default function RootLayout() {
  const { theme } = useUnistyles();

  // Check E2E at render time - this is intentionally evaluated during render
  // because in CI, the module loads before the browser navigates to ?e2e=true
  const isE2EEnvironment = detectE2EEnvironment();

  // Track font loading timeout for CI environments
  // In E2E, skip waiting for fonts entirely to allow tests to proceed
  const [fontTimeout, setFontTimeout] = React.useState(isE2EEnvironment);

  // Carregar fontes customizadas
  const [fontsLoaded, fontError] = useFonts({
    // Nunito Sans (todos os pesos)
    'Nunito Sans': NunitoSans_400Regular,
    'NunitoSans-Light': NunitoSans_300Light,
    'NunitoSans-Regular': NunitoSans_400Regular,
    'NunitoSans-Medium': NunitoSans_500Medium,
    'NunitoSans-SemiBold': NunitoSans_600SemiBold,
    'NunitoSans-Bold': NunitoSans_700Bold,
    'NunitoSans-ExtraBold': NunitoSans_800ExtraBold,

    // Viga (display font)
    'Viga': Viga_400Regular,
  });

  // Font loading timeout for web (prevents app from being stuck in CI)
  // Clear timeout when fonts load successfully
  const fontTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Skip timeout setup in E2E (render condition handles this)
    if (isE2EEnvironment) {
      // In E2E, immediately set fontTimeout to true so splash screen hides
      if (!fontTimeout) setFontTimeout(true);
      return;
    }

    if (Platform.OS === 'web' && !fontsLoaded && !fontError) {
      // 10 second timeout for normal users
      fontTimeoutRef.current = setTimeout(() => {
        console.warn('[RootLayout] Font loading timeout (10000ms) - proceeding without custom fonts');
        setFontTimeout(true);
      }, 10000);

      return () => {
        if (fontTimeoutRef.current) {
          clearTimeout(fontTimeoutRef.current);
        }
      };
    }
    // Clear timeout if fonts loaded successfully
    if (fontsLoaded && fontTimeoutRef.current) {
      clearTimeout(fontTimeoutRef.current);
      fontTimeoutRef.current = null;
    }
  }, [fontsLoaded, fontError, isE2EEnvironment, fontTimeout]);

  // Esconder splash screen quando fontes carregarem
  useEffect(() => {
    if (fontsLoaded || fontError || fontTimeout) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, fontTimeout]);

  // Inicializar notificações e sync offline (apenas mobile)
  useEffect(() => {
    if (Platform.OS !== 'web') {
      // Inicializar sistema de notificações
      initializeNotifications();

      // Configurar sync automático quando conexão mudar
      const unsubscribe = setupOfflineSync();

      return () => {
        unsubscribe();
      };
    }
  }, []);

  // Configurar título da página para web apenas
  useEffect(() => {
    if (Platform.OS === 'web') {
      try {
        if (typeof document !== 'undefined') {
          document.title = 'Rota Mestre - Sistema de Otimização e Gestão de Rotas';

          // Adicionar meta description se não existir
          let metaDescription = document.querySelector('meta[name="description"]');
          if (!metaDescription) {
            metaDescription = document.createElement('meta');
            metaDescription.setAttribute('name', 'description');
            document.head.appendChild(metaDescription);
          }
          metaDescription.setAttribute('content', 'Sistema completo de gestão de rotas de entrega com rastreamento em tempo real.');
          // Nota: CSS fix para z-index e toast-root estão em +html.tsx
        }
      } catch (error) {
        // Ignorar erros de manipulação do DOM
        console.warn('Erro ao configurar meta tags:', error);
      }
    }
  }, []);

  // Mostrar null enquanto fontes não carregam (splash screen continua visível)
  // Apply stored theme preferences or query param overrides
  useEffect(() => {
    const applyPreference = async () => {
      const stored = await getThemePreferences();

      let themeParam: ThemePreference | null = null;
      let densityParam: ThemeDensityPreference | null = null;
      let contrastParam: ThemeContrastPreference | null = null;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const themeOverride = params.get('theme');
        const densityOverride = params.get('density');
        const contrastOverride = params.get('contrast');

        if (themeOverride === 'light' || themeOverride === 'dark') {
          themeParam = themeOverride;
        }
        if (densityOverride === 'compact' || densityOverride === 'regular') {
          densityParam = densityOverride;
        }
        if (contrastOverride === 'high' || contrastOverride === 'normal') {
          contrastParam = contrastOverride;
        }
      }

      if (themeParam || densityParam || contrastParam) {
        applyThemePreferences({
          mode: themeParam ?? stored?.mode ?? 'light',
          density: densityParam ?? stored?.density ?? 'regular',
          contrast: contrastParam ?? stored?.contrast ?? 'normal',
        });
        return;
      }

      if (stored) {
        applyThemePreferences(stored);
      }
    };

    applyPreference();
  }, []);

  // Don't render until fonts are loaded (or timeout on web, or E2E mode)
  // isE2EEnvironment is checked here to handle navigation to ?e2e=true URLs
  if (!fontsLoaded && !fontError && !fontTimeout && !isE2EEnvironment) {
    return null;
  }

  // Se houver erro ao carregar fontes, mostrar no console mas continuar
  if (fontError) {
    console.error('Erro ao carregar fontes:', fontError);
  }

  return (
    <NotificationDataProvider>
      <NotificationModalProvider>
        <ConditionalLayout>
          <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: theme.colors.primary,
            },
            headerTintColor: theme.colors.white,
            headerTitleStyle: {
              fontFamily: theme.typography.fontDisplay,
              fontSize: theme.typography.lg,
            },
            headerShown: false,
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              title: 'Rota Mestre - Início'
            }}
          />
          <Stack.Screen
            name="auth"
            options={{
              title: 'Rota Mestre - Autenticação'
            }}
          />
          <Stack.Screen
            name="gestor"
            options={{
              title: 'Rota Mestre - Painel do Gestor'
            }}
          />
          <Stack.Screen
            name="motorista"
            options={{
              title: 'Rota Mestre - Motorista'
            }}
          />
        </Stack>
        </ConditionalLayout>
        <Toast
          config={{
            success: ({ text1, text2 }) => renderToast(theme.colors.success, text1, text2),
            error: ({ text1, text2 }) => renderToast(theme.colors.error, text1, text2),
            info: ({ text1, text2 }) => renderToast(theme.colors.primary, text1, text2),
            warning: ({ text1, text2 }) => renderToast(theme.colors.secondary, text1, text2),
          }}
        />
      </NotificationModalProvider>
    </NotificationDataProvider>
  );
}

function renderToast(backgroundColor: string, title?: string, message?: string) {
  return (
    <View style={[styles.toastContainer, { backgroundColor }]}>
      {title ? <Text style={styles.toastTitle}>{title}</Text> : null}
      {message ? <Text style={styles.toastMessage}>{message}</Text> : null}
    </View>
  );
}

// Estilos para o layout desktop com Sidebar
const styles = StyleSheet.create((theme: Theme) => ({
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: theme.colors.gray50,
  },
  content: {
    flex: 1,
  },
  toastContainer: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginHorizontal: theme.spacing['3xl'],
    minWidth: 300,
    ...theme.shadows.md,
  },
  toastTitle: {
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.white,
  },
  toastMessage: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.white,
  },
}));
