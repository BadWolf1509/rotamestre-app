import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUnistyles } from '@/utils/styles';
import { RouteStatus } from '@/context/RouteStatusContext';
import { StreetViewPreview } from '@/components/StreetViewPreview';
import { SwipeableRow } from '@/components/SwipeableRow';

interface MainCardProps {
  state: RouteStatus;
  route: any;
  paradas: any[];
  currentStop?: any;
  nextStop?: any;
  location?: any;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onPress?: () => void;
}

export function MainCard({
  state,
  route,
  paradas,
  currentStop,
  nextStop,
  location,
  onSwipeLeft,
  onSwipeRight,
  onPress,
}: MainCardProps) {
  const { theme } = useUnistyles();

  // Renderização baseada no estado
  const renderContent = () => {
    switch (state) {
      case 'no-route':
        return renderNoRoute();
      case 'pending':
        return renderPending();
      case 'active':
      case 'last-stop':
        return renderActive();
      case 'ready-to-complete':
        return renderReadyToComplete();
      case 'completed':
        return renderCompleted();
      default:
        return null;
    }
  };

  const renderNoRoute = () => (
    <View style={styles.content}>
      <Text style={styles.icon}>☕</Text>
      <Text style={styles.title}>{getGreeting()}, {route?.motorista_nome || 'Motorista'}!</Text>
      <Text style={styles.subtitle}>Nenhuma rota para hoje</Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Ontem</Text>
          <Text style={styles.statValue}>2 rotas</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Paradas</Text>
          <Text style={styles.statValue}>24</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Distância</Text>
          <Text style={styles.statValue}>87 km</Text>
        </View>
      </View>
    </View>
  );

  const renderPending = () => {
    const firstStop = paradas[0];

    return (
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>ROTA PENDENTE</Text>
          </View>
        </View>

        <Text style={styles.empresa}>{route?.unidade_nome}</Text>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Ionicons name="location-outline" size={16} color={theme.colors.gray500} />
            <Text style={styles.infoValue}>{paradas.length} paradas</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="navigate-outline" size={16} color={theme.colors.gray500} />
            <Text style={styles.infoValue}>{route?.distancia_total || '0'} km</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="time-outline" size={16} color={theme.colors.gray500} />
            <Text style={styles.infoValue}>~3h 20min</Text>
          </View>
        </View>

        {firstStop && (
          <View style={styles.firstStopSection}>
            <Text style={styles.sectionLabel}>PRIMEIRA PARADA</Text>
            <Text style={styles.addressText}>{firstStop.endereco}</Text>
            <Text style={styles.distanceText}>2.3 km daqui</Text>
          </View>
        )}
      </View>
    );
  };

  const renderActive = () => {
    if (!currentStop) return null;

    const swipeActions = {
      leftActions: [{
        icon: 'checkmark-circle',
        label: 'Concluir',
        color: theme.colors.success,
        onPress: onSwipeRight || (() => {}),
      }],
      rightActions: [{
        icon: 'arrow-forward-circle',
        label: 'Pular',
        color: theme.colors.warning,
        onPress: onSwipeLeft || (() => {}),
      }],
    };

    return (
      <SwipeableRow {...swipeActions}>
        <TouchableOpacity style={styles.content} onPress={onPress} activeOpacity={0.9}>
          <View style={styles.header}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {state === 'last-stop' ? 'ÚLTIMA PARADA! 🎯' : `PARADA ${currentStop.ordem}/${paradas.length}`}
              </Text>
            </View>
            <View style={styles.timer}>
              <Ionicons name="time-outline" size={14} color={theme.colors.gray500} />
              <Text style={styles.timerText}>2 min</Text>
            </View>
          </View>

          <Text style={styles.addressMain}>{currentStop.endereco}</Text>

          {currentStop.destinatario && (
            <View style={styles.contactInfo}>
              <Ionicons name="person-outline" size={14} color={theme.colors.gray500} />
              <Text style={styles.contactText}>{currentStop.destinatario}</Text>
            </View>
          )}

          {currentStop.telefone && (
            <View style={styles.contactInfo}>
              <Ionicons name="call-outline" size={14} color={theme.colors.gray500} />
              <Text style={styles.contactText}>{currentStop.telefone}</Text>
            </View>
          )}

          {currentStop.observacoes && (
            <View style={styles.observationBox}>
              <Text style={styles.observationText}>{currentStop.observacoes}</Text>
            </View>
          )}

          {/* Street View Preview */}
          <View style={styles.streetViewContainer}>
            <StreetViewPreview
              latitude={currentStop.latitude}
              longitude={currentStop.longitude}
              address={currentStop.endereco}
              size="large"
            />
          </View>

          <View style={styles.distanceBar}>
            <Ionicons name="navigate" size={16} color={theme.colors.primary} />
            <Text style={styles.distanceText}>800m • 2 min de carro</Text>
          </View>
        </TouchableOpacity>
      </SwipeableRow>
    );
  };

  const renderReadyToComplete = () => (
    <View style={styles.content}>
      <Text style={styles.icon}>🎉</Text>
      <Text style={styles.title}>Todas as paradas concluídas!</Text>
      <Text style={styles.subtitle}>Você pode finalizar a rota agora</Text>

      <View style={styles.summaryBox}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Tempo total</Text>
          <Text style={styles.summaryValue}>3h 15min</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Distância</Text>
          <Text style={styles.summaryValue}>{route?.distancia_total} km</Text>
        </View>
      </View>
    </View>
  );

  const renderCompleted = () => (
    <View style={styles.content}>
      <Text style={styles.icon}>✅</Text>
      <Text style={styles.title}>Rota Concluída</Text>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>3h 15min</Text>
          <Text style={styles.statLabel}>Tempo Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{paradas.length}</Text>
          <Text style={styles.statLabel}>Paradas</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{route?.distancia_total} km</Text>
          <Text style={styles.statLabel}>Distância</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: theme.colors.success }]}>12 min</Text>
          <Text style={styles.statLabel}>Economia</Text>
        </View>
      </View>
    </View>
  );

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <View style={styles.card}>
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#1e5aa8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerText: {
    fontSize: 12,
    color: '#6b7280',
  },
  icon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  empresa: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  addressMain: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoValue: {
    fontSize: 14,
    color: '#374151',
  },
  firstStopSection: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 4,
  },
  distanceText: {
    fontSize: 12,
    color: '#6b7280',
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  contactText: {
    fontSize: 14,
    color: '#374151',
  },
  observationBox: {
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  observationText: {
    fontSize: 12,
    color: '#92400e',
  },
  streetViewContainer: {
    marginTop: 12,
    marginBottom: 8,
  },
  distanceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    marginTop: 8,
  },
  summaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
});