import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { formatarDecimal } from '@/lib/formatNumber';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import type {
  DistanciaManualReal,
  EnderecoUnidade,
  MotoristaResumo,
  Parada,
  RotaOtimizadaState,
  RouteDraftValidation,
} from './types';

interface RouteReviewModalProps {
  visible: boolean;
  paradas: Parada[];
  motorista: MotoristaResumo | null;
  unidadeNome: string;
  enderecoUnidade: EnderecoUnidade | null;
  dataRota: string;
  rotaOtimizada: RotaOtimizadaState | null;
  ordemManual: boolean;
  distanciaManualReal: DistanciaManualReal | null;
  validation: RouteDraftValidation;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-');
  return day && month && year ? `${day}/${month}/${year}` : value;
}

export function RouteReviewModal({
  visible,
  paradas,
  motorista,
  unidadeNome,
  enderecoUnidade,
  dataRota,
  rotaOtimizada,
  ordemManual,
  distanciaManualReal,
  validation,
  isLoading,
  onClose,
  onConfirm,
}: RouteReviewModalProps) {
  const { theme } = useUnistyles();
  const [confirmedDistance, setConfirmedDistance] = useState(false);

  useEffect(() => {
    if (!visible) setConfirmedDistance(false);
  }, [visible]);

  const routeMetrics = useMemo(() => {
    if (ordemManual && distanciaManualReal) {
      return {
        meters: distanciaManualReal.metros,
        seconds: distanciaManualReal.segundos,
        estimated: distanciaManualReal.isEstimated === true,
      };
    }
    if (rotaOtimizada) {
      return {
        meters: rotaOtimizada.distancia_total_metros,
        seconds: rotaOtimizada.duracao_total_segundos,
        estimated: rotaOtimizada.isEstimated === true,
      };
    }
    return null;
  }, [distanciaManualReal, ordemManual, rotaOtimizada]);

  const requiresDistanceConfirmation =
    validation.sanidadeGeografica.requerConfirmacao;
  const confirmDisabled =
    isLoading ||
    !validation.valido ||
    routeMetrics?.estimated === true ||
    (requiresDistanceConfirmation && !confirmedDistance);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={styles.container}
          onPress={(event) => event.stopPropagation()}
          accessibilityViewIsModal
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Revisar e confirmar rota</Text>
              <Text style={styles.subtitle}>
                Confira os dados antes de notificar o motorista
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fechar revisão"
            >
              <Ionicons name="close" size={24} color={theme.colors.gray600} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.summaryGrid}>
              <Summary label="Unidade" value={unidadeNome || 'Não informada'} />
              <Summary
                label="Base"
                value={enderecoUnidade?.endereco || 'Não cadastrada'}
              />
              <Summary
                label="Motorista"
                value={motorista?.nome || 'Não selecionado'}
              />
              <Summary label="Data" value={formatDate(dataRota)} />
              <Summary label="Paradas" value={String(paradas.length)} />
              <Summary
                label="Ordenação"
                value={
                  ordemManual
                    ? 'Manual'
                    : rotaOtimizada
                      ? 'Otimizada'
                      : 'Ordem de cadastro'
                }
              />
            </View>

            {routeMetrics && (
              <View style={styles.metrics}>
                <Text style={styles.metric}>
                  {formatarDecimal(routeMetrics.meters / 1000)} km
                </Text>
                <Text style={styles.metric}>
                  {Math.round(routeMetrics.seconds / 60)} min
                </Text>
              </View>
            )}

            {validation.erros.map((error) => (
              <AlertRow key={error} text={error} type="error" />
            ))}
            {validation.avisos.map((warning) => (
              <AlertRow key={warning} text={warning} type="warning" />
            ))}
            {motorista?.rotaEmAndamento && (
              <AlertRow
                text="O motorista selecionado está executando outra rota. Confira a data e a carga antes de confirmar."
                type="warning"
              />
            )}
            {routeMetrics?.estimated && (
              <AlertRow
                text="O percurso é apenas uma estimativa; recalcule antes de confirmar."
                type="error"
              />
            )}

            {requiresDistanceConfirmation && (
              <Pressable
                style={styles.confirmDistance}
                onPress={() => setConfirmedDistance((current) => !current)}
                accessibilityRole="checkbox"
                accessibilityLabel="Confirmar parada a mais de 300 quilômetros da base"
                accessibilityState={{ checked: confirmedDistance }}
              >
                <Ionicons
                  name={confirmedDistance ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={
                    confirmedDistance
                      ? theme.colors.primary
                      : theme.colors.gray500
                  }
                />
                <Text style={styles.confirmDistanceText}>
                  Confirmo que há parada a aproximadamente{' '}
                  {formatarDecimal(
                    validation.sanidadeGeografica.maiorDistanciaKm,
                    0,
                  )}{' '}
                  km da base e que a unidade selecionada está correta.
                </Text>
              </Pressable>
            )}

            <Text style={styles.stopsTitle}>Sequência das paradas</Text>
            {paradas.map((parada) => (
              <View key={parada.id} style={styles.stopRow}>
                <Text style={styles.stopOrder}>{parada.ordem}</Text>
                <View style={styles.stopInfo}>
                  <Text style={styles.stopTitle}>
                    {parada.tipo === 'retirada' ? 'Retirada' : 'Entrega'} ·{' '}
                    {parada.destinatario}
                  </Text>
                  <Text style={styles.stopAddress}>{parada.endereco}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Voltar e editar a rota"
            >
              <Text style={styles.cancelText}>Voltar e editar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                confirmDisabled && styles.confirmButtonDisabled,
              ]}
              onPress={onConfirm}
              disabled={confirmDisabled}
              accessibilityRole="button"
              accessibilityLabel={
                isLoading
                  ? 'Criando e notificando motorista'
                  : 'Criar rota e notificar motorista'
              }
              accessibilityState={{ disabled: confirmDisabled }}
            >
              {isLoading ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text style={styles.confirmText}>Criar e notificar</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function AlertRow({ text, type }: { text: string; type: 'error' | 'warning' }) {
  const { theme } = useUnistyles();
  return (
    <View
      style={[
        styles.alertRow,
        type === 'error' ? styles.errorRow : styles.warningRow,
      ]}
      accessibilityLiveRegion="polite"
    >
      <Ionicons
        name={type === 'error' ? 'alert-circle' : 'warning'}
        size={18}
        color={type === 'error' ? theme.colors.error : theme.colors.warning}
      />
      <Text style={styles.alertText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '92%',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    ...theme.shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  title: {
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.xl,
  },
  subtitle: {
    color: theme.colors.gray500,
    fontSize: theme.typography.sm,
    marginTop: theme.spacing.xs,
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    padding: theme.spacing.xl,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  summaryItem: {
    width: '47%',
    minWidth: 180,
  },
  summaryLabel: {
    color: theme.colors.gray500,
    fontSize: theme.typography.xs,
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.sm,
    marginTop: 2,
  },
  metrics: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    marginVertical: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primaryBg,
    borderRadius: theme.borderRadius.lg,
  },
  metric: {
    color: theme.colors.primaryDark,
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.lg,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  errorRow: {
    backgroundColor: theme.colors.error + '12',
  },
  warningRow: {
    backgroundColor: theme.colors.warning + '15',
  },
  alertText: {
    flex: 1,
    color: theme.colors.gray700,
    fontSize: theme.typography.sm,
  },
  confirmDistance: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.warning,
    borderRadius: theme.borderRadius.lg,
    marginVertical: theme.spacing.md,
  },
  confirmDistanceText: {
    flex: 1,
    color: theme.colors.gray700,
    fontSize: theme.typography.sm,
  },
  stopsTitle: {
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.base,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  stopRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  stopOrder: {
    width: 28,
    height: 28,
    textAlign: 'center',
    textAlignVertical: 'center',
    borderRadius: 14,
    backgroundColor: theme.colors.primaryBg,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansBold,
  },
  stopInfo: {
    flex: 1,
  },
  stopTitle: {
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.sm,
  },
  stopAddress: {
    color: theme.colors.gray500,
    fontSize: theme.typography.xs,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
  },
  cancelButton: {
    paddingHorizontal: theme.spacing.lg,
    minHeight: 46,
    justifyContent: 'center',
  },
  cancelText: {
    color: theme.colors.gray600,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  confirmButton: {
    minHeight: 46,
    minWidth: 170,
    paddingHorizontal: theme.spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.success,
  },
  confirmButtonDisabled: {
    backgroundColor: theme.colors.gray400,
    opacity: 0.7,
  },
  confirmText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansBold,
  },
}));
