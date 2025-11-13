import { useMemo } from 'react';
import { Image, Text, View } from 'react-native';

import LogoHorizontal from '@/../assets/logo-horizontal1.png';
import { StyleSheet, Theme, useUnistyles } from '@/utils/styles';

type Highlight = {
  value: string;
  label: string;
};

export type AuthBrandPanelProps = {
  title?: string;
  subtitle?: string;
  description?: string;
  highlights?: Highlight[];
};

const defaultHighlights: Highlight[] = [
  { value: '99,8%', label: 'Entregas pontuais' },
  { value: '24/7', label: 'Monitoramento em tempo real' },
  { value: '+800', label: 'Rotas otimizadas/dia' },
];

export function AuthBrandPanel({
  title = 'Rota Mestre',
  subtitle = 'Otimizacao inteligente de rotas',
  description = 'Planeje, execute e monitore operacoes logisticas em minutos.',
  highlights = defaultHighlights,
}: AuthBrandPanelProps) {
  const { theme } = useUnistyles();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.branding}>
        <Image source={LogoHorizontal} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      <View style={styles.highlightsRow}>
        {highlights.map(highlight => (
          <View key={`${highlight.label}-${highlight.value}`} style={styles.highlightCard}>
            <Text style={styles.highlightValue}>{highlight.value}</Text>
            <Text style={styles.highlightLabel}>{highlight.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 48,
      paddingVertical: 40,
      justifyContent: 'space-between',
    },
    branding: {
      alignItems: 'flex-start',
    },
    logo: {
      width: 220,
      height: 80,
      marginBottom: theme.spacing.lg,
    },
    title: {
      fontFamily: theme.typography.fontDisplay,
      fontSize: theme.typography['3xl'],
      color: theme.colors.white,
      letterSpacing: -0.5,
      textTransform: 'uppercase',
      textShadowColor: 'rgba(0, 0, 0, 0.25)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 6,
    },
    subtitle: {
      fontFamily: theme.typography.fontDisplay,
      fontSize: theme.typography.xl,
      color: theme.colors.white,
      marginTop: theme.spacing.sm,
      textShadowColor: 'rgba(0, 0, 0, 0.2)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    description: {
      fontFamily: theme.typography.fontSans,
      fontSize: theme.typography.lg,
      color: theme.colors.white,
      marginTop: theme.spacing.md,
      lineHeight: 24,
      maxWidth: 360,
      textShadowColor: 'rgba(0, 0, 0, 0.25)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    highlightsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      columnGap: theme.spacing.lg,
    },
    highlightCard: {
      flex: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    highlightValue: {
      fontFamily: theme.typography.fontDisplay,
      fontSize: theme.typography['2xl'],
      color: theme.colors.secondaryLight,
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    highlightLabel: {
      fontFamily: theme.typography.fontSans,
      fontSize: theme.typography.sm,
      color: theme.colors.white,
      marginTop: theme.spacing.xs,
      opacity: 0.85,
    },
  });
