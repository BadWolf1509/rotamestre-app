import { useEffect, useRef } from 'react';
import { View, Text } from 'react-native';

import { DashboardDesktop } from '@/components/gestor/dashboard/_components/desktop/DashboardDesktop';
import { DashboardMobile } from '@/components/gestor/dashboard/_components/mobile/DashboardMobile';
import { useDashboardData } from '@/components/gestor/dashboard/_hooks/useDashboardData';
import { useResponsive } from '@/hooks/useResponsive';

/**
 * Teste isolado do Dashboard real com contadores
 */
export default function DashboardIsolated() {
  const renderCount = useRef(0);
  renderCount.current++;

  console.log(`[ISOLATED] Dashboard renderizado ${renderCount.current} vezes`);

  const { isDesktop } = useResponsive();
  const dashboardData = useDashboardData();

  useEffect(() => {
    console.log('[ISOLATED] useEffect executado');
    if (renderCount.current > 50) {
      console.error('[ISOLATED] POSSÍVEL LOOP INFINITO DETECTADO!');
    }
  });

  // Debug overlay
  const debugOverlay = (
    <View style={{
      position: 'absolute',
      top: 10,
      right: 10,
      backgroundColor: 'rgba(255,0,0,0.9)',
      padding: 10,
      borderRadius: 5,
      zIndex: 9999
    }}>
      <Text style={{ color: 'white', fontWeight: 'bold' }}>
        Renders: {renderCount.current}
      </Text>
    </View>
  );

  if (isDesktop) {
    return (
      <View style={{ flex: 1 }}>
        <DashboardDesktop {...dashboardData} />
        {debugOverlay}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <DashboardMobile {...dashboardData} />
      {debugOverlay}
    </View>
  );
}
