import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { usePerformance } from '@/hooks/usePerformance';
import { supabase } from '@/lib/supabase';
import PerformanceOptimizer from '@/services/performanceOptimizer';
import { defaultTheme, useUnistyles } from '@/utils/styles';

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
          <Ionicons name="bug" size={24} color="#fff" />
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
              <Ionicons name="close" size={20} color="#fff" />
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
                color="#fff"
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
                        color={pathname === route.path ? theme.colors.primary : '#fff'}
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
                color="#fff"
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
                    <Ionicons name={action.icon as any} size={20} color="#fff" />
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
                <Ionicons name="car" size={16} color="#fff" />
                <Text style={styles.loginButtonText}>Motorista</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.loginButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => handleLoginAs('gestor')}
              >
                <Ionicons name="business" size={16} color="#fff" />
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

const styles = StyleSheet.create({
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
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  expandedContainer: {
    width: 320,
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
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
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  infoSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  infoText: {
    color: '#d1d5db',
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
    color: '#fff',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  activeRoute: {
    backgroundColor: '#fff',
  },
  routeButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  activeRouteText: {
    color: defaultTheme.colors.primary,
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 8,
    borderRadius: 6,
  },
  actionButtonText: {
    color: '#fff',
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
    backgroundColor: defaultTheme.colors.secondary,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  shortcutsSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 8,
    marginTop: 8,
  },
  shortcutText: {
    color: '#9ca3af',
    fontSize: 10,
    marginBottom: 2,
    fontFamily: Platform.select({ web: 'monospace' }) as any,
  },
});
/* istanbul ignore file */
