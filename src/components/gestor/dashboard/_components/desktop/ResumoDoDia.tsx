/**
 * ResumoDoDia — "como está o dia" numa frase, no topo da Início desktop.
 *
 * "3 rotas em andamento, 2 pendentes, 1 concluída — 12 de 40 paradas feitas,
 * 48,5 km". Status com zero rota sai da frase; a concordância é do `plural`.
 * Com incidente aberto, um trecho em laranja (atenção) leva aos incidentes;
 * sem incidente, a frase não fala deles. Contagem indisponível (null) não
 * vira "0": diz que está indisponível, sem link.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { RouteStatusType } from '@/constants/statusConfig';
import { formatarDecimal } from '@/lib/formatNumber';
import { plural } from '@/lib/plural';
import { StyleSheet, type Theme } from '@/utils/styles';

import type { RotaResumo } from '../../_hooks/useDashboardData';

interface ResumoDoDiaProps {
  rotas: RotaResumo[];
  /** A frase sem rota; a Início passa a mesma do estado vazio ao lado. */
  textoSemRotas?: string;
  /** null = a contagem falhou (indisponível). */
  incidentesAbertos: number | null;
  onAbrirIncidentes: () => void;
}

/** Ordem da frase e concordância (singular, plural) de cada status. */
const PARTES_DE_STATUS: [RouteStatusType, string, string][] = [
  ['em_andamento', 'em andamento', 'em andamento'],
  ['pendente', 'pendente', 'pendentes'],
  ['concluida', 'concluída', 'concluídas'],
  ['cancelada', 'cancelada', 'canceladas'],
  ['nao_executada', 'não executada', 'não executadas'],
];

function fraseDoResumo(rotas: RotaResumo[], textoSemRotas: string): string {
  if (rotas.length === 0) return textoSemRotas;

  const partes: string[] = [];
  for (const [status, singular, pluralForma] of PARTES_DE_STATUS) {
    const n = rotas.filter((r) => r.status === status).length;
    if (n === 0) continue;
    // Só a primeira parte leva o substantivo: "3 rotas em andamento, 2 pendentes".
    partes.push(
      partes.length === 0
        ? plural(n, `rota ${singular}`, `rotas ${pluralForma}`)
        : plural(n, singular, pluralForma),
    );
  }
  if (partes.length === 0) partes.push(plural(rotas.length, 'rota', 'rotas'));

  // Rota cancelada ou não executada não vai mais ser feita: suas paradas
  // saem do total e do feito (senão o dia parece atrasado para sempre).
  const rotasDoDia = rotas.filter(
    (r) => r.status !== 'cancelada' && r.status !== 'nao_executada',
  );
  const total = rotasDoDia.reduce((soma, r) => soma + r.total_paradas, 0);
  const feitas = rotasDoDia.reduce((soma, r) => soma + r.paradas_concluidas, 0);
  const km = rotas.reduce((soma, r) => soma + r.distancia_total, 0);

  return `${partes.join(', ')} — ${feitas} de ${plural(
    total,
    'parada feita',
    'paradas feitas',
  )}, ${formatarDecimal(km)} km`;
}

export function ResumoDoDia({
  rotas,
  textoSemRotas = 'Nenhuma rota no período',
  incidentesAbertos,
  onAbrirIncidentes,
}: ResumoDoDiaProps) {
  const textoIncidentes =
    incidentesAbertos && incidentesAbertos > 0
      ? plural(incidentesAbertos, 'incidente aberto', 'incidentes abertos')
      : null;

  return (
    <View style={styles.container} testID="gestor-dashboard-stats">
      <Text style={styles.frase} testID="gestor-dashboard-resumo">
        {fraseDoResumo(rotas, textoSemRotas)}
      </Text>
      {textoIncidentes ? (
        <Pressable
          onPress={onAbrirIncidentes}
          accessibilityRole="link"
          accessibilityLabel={textoIncidentes}
          accessibilityHint="Abre os incidentes"
          style={styles.incidentes}
        >
          <Text style={styles.incidentesTexto}>{textoIncidentes}</Text>
        </Pressable>
      ) : null}
      {incidentesAbertos === null ? (
        <Text style={styles.indisponivel}>Incidentes indisponíveis</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: theme.spacing.lg,
    rowGap: theme.spacing.xs,
    marginBottom: theme.spacing.xl,
  },
  frase: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray900,
    flexShrink: 1,
  },
  incidentes: {
    borderRadius: theme.borderRadius.sm,
  },
  incidentesTexto: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    // `warningText` (5,1:1 sobre o fundo claro): o laranja de atenção legível.
    color: theme.colors.warningText,
    textDecorationLine: 'underline',
  },
  indisponivel: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray600,
  },
}));
