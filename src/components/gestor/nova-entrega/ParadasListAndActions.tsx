import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { memo } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';

import type {
  BulkImportResult,
  BulkParadaInput,
} from '@/hooks/nova-entrega/useParadasManagement';
import { MAX_ROUTE_STOPS } from '@/lib/routeOptimization';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { BulkStopImporter } from './BulkStopImporter';
import { MotoristaSeletor } from './MotoristaSeletor';
import { OrdemManualBanner } from './OrdemManualBanner';
import { ParadaCard } from './ParadaCard';
import { RotaOtimizadaBanner } from './RotaOtimizadaBanner';
import { RouteDateSelector } from './RouteDateSelector';

import type {
  DistanciaManualReal,
  EnderecoUnidade,
  MotoristaResumo,
  Parada,
  ParadasStatus,
  RotaOtimizadaState,
} from './types';

export interface ParadasListAndActionsProps {
  paradas: Parada[];
  paradasStatus: ParadasStatus;
  motoristas: MotoristaResumo[];
  motoristaSelecionado: string;
  rotaOtimizada: RotaOtimizadaState | null;
  ordemManual: boolean;
  distanciaManualReal: DistanciaManualReal | null;
  enderecoUnidade: EnderecoUnidade | null;
  isOptimizing: boolean;
  isCalculandoReal: boolean;
  isLoading: boolean;
  isDesktop: boolean;
  dataRota: string;
  canGenerateRoute: boolean;
  validationErrors: string[];
  hideGenerateButton?: boolean;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (index: number) => void;
  onEdit: (index: number) => void;
  onReorder: (data: Parada[]) => void;
  onImport: (items: BulkParadaInput[]) => Promise<BulkImportResult>;
  onOptimize: () => void;
  onSelectMotorista: (id: string) => void;
  onChangeDataRota: (value: string) => void;
  onGenerateRoute: () => void;
}

export const ParadasListAndActions = memo(function ParadasListAndActions({
  paradas,
  paradasStatus,
  motoristas,
  motoristaSelecionado,
  rotaOtimizada,
  ordemManual,
  distanciaManualReal,
  enderecoUnidade,
  isOptimizing,
  isCalculandoReal,
  isLoading,
  isDesktop,
  dataRota,
  canGenerateRoute,
  validationErrors,
  hideGenerateButton = false,
  onMoveUp,
  onMoveDown,
  onRemove,
  onEdit,
  onReorder,
  onImport,
  onOptimize,
  onSelectMotorista,
  onChangeDataRota,
  onGenerateRoute,
}: ParadasListAndActionsProps) {
  const { theme } = useUnistyles();
  const router = useRouter();
  const styles = createStyles(theme, isDesktop);

  const renderStop = ({
    item,
    getIndex,
    drag,
    isActive,
  }: RenderItemParams<Parada>) => {
    const index = getIndex() ?? 0;
    const linkedPickup = item.vinculo_parada_id
      ? (paradas.find((parada) => parada.id === item.vinculo_parada_id) ?? null)
      : null;

    return (
      <ScaleDecorator>
        <ParadaCard
          parada={item}
          index={index}
          totalParadas={paradas.length}
          retiradaVinculada={linkedPickup}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onRemove={onRemove}
          onEdit={onEdit}
          onDrag={drag}
          isDragging={isActive}
        />
      </ScaleDecorator>
    );
  };

  return (
    <View style={styles.column}>
      {enderecoUnidade ? (
        <View style={styles.baseCard}>
          <Ionicons
            name="business-outline"
            size={18}
            color={theme.colors.primary}
          />
          <View style={styles.baseInfo}>
            <Text style={styles.baseLabel}>Partida e chegada</Text>
            <Text style={styles.baseAddress}>{enderecoUnidade.endereco}</Text>
          </View>
        </View>
      ) : (
        // Sem sede a rota não pode ser criada, e antes disso o cartão apenas
        // sumia: o gestor montava tudo e descobria no submit, por um toast de 5
        // segundos. A tela do conserto é Minha Unidade — este aviso é fixo e
        // leva até ela. A tela só chega aqui depois de carregar o endereço
        // (app/gestor/nova-entrega.tsx:212), então ausência aqui é ausência
        // mesmo, não carregamento.
        <View style={styles.semSedeCard}>
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={theme.colors.warning}
          />
          <View style={styles.baseInfo}>
            <Text style={styles.semSedeLabel}>Sede não cadastrada</Text>
            <Text style={styles.baseAddress}>
              A rota parte e volta para a sede da unidade. Sem o endereço dela,
              não é possível criar rotas.
            </Text>
            <TouchableOpacity
              style={styles.semSedeAcao}
              onPress={() => router.push('/unidade')}
              accessibilityLabel="Cadastrar sede da unidade"
              accessibilityRole="button"
            >
              <Text style={styles.semSedeAcaoTexto}>Cadastrar sede</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {paradas.length > 0 ? (
        <View style={styles.listSection}>
          <View style={styles.headerRow}>
            {!isDesktop && (
              <Text style={styles.sectionTitle}>
                Paradas Adicionadas ({paradas.length})
              </Text>
            )}
            {paradasStatus.cor !== 'default' && (
              <View
                style={[
                  styles.limitBadge,
                  paradasStatus.cor === 'error'
                    ? styles.limitBadgeError
                    : styles.limitBadgeWarning,
                ]}
              >
                <Ionicons
                  name={paradasStatus.icone || 'alert-circle'}
                  size={14}
                  color={
                    paradasStatus.cor === 'error'
                      ? theme.colors.error
                      : theme.colors.warning
                  }
                />
                <Text
                  style={[
                    styles.limitText,
                    {
                      color:
                        paradasStatus.cor === 'error'
                          ? theme.colors.error
                          : theme.colors.warning,
                    },
                  ]}
                >
                  {paradas.length > MAX_ROUTE_STOPS
                    ? 'Limite excedido'
                    : 'Próximo do limite'}
                </Text>
              </View>
            )}
          </View>

          <BulkStopImporter
            onImport={onImport}
            disabled={isLoading || paradas.length >= MAX_ROUTE_STOPS}
          />

          <DraggableFlatList
            data={paradas}
            keyExtractor={(parada) => parada.id}
            renderItem={renderStop}
            onDragEnd={({ data }) => onReorder(data)}
            scrollEnabled={false}
            activationDistance={8}
          />

          <TouchableOpacity
            style={[
              styles.optimizeButton,
              (isOptimizing || !enderecoUnidade) && styles.disabledButton,
            ]}
            onPress={onOptimize}
            disabled={isOptimizing || !enderecoUnidade}
            accessibilityLabel="Otimizar rota para o melhor percurso"
            accessibilityRole="button"
            accessibilityState={{
              disabled: isOptimizing || !enderecoUnidade,
            }}
          >
            {isOptimizing ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={styles.optimizeText}>Otimizar melhor percurso</Text>
            )}
          </TouchableOpacity>

          {rotaOtimizada && !ordemManual && (
            <RotaOtimizadaBanner
              rotaOtimizada={rotaOtimizada}
              enderecoUnidade={enderecoUnidade}
            />
          )}
          {ordemManual && rotaOtimizada && (
            <OrdemManualBanner
              rotaOtimizada={rotaOtimizada}
              distanciaManualReal={distanciaManualReal}
              isOptimizing={isOptimizing}
              isCalculandoReal={isCalculandoReal}
              onReoptimize={onOptimize}
            />
          )}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="cube-outline"
              size={44}
              color={theme.colors.gray400}
            />
          </View>
          <Text style={styles.emptyTitle}>Nenhuma parada adicionada</Text>
          <Text style={styles.emptyText}>
            Use o formulário de parada para começar a montar a rota.
          </Text>
          <BulkStopImporter onImport={onImport} disabled={isLoading} />
        </View>
      )}

      {paradas.length > 0 && (
        <>
          <RouteDateSelector value={dataRota} onChange={onChangeDataRota} />
          <MotoristaSeletor
            motoristas={motoristas}
            motoristaSelecionado={motoristaSelecionado}
            onSelectMotorista={onSelectMotorista}
          />
        </>
      )}

      {paradas.length > 0 && !hideGenerateButton && (
        <>
          {validationErrors.length > 0 && (
            <View style={styles.validationBox} accessibilityLiveRegion="polite">
              <Ionicons
                name="alert-circle"
                size={18}
                color={theme.colors.error}
              />
              <Text style={styles.validationText}>{validationErrors[0]}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.generateButton,
              (!canGenerateRoute || isLoading) && styles.disabledButton,
            ]}
            onPress={onGenerateRoute}
            disabled={!canGenerateRoute || isLoading}
            accessibilityLabel={
              isLoading
                ? 'Criando rota'
                : canGenerateRoute
                  ? `Revisar rota com ${paradas.length} paradas`
                  : validationErrors[0] || 'Rota ainda não pode ser criada'
            }
            accessibilityRole="button"
            accessibilityState={{ disabled: !canGenerateRoute || isLoading }}
          >
            {isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={theme.colors.white} />
                <Text style={styles.generateText}>Criando rota...</Text>
              </View>
            ) : (
              <Text style={styles.generateText}>Revisar e Criar Rota</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
});

const createStyles = (theme: Theme, isDesktop: boolean) =>
  StyleSheet.create({
    column: {
      flex: 1,
    },
    baseCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.primary + '35',
      backgroundColor: theme.colors.primaryBg,
    },
    baseInfo: {
      flex: 1,
    },
    baseLabel: {
      color: theme.colors.primaryDark,
      fontFamily: theme.typography.fontSansSemiBold,
      fontSize: theme.typography.xs,
      textTransform: 'uppercase',
    },
    baseAddress: {
      color: theme.colors.gray700,
      fontSize: theme.typography.sm,
      marginTop: 2,
    },
    semSedeCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.warning + '55',
      backgroundColor: theme.colors.warning + '12',
    },
    semSedeLabel: {
      color: theme.colors.warning,
      fontFamily: theme.typography.fontSansSemiBold,
      fontSize: theme.typography.xs,
      textTransform: 'uppercase',
    },
    semSedeAcao: {
      alignSelf: 'flex-start',
      marginTop: theme.spacing.sm,
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.primary,
    },
    semSedeAcaoTexto: {
      color: theme.colors.white,
      fontFamily: theme.typography.fontSansSemiBold,
      fontSize: theme.typography.sm,
    },
    listSection: {
      marginBottom: theme.spacing.xl,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.md,
    },
    sectionTitle: {
      color: theme.colors.gray900,
      fontFamily: theme.typography.fontSansSemiBold,
      fontSize: theme.typography.lg,
    },
    limitBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.md,
    },
    limitBadgeError: {
      backgroundColor: theme.colors.error + '18',
    },
    limitBadgeWarning: {
      backgroundColor: theme.colors.warning + '18',
    },
    limitText: {
      fontFamily: theme.typography.fontSansSemiBold,
      fontSize: theme.typography.xs,
    },
    optimizeButton: {
      alignSelf: isDesktop ? 'flex-start' : 'stretch',
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.info,
      paddingHorizontal: theme.spacing.lg,
      marginTop: theme.spacing.md,
    },
    optimizeText: {
      color: theme.colors.white,
      fontFamily: theme.typography.fontSansSemiBold,
      fontSize: theme.typography.sm,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: isDesktop ? 280 : 320,
      padding: theme.spacing.xl,
      borderWidth: 1,
      borderColor: theme.colors.gray200,
      borderRadius: theme.borderRadius.xl,
      backgroundColor: theme.colors.white,
      marginBottom: theme.spacing.xl,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.gray100,
      marginBottom: theme.spacing.lg,
    },
    emptyTitle: {
      color: theme.colors.gray900,
      fontFamily: theme.typography.fontSansSemiBold,
      fontSize: theme.typography.lg,
    },
    emptyText: {
      color: theme.colors.gray500,
      fontSize: theme.typography.sm,
      textAlign: 'center',
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
    },
    validationBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.error + '12',
      marginBottom: theme.spacing.sm,
    },
    validationText: {
      flex: 1,
      color: theme.colors.error,
      fontSize: theme.typography.sm,
    },
    generateButton: {
      alignSelf: isDesktop ? 'flex-start' : 'stretch',
      minHeight: 50,
      minWidth: isDesktop ? 210 : undefined,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.success,
      paddingHorizontal: theme.spacing.xl,
    },
    disabledButton: {
      backgroundColor: theme.colors.gray400,
      opacity: 0.65,
    },
    generateText: {
      color: theme.colors.white,
      fontFamily: theme.typography.fontSansBold,
      fontSize: theme.typography.base,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
  });
