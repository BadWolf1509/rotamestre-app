import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useMemo } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';

import { ParadaCard, type Parada } from '@/components/motorista/ParadaCard';
import {
  MobileCard,
  MobileEmptyState,
  MobileHeader,
  MobileLoading,
} from '@/design-system';
import { useResponsive } from '@/hooks/useResponsive';
import { useResumoRota } from '@/hooks/useResumoRota';
import { parseLocalDate } from '@/lib/dateUtils';
import type { Checkpoint } from '@/types/rota';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export default function ResumoMotorista() {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ rota_id: string }>();

  const {
    rota,
    paradas,
    loading,
    error,
    recargar,
  } = useResumoRota(params.rota_id);

  const paradasReais = useMemo(
    () => paradas.filter((p) => p.is_checkpoint !== false),
    [paradas]
  );
  const isInitialLoading = loading && paradasReais.length === 0;

  const resumoSubtitle = useMemo(() => {
    if (!rota) return undefined;
    const dataCriacao = parseLocalDate(rota.created_at.split('T')[0]);
    const dataLabel = dataCriacao
      ? dataCriacao.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      })
      : '';
    return `${rota.unidades?.nome || 'Unidade'}${dataLabel ? ` • ${dataLabel}` : ''}`;
  }, [rota]);

  const formatEnderecoResumo = useCallback((endereco: Checkpoint['endereco']) => {
    if (!endereco) return { linha1: 'Endereço não informado', linha2: '' };
    if (typeof endereco === 'string') return { linha1: endereco, linha2: '' };
    const numero = endereco.numero ? `, ${endereco.numero}` : '';
    const complemento = endereco.complemento ? ` - ${endereco.complemento}` : '';
    const linha1 = `${endereco.logradouro || ''}${numero}${complemento}`.trim();
    if (!linha1 && endereco.endereco_completo) {
      return { linha1: endereco.endereco_completo, linha2: '' };
    }

    const bairro = endereco.bairro?.trim();
    const cidade = endereco.cidade?.trim();
    const estado = endereco.estado?.trim();
    let linha2 = '';
    if (bairro && (cidade || estado)) {
      linha2 = `${bairro} - ${cidade || ''}${estado ? `/${estado}` : ''}`.trim();
    } else if (cidade || estado) {
      linha2 = `${cidade || ''}${estado ? `/${estado}` : ''}`.trim();
    }

    return {
      linha1: linha1 || 'Endereço não informado',
      linha2,
    };
  }, []);

  const handleNoop = useCallback((_parada: Parada) => {}, []);

  const keyExtractor = useCallback((item: Checkpoint) => item.id, []);

  const renderParada = useCallback(
    ({ item }: { item: Checkpoint }) => {
      const { linha1, linha2 } = formatEnderecoResumo(item.endereco);
      const coordenadas = typeof item.endereco === 'object' ? item.endereco.coordenadas : undefined;

      const parada: Parada = {
        id: item.id,
        endereco: linha1,
        enderecoSecundario: linha2 || undefined,
        latitude: coordenadas?.latitude ?? 0,
        longitude: coordenadas?.longitude ?? 0,
        ordem: item.ordem,
        status: (item.status ?? 'pendente') as Parada['status'],
        tipo: (item.tipo ?? 'entrega') as Parada['tipo'],
        observacoes: item.observacoes,
        is_checkpoint: item.is_checkpoint,
        vinculo_parada_id: item.vinculo_parada_id ?? null,
        concluidaEm: item.concluida_em || item.timestamp_conclusao,
      };

      return (
        <ParadaCard
          parada={parada}
          rotaEmAndamento={false}
          onConcluir={handleNoop}
          onPular={handleNoop}
          onRetomar={handleNoop}
          onNavegar={handleNoop}
          onReportar={handleNoop}
          variant="summary"
        />
      );
    },
    [formatEnderecoResumo, handleNoop]
  );

  function calcularTempoTotal() {
    if (!rota?.iniciada_em || !rota?.concluida_em) return null;
    const inicio = new Date(rota.iniciada_em);
    const fim = new Date(rota.concluida_em);
    const diffMs = fim.getTime() - inicio.getTime();
    const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffHoras}h ${diffMinutos}min`;
  }

  const renderDesktopHeader = (subtitle?: string) =>
    isDesktop ? (
      <MobileHeader
        title="Resumo da Rota"
        subtitle={subtitle}
        showBack={!!params.rota_id}
        onBack={() => router.back()}
      />
    ) : null;

  useLayoutEffect(() => {
    if (isDesktop) return;
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Resumo da Rota</Text>
        </View>
      ),
    });
  }, [isDesktop, navigation]);

  if (isInitialLoading) {
    return <MobileLoading message="Carregando resumo..." />;
  }

  if (error) {
    return (
      <>
        {renderDesktopHeader()}
        <MobileEmptyState
          icon="⚠️"
          title="Não foi possível carregar o resumo"
          subtitle={error}
          actionLabel="Tentar novamente"
          onAction={recargar}
          fullScreen
        />
      </>
    );
  }

  if (!rota || paradasReais.length === 0) {
    return (
      <>
        {renderDesktopHeader()}
        <MobileEmptyState
          icon="🛣️"
          title="Nenhuma rota concluída disponível"
          subtitle="Complete uma rota para visualizar o resumo"
          actionLabel="Ver Rotas Disponíveis"
          onAction={() => router.push('/motorista')}
          fullScreen
        />
      </>
    );
  }

  const isConcluidaStatus = (status?: string) => status === 'concluida';
  const isPuladaStatus = (status?: string) => status === 'pulada';

  const paradasConcluidas = paradasReais.filter((p) => isConcluidaStatus(p.status)).length;
  const paradasPuladas = paradasReais.filter((p) => isPuladaStatus(p.status)).length;
  const taxaConclusao =
    paradasReais.length > 0 ? Math.round((paradasConcluidas / paradasReais.length) * 100) : 0;
  const taxaConclusaoRatio = `${paradasConcluidas}/${paradasReais.length}`;
  const tempoTotal = calcularTempoTotal();
  const distanciaFormatada = rota.distancia_total !== undefined && rota.distancia_total !== null
    ? rota.distancia_total.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
    : null;

  return (
    <>
      {renderDesktopHeader(resumoSubtitle)}

      {!isDesktop && resumoSubtitle ? (
        <View style={styles.headerCompact}>
          <Text style={styles.headerCompactSubtitle} numberOfLines={2} ellipsizeMode="tail">
            {resumoSubtitle}
          </Text>
        </View>
      ) : null}

      <FlatList
        data={paradasReais}
        keyExtractor={keyExtractor}
        renderItem={renderParada}
        style={styles.container}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={recargar}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Card de Performance */}
            <MobileCard title="Desempenho" variant="highlight">
              <View style={styles.performanceGrid}>
                <View style={styles.performanceItem}>
                  <View style={[styles.performanceIcon, { backgroundColor: theme.colors.primary }]}>
                    <Ionicons name="location" size={22} color={theme.colors.white} />
                  </View>
                  <Text style={styles.performanceValue}>{paradasReais.length}</Text>
                  <Text style={styles.performanceLabel}>Total de Paradas</Text>
                </View>

                <View style={styles.performanceItem}>
                  <View style={[styles.performanceIcon, { backgroundColor: theme.colors.success }]}>
                    <Ionicons name="checkmark-circle" size={22} color={theme.colors.white} />
                  </View>
                  <Text style={styles.performanceValue}>{paradasConcluidas}</Text>
                  <Text style={styles.performanceLabel}>Concluídas</Text>
                </View>

                <View style={styles.performanceItem}>
                  <View style={[styles.performanceIcon, { backgroundColor: theme.colors.error }]}>
                    <Ionicons name="arrow-forward-circle" size={22} color={theme.colors.white} />
                  </View>
                  <Text style={styles.performanceValue}>{paradasPuladas}</Text>
                  <Text style={styles.performanceLabel}>Puladas</Text>
                </View>

                <View style={styles.performanceItem}>
                  <View style={[styles.performanceIcon, { backgroundColor: theme.colors.purple600 }]}>
                    <Ionicons name="analytics" size={22} color={theme.colors.white} />
                  </View>
                  <Text style={styles.performanceValue}>{taxaConclusao}%</Text>
                  <Text style={styles.performanceLabel}>Taxa de Sucesso</Text>
                  <Text style={styles.performanceMeta}>{taxaConclusaoRatio}</Text>
                </View>
              </View>
            </MobileCard>

            {/* Informações da Rota */}
            <MobileCard title="Informações da Rota">
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Horário de Início:</Text>
                <Text style={styles.infoValue}>
                  {rota.iniciada_em
                    ? new Date(rota.iniciada_em).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                    : 'N/A'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Horário de Conclusão:</Text>
                <Text style={styles.infoValue}>
                  {rota.concluida_em
                    ? new Date(rota.concluida_em).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                    : 'N/A'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tempo Total:</Text>
                <Text style={styles.infoValue}>{tempoTotal || 'N/A'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Distância Percorrida:</Text>
                <Text style={styles.infoValue}>
                  {distanciaFormatada ? `${distanciaFormatada} km` : 'N/A'}
                </Text>
              </View>
            </MobileCard>

            <Text style={styles.sectionTitle}>Detalhes das Paradas</Text>
          </View>
        }
      />
    </>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  listContent: {
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  headerTitleContainer: {
    paddingVertical: theme.spacing.xs,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.white,
  },
  headerCompact: {
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  headerCompactSubtitle: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray500,
  },
  sectionTitle: {
    marginBottom: theme.spacing.sm,
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  performanceItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  performanceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  performanceValue: {
    fontSize: theme.typography['2xl'],
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  performanceLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  performanceMeta: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginTop: theme.spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  infoLabel: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    fontFamily: theme.typography.fontSansMedium,
  },
  infoValue: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontSansSemiBold,
  },
}));
