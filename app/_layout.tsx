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
import { useResponsive } from '@/hooks/useResponsive';
import { useUser } from '@/hooks/useUser';
import { StyleSheet } from '@/utils/styles';

// Inicializar Unistyles v3 ANTES de qualquer componente (apenas native)
if (Platform.OS !== 'web') {
  require('../unistyles');
}

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
  const gestorRoutes = ['/gestor', '/perfil', '/unidade'];

  // Mostrar Sidebar se:
  // 1. Usuário é gestor
  // 2. Está em desktop (width >= 1024px)
  // 3. Está em uma das rotas específicas
  const showSidebar =
    userData?.papel === 'gestor' &&
    isDesktop &&
    gestorRoutes.some(route => pathname.startsWith(route));

  if (showSidebar) {
    return (
      <View style={styles.desktopLayout}>
        <Sidebar />
        <View style={styles.content}>
          {children}
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
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

  // Esconder splash screen quando fontes carregarem
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

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
        }
      } catch (error) {
        // Ignorar erros de manipulação do DOM
        console.warn('Erro ao configurar meta tags:', error);
      }
    }
  }, []);

  // Mostrar null enquanto fontes não carregam (splash screen continua visível)
  if (!fontsLoaded && !fontError) {
    return null;
  }

  // Se houver erro ao carregar fontes, mostrar no console mas continuar
  if (fontError) {
    console.error('Erro ao carregar fontes:', fontError);
  }

  return (
    <>
      <ConditionalLayout>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: '#2563eb',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
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
          success: ({ text1, text2 }) => (
            <View style={{
              backgroundColor: '#10b981',
              padding: 16,
              borderRadius: 8,
              marginHorizontal: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5,
              minWidth: 300,
            }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{text1}</Text>
              {text2 && <Text style={{ color: '#fff', fontSize: 14, marginTop: 4 }}>{text2}</Text>}
            </View>
          ),
          error: ({ text1, text2 }) => (
            <View style={{
              backgroundColor: '#ef4444',
              padding: 16,
              borderRadius: 8,
              marginHorizontal: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5,
              minWidth: 300,
            }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{text1}</Text>
              {text2 && <Text style={{ color: '#fff', fontSize: 14, marginTop: 4 }}>{text2}</Text>}
            </View>
          ),
        }}
      />
    </>
  );
}

// Estilos para o layout desktop com Sidebar
const styles = StyleSheet.create(theme => ({
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: theme.colors.gray50,
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
}));
