/**
 * MapaRotaSkeleton - Skeleton loading para a página Mapa da Rota
 * Melhora UX mostrando estrutura da página enquanto carrega
 */

import React from 'react';
import { View } from 'react-native';

import { ShimmerBox } from '@/components/ShimmerBox';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import { DesktopCard, DesktopPageLayout, SplitView } from '@/design-system';
import { useUnistyles } from '@/utils/styles';

import { styles } from './styles';

interface MapaRotaSkeletonProps {
  isDesktop?: boolean;
  userMenuTrigger?: React.ReactNode | ((isOpen: boolean) => React.ReactNode);
  userMenuItems?: Array<{ label: string; onPress: () => void }>;
}

// Skeleton card for paradas list
function SkeletonParadaCard() {
  const { theme } = useUnistyles();
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonCardHeader}>
        <ShimmerBox style={styles.skeletonCircle} />
        <View style={[styles.skeletonFlexCol, { gap: theme.spacing['2'] }]}>
          <ShimmerBox style={[styles.skeletonLine, styles.skeletonLineMedium]} />
          <View style={styles.skeletonRow}>
            <ShimmerBox style={styles.skeletonTag} />
            <ShimmerBox style={styles.skeletonTag} />
          </View>
        </View>
      </View>
      <ShimmerBox style={[styles.skeletonLine, styles.skeletonLineShort, { marginTop: theme.spacing['2'] }]} />
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
      <View style={[styles.skeletonRowCenter, { gap: theme.spacing['3'] }]}>
        {/* Número da parada */}
        <ShimmerBox style={styles.skeletonCircle28} />
        {/* Endereço e info */}
        <View style={[styles.skeletonFlexCol, { gap: theme.spacing['1'] }]}>
          <ShimmerBox style={[styles.skeletonLine, { width: '80%', height: 14 }]} />
          <View style={{ flexDirection: 'row', gap: theme.spacing['2'] }}>
            <ShimmerBox style={[styles.skeletonRect4, { width: 50, height: 18 }]} />
            <ShimmerBox style={[styles.skeletonRect4, { width: 60, height: 18 }]} />
          </View>
        </View>
        {/* Status icon */}
        <ShimmerBox style={styles.skeletonCircle20} />
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
        <View style={[styles.skeletonRowCenter, { gap: theme.spacing['2'] }]}>
          <ShimmerBox style={styles.skeletonCircle24} />
          <ShimmerBox style={[styles.skeletonRect4, { width: 120, height: 16 }]} />
        </View>
        {/* Separator */}
      <View style={[styles.skeletonDivider, { height: 20 }]} />
      {/* Status badge */}
      <ShimmerBox style={{ width: 80, height: 26, borderRadius: 13 }} />
      {/* Metrics */}
      <View style={{ flexDirection: 'row', gap: theme.spacing['4'] }}>
        <ShimmerBox style={[styles.skeletonRect4, { width: 70, height: 16 }]} />
        <ShimmerBox style={[styles.skeletonRect4, { width: 80, height: 16 }]} />
      </View>
      {/* Spacer */}
      <View style={styles.skeletonFlexCol} />
      {/* Cancel button */}
      <ShimmerBox style={{ width: 90, height: 32, borderRadius: 16 }} />
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
          <View style={[styles.skeletonRowCenter, { gap: theme.spacing['1.5'] }]}>
            <ShimmerBox style={styles.skeletonCircle20} />
            <ShimmerBox style={[styles.skeletonRect4, { width: 24, height: 18 }]} />
            <ShimmerBox style={[styles.skeletonRect4, { width: 30, height: 12 }]} />
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
      <View style={styles.skeletonRowBetween}>
        <View style={[styles.skeletonRowCenter, { gap: theme.spacing['2'] }]}>
          <ShimmerBox style={{ width: 32, height: 32, borderRadius: 8 }} />
          <ShimmerBox style={[styles.skeletonRect4, { width: 80, height: 18 }]} />
        </View>
        <ShimmerBox style={[styles.skeletonRect4, { width: 20, height: 20 }]} />
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
          <ShimmerBox style={[styles.skeletonLine, { width: 200, height: 20 }]} />
          <View style={{ flexDirection: 'row', gap: theme.spacing['3'] }}>
            <ShimmerBox style={styles.skeletonTag} />
            <ShimmerBox style={[styles.skeletonLine, { width: 100 }]} />
          </View>
        </View>

        {/* Map skeleton */}
        <View style={{ padding: theme.spacing['4'] }}>
          <ShimmerBox style={[styles.skeletonMap, { height: 300 }]} />
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
            <ShimmerBox style={{ height: OPTIMIZED_MAP_HEIGHT, borderRadius: 0 }} />
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
