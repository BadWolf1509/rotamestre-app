import { useState } from 'react';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DashboardDesktop } from '@/components/gestor/dashboard/_components/desktop/DashboardDesktop';
import { DashboardMobile } from '@/components/gestor/dashboard/_components/mobile/DashboardMobile';
import { useDashboardData } from '@/components/gestor/dashboard/_hooks/useDashboardData';
import type { RouteFiltersState as RouteFilters } from '@/components/RouteFilters';
import { useResponsive } from '@/hooks/useResponsive';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';

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

  // O motorista filtrado é de UMA loja: com a loja trocada pelo seletor, o id
  // dele não existe na nova e o painel mostraria "nenhuma rota". Ajuste
  // durante o render (e não num useEffect) para que a carga da loja nova já
  // saia sem o filtro, em vez de consultar uma vez com a combinação inválida.
  const { unidadeAtiva } = useUnidadeAtiva();
  const [lojaDosFiltros, setLojaDosFiltros] = useState(unidadeAtiva);
  if (lojaDosFiltros !== unidadeAtiva) {
    setLojaDosFiltros(unidadeAtiva);
    setFilters((atuais) =>
      atuais.motoristaId ? { ...atuais, motoristaId: null } : atuais,
    );
  }

  // Na passada em que a loja acabou de mudar, o `filters` ainda é o antigo
  // (o ajuste acima só vale na re-renderização): não deixa o hook vê-lo.
  const dashboardData = useDashboardData({
    filters:
      lojaDosFiltros !== unidadeAtiva
        ? { ...filters, motoristaId: null }
        : filters,
  });

  // Renderizar layout apropriado baseado no breakpoint
  if (isDesktop) {
    return (
      <ErrorBoundary>
        <DashboardDesktop
          {...dashboardData}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <DashboardMobile
        {...dashboardData}
        filters={filters}
        onFiltersChange={setFilters}
      />
    </ErrorBoundary>
  );
}
