/**
 * LinhaDeParadas — um ponto por parada real da rota, na ordem dela.
 *
 * O desenho de cada estado segue a tabela da spec da revisão de design do
 * desktop do gestor (docs/superpowers/specs/2026-11-07-design-desktop-gestor-design.md):
 * - concluída: ponto cheio em `success`;
 * - em andamento: ponto com anel em `info`;
 * - pendente: ponto vazado, só a borda em `gray400` (é desenho, não texto);
 * - pulada: ponto cheio em `warning` — é a atenção.
 *
 * Acima de `maximo`, mostra os primeiros pontos e "+N". A linha não quebra e
 * não estoura a largura: o contêiner corta o que não couber.
 */

import React from 'react';
import { Text, View } from 'react-native';

import { STOP_STATUS_CONFIG } from '@/constants/statusConfig';
import { plural } from '@/lib/plural';
import type { StatusParada } from '@/types/rota';
import { StyleSheet, type Theme } from '@/utils/styles';

interface LinhaDeParadasProps {
  /** Estados das paradas reais, já na ordem da rota. */
  paradas: StatusParada[];
  /** Quantos pontos desenhar antes do "+N" (padrão 24). */
  maximo?: number;
  testID?: string;
}

const MAXIMO_PADRAO = 24;

/** "Parada 3, em andamento": o rótulo da config, em minúsculas. */
function rotuloDoPonto(indice: number, status: StatusParada): string {
  const estado = (STOP_STATUS_CONFIG[status]?.label ?? status).toLowerCase();
  return `Parada ${indice + 1}, ${estado}`;
}

function estiloDoPonto(status: StatusParada) {
  switch (status) {
    case 'concluida':
      return styles.pontoConcluida;
    case 'em_andamento':
      return styles.pontoEmAndamento;
    case 'pulada':
      return styles.pontoPulada;
    case 'pendente':
    default:
      return styles.pontoPendente;
  }
}

export function LinhaDeParadas({
  paradas,
  maximo = MAXIMO_PADRAO,
  testID,
}: LinhaDeParadasProps) {
  if (paradas.length === 0) {
    return (
      <View testID={testID} style={styles.linha}>
        <Text style={styles.semParadas}>Sem paradas</Text>
      </View>
    );
  }

  const visiveis = paradas.slice(0, maximo);
  const restantes = paradas.length - visiveis.length;

  return (
    <View testID={testID} style={styles.linha}>
      <View style={styles.pontos}>
        {visiveis.map((status, indice) => (
          <View
            key={indice}
            accessible
            accessibilityRole="image"
            accessibilityLabel={rotuloDoPonto(indice, status)}
            style={[styles.ponto, estiloDoPonto(status)]}
          >
            {status === 'em_andamento' ? <View style={styles.miolo} /> : null}
          </View>
        ))}
      </View>
      {restantes > 0 ? (
        <Text
          style={styles.mais}
          accessibilityLabel={`Mais ${plural(restantes, 'parada', 'paradas')}`}
        >
          {`+${restantes}`}
        </Text>
      ) : null}
    </View>
  );
}

const TAMANHO_PONTO = 10;

const styles = StyleSheet.create((theme: Theme) => ({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minWidth: 0,
    flexShrink: 1,
    overflow: 'hidden',
  },
  pontos: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: theme.spacing.xs,
    flexShrink: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  ponto: {
    width: TAMANHO_PONTO,
    height: TAMANHO_PONTO,
    borderRadius: TAMANHO_PONTO / 2,
    borderWidth: 2,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pontoConcluida: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  pontoEmAndamento: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.info,
  },
  pontoPendente: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.gray400,
  },
  pontoPulada: {
    backgroundColor: theme.colors.warning,
    borderColor: theme.colors.warning,
  },
  miolo: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.info,
  },
  mais: {
    fontSize: 13,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray600,
    flexShrink: 0,
  },
  semParadas: {
    fontSize: 13,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray600,
  },
}));
