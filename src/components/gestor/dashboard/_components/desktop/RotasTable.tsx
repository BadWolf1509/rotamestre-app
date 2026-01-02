import { View } from 'react-native';

import {
  DataTable,
  type DataTableAction,
  type DataTableColumn,
  DistanceCell,
  EmptyState,
  ProgressCell,
  StatusCell,
  UserCell,
} from '@/design-system';
import { formatDateBR } from '@/lib/dateUtils';
import { StyleSheet, type Theme } from '@/utils/styles';

import type { RotaResumo } from '../../_hooks/useDashboardData';

interface RotasTableProps {
  rotas: RotaResumo[];
  onViewDetails?: (rotaId: string) => void;
  onDelete?: (rotaId: string) => void;
}

/**
 * RotasTable - Routes table using DataTable from design system
 * Responsive: Cards on mobile, Table on desktop
 */
export function RotasTable({ rotas, onViewDetails, onDelete }: RotasTableProps) {
  if (rotas.length === 0) {
    return (
      <View testID="rotas-table">
        <EmptyState
          icon="map-outline"
          title="Nenhuma rota cadastrada hoje"
          description="Crie sua primeira rota de entrega"
          style={styles.emptyState}
        />
      </View>
    );
  }

  // Define columns for DataTable using design-system renderers
  const columns: DataTableColumn<RotaResumo>[] = [
    {
      key: 'motorista_nome',
      label: 'Motorista',
      width: 280,
      render: (rota) => (
        <UserCell
          name={rota.motorista_nome}
          subtitle={formatDateBR(rota.data)}
        />
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: 180,
      align: 'center',
      render: (rota) => <StatusCell status={rota.status} />,
    },
    {
      key: 'progresso',
      label: 'Progresso',
      width: 220,
      align: 'center',
      render: (rota) => (
        <ProgressCell
          value={rota.paradas_concluidas}
          total={rota.total_paradas}
          showFraction
        />
      ),
    },
    {
      key: 'distancia_total',
      label: 'Distância',
      width: 160,
      align: 'center',
      render: (rota) => <DistanceCell km={rota.distancia_total} />,
    },
  ];

  // Define actions for DataTable
  const actions: DataTableAction<RotaResumo>[] = [];

  if (onViewDetails) {
    actions.push({
      icon: 'eye-outline',
      label: 'Detalhes',
      type: 'primary',
      onPress: (rota) => onViewDetails(rota.id),
    });
  }

  if (onDelete) {
    actions.push({
      icon: 'trash-outline',
      label: 'Excluir',
      type: 'danger',
      onPress: (rota) => onDelete(rota.id),
    });
  }

  return (
    <View testID="rotas-table">
      <DataTable
        data={rotas}
        columns={columns}
        actions={actions}
        keyExtractor={(rota) => rota.id}
        pagination={false}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  emptyState: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing['5xl'],
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
}));
