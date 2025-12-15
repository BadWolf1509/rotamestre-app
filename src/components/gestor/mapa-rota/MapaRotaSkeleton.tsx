/**
 * MapaRotaSkeleton - Skeleton loading para a página Mapa da Rota
 * Melhora UX mostrando estrutura da página enquanto carrega
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';

import { DesktopCard } from '@/components/desktop/DesktopCard';
import { DesktopPageLayout } from '@/components/desktop/DesktopPageLayout';
import { SplitView } from '@/components/desktop/SplitView';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import { useUnistyles } from '@/utils/styles';

import { styles, MAP_HEIGHT } from './styles';

interface MapaRotaSkeletonProps {
  isDesktop?: boolean;
  userMenuTrigger?: React.ReactNode;
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
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonCardHeader}>
        <SkeletonPulse style={styles.skeletonCircle} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonPulse style={[styles.skeletonLine, styles.skeletonLineMedium]} />
          <View style={styles.skeletonRow}>
            <SkeletonPulse style={styles.skeletonTag} />
            <SkeletonPulse style={styles.skeletonTag} />
          </View>
        </View>
      </View>
      <SkeletonPulse style={[styles.skeletonLine, styles.skeletonLineShort, { marginTop: 8 }]} />
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
        <View style={[styles.rotaInfo, { gap: 12 }]}>
          <SkeletonPulse style={[styles.skeletonLine, { width: 200, height: 20 }]} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <SkeletonPulse style={styles.skeletonTag} />
            <SkeletonPulse style={[styles.skeletonLine, { width: 100 }]} />
          </View>
        </View>

        {/* Map skeleton */}
        <View style={{ padding: 16 }}>
          <SkeletonPulse style={[styles.skeletonMap, { height: 300 }]} />
        </View>

        {/* Cards skeleton */}
        <View style={{ padding: 16, gap: 12 }}>
          <SkeletonParadaCard />
          <SkeletonParadaCard />
          <SkeletonParadaCard />
        </View>
      </View>
    );
  }

  // Desktop skeleton
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
      {/* Header bar skeleton */}
      <View style={styles.skeletonHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
          <SkeletonPulse style={{ width: 150, height: 40, borderRadius: 8 }} />
          <SkeletonPulse style={{ width: 80, height: 28, borderRadius: 14 }} />
          <SkeletonPulse style={{ width: 120, height: 20, borderRadius: 4 }} />
          <SkeletonPulse style={{ width: 140, height: 20, borderRadius: 4 }} />
        </View>
      </View>

      {/* Split view skeleton */}
      <SplitView
        left={
          <DesktopCard
            title="Mapa"
            icon="map-outline"
            iconColor={theme.colors.primary}
            variant="elevated"
            noPadding
          >
            <SkeletonPulse style={{ height: MAP_HEIGHT, borderRadius: 0 }} />
          </DesktopCard>
        }
        right={
          <View style={{ gap: 16, flex: 1 }}>
            <DesktopCard
              title="Paradas"
              subtitle="Carregando..."
              icon="list-outline"
              iconColor={theme.colors.secondary}
              variant="outlined"
            >
              <View style={{ maxHeight: MAP_HEIGHT, gap: 12 }}>
                <SkeletonParadaCard />
                <SkeletonParadaCard />
                <SkeletonParadaCard />
                <SkeletonParadaCard />
              </View>
            </DesktopCard>

            <DesktopCard
              title="Timeline"
              icon="time-outline"
              iconColor={theme.colors.info}
              variant="outlined"
            >
              <View style={{ height: 200, gap: 16 }}>
                {[1, 2, 3].map((i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <SkeletonPulse style={{ width: 24, height: 24, borderRadius: 12 }} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <SkeletonPulse style={[styles.skeletonLine, { width: '70%' }]} />
                      <SkeletonPulse style={[styles.skeletonLine, { width: '40%', height: 12 }]} />
                    </View>
                  </View>
                ))}
              </View>
            </DesktopCard>
          </View>
        }
        leftFlex={1.5}
        rightFlex={1}
        gap={24}
      />

      {/* Bottom cards skeleton */}
      <View style={styles.desktopInfoRow}>
        <View style={styles.desktopInfoColumn}>
          <DesktopCard
            title="Pontos da Unidade"
            icon="business-outline"
            iconColor={theme.colors.secondary}
            variant="outlined"
          >
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <SkeletonPulse style={{ width: 36, height: 36, borderRadius: 18 }} />
                <View style={{ flex: 1, gap: 4 }}>
                  <SkeletonPulse style={[styles.skeletonLine, { width: 60, height: 10 }]} />
                  <SkeletonPulse style={[styles.skeletonLine, { width: '90%' }]} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <SkeletonPulse style={{ width: 36, height: 36, borderRadius: 18 }} />
                <View style={{ flex: 1, gap: 4 }}>
                  <SkeletonPulse style={[styles.skeletonLine, { width: 60, height: 10 }]} />
                  <SkeletonPulse style={[styles.skeletonLine, { width: '90%' }]} />
                </View>
              </View>
            </View>
          </DesktopCard>
        </View>
        <View style={styles.desktopInfoColumnWide}>
          <DesktopCard
            title="Resumo da Rota"
            icon="analytics-outline"
            iconColor={theme.colors.primary}
            variant="outlined"
          >
            <View style={{ flexDirection: 'row', gap: 32 }}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={{ flex: 1, gap: 8 }}>
                  <SkeletonPulse style={{ width: 36, height: 36, borderRadius: 8 }} />
                  <SkeletonPulse style={{ width: 40, height: 28 }} />
                  <SkeletonPulse style={{ width: 80, height: 12 }} />
                </View>
              ))}
            </View>
          </DesktopCard>
        </View>
      </View>
    </DesktopPageLayout>
  );
}
