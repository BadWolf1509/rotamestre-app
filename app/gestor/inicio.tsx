import { useState } from 'react';

import { DashboardDesktop } from '@/components/gestor/dashboard/_components/desktop/DashboardDesktop';
import { DashboardMobile } from '@/components/gestor/dashboard/_components/mobile/DashboardMobile';
import { useDashboardData } from '@/components/gestor/dashboard/_hooks/useDashboardData';
import type { RouteFilters } from '@/components/RouteFilters';
import { useResponsive } from '@/hooks/useResponsive';

/**
 * Página inicial do gestor
 * Renderiza DashboardMobile ou DashboardDesktop baseado no breakpoint
 */
export default function GestorInicio() {
  const { isDesktop } = useResponsive();
  const [filters, setFilters] = useState<RouteFilters>({
    status: null,
    dataInicio: null,
    dataFim: null,
    motoristaId: null,
  });

  const dashboardData = useDashboardData({ filters });

  // Renderizar layout apropriado baseado no breakpoint
  if (isDesktop) {
    return (
      <DashboardDesktop {...dashboardData} filters={filters} onFiltersChange={setFilters} />
    );
  }

  return <DashboardMobile {...dashboardData} filters={filters} onFiltersChange={setFilters} />;
}
