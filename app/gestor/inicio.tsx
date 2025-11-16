import { DashboardDesktop } from '@/components/gestor/dashboard/_components/desktop/DashboardDesktop';
import { DashboardMobile } from '@/components/gestor/dashboard/_components/mobile/DashboardMobile';
import { useDashboardData } from '@/components/gestor/dashboard/_hooks/useDashboardData';
import { useResponsive } from '@/hooks/useResponsive';

/**
 * Página inicial do gestor
 * Renderiza DashboardMobile ou DashboardDesktop baseado no breakpoint
 */
export default function GestorInicio() {
  const { isDesktop } = useResponsive();
  const dashboardData = useDashboardData();

  // Renderizar layout apropriado baseado no breakpoint
  if (isDesktop) {
    return <DashboardDesktop {...dashboardData} />;
  }

  return <DashboardMobile {...dashboardData} />;
}
