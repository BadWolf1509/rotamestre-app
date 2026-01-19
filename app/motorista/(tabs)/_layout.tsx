/**
 * Tab Layout para Motorista
 * Bottom Tab Navigation com 4 tabs principais
 */
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationBell } from '@/components/NotificationBell';
import { useDrawerMenu } from '@/context/DrawerMenuContext';
import { useRouteStatus } from '@/context/RouteStatusContext';
import { useUnistyles } from '@/utils/styles';

// Altura base da tab bar
const TAB_BAR_HEIGHT = 60;

type IconName = keyof typeof Ionicons.glyphMap;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useDrawerMenu();
  const routeStatus = useRouteStatus();
  const { theme } = useUnistyles();

  // Debug: Log insets para verificar se estão corretos
  useEffect(() => {
    if (__DEV__ && Platform.OS === 'android') {
      console.log('[TabLayout] Safe area insets:', insets);
    }
  }, [insets]);

  // Calcular paradas pendentes para badge
  const paradasPendentes = routeStatus?.paradas?.filter(
    (p) => p.status === 'pendente' && p.is_checkpoint !== false
  ).length || 0;

  // Função para renderizar ícone com suporte a outline/filled
  const renderTabIcon = (
    name: IconName,
    nameOutline: IconName,
    color: string,
    focused: boolean
  ) => (
    <Ionicons
      name={focused ? name : nameOutline}
      size={24}
      color={color}
    />
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.gray400,
        tabBarStyle: {
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
          backgroundColor: theme.colors.white,
          borderTopWidth: 1,
          borderTopColor: theme.colors.gray200,
          ...Platform.select({
            ios: {
              shadowColor: theme.colors.black,
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
            },
            android: {
              elevation: 8,
            },
          }),
        },
        tabBarLabelStyle: {
          fontSize: theme.typography.xs,
          fontFamily: theme.typography.fontSansSemiBold,
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: theme.colors.white,
        headerTitleStyle: {
          fontFamily: theme.typography.fontSansBold,
          fontSize: theme.typography.lg,
        },
        headerLeft: () => (
          <Pressable
            onPress={openDrawer}
            style={{ paddingHorizontal: 16, paddingVertical: 8 }}
            hitSlop={8}
            testID="menu-button"
            accessibilityLabel="menu"
          >
            <Ionicons name="menu" size={24} color={theme.colors.white} />
          </Pressable>
        ),
        headerRight: () => (
          <View style={{ paddingRight: 8, paddingVertical: 4 }}>
            <NotificationBell variant="mobile" />
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          headerTitle: 'Início',
          tabBarAccessibilityLabel: 'tab-inicio',
          tabBarIcon: ({ color, focused }) =>
            renderTabIcon('home', 'home-outline', color, focused),
        }}
      />

      <Tabs.Screen
        name="paradas"
        options={{
          title: 'Paradas',
          headerTitle: 'Paradas',
          tabBarAccessibilityLabel: 'tab-paradas',
          tabBarIcon: ({ color, focused }) =>
            renderTabIcon('list', 'list-outline', color, focused),
          tabBarBadge: paradasPendentes > 0 ? paradasPendentes : undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.colors.secondaryDark, // contraste 4.5:1 com texto branco
            color: theme.colors.white,
            fontSize: theme.typography.xs,
            fontFamily: theme.typography.fontSansBold,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
          },
        }}
      />

      <Tabs.Screen
        name="mapa"
        options={{
          title: 'Mapa',
          headerTitle: 'Mapa',
          tabBarAccessibilityLabel: 'tab-mapa',
          tabBarIcon: ({ color, focused }) =>
            renderTabIcon('map', 'map-outline', color, focused),
        }}
      />

      <Tabs.Screen
        name="historico"
        options={{
          title: 'Histórico',
          headerTitle: 'Histórico',
          tabBarAccessibilityLabel: 'tab-historico',
          tabBarIcon: ({ color, focused }) =>
            renderTabIcon('time', 'time-outline', color, focused),
        }}
      />
    </Tabs>
  );
}
