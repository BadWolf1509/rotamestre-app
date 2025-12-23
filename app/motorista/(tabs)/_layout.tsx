/**
 * Tab Layout para Motorista
 * Bottom Tab Navigation com 4 tabs principais
 */
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationBell } from '@/components/NotificationBell';
import { useDrawerMenu } from '@/context/DrawerMenuContext';
import { useRouteStatus } from '@/context/RouteStatusContext';
import { colors } from '@/lib/design-tokens';

// Altura base da tab bar
const TAB_BAR_HEIGHT = 60;

type IconName = keyof typeof Ionicons.glyphMap;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useDrawerMenu();
  const routeStatus = useRouteStatus();

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
        tabBarActiveTintColor: colors.primary.main,
        tabBarInactiveTintColor: colors.gray[400],
        tabBarStyle: {
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderTopColor: colors.gray[200],
          ...Platform.select({
            ios: {
              shadowColor: colors.black,
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
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        headerStyle: {
          backgroundColor: colors.primary.main,
        },
        headerTintColor: colors.white,
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
        headerLeft: () => (
          <Pressable
            onPress={openDrawer}
            style={{ paddingHorizontal: 16, paddingVertical: 8 }}
            hitSlop={8}
          >
            <Ionicons name="menu" size={24} color={colors.white} />
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
          tabBarIcon: ({ color, focused }) =>
            renderTabIcon('home', 'home-outline', color, focused),
        }}
      />

      <Tabs.Screen
        name="paradas"
        options={{
          title: 'Paradas',
          headerTitle: 'Paradas',
          tabBarIcon: ({ color, focused }) =>
            renderTabIcon('list', 'list-outline', color, focused),
          tabBarBadge: paradasPendentes > 0 ? paradasPendentes : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.secondary.dark, // #c87704 para contraste 4.5:1 com texto branco
            color: colors.white,
            fontSize: 10,
            fontWeight: 'bold',
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
          tabBarIcon: ({ color, focused }) =>
            renderTabIcon('map', 'map-outline', color, focused),
        }}
      />

      <Tabs.Screen
        name="historico"
        options={{
          title: 'Histórico',
          headerTitle: 'Histórico',
          tabBarIcon: ({ color, focused }) =>
            renderTabIcon('time', 'time-outline', color, focused),
        }}
      />
    </Tabs>
  );
}
