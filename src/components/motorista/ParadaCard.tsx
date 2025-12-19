/**
 * ParadaCard - Card individual para exibição de parada do motorista
 * Extraído de checkpoints.tsx para melhor manutenibilidade
 */

import { Ionicons } from '@expo/vector-icons';
import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Linking, Animated } from 'react-native';

import { StreetViewPreview } from '@/components/StreetViewPreview';
import { SwipeableRow } from '@/components/SwipeableRow';
import { successHaptic } from '@/utils/haptics';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// Tipos fortes para status
export type ParadaStatus = 'pendente' | 'concluida' | 'pulada';
export type ParadaTipo = 'entrega' | 'retirada';

export interface Parada {
  id: string;
  endereco: string;
  latitude: number;
  longitude: number;
  ordem: number;
  status: ParadaStatus;
  tipo: ParadaTipo;
  destinatario?: string;
  telefone?: string;
  observacoes?: string;
  is_checkpoint?: boolean;
  vinculo_parada_id?: string | null;
}

export interface ParadaCardProps {
  parada: Parada;
  rotaEmAndamento: boolean;
  onConcluir: (parada: Parada) => void;
  onPular: (parada: Parada) => void;
  onRetomar: (parada: Parada) => void;
  onNavegar: (parada: Parada) => void;
  onReportar: (parada: Parada) => void;
  concluindo?: boolean;
  pulando?: boolean;
  retomando?: boolean;
  isProxima?: boolean;
}

export const ParadaCard = memo<ParadaCardProps>(
  ({
    parada,
    rotaEmAndamento,
    onConcluir,
    onPular,
    onRetomar,
    onNavegar,
    onReportar,
    concluindo = false,
    pulando = false,
    retomando = false,
    isProxima = false,
  }) => {
    const { theme } = useUnistyles();

    const isConcluida = parada.status === 'concluida';
    const isPulada = parada.status === 'pulada';
    const isPendente = parada.status === 'pendente';
    const isProcessada = isConcluida || isPulada;

    // Estado para card processado expansível
    const [cardExpandido, setCardExpandido] = useState(false);

    // Estado para observações expansíveis
    const [obsExpandida, setObsExpandida] = useState(false);

    // Estado para Street View indisponível (para esconder quando não há imagem)
    const [streetViewUnavailable, setStreetViewUnavailable] = useState(false);
    const LIMITE_OBS = 80;
    const temObsLonga = parada.observacoes && parada.observacoes.length > LIMITE_OBS;

    // Helper para tradução de status
    const statusLabel = isConcluida ? 'concluída' : isPulada ? 'pulada' : 'pendente';
    const tipoLabel = parada.tipo === 'entrega' ? 'entrega' : 'retirada';

    // Animação de conclusão
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const prevStatusRef = useRef(parada.status);

    useEffect(() => {
      // Detectar mudança de status para concluída
      if (prevStatusRef.current === 'pendente' && parada.status === 'concluida') {
        // Haptic feedback
        successHaptic();

        // Animação de "pulse"
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.03,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      }

      prevStatusRef.current = parada.status;
    }, [parada.status, scaleAnim]);

    const handleConcluir = useCallback(() => {
      onConcluir(parada);
    }, [parada, onConcluir]);

    const handlePular = useCallback(() => {
      onPular(parada);
    }, [parada, onPular]);

    const handleRetomar = useCallback(() => {
      onRetomar(parada);
    }, [parada, onRetomar]);

    const handleNavegar = useCallback(() => {
      onNavegar(parada);
    }, [parada, onNavegar]);

    const handleReportar = useCallback(() => {
      onReportar(parada);
    }, [parada, onReportar]);

    const handleLigar = useCallback(() => {
      if (parada.telefone) {
        const numeroLimpo = parada.telefone.replace(/\D/g, '');
        Linking.openURL(`tel:${numeroLimpo}`);
      }
    }, [parada.telefone]);

    // Swipe actions para paradas pendentes
    const leftActions = isPendente && rotaEmAndamento
      ? [
          {
            icon: 'checkmark-circle',
            label: 'Concluir',
            color: theme.colors.success,
            onPress: handleConcluir,
          },
        ]
      : [];

    const rightActions = isPendente && rotaEmAndamento
      ? [
          {
            icon: 'arrow-forward-circle',
            label: 'Pular',
            color: theme.colors.warning,
            onPress: handlePular,
          },
        ]
      : [];

    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <SwipeableRow
          leftActions={leftActions}
          rightActions={rightActions}
          enabled={isPendente && !concluindo && !pulando && rotaEmAndamento}
        >
          <View
          accessible={true}
          accessibilityLabel={`Parada ${parada.ordem}, ${tipoLabel}, ${statusLabel}${isProxima ? ', próxima parada' : ''}. ${parada.endereco}`}
          accessibilityHint={
            isPendente
              ? 'Deslize para a esquerda para concluir ou para a direita para pular'
              : undefined
          }
          style={[
            styles.paradaCard,
            isProxima && isPendente && styles.paradaCardProxima,
            isConcluida && styles.paradaCardConcluida,
            isPulada && styles.paradaCardPulada,
          ]}
        >
          {/* Badge PRÓXIMA */}
          {isProxima && isPendente && (
            <View style={styles.proximaBadge}>
              <Text style={styles.proximaBadgeText}>PRÓXIMA</Text>
            </View>
          )}

          {/* Ordem e Status */}
          <View style={styles.paradaHeader}>
            <View style={styles.ordemBadge}>
              <Text style={styles.ordemText}>{parada.ordem}</Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                isConcluida && styles.statusBadgeConcluida,
                isPulada && styles.statusBadgePulada,
                isPendente && styles.statusBadgePendente,
              ]}
            >
              <Text style={styles.statusBadgeText}>
                {isConcluida ? '✓ Concluída' : isPulada ? '↷ Pulada' : '○ Pendente'}
              </Text>
            </View>
            <View
              style={[
                styles.tipoBadge,
                parada.tipo === 'entrega' ? styles.tipoBadgeEntrega : styles.tipoBadgeRetirada,
              ]}
            >
              <Text style={styles.tipoBadgeText}>
                {parada.tipo === 'entrega' ? '📦 Entrega' : '📥 Retirada'}
              </Text>
            </View>
          </View>

          {/* Endereço - clicável para expandir em cards processados */}
          {isProcessada ? (
            <TouchableOpacity
              onPress={() => setCardExpandido(!cardExpandido)}
              activeOpacity={0.7}
              style={styles.enderecoExpandivel}
            >
              <Text
                style={[styles.paradaEndereco, styles.paradaEnderecoCompacto]}
                numberOfLines={cardExpandido ? undefined : 1}
              >
                {parada.endereco}
              </Text>
              <Ionicons
                name={cardExpandido ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.colors.gray400}
              />
            </TouchableOpacity>
          ) : (
            <Text style={styles.paradaEndereco}>
              {parada.endereco}
            </Text>
          )}

          {/* Detalhes expandidos para cards processados */}
          {isProcessada && cardExpandido && (
            <>
              {/* Detalhes */}
              {(parada.destinatario || parada.telefone) && (
                <View style={styles.paradaDetalhes}>
                  {parada.destinatario && (
                    <Text style={styles.paradaDetalheTexto}>👤 {parada.destinatario}</Text>
                  )}
                  {parada.telefone && (
                    <TouchableOpacity
                      onPress={handleLigar}
                      style={styles.telefoneContainer}
                      accessibilityLabel={`Ligar para ${parada.telefone}`}
                      accessibilityRole="button"
                      activeOpacity={0.7}
                    >
                      <Text style={styles.telefoneLinkTexto}>📞 {parada.telefone}</Text>
                      <Ionicons name="call-outline" size={14} color={theme.colors.info} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Observações */}
              {parada.observacoes && (
                <View style={styles.observacoesContainer}>
                  <Text style={styles.observacoesLabel}>📝 Observações:</Text>
                  <Text style={styles.observacoesTexto}>{parada.observacoes}</Text>
                </View>
              )}
            </>
          )}

          {/* Conteúdo expandido apenas para paradas pendentes */}
          {!isProcessada && (
            <>
              {/* Street View Preview - lazy loading: só carrega para pendentes */}
              {/* Esconde completamente quando não há imagem disponível para o local */}
              {!streetViewUnavailable && (
                <View style={styles.streetViewContainer}>
                  <StreetViewPreview
                    latitude={parada.latitude}
                    longitude={parada.longitude}
                    address={parada.endereco}
                    size="medium"
                    onUnavailable={() => setStreetViewUnavailable(true)}
                    fallback="none"
                  />
                </View>
              )}

              {/* Detalhes */}
              {(parada.destinatario || parada.telefone) && (
                <View style={styles.paradaDetalhes}>
                  {parada.destinatario && (
                    <Text style={styles.paradaDetalheTexto}>👤 {parada.destinatario}</Text>
                  )}
                  {parada.telefone && (
                    <TouchableOpacity
                      onPress={handleLigar}
                      style={styles.telefoneContainer}
                      accessibilityLabel={`Ligar para ${parada.telefone}`}
                      accessibilityRole="button"
                      activeOpacity={0.7}
                    >
                      <Text style={styles.telefoneLinkTexto}>📞 {parada.telefone}</Text>
                      <Ionicons name="call-outline" size={14} color={theme.colors.info} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Observações - expansíveis */}
              {parada.observacoes && (
                <TouchableOpacity
                  style={styles.observacoesContainer}
                  onPress={() => temObsLonga && setObsExpandida(!obsExpandida)}
                  disabled={!temObsLonga}
                  activeOpacity={temObsLonga ? 0.7 : 1}
                >
                  <View style={styles.observacoesHeader}>
                    <Text style={styles.observacoesLabel}>📝 Observações:</Text>
                    {temObsLonga && (
                      <Ionicons
                        name={obsExpandida ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={theme.colors.gray500}
                      />
                    )}
                  </View>
                  <Text style={styles.observacoesTexto}>
                    {!obsExpandida && temObsLonga
                      ? parada.observacoes.slice(0, LIMITE_OBS) + '...'
                      : parada.observacoes}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Botões de Ação Primários */}
          {!isConcluida && !isPulada && (
            <View style={styles.primaryActionsContainer}>
              <TouchableOpacity
                style={styles.botaoNavegar}
                onPress={handleNavegar}
                activeOpacity={0.7}
                accessibilityLabel="Como chegar"
                accessibilityRole="button"
                accessibilityHint="Abre o aplicativo de navegação"
              >
                <Text style={styles.botaoNavegarIcone}>🧭</Text>
                <Text style={styles.botaoNavegarTexto}>Como Chegar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botaoReportar}
                onPress={handleReportar}
                activeOpacity={0.7}
                accessibilityLabel="Reportar problema"
                accessibilityRole="button"
                accessibilityHint="Abre formulário para reportar incidente"
              >
                <Ionicons name="warning-outline" size={20} color={theme.colors.white} />
                <Text style={styles.botaoReportarTexto}>Reportar Problema</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Botão Retomar para paradas PULADAS */}
          {isPulada && (
            <View style={styles.retornarContainer}>
              <TouchableOpacity
                style={[styles.botaoRetomar, retomando && styles.botaoDisabled]}
                onPress={handleRetomar}
                disabled={retomando}
                activeOpacity={0.7}
                accessibilityLabel="Retomar parada"
                accessibilityRole="button"
                accessibilityHint="Volta esta parada para o status pendente"
                accessibilityState={{ disabled: retomando }}
              >
                {retomando ? (
                  <ActivityIndicator color={theme.colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={18} color={theme.colors.white} />
                    <Text style={styles.botaoRetomarTexto}>Retomar Parada</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Indicador visual de swipe para paradas pendentes */}
          {isPendente && rotaEmAndamento && (
            <View style={styles.swipeHint}>
              <Ionicons name="swap-horizontal" size={16} color={theme.colors.gray400} />
              <Text style={styles.swipeHintText}>Deslize para ações</Text>
            </View>
          )}
          </View>
        </SwipeableRow>
      </Animated.View>
    );
  },
  // Custom comparison para evitar re-renders desnecessários
  (prevProps, nextProps) => {
    return (
      prevProps.parada.id === nextProps.parada.id &&
      prevProps.parada.status === nextProps.parada.status &&
      prevProps.concluindo === nextProps.concluindo &&
      prevProps.pulando === nextProps.pulando &&
      prevProps.retomando === nextProps.retomando &&
      prevProps.rotaEmAndamento === nextProps.rotaEmAndamento &&
      prevProps.isProxima === nextProps.isProxima
    );
  }
);

ParadaCard.displayName = 'ParadaCard';

const styles = StyleSheet.create((theme: Theme) => ({
  paradaCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    ...theme.shadows.md,
  },
  paradaCardProxima: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    backgroundColor: theme.colors.primaryBg,
    marginTop: 12, // Espaço para o badge "PRÓXIMA"
  },
  proximaBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    zIndex: 1,
  },
  proximaBadgeText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  paradaCardConcluida: {
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.successBg,
  },
  paradaCardPulada: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.errorBg,
    opacity: 0.7,
  },
  paradaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  ordemBadge: {
    width: theme.spacing.xl,
    height: theme.spacing.xl,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ordemText: {
    color: theme.colors.white,
    fontSize: theme.typography.md,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.xl,
    flex: 1,
  },
  statusBadgePendente: {
    backgroundColor: theme.colors.yellow100,
  },
  statusBadgeConcluida: {
    backgroundColor: theme.colors.green100,
  },
  statusBadgePulada: {
    backgroundColor: theme.colors.red100,
  },
  statusBadgeText: {
    fontSize: theme.typography.xs,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  tipoBadge: {
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.xl,
  },
  tipoBadgeEntrega: {
    backgroundColor: theme.colors.blue100,
  },
  tipoBadgeRetirada: {
    backgroundColor: theme.colors.indigo100,
  },
  tipoBadgeText: {
    fontSize: theme.typography.xs,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  paradaEndereco: {
    fontSize: theme.typography.md,
    fontWeight: '600',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  paradaEnderecoCompacto: {
    fontSize: theme.typography.sm,
    marginBottom: 0,
    flex: 1,
  },
  enderecoExpandivel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  paradaDetalhes: {
    marginBottom: theme.spacing.xs,
  },
  paradaDetalheTexto: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.xs,
  },
  telefoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  telefoneLinkTexto: {
    fontSize: theme.typography.sm,
    color: theme.colors.info,
    textDecorationLine: 'underline',
  },
  observacoesContainer: {
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  observacoesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  observacoesLabel: {
    fontSize: theme.typography.xs,
    fontWeight: '600',
    color: theme.colors.gray500,
  },
  observacoesTexto: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray900,
    fontStyle: 'italic',
  },
  botaoDisabled: {
    opacity: 0.6,
  },
  retornarContainer: {
    marginTop: theme.spacing.sm,
  },
  botaoRetomar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.info,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
  },
  botaoRetomarTexto: {
    color: theme.colors.white,
    fontSize: theme.typography.sm,
    fontWeight: '600',
  },
  botaoNavegar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondary,
    paddingVertical: theme.spacing.md - 4,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
    // Brand: sombra com tom da cor do botão (cross-platform)
    shadowColor: theme.colors.secondaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    // Web: boxShadow CSS
    boxShadow: '0px 4px 16px rgba(200, 119, 4, 0.35)',
  },
  botaoNavegarIcone: {
    fontSize: 20,
  },
  botaoNavegarTexto: {
    color: theme.colors.white,
    fontSize: theme.typography.md,
    fontWeight: '600',
    // Brand: sombra para texto branco em fundo laranja (cross-platform)
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    // Web: textShadow CSS
    textShadow: '0px 1px 2px rgba(0, 0, 0, 0.25)',
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.sm,
  },
  swipeHintText: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    fontWeight: '500',
  },
  streetViewContainer: {
    marginTop: theme.spacing.sm,
    alignItems: 'center',
  },
  primaryActionsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  botaoReportar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.warning,
    paddingVertical: theme.spacing.md - 4,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
    // Brand: sombra com tom da cor do botão (cross-platform)
    shadowColor: theme.colors.warningDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    // Web: boxShadow CSS
    boxShadow: '0px 4px 16px rgba(217, 119, 6, 0.35)',
  },
  botaoReportarTexto: {
    color: theme.colors.white,
    fontSize: theme.typography.sm,
    fontWeight: '600',
    // Brand: sombra para texto branco em fundo laranja/warning (cross-platform)
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    // Web: textShadow CSS
    textShadow: '0px 1px 2px rgba(0, 0, 0, 0.3)',
  },
}));
