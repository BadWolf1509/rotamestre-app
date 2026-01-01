/**
 * ExpirationWarning - Aviso de expiração de rota com countdown
 *
 * Exibe um banner de aviso quando a rota está prestes a expirar (após 20:00).
 * A expiração acontece às 22:00 via cron job.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Animated, Text } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface ExpirationWarningProps {
  /** Data da rota (formato YYYY-MM-DD) */
  rotaData: string;
  /** Callback quando expirar */
  onExpire?: () => void;
}

/**
 * Calcula tempo restante até 22:00
 * Retorna null se não estiver no período de aviso (antes das 20:00)
 */
function getTimeUntilExpiration(rotaData: string): { minutes: number; isUrgent: boolean } | null {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Só mostrar aviso se a rota é de hoje
  if (rotaData !== today) {
    return null;
  }

  const hour = now.getHours();

  // Só mostrar aviso a partir das 20:00 (2h antes da expiração)
  if (hour < 20) {
    return null;
  }

  // Se já passou das 22:00, já expirou
  if (hour >= 22) {
    return { minutes: 0, isUrgent: true };
  }

  // Calcular minutos restantes até 22:00
  const expirationTime = new Date(now);
  expirationTime.setHours(22, 0, 0, 0);

  const diffMs = expirationTime.getTime() - now.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));

  // Urgente se faltam menos de 30 minutos
  const isUrgent = diffMins <= 30;

  return { minutes: diffMins, isUrgent };
}

/**
 * Formata tempo restante para exibição
 */
function formatTimeRemaining(minutes: number): string {
  if (minutes <= 0) return 'Expirando...';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins}min`;
  }
  return `${mins}min`;
}

export function ExpirationWarning({ rotaData, onExpire }: ExpirationWarningProps) {
  const { theme } = useUnistyles();
  const [timeInfo, setTimeInfo] = useState<{ minutes: number; isUrgent: boolean } | null>(null);

  // Animação de pulso para estado urgente
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  // Atualizar countdown a cada minuto
  useEffect(() => {
    const updateTime = () => {
      const info = getTimeUntilExpiration(rotaData);
      setTimeInfo(info);

      // Se expirou, chamar callback
      if (info && info.minutes <= 0 && onExpire) {
        onExpire();
      }
    };

    // Atualizar imediatamente
    updateTime();

    // Atualizar a cada minuto
    const interval = setInterval(updateTime, 60000);

    return () => clearInterval(interval);
  }, [rotaData, onExpire]);

  // Animação de pulso quando urgente
  useEffect(() => {
    if (timeInfo?.isUrgent) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [timeInfo?.isUrgent, pulseAnim]);

  // Não renderizar se não estiver no período de aviso
  if (!timeInfo) {
    return null;
  }

  const backgroundColor = timeInfo.isUrgent
    ? theme.colors.error
    : theme.colors.warning;

  const textColor = theme.colors.white;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor },
        { transform: [{ scale: pulseAnim }] },
      ]}
    >
      <Ionicons
        name={timeInfo.isUrgent ? 'warning' : 'time-outline'}
        size={16}
        color={textColor}
      />
      <Text style={[styles.text, { color: textColor }]}>
        {timeInfo.minutes <= 0
          ? 'Rota expirando agora!'
          : `Rota expira em ${formatTimeRemaining(timeInfo.minutes)}`}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
}));
