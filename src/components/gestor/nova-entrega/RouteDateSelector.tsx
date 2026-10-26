import { Ionicons } from '@expo/vector-icons';
import React, { memo, useEffect, useRef, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface RouteDateSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

function toLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/*
 * O gestor digita em dd/mm/aaaa (o formato do resto do app); o rascunho guarda
 * AAAA-MM-DD. A conversão é só de texto: coluna `date` não passa por
 * `new Date()`/`toISOString()` (regra de fuso do CLAUDE.md).
 */
function mascararDataBR(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

/** 'dd/mm/aaaa' de um dia que existe → 'AAAA-MM-DD'; senão null. */
function dataBRParaISO(texto: string): string | null {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!partes) return null;
  const [, dia, mes, ano] = partes;
  const d = Number(dia);
  const m = Number(mes);
  const a = Number(ano);
  // Dias do mês sem Date: fevereiro bissexto pela regra do calendário.
  const bissexto = (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
  const diasNoMes = [
    31,
    bissexto ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (m < 1 || m > 12 || d < 1 || d > diasNoMes[m - 1]) return null;
  return `${ano}-${mes}-${dia}`;
}

/** 'AAAA-MM-DD' → 'dd/mm/aaaa'; outro texto (digitação em curso) passa igual. */
function isoParaDataBR(valor: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : valor;
}

export const RouteDateSelector = memo(function RouteDateSelector({
  value,
  onChange,
}: RouteDateSelectorProps) {
  const { theme } = useUnistyles();
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  // O campo mostra dd/mm/aaaa. Enquanto a data está incompleta, o rascunho
  // recebe o próprio texto (inválido como data, e a validação da rota recusa);
  // completa e existente, recebe AAAA-MM-DD. O valor que vem de fora (atalho,
  // rascunho restaurado) reescreve o campo; o que a digitação emitiu, não.
  const [texto, setTexto] = useState(() => isoParaDataBR(value));
  const ultimoEmitidoRef = useRef(value);
  useEffect(() => {
    if (value === ultimoEmitidoRef.current) return;
    ultimoEmitidoRef.current = value;
    setTexto(isoParaDataBR(value));
  }, [value]);

  const aoDigitar = (digitado: string) => {
    const mascarado = mascararDataBR(digitado);
    setTexto(mascarado);
    const emitido = dataBRParaISO(mascarado) ?? mascarado;
    ultimoEmitidoRef.current = emitido;
    onChange(emitido);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Data da rota *</Text>
      <View style={styles.inputRow}>
        <Ionicons
          name="calendar-outline"
          size={20}
          color={theme.colors.gray500}
        />
        <TextInput
          style={styles.input}
          value={texto}
          onChangeText={aoDigitar}
          placeholder="DD/MM/AAAA"
          maxLength={10}
          keyboardType="number-pad"
          accessibilityLabel="Data da rota no formato dia, mês e ano"
        />
      </View>
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickButton}
          onPress={() => onChange(toLocalDate(today))}
          accessibilityRole="button"
        >
          <Text style={styles.quickButtonText}>Hoje</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickButton}
          onPress={() => onChange(toLocalDate(tomorrow))}
          accessibilityRole="button"
        >
          <Text style={styles.quickButtonText}>Amanhã</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    color: theme.colors.gray700,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.sm,
    marginBottom: theme.spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    minHeight: 46,
  },
  input: {
    flex: 1,
    color: theme.colors.gray900,
    fontSize: theme.typography.base,
    minHeight: 44,
  },
  quickActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  quickButton: {
    backgroundColor: theme.colors.primaryBg,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  quickButtonText: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.sm,
  },
}));
