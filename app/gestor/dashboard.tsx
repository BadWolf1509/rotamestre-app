import { DashboardDesktop } from '@/components/gestor/dashboard/_components/desktop/DashboardDesktop';
import { DashboardMobile } from '@/components/gestor/dashboard/_components/mobile/DashboardMobile';
import { useDashboardData } from '@/components/gestor/dashboard/_hooks/useDashboardData';
import { useResponsive } from '@/hooks/useResponsive';

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
