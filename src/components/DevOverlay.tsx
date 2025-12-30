import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { usePerformance } from '@/hooks/usePerformance';
import { supabase } from '@/lib/supabase';
import PerformanceOptimizer from '@/services/performanceOptimizer';
import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface DevOverlayProps {
  enabled?: boolean;
}

export function DevOverlay({ enabled = __DEV__ }: DevOverlayProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { metrics, clearCache, getPerformanceReport } = usePerformance();
  const { theme } = useUnistyles();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRoutes, setShowRoutes] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserInfo(user);
  };

  if (!enabled || Platform.OS !== 'web') {
    return null;
  }

  const quickRoutes = [
    { name: 'Login', path: '/login', icon: 'log-in' },
    { name: 'Motorista', path: '/motorista', icon: 'car' },
    { name: 'Gestor', path: '/gestor', icon: 'business' },
    { name: 'Mapa', path: '/motorista/mapa', icon: 'map' },
    { name: 'Histórico', path: '/motorista/historico', icon: 'time' },
    { name: 'Config', path: '/motorista/perfil/configuracoes', icon: 'settings' },
  ];

  const performanceActions = [
    {
      name: 'Clear Cache',
      action: async () => {
        await clearCache();
        Alert.alert('Success', 'Cache cleared!');
      },
      icon: 'trash',
    },
    {
      name: 'Force Reload',
      action: () => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      },
      icon: 'refresh',
    },
    {
      name: 'Toggle Offline',
      action: async () => {
        const settings = PerformanceOptimizer.getSettings();
        await PerformanceOptimizer.updateSettings({
          enableOfflineMode: !settings.enableOfflineMode,
        });
        Alert.alert('Success', `Offline mode ${!settings.enableOfflineMode ? 'enabled' : 'disabled'}`);
      },
      icon: 'cloud-offline',
    },
    {
      name: 'Performance Report',
      action: () => {
        const report = getPerformanceReport();
        console.log('Performance Report:', report);
        Alert.alert('Performance Report', 'Check console for details');
      },
      icon: 'analytics',
    },
  ];

  const handleLoginAs = async (role: 'motorista' | 'gestor') => {
    // Mock login for testing
    const mockUsers = {
      motorista: {
        email: 'motorista@test.com',
        password: 'test123',
      },
      gestor: {
        email: 'gestor@test.com',
        password: 'test123',
      },
    };

    try {
      const { error } = await supabase.auth.signInWithPassword(mockUsers[role]);
      if (!error) {
        router.replace(role === 'motorista' ? '/motorista' : '/gestor');
      } else {
        Alert.alert('Error', 'Failed to login as ' + role);
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Collapsed State */}
      {!isExpanded && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setIsExpanded(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="bug" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      )}

      {/* Expanded State */}
      {isExpanded && (
        <View style={styles.expandedContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Dev Tools</Text>
            <TouchableOpacity
              onPress={() => setIsExpanded(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={20} color={theme.colors.white} />
            </TouchableOpacity>
          </View>

          {/* Current Info */}
          <View style={styles.infoSection}>
            <Text style={styles.infoText}>📍 Path: {pathname}</Text>
            <Text style={styles.infoText}>👤 User: {userInfo?.email || 'Not logged in'}</Text>
            <Text style={styles.infoText}>💾 Memory: {metrics.memoryUsage.toFixed(1)} MB</Text>
            <Text style={styles.infoText}>
              🌐 Network: {metrics.isOnline ? '✅ Online' : '❌ Offline'}
            </Text>
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setShowRoutes(!showRoutes)}
            >
              <Text style={styles.sectionTitle}>Quick Routes</Text>
              <Ionicons
                name={showRoutes ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.colors.white}
              />
            </TouchableOpacity>

            {showRoutes && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.buttonRow}>
                  {quickRoutes.map((route) => (
                    <TouchableOpacity
                      key={route.path}
                      style={[
                        styles.routeButton,
                        pathname === route.path && styles.activeRoute,
                      ]}
                      onPress={() => router.push(route.path as any)}
                    >
                        <Ionicons
                          name={route.icon as any}
                          size={16}
                          color={pathname === route.path ? theme.colors.primary : theme.colors.white}
                        />
                      <Text
                        style={[
                          styles.routeButtonText,
                          pathname === route.path && styles.activeRouteText,
                        ]}
                      >
                        {route.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>

          {/* Performance Actions */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setShowPerformance(!showPerformance)}
            >
              <Text style={styles.sectionTitle}>Performance</Text>
              <Ionicons
                name={showPerformance ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.colors.white}
              />
            </TouchableOpacity>

            {showPerformance && (
              <View style={styles.actionGrid}>
                {performanceActions.map((action) => (
                  <TouchableOpacity
                    key={action.name}
                    style={styles.actionButton}
                    onPress={action.action}
                  >
                    <Ionicons name={action.icon as any} size={20} color={theme.colors.white} />
                    <Text style={styles.actionButtonText}>{action.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Quick Login */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Login</Text>
            <View style={styles.loginButtons}>
              <TouchableOpacity
                style={[styles.loginButton, styles.loginButtonSecondary]}
                onPress={() => handleLoginAs('motorista')}
              >
                <Ionicons name="car" size={16} color={theme.colors.white} />
                <Text style={styles.loginButtonText}>Motorista</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.loginButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => handleLoginAs('gestor')}
              >
                <Ionicons name="business" size={16} color={theme.colors.white} />
                <Text style={styles.loginButtonText}>Gestor</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Shortcuts Info */}
          <View style={styles.shortcutsSection}>
            <Text style={styles.shortcutText}>Ctrl+Shift+D: Toggle Debug Panel</Text>
            <Text style={styles.shortcutText}>F12: Open Edge DevTools</Text>
            <Text style={styles.shortcutText}>Ctrl+R: Reload</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    position: 'absolute' as any,
    bottom: 20,
    left: 20,
    zIndex: 999999,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  expandedContainer: {
    width: 320,
    backgroundColor: withOpacity(theme.colors.gray900, 0.95),
    borderRadius: 12,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: theme.colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  infoSection: {
    backgroundColor: withOpacity(theme.colors.white, 0.1),
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  infoText: {
    color: theme.colors.gray300,
    fontSize: 11,
    marginBottom: 2,
    fontFamily: Platform.select({ web: 'monospace' }) as any,
  },
  section: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  routeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: withOpacity(theme.colors.white, 0.1),
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.white, 0.2),
  },
  activeRoute: {
    backgroundColor: theme.colors.white,
  },
  routeButtonText: {
    color: theme.colors.white,
    fontSize: 12,
  },
  activeRouteText: {
    color: theme.colors.primary,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: withOpacity(theme.colors.white, 0.1),
    padding: 8,
    borderRadius: 6,
  },
  actionButtonText: {
    color: theme.colors.white,
    fontSize: 11,
  },
  loginButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  loginButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 6,
  },
  loginButtonSecondary: {
    backgroundColor: theme.colors.secondary,
  },
  loginButtonText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  shortcutsSection: {
    borderTopWidth: 1,
    borderTopColor: withOpacity(theme.colors.white, 0.1),
    paddingTop: 8,
    marginTop: 8,
  },
  shortcutText: {
    color: theme.colors.gray400,
    fontSize: 10,
    marginBottom: 2,
    fontFamily: Platform.select({ web: 'monospace' }) as any,
  },
}));
/* istanbul ignore file */
