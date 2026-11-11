import { useState } from 'react';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DashboardDesktop } from '@/components/gestor/dashboard/_components/desktop/DashboardDesktop';
import { DashboardMobile } from '@/components/gestor/dashboard/_components/mobile/DashboardMobile';
import { useDashboardData } from '@/components/gestor/dashboard/_hooks/useDashboardData';
import type { RouteFiltersState as RouteFilters } from '@/components/RouteFilters';
import { usePeriodoLembrado } from '@/hooks/usePeriodoLembrado';
import { useResponsive } from '@/hooks/useResponsive';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { resolverPeriodo } from '@/lib/periodo';

/**
 * Página inicial do gestor
 * Renderiza DashboardMobile ou DashboardDesktop baseado no breakpoint
 */
export default function GestorInicio() {
  const { isDesktop } = useResponsive();
  const [filters, setFilters] = useState<RouteFilters>({
    status: null,
    motoristaId: null,
  });
  // Período lembrado no aparelho (padrão "Este mês"). Não é da loja: trocar de
  // loja não mexe nele.
  const { periodo, definirPeriodo, carregado } =
    usePeriodoLembrado('inicio_gestor');

  // O motorista filtrado é de UMA loja: com a loja trocada pelo seletor, o id
  // dele não existe na nova e o painel mostraria "nenhuma rota". Ajuste
  // durante o render (e não num useEffect) para que a carga da loja nova já
  // saia sem o filtro, em vez de consultar uma vez com a combinação inválida.
  const { unidadeAtiva, unidadeAtivaData } = useUnidadeAtiva();
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
    // KPIs da semana/mês e o total de hoje só o mobile mostra.
    comKpis: !isDesktop,
    // Antes de `carregado`, o período é o padrão, não o lembrado: não consulta.
    periodo: carregado ? resolverPeriodo(periodo) : null,
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
          unidadeNome={unidadeAtivaData?.nome}
          filters={filters}
          onFiltersChange={setFilters}
          periodo={periodo}
          onPeriodoChange={definirPeriodo}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <DashboardMobile
        {...dashboardData}
        unidadeNome={unidadeAtivaData?.nome}
        filters={filters}
        onFiltersChange={setFilters}
        periodo={periodo}
        onPeriodoChange={definirPeriodo}
      />
    </ErrorBoundary>
  );
}
