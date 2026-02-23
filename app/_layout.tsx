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
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { Sidebar } from '@/components/gestor/dashboard/_components/desktop/Sidebar';
import { NotificationDataProvider } from '@/context/NotificationDataContext';
import { NotificationModalProvider } from '@/context/NotificationModalContext';
import { useResponsive } from '@/hooks/useResponsive';
import { useUser } from '@/hooks/useUser';
import { logger } from '@/lib/logger';
import { setupNotificationResponseHandler } from '@/lib/notificationHandlers';
import { initializeNotifications } from '@/lib/notifications';
import { setupOfflineSync } from '@/lib/offline';
import { initSentry } from '@/lib/sentry';
import {
  applyThemePreferences,
  getThemePreferences,
  type ThemeContrastPreference,
  type ThemeDensityPreference,
  type ThemePreference,
} from '@/lib/themePreference';
import { reportWebVitals } from '@/lib/web-vitals';
import { configureLogBox } from '@/utils/configureLogBox';
import { migrateNavigationPreferences } from '@/utils/navigationPreferencesMigration';
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
  if (window.__PLAYWRIGHT_E2E__ === true) return true;

  // Method 2: Check for localStorage flag (set by global-setup)
  try {
    if (localStorage.getItem('e2e_mode') === 'true') return true;
  } catch {
    // localStorage may not be available
  }

  // Method 3: Check navigator.webdriver (Playwright/Selenium sets this)
  if (navigator.webdriver === true) return true;

  // Method 4: Check for headless browser patterns in userAgent (case-insensitive)
  // Note: navigator.userAgent may be undefined in React Native on Android
  const ua = navigator.userAgent?.toLowerCase() || '';
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
      // 3 second timeout - fonts are preloaded in HTML, so should load fast
      fontTimeoutRef.current = setTimeout(() => {
        logger.warn('Font loading timeout (3000ms) - proceeding without custom fonts');
        setFontTimeout(true);
      }, 3000);

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
      // Inicializar sistema de notificações locais
      initializeNotifications();

      // Configurar sync automático quando conexão mudar
      const unsubscribeOffline = setupOfflineSync();

      // Configurar handler de clique em notificações (deep linking)
      const unsubscribeNotifications = setupNotificationResponseHandler();

      return () => {
        unsubscribeOffline();
        unsubscribeNotifications?.remove();
      };
    }
  }, []);

  // Migrar preferências de navegação para o sistema unificado
  useEffect(() => {
    migrateNavigationPreferences();
  }, []);

  // Inicializar Sentry e Web Vitals (web, produção apenas)
  useEffect(() => {
    if (Platform.OS === 'web') {
      initSentry();
      reportWebVitals();
    }
  }, []);

  // Meta tags são injetadas pelo build script (tools/scripts/inject-meta-tags.js)
  // NÃO manipular meta tags via JS runtime - causa duplicação e inconsistência

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

  // NOTE: Per Expo Router best practices, we do NOT return null while fonts load.
  // This pattern "breaks navigation hydration" and causes issues on web (static rendering).
  // See: https://github.com/expo/expo/issues/37391
  // Since React Native 0.72+ (SDK 49), fonts swap automatically when loaded.
  // The SplashScreen is kept visible until fonts are ready (see useEffect above).

  // Log font error but continue rendering (fonts will use fallback)
  if (fontError) {
    logger.error('Erro ao carregar fontes', fontError);
  }

  return (
    <SafeAreaProvider>
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
            <Stack.Screen
              name="onboarding"
              options={{
                title: 'Rota Mestre - Configuração Inicial'
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
    </SafeAreaProvider>
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
