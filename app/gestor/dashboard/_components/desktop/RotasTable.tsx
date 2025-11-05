import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { RotaResumo } from '../../dashboard/_hooks/useDashboardData';

interface RotasTableProps {
  rotas: RotaResumo[];
  onRotaPress?: (rotaId: string) => void;
}

function getStatusColor(status: string, theme: any): string {
  switch (status) {
    case 'em_andamento':
      return theme.colors.secondary;
    case 'concluida':
      return theme.colors.success;
    case 'pendente':
      return theme.colors.gray500;
    case 'cancelada':
      return theme.colors.error;
    default:
      return theme.colors.gray500;
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'em_andamento':
      return 'Em Andamento';
    case 'concluida':
      return 'Concluída';
    case 'pendente':
      return 'Pendente';
    case 'cancelada':
      return 'Cancelada';
    default:
      return status;
  }
}

/**
 * Tabela de rotas estilo desktop
 * Layout inspirado no rotamestre-painel
 */
export function RotasTable({ rotas, onRotaPress }: RotasTableProps) {
  const { theme } = useUnistyles();

  if (rotas.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateTitle}>
          Nenhuma rota cadastrada hoje
        </Text>
        <Text style={styles.emptyStateSubtitle}>
          Crie sua primeira rota de entrega
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.tableContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.table}>
          {/* Header */}
          <View style={styles.tableHeader}>
            <View style={styles.colMotorista}>
              <Text style={styles.headerText}>
                MOTORISTA
              </Text>
            </View>
            <View style={styles.colStatus}>
              <Text style={[styles.headerText, styles.textCenter]}>
                STATUS
              </Text>
            </View>
            <View style={styles.colProgresso}>
              <Text style={[styles.headerText, styles.textCenter]}>
                PROGRESSO
              </Text>
            </View>
            <View style={styles.colDistancia}>
              <Text style={[styles.headerText, styles.textCenter]}>
                DISTÂNCIA
              </Text>
            </View>
            <View style={styles.colAcoes}>
              <Text style={[styles.headerText, styles.textCenter]}>
                AÇÕES
              </Text>
            </View>
          </View>

          {/* Rows */}
          {rotas.map((rota, index) => {
            const progressPercent = rota.total_paradas > 0
              ? (rota.paradas_concluidas / rota.total_paradas) * 100
              : 0;

            const statusColor = getStatusColor(rota.status, theme);

            return (
              <View
                key={rota.id}
                style={[
                  styles.tableRow,
                  index % 2 === 0 ? styles.rowEven : styles.rowOdd,
                ]}
              >
                {/* Motorista */}
                <View style={styles.colMotorista}>
                  <Text style={styles.motoristaNome}>
                    {rota.motorista_nome}
                  </Text>
                  <Text style={styles.rotaData}>
                    {new Date(rota.data).toLocaleDateString('pt-BR')}
                  </Text>
                </View>

                {/* Status */}
                <View style={styles.colStatusContent}>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                    <Text style={styles.statusText}>
                      {getStatusLabel(rota.status)}
                    </Text>
                  </View>
                </View>

                {/* Progresso */}
                <View style={styles.colProgressoContent}>
                  <Text style={styles.progressText}>
                    {rota.paradas_concluidas}/{rota.total_paradas} paradas
                  </Text>
                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: `${progressPercent}%`,
                          backgroundColor: statusColor,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Distância */}
                <View style={styles.colDistanciaContent}>
                  <Text style={styles.distanciaText}>
                    {rota.distancia_total.toFixed(1)} km
                  </Text>
                </View>

                {/* Ações */}
                <View style={styles.colAcoesContent}>
                  <TouchableOpacity
                    onPress={() => onRotaPress?.(rota.id)}
                    style={styles.detailsButton}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.detailsButtonText}>
                      Ver Detalhes
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  tableContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    overflow: 'hidden',
  },
  table: {
    minWidth: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: theme.colors.gray50,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  rowEven: {
    backgroundColor: theme.colors.white,
  },
  rowOdd: {
    backgroundColor: `${theme.colors.gray50}80`, // 80 = ~50% opacity
  },
  headerText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray500,
    textTransform: 'uppercase',
  },
  textCenter: {
    textAlign: 'center',
  },
  // Columns
  colMotorista: {
    width: 192, // 48 * 4
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.md,
  },
  colStatus: {
    width: 128, // 32 * 4
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.md,
  },
  colProgresso: {
    width: 160, // 40 * 4
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.md,
  },
  colDistancia: {
    width: 128, // 32 * 4
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.md,
  },
  colAcoes: {
    width: 128, // 32 * 4
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.md,
  },
  colStatusContent: {
    width: 128,
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colProgressoContent: {
    width: 160,
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.lg,
    justifyContent: 'center',
  },
  colDistanciaContent: {
    width: 128,
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colAcoesContent: {
    width: 128,
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motoristaNome: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray900,
  },
  rotaData: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.md,
  },
  statusText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.white,
  },
  progressText: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: theme.borderRadius.full,
  },
  distanciaText: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray900,
  },
  detailsButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
  },
  detailsButtonText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.white,
  },
  emptyState: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing['5xl'],
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
    marginBottom: theme.spacing.sm,
  },
  emptyStateSubtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
}));
