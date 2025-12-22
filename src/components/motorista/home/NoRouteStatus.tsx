/**
 * NoRouteStatus - Componente de status principal para estado "sem rota"
 *
 * Exibe mensagem contextualizada baseada no horário de trabalho (7h-17h, seg-sex)
 * e no contexto do motorista (performance, streak, etc.)
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import {
  getNoRouteMessage,
  getWorkContext,
  type MotivationalMessage,
  type NoRouteContext,
} from '@/utils/motivationalMessages';
import { defaultTheme, useUnistyles } from '@/utils/styles';

interface NoRouteStatusProps {
  /** Contexto para personalizar a mensagem */
  context?: NoRouteContext;
  /** Mostrar animação de aguardando */
  showWaitingIndicator?: boolean;
}

export function NoRouteStatus({
  context = {},
  showWaitingIndicator = true,
}: NoRouteStatusProps) {
  const { theme } = useUnistyles();
  const workContext = getWorkContext();
  const message = getNoRouteMessage(context);

  // Animação de pulso para o ícone (apenas durante horário de trabalho)
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (workContext.isWorkHours && showWaitingIndicator) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      return () => pulse.stop();
    }
  }, [workContext.isWorkHours, showWaitingIndicator, pulseAnim]);

  // Determinar cor do badge baseado no período
  const getBadgeStyle = () => {
    if (!workContext.isWorkDay) {
      // Fim de semana - azul claro
      return {
        backgroundColor: theme.colors.infoBg,
        iconColor: theme.colors.info,
        textColor: theme.colors.info,
      };
    }
    if (!workContext.isWorkHours) {
      // Fora do expediente - cinza
      return {
        backgroundColor: theme.colors.gray100,
        iconColor: theme.colors.gray500,
        textColor: theme.colors.gray600,
      };
    }
    // Durante expediente - verde suave (disponível)
    return {
      backgroundColor: theme.colors.gray100,
      iconColor: theme.colors.gray600,
      textColor: theme.colors.gray700,
    };
  };

  const badgeStyle = getBadgeStyle();

  return (
    <View style={styles.container}>
      {/* Ícone com emoji */}
      <Animated.View
        style={[
          styles.iconContainer,
          { backgroundColor: badgeStyle.backgroundColor },
          workContext.isWorkHours && { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <Text style={styles.emoji}>{message.emoji || '☕'}</Text>
      </Animated.View>

      {/* Título */}
      <Text style={styles.title}>{message.title}</Text>

      {/* Subtítulo */}
      <Text style={[styles.subtitle, { color: badgeStyle.textColor }]}>
        {message.subtitle}
      </Text>

      {/* Indicador de aguardando (apenas durante horário de trabalho) */}
      {showWaitingIndicator && workContext.isWorkHours && (
        <View style={styles.waitingIndicator}>
          <Ionicons
            name="notifications-outline"
            size={14}
            color={theme.colors.gray400}
          />
          <Text style={styles.waitingText}>
            Notificação automática ativada
          </Text>
        </View>
      )}
    </View>
  );
}

const colors = defaultTheme.colors;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emoji: {
    fontSize: 28,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray900,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  waitingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.gray50,
    borderRadius: 16,
  },
  waitingText: {
    fontSize: 12,
    color: colors.gray500,
  },
});
