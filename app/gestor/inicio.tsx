import { useState } from 'react';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DashboardDesktop } from '@/components/gestor/dashboard/_components/desktop/DashboardDesktop';
import { DashboardMobile } from '@/components/gestor/dashboard/_components/mobile/DashboardMobile';
import { useDashboardData } from '@/components/gestor/dashboard/_hooks/useDashboardData';
import type { RouteFiltersState as RouteFilters } from '@/components/RouteFilters';
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
      <ErrorBoundary>
        <DashboardDesktop {...dashboardData} filters={filters} onFiltersChange={setFilters} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <DashboardMobile {...dashboardData} filters={filters} onFiltersChange={setFilters} />
    </ErrorBoundary>
  );
}
