/**
 * Painel do período personalizado: "De" e "Até" + Aplicar.
 * - Web: calendário de intervalo (react-native-ui-datepicker).
 * - Nativo: um seletor de data para cada ponta.
 * O rascunho vive aqui; só `Aplicar` (habilitado com as duas datas e de <= ate)
 * devolve o período.
 */
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateRangePicker, { useDefaultStyles } from 'react-native-ui-datepicker';

import { parseLocalDate, toLocalISODate } from '@/lib/dateUtils';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export interface PainelPersonalizadoProps {
  de: string | null;
  ate: string | null;
  aoAplicar: (de: string, ate: string) => void;
  aoCancelar: () => void;
  testID: string;
}

/** AAAA-MM-DD -> DD/MM/AAAA, sem Date (Hermes sem ICU). */
function dataBR(iso: string | null): string {
  if (!iso) return 'Selecionar';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function paraDate(iso: string | null): Date | undefined {
  return parseLocalDate(iso) ?? undefined;
}

export function PainelPersonalizado({
  de: deInicial,
  ate: ateInicial,
  aoAplicar,
  aoCancelar,
  testID,
}: PainelPersonalizadoProps) {
  const { theme } = useUnistyles();
  const [de, setDe] = useState<string | null>(deInicial);
  const [ate, setAte] = useState<string | null>(ateInicial);
  const [escolhendo, setEscolhendo] = useState<'de' | 'ate' | null>(null);
  const defaultStyles = useDefaultStyles('light');

  const valido = de !== null && ate !== null && de <= ate;

  const calendarStyles = {
    ...defaultStyles,
    headerText: { color: theme.colors.gray900, fontWeight: '600' as const },
    monthText: { color: theme.colors.gray900, fontWeight: '700' as const },
    weekDaysText: { color: theme.colors.gray800, fontWeight: '600' as const },
    dayText: { color: theme.colors.gray900, fontWeight: '500' as const },
    range_fill: { backgroundColor: theme.colors.primaryBg },
    range_start: { backgroundColor: theme.colors.primary },
    range_end: { backgroundColor: theme.colors.primary },
    selected: { backgroundColor: theme.colors.primary },
  };

  const renderCalendario = () => (
    <DateRangePicker
      mode="range"
      startDate={paraDate(de)}
      endDate={paraDate(ate)}
      onChange={(p: { startDate?: unknown; endDate?: unknown }) => {
        setDe(p.startDate instanceof Date ? toLocalISODate(p.startDate) : null);
        setAte(p.endDate instanceof Date ? toLocalISODate(p.endDate) : null);
      }}
      styles={calendarStyles}
      locale="pt-BR"
    />
  );

  const renderPonta = (qual: 'de' | 'ate', rotulo: string) => (
    <Pressable
      testID={`${testID}-${qual}`}
      accessibilityRole="button"
      accessibilityLabel={`${rotulo}: ${dataBR(qual === 'de' ? de : ate)}`}
      style={styles.ponta}
      onPress={() => setEscolhendo(qual)}
    >
      <Text style={styles.pontaRotulo}>{rotulo}</Text>
      <View style={styles.pontaValor}>
        <Ionicons
          name="calendar-outline"
          size={18}
          color={theme.colors.gray500}
        />
        <Text style={styles.pontaTexto}>
          {dataBR(qual === 'de' ? de : ate)}
        </Text>
      </View>
    </Pressable>
  );

  const renderSeletoresNativos = () => (
    <>
      <View style={styles.pontas}>
        {renderPonta('de', 'De')}
        {renderPonta('ate', 'Até')}
      </View>
      {escolhendo !== null && (
        <DateTimePicker
          value={paraDate(escolhendo === 'de' ? de : ate) ?? new Date()}
          mode="date"
          display="default"
          onChange={(_e, escolhida) => {
            const qual = escolhendo;
            setEscolhendo(null);
            if (!escolhida) return;
            if (qual === 'de') setDe(toLocalISODate(escolhida));
            else setAte(toLocalISODate(escolhida));
          }}
        />
      )}
      {de !== null && ate !== null && de > ate && (
        <Text style={styles.erro}>A data inicial é depois da final.</Text>
      )}
    </>
  );

  return (
    <View style={styles.painel}>
      <Text style={styles.titulo}>Selecionar período</Text>
      {Platform.OS === 'web' ? renderCalendario() : renderSeletoresNativos()}
      <View style={styles.rodape}>
        <Pressable
          testID={`${testID}-cancelar`}
          accessibilityRole="button"
          style={[styles.botao, styles.cancelar]}
          onPress={aoCancelar}
        >
          <Text style={styles.cancelarTexto}>Cancelar</Text>
        </Pressable>
        <Pressable
          testID={`${testID}-aplicar`}
          accessibilityRole="button"
          accessibilityState={{ disabled: !valido }}
          disabled={!valido}
          style={[styles.botao, styles.aplicar, !valido && styles.desabilitado]}
          onPress={() => {
            if (de !== null && ate !== null && de <= ate) aoAplicar(de, ate);
          }}
        >
          <Text style={styles.aplicarTexto}>Aplicar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  painel: { gap: theme.spacing.md },
  titulo: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  pontas: { flexDirection: 'row', gap: theme.spacing.md },
  ponta: {
    flex: 1,
    minHeight: 44,
    gap: theme.spacing.xs,
  },
  pontaRotulo: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray600,
  },
  pontaValor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.white,
  },
  pontaTexto: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray700,
  },
  erro: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.error,
  },
  rodape: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  botao: {
    minHeight: 44,
    minWidth: 100,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelar: { backgroundColor: theme.colors.gray100 },
  aplicar: { backgroundColor: theme.colors.primary },
  desabilitado: { opacity: 0.4 },
  cancelarTexto: {
    color: theme.colors.gray600,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
  },
  aplicarTexto: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
  },
}));
