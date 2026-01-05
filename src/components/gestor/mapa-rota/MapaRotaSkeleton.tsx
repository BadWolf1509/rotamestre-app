/**
 * MapaRotaSkeleton - Skeleton loading para a página Mapa da Rota
 * Melhora UX mostrando estrutura da página enquanto carrega
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';

import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import { DesktopCard, DesktopPageLayout, SplitView } from '@/design-system';
import { useUnistyles } from '@/utils/styles';

import { styles } from './styles';

interface MapaRotaSkeletonProps {
  isDesktop?: boolean;
  userMenuTrigger?: React.ReactNode | ((isOpen: boolean) => React.ReactNode);
  userMenuItems?: Array<{ label: string; onPress: () => void }>;
}

// Animated pulse component
function SkeletonPulse({ style }: { style?: any }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={[styles.skeletonPulse, style, { opacity }]} />;
}

// Skeleton card for paradas list
function SkeletonParadaCard() {
  const { theme } = useUnistyles();
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonCardHeader}>
        <SkeletonPulse style={styles.skeletonCircle} />
        <View style={{ flex: 1, gap: theme.spacing['2'] }}>
          <SkeletonPulse style={[styles.skeletonLine, styles.skeletonLineMedium]} />
          <View style={styles.skeletonRow}>
            <SkeletonPulse style={styles.skeletonTag} />
            <SkeletonPulse style={styles.skeletonTag} />
          </View>
        </View>
      </View>
      <SkeletonPulse style={[styles.skeletonLine, styles.skeletonLineShort, { marginTop: theme.spacing['2'] }]} />
    </View>
  );
}

// Altura otimizada do mapa (igual ao componente principal)
const OPTIMIZED_MAP_HEIGHT = 480;

// Skeleton compacto para paradas (novo layout)
function SkeletonParadaCardCompact() {
  const { theme } = useUnistyles();
  return (
    <View style={styles.skeletonCardCompact}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing['3'] }}>
        {/* Número da parada */}
        <SkeletonPulse style={{ width: 28, height: 28, borderRadius: 14 }} />
        {/* Endereço e info */}
        <View style={{ flex: 1, gap: theme.spacing['1'] }}>
          <SkeletonPulse style={[styles.skeletonLine, { width: '80%', height: 14 }]} />
          <View style={{ flexDirection: 'row', gap: theme.spacing['2'] }}>
            <SkeletonPulse style={{ width: 50, height: 18, borderRadius: 4 }} />
            <SkeletonPulse style={{ width: 60, height: 18, borderRadius: 4 }} />
          </View>
        </View>
        {/* Status icon */}
        <SkeletonPulse style={{ width: 20, height: 20, borderRadius: 10 }} />
      </View>
    </View>
  );
}

// Skeleton do header compacto
function SkeletonHeaderCompact() {
  const { theme } = useUnistyles();
  return (
      <View style={styles.skeletonHeaderCompact}>
        {/* Motorista */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing['2'] }}>
          <SkeletonPulse style={{ width: 24, height: 24, borderRadius: 12 }} />
          <SkeletonPulse style={{ width: 120, height: 16, borderRadius: 4 }} />
        </View>
        {/* Separator */}
      <View style={[styles.skeletonDivider, { height: 20 }]} />
      {/* Status badge */}
      <SkeletonPulse style={{ width: 80, height: 26, borderRadius: 13 }} />
      {/* Metrics */}
      <View style={{ flexDirection: 'row', gap: theme.spacing['4'] }}>
        <SkeletonPulse style={{ width: 70, height: 16, borderRadius: 4 }} />
        <SkeletonPulse style={{ width: 80, height: 16, borderRadius: 4 }} />
      </View>
      {/* Spacer */}
      <View style={{ flex: 1 }} />
      {/* Cancel button */}
      <SkeletonPulse style={{ width: 90, height: 32, borderRadius: 16 }} />
    </View>
  );
}

// Skeleton do resumo inline
function SkeletonResumoInline() {
  const { theme } = useUnistyles();
  return (
    <View style={styles.skeletonResumoInline}>
      {[1, 2, 3].map((i, index) => (
        <React.Fragment key={i}>
          {index > 0 && <View style={[styles.skeletonDivider, { height: 16 }]} />}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing['1.5'] }}>
            <SkeletonPulse style={{ width: 20, height: 20, borderRadius: 10 }} />
            <SkeletonPulse style={{ width: 24, height: 18, borderRadius: 4 }} />
            <SkeletonPulse style={{ width: 30, height: 12, borderRadius: 4 }} />
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

// Skeleton da timeline colapsável
function SkeletonTimelineCollapsible() {
  const { theme } = useUnistyles();
  return (
    <View style={styles.skeletonTimelineCollapsible}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing['2'] }}>
          <SkeletonPulse style={{ width: 32, height: 32, borderRadius: 8 }} />
          <SkeletonPulse style={{ width: 80, height: 18, borderRadius: 4 }} />
        </View>
        <SkeletonPulse style={{ width: 20, height: 20, borderRadius: 4 }} />
      </View>
    </View>
  );
}

export function MapaRotaSkeleton({
  isDesktop = true,
  userMenuTrigger,
  userMenuItems,
}: MapaRotaSkeletonProps) {
  const { theme } = useUnistyles();
  const pageMeta = getGestorPageMeta('mapaRota');

  if (!isDesktop) {
    // Mobile skeleton
    return (
      <View style={styles.skeletonContainer}>
        {/* Header skeleton */}
        <View style={[styles.rotaInfo, { gap: theme.spacing['3'] }]}>
          <SkeletonPulse style={[styles.skeletonLine, { width: 200, height: 20 }]} />
          <View style={{ flexDirection: 'row', gap: theme.spacing['3'] }}>
            <SkeletonPulse style={styles.skeletonTag} />
            <SkeletonPulse style={[styles.skeletonLine, { width: 100 }]} />
          </View>
        </View>

        {/* Map skeleton */}
        <View style={{ padding: theme.spacing['4'] }}>
          <SkeletonPulse style={[styles.skeletonMap, { height: 300 }]} />
        </View>

        {/* Cards skeleton */}
        <View style={{ padding: theme.spacing['4'], gap: theme.spacing['3'] }}>
          <SkeletonParadaCard />
          <SkeletonParadaCard />
          <SkeletonParadaCard />
        </View>
      </View>
    );
  }

  // Desktop skeleton (novo layout otimizado)
  return (
    <DesktopPageLayout
      title={pageMeta.title}
      subtitle={pageMeta.subtitle}
      breadcrumbs={pageMeta.breadcrumbs}
      userMenuTrigger={userMenuTrigger}
      userMenuItems={userMenuItems}
      fullWidth
      noPadding
    >
      {/* Header Compacto */}
      <SkeletonHeaderCompact />

      {/* Split View: Mapa | Paradas */}
      <SplitView
        left={
          <DesktopCard
            title="Mapa"
            icon="map-outline"
            iconColor={theme.colors.primary}
            variant="elevated"
            noPadding
          >
            <SkeletonPulse style={{ height: OPTIMIZED_MAP_HEIGHT, borderRadius: 0 }} />
          </DesktopCard>
        }
        right={
          <DesktopCard
            title="Paradas"
            icon="list-outline"
            iconColor={theme.colors.secondary}
            variant="outlined"
          >
            <View style={{ maxHeight: OPTIMIZED_MAP_HEIGHT - 80, gap: theme.spacing['2'] }}>
              <SkeletonParadaCardCompact />
              <SkeletonParadaCardCompact />
              <SkeletonParadaCardCompact />
              <SkeletonParadaCardCompact />
              <SkeletonParadaCardCompact />
            </View>
            {/* Resumo Inline */}
            <View style={{ marginTop: theme.spacing['3'] }}>
              <SkeletonResumoInline />
            </View>
          </DesktopCard>
        }
        leftFlex={1.2}
        rightFlex={1}
        gap={theme.spacing['5']}
      />

      {/* Timeline Colapsável */}
      <View style={{ marginTop: theme.spacing['4'] }}>
        <SkeletonTimelineCollapsible />
      </View>
    </DesktopPageLayout>
  );
}
