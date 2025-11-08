import { useResponsive } from '@/hooks/useResponsive';
import { useDashboardData } from '@/components/gestor/dashboard/_hooks/useDashboardData';
import { DashboardMobile } from '@/components/gestor/dashboard/_components/mobile/DashboardMobile';
import { DashboardDesktop } from '@/components/gestor/dashboard/_components/desktop/DashboardDesktop';

/**
 * Roteador principal do Dashboard do Gestor
 * Renderiza DashboardMobile ou DashboardDesktop baseado no breakpoint
 */
export default function Dashboard() {
  const { isDesktop } = useResponsive();
  const dashboardData = useDashboardData();

  // Renderizar layout apropriado baseado no breakpoint
  if (isDesktop) {
    return <DashboardDesktop {...dashboardData} />;
  }

  return <DashboardMobile {...dashboardData} />;
}
