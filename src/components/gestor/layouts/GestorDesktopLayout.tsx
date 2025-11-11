import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from '@/utils/styles';
import { useUser } from '@/hooks/useUser';

interface GestorDesktopLayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  badge?: number;
}

export function GestorDesktopLayout({ children }: GestorDesktopLayoutProps) {
  const { theme } = useUnistyles();
  const router = useRouter();
  const pathname = usePathname();
  const { userData } = useUser();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const menuItems: MenuItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: 'grid-outline',
      route: '/gestor/dashboard',
    },
    {
      id: 'rotas',
      label: 'Rotas',
      icon: 'map-outline',
      route: '/gestor/nova-entrega',
      badge: 3,
    },
    {
      id: 'motoristas',
      label: 'Motoristas',
      icon: 'people-outline',
      route: '/gestor/motoristas',
    },
    {
      id: 'historico',
      label: 'Histórico',
      icon: 'time-outline',
      route: '/gestor/historico',
    },
    {
      id: 'relatorios',
      label: 'Relatórios',
      icon: 'analytics-outline',
      route: '/gestor/relatorios',
    },
    {
      id: 'configuracoes',
      label: 'Configurações',
      icon: 'settings-outline',
      route: '/gestor/configuracoes',
    },
  ];

  const isActiveRoute = (route: string) => pathname === route;

  const handleNavigation = (route: string) => {
    router.push(route as any);
  };

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={[
        styles.sidebar,
        sidebarCollapsed && styles.sidebarCollapsed,
        { backgroundColor: theme.colors.gray900 }
      ]}>
        {/* Sidebar Header */}
        <View style={styles.sidebarHeader}>
          <View style={styles.logoContainer}>
            <Ionicons
              name="car-sport"
              size={32}
              color={theme.colors.primary}
            />
            {!sidebarCollapsed && (
              <Text style={styles.logoText}>RotaMestre</Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={styles.collapseButton}
          >
            <Ionicons
              name={sidebarCollapsed ? 'chevron-forward' : 'chevron-back'}
              size={20}
              color={theme.colors.gray400}
            />
          </TouchableOpacity>
        </View>

        {/* User Info */}
        <View style={[styles.userInfo, sidebarCollapsed && styles.userInfoCollapsed]}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {userData?.nome?.charAt(0).toUpperCase() || 'G'}
            </Text>
          </View>
          {!sidebarCollapsed && (
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{userData?.nome || 'Gestor'}</Text>
              <Text style={styles.userRole}>Gerente</Text>
            </View>
          )}
        </View>

        {/* Menu Items */}
        <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
          {menuItems.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => handleNavigation(item.route)}
              onHoverIn={() => Platform.OS === 'web' && setHoveredItem(item.id)}
              onHoverOut={() => Platform.OS === 'web' && setHoveredItem(null)}
              style={[
                styles.menuItem,
                isActiveRoute(item.route) && styles.menuItemActive,
                hoveredItem === item.id && styles.menuItemHovered,
                sidebarCollapsed && styles.menuItemCollapsed,
              ]}
            >
              <View style={styles.menuItemContent}>
                <Ionicons
                  name={item.icon}
                  size={22}
                  color={
                    isActiveRoute(item.route)
                      ? theme.colors.primary
                      : theme.colors.gray400
                  }
                />
                {!sidebarCollapsed && (
                  <>
                    <Text style={[
                      styles.menuItemText,
                      isActiveRoute(item.route) && styles.menuItemTextActive,
                    ]}>
                      {item.label}
                    </Text>
                    {item.badge && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.badge}</Text>
                      </View>
                    )}
                  </>
                )}
              </View>
              {sidebarCollapsed && item.badge && (
                <View style={styles.badgeSmall} />
              )}
            </Pressable>
          ))}
        </ScrollView>

        {/* Sidebar Footer */}
        <View style={styles.sidebarFooter}>
          <Pressable
            onPress={() => router.push('/perfil')}
            onHoverIn={() => Platform.OS === 'web' && setHoveredItem('profile')}
            onHoverOut={() => Platform.OS === 'web' && setHoveredItem(null)}
            style={[
              styles.footerItem,
              hoveredItem === 'profile' && styles.footerItemHovered,
            ]}
          >
            <Ionicons name="person-outline" size={20} color={theme.colors.gray400} />
            {!sidebarCollapsed && (
              <Text style={styles.footerText}>Perfil</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => router.push('/auth/login')}
            onHoverIn={() => Platform.OS === 'web' && setHoveredItem('logout')}
            onHoverOut={() => Platform.OS === 'web' && setHoveredItem(null)}
            style={[
              styles.footerItem,
              hoveredItem === 'logout' && styles.footerItemHovered,
            ]}
          >
            <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
            {!sidebarCollapsed && (
              <Text style={[styles.footerText, { color: theme.colors.error }]}>
                Sair
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={20} color={theme.colors.gray500} />
            <Text style={styles.searchPlaceholder}>Buscar...</Text>
          </View>

          <View style={styles.topBarActions}>
            <TouchableOpacity style={styles.topBarButton}>
              <Ionicons name="notifications-outline" size={22} color={theme.colors.gray700} />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.topBarButton}>
              <Ionicons name="help-circle-outline" size={22} color={theme.colors.gray700} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Page Content */}
        <ScrollView
          style={styles.pageContent}
          contentContainerStyle={styles.pageContentContainer}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: theme.colors.gray50,
  },
  sidebar: {
    width: 280,
    borderRightWidth: 1,
    borderRightColor: theme.colors.gray800,
    transition: 'width 0.3s ease',
  },
  sidebarCollapsed: {
    width: 80,
  },
  sidebarHeader: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray800,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.white,
  },
  collapseButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.gray800,
  },
  userInfo: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray800,
  },
  userInfoCollapsed: {
    justifyContent: 'center',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    color: theme.colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  userRole: {
    color: theme.colors.gray400,
    fontSize: 12,
    marginTop: 2,
  },
  menuContainer: {
    flex: 1,
    padding: 12,
  },
  menuItem: {
    borderRadius: 12,
    marginBottom: 4,
    padding: 12,
    transition: 'all 0.2s ease',
  },
  menuItemCollapsed: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemActive: {
    backgroundColor: theme.colors.gray800,
  },
  menuItemHovered: {
    backgroundColor: theme.colors.gray800,
    transform: [{ translateX: 4 }],
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    flex: 1,
    color: theme.colors.gray400,
    fontSize: 14,
    fontWeight: '500',
  },
  menuItemTextActive: {
    color: theme.colors.primary,
  },
  badge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: theme.colors.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  badgeSmall: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  sidebarFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray800,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  footerItemHovered: {
    backgroundColor: theme.colors.gray800,
  },
  footerText: {
    color: theme.colors.gray400,
    fontSize: 14,
  },
  mainContent: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  topBar: {
    height: 64,
    backgroundColor: theme.colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.gray100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
    minWidth: 300,
  },
  searchPlaceholder: {
    color: theme.colors.gray500,
    fontSize: 14,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBarButton: {
    position: 'relative',
    padding: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.gray100,
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.error,
  },
  pageContent: {
    flex: 1,
  },
  pageContentContainer: {
    padding: 24,
  },
}));