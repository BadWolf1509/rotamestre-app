/**
 * ParadaCard - Individual stop card for motorista
 * Orchestrator component that composes subcomponents
 */

import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import { View, Text, Animated } from 'react-native';

import { SwipeableRow } from '@/components/SwipeableRow';
import { successHaptic } from '@/utils/haptics';
import { useUnistyles } from '@/utils/styles';

import { styles } from './ParadaCard.styles';
import { getStatusLabel, type ParadaCardProps } from './ParadaCard.types';
import { PrimaryActions, RetomarButton, SwipeHint } from './ParadaCardActions';
import { ParadaCardAddress } from './ParadaCardAddress';
import { ParadaCardDetails } from './ParadaCardDetails';
import { ParadaCardHeader } from './ParadaCardHeader';

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
    variant = 'default',
  }) => {
    const { theme } = useUnistyles();
    const isSummary = variant === 'summary';

    // Derived status flags
    const isConcluida = parada.status === 'concluida';
    const isPulada = parada.status === 'pulada';
    const isEmAndamento = parada.status === 'em_andamento';
    const isPendente = parada.status === 'pendente' || isEmAndamento;
    const isProcessada = isConcluida || isPulada;

    // Local state
    const [cardExpandido, setCardExpandido] = useState(false);

    // Animation for completion
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const prevStatusRef = useRef(parada.status);

    useEffect(() => {
      if (prevStatusRef.current === 'pendente' && parada.status === 'concluida') {
        successHaptic();

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

    // Memoized callbacks
    const handleConcluir = useCallback(() => onConcluir(parada), [parada, onConcluir]);
    const handlePular = useCallback(() => onPular(parada), [parada, onPular]);
    const handleRetomar = useCallback(() => onRetomar(parada), [parada, onRetomar]);
    const handleNavegar = useCallback(() => onNavegar(parada), [parada, onNavegar]);
    const handleReportar = useCallback(() => onReportar(parada), [parada, onReportar]);
    const handleToggleExpand = useCallback(() => setCardExpandido(prev => !prev), []);

    // Swipe configuration
    const canSwipe = !isSummary && isPendente && rotaEmAndamento;

    const leftActions = canSwipe
      ? [{
          icon: 'checkmark-circle' as const,
          label: 'Concluir',
          color: theme.colors.success,
          onPress: handleConcluir,
        }]
      : [];

    const rightActions = canSwipe
      ? [{
          icon: 'arrow-forward-circle' as const,
          label: 'Pular',
          color: theme.colors.warning,
          onPress: handlePular,
        }]
      : [];

    // Accessibility
    const tipoLabel = parada.tipo === 'entrega' ? 'entrega' : parada.tipo === 'retirada' ? 'retirada' : 'origem';
    const statusLabel = getStatusLabel(isConcluida, isPulada, isEmAndamento);
    const enderecoA11y = parada.enderecoSecundario
      ? `${parada.endereco}. ${parada.enderecoSecundario}`
      : parada.endereco;

    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <SwipeableRow
          leftActions={leftActions}
          rightActions={rightActions}
          enabled={canSwipe && !concluindo && !pulando}
        >
          <View
            accessible={true}
            accessibilityLabel={`Parada ${parada.ordem}. Tipo ${tipoLabel}. Status ${statusLabel}${isProxima ? '. Próxima parada' : ''}. ${enderecoA11y}`}
            accessibilityHint={
              canSwipe
                ? 'Deslize para a esquerda para concluir ou para a direita para pular'
                : undefined
            }
            style={[
              styles.paradaCard,
              !isSummary && isProxima && isPendente && styles.paradaCardProxima,
              !isSummary && isConcluida && styles.paradaCardConcluida,
              !isSummary && isPulada && styles.paradaCardPulada,
            ]}
          >
            {/* PROXIMA badge */}
            {!isSummary && isProxima && isPendente && (
              <View style={styles.proximaBadge}>
                <Text style={styles.proximaBadgeText}>PRÓXIMA</Text>
              </View>
            )}

            {/* Header with badges */}
            <ParadaCardHeader
              ordem={parada.ordem}
              tipo={parada.tipo}
              isConcluida={isConcluida}
              isPulada={isPulada}
              isEmAndamento={isEmAndamento}
              isPendente={isPendente}
              isSummary={isSummary}
            />

            {/* Address */}
            <ParadaCardAddress
              endereco={parada.endereco}
              enderecoSecundario={parada.enderecoSecundario}
              concluidaEm={parada.concluidaEm}
              isConcluida={isConcluida}
              isPulada={isPulada}
              isProcessada={isProcessada}
              isSummary={isSummary}
              cardExpandido={cardExpandido}
              onToggleExpand={handleToggleExpand}
            />

            {/* Expanded details for processed cards */}
            {!isSummary && isProcessada && cardExpandido && (
              <ParadaCardDetails
                destinatario={parada.destinatario}
                telefone={parada.telefone}
                observacoes={parada.observacoes}
                isProcessada={true}
              />
            )}

            {/* Expanded content for pending cards */}
            {!isSummary && !isProcessada && (
              <ParadaCardDetails
                destinatario={parada.destinatario}
                telefone={parada.telefone}
                observacoes={parada.observacoes}
                isProcessada={false}
              />
            )}

            {/* Primary actions for pending cards */}
            {!isSummary && !isConcluida && !isPulada && (
              <PrimaryActions
                onNavegar={handleNavegar}
                onReportar={handleReportar}
              />
            )}

            {/* Retomar button for skipped cards */}
            {!isSummary && isPulada && (
              <RetomarButton
                onRetomar={handleRetomar}
                retomando={retomando}
              />
            )}

            {/* Swipe hint for pending cards */}
            {!isSummary && isPendente && rotaEmAndamento && (
              <SwipeHint />
            )}
          </View>
        </SwipeableRow>
      </Animated.View>
    );
  },
  // Custom comparison to avoid unnecessary re-renders
  (prevProps, nextProps) => {
    return (
      prevProps.parada.id === nextProps.parada.id &&
      prevProps.parada.status === nextProps.parada.status &&
      prevProps.concluindo === nextProps.concluindo &&
      prevProps.pulando === nextProps.pulando &&
      prevProps.retomando === nextProps.retomando &&
      prevProps.rotaEmAndamento === nextProps.rotaEmAndamento &&
      prevProps.isProxima === nextProps.isProxima &&
      prevProps.variant === nextProps.variant
    );
  }
);

ParadaCard.displayName = 'ParadaCard';
