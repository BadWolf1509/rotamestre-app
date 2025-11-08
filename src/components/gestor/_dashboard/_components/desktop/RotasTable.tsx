import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { StyleSheet, useUnistyles } from '@/utils/styles';
import type { RotaResumo } from '../../dashboard/_hooks/useDashboardData';

interface RotasTableProps {
  rotas: RotaResumo[];
  onRotaPress?: (rotaId: string) => void;
  onDeletePress?: (rotaId: string) => void;
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
export function RotasTable({ rotas, onRotaPress, onDeletePress }: RotasTableProps) {
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
                <View style={[styles.colAcoes, styles.colAcoesContent]}>
                  <TouchableOpacity
                    onPress={() => onRotaPress?.(rota.id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      backgroundColor: theme.colors.primary,
                      borderRadius: theme.borderRadius.md,
                      marginRight: 8,
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: 'white' }}>
                      👁️ Detalhes
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => onDeletePress?.(rota.id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      backgroundColor: theme.colors.error,
                      borderRadius: theme.borderRadius.md,
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: 'white' }}>
                      🗑️ Excluir
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
    // Web-only hover state
    ...(Platform.OS === 'web' && {
      transitionProperty: 'background-color',
      transitionDuration: '0.15s',
      transitionTimingFunction: 'ease-in-out',
      // @ts-ignore - web-only CSS
      ':hover': {
        backgroundColor: theme.colors.primary + '08', // 8% opacity
      },
    }),
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
  // Columns - Redistributed for better space usage
  // Total width: 280 + 180 + 220 + 160 + 280 = 1120px (Ações combina Ver Detalhes + Excluir)
  colMotorista: {
    width: 280, // Increased for better readability
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.md,
  },
  colStatus: {
    width: 180, // Increased
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.md,
  },
  colProgresso: {
    width: 220, // Increased for progress bar
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.md,
  },
  colDistancia: {
    width: 160, // Increased
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.md,
  },
  colAcoes: {
    width: 300, // Increased to fit both buttons with proper spacing
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  colStatusContent: {
    width: 180,
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colProgressoContent: {
    width: 220,
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.lg,
    justifyContent: 'center',
  },
  colDistanciaContent: {
    width: 160,
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colAcoesContent: {
    width: 300,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'nowrap',
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    marginRight: theme.spacing.sm,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
    // Web-only hover state
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transitionProperty: 'all',
      transitionDuration: '0.2s',
      transitionTimingFunction: 'ease-in-out',
      // @ts-ignore - web-only CSS
      ':hover': {
        backgroundColor: theme.colors.primaryDark,
        transform: 'translateY(-1px)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
      },
    }),
  },
  detailsButtonText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.white,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.error,
    borderRadius: theme.borderRadius.md,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    // Web-only hover state
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transitionProperty: 'all',
      transitionDuration: '0.2s',
      transitionTimingFunction: 'ease-in-out',
      // @ts-ignore - web-only CSS
      ':hover': {
        opacity: 0.9,
        transform: 'translateY(-1px)',
        boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)',
      },
    }),
  },
  deleteButtonText: {
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
