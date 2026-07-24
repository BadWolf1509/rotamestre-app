import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type {
  BulkImportResult,
  BulkParadaInput,
} from '@/hooks/nova-entrega/useParadasManagement';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface BulkStopImporterProps {
  onImport: (items: BulkParadaInput[]) => Promise<BulkImportResult>;
  disabled?: boolean;
}

function splitSemicolonLine(line: string): {
  values: string[];
  hasUnclosedQuote: boolean;
} {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ';' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  values.push(current.trim());
  return { values, hasUnclosedQuote: quoted };
}

export function parseBulkStops(text: string): {
  items: BulkParadaInput[];
  errors: string[];
} {
  const errors: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((line, index) => ({
      value: line.trim(),
      lineNumber: index + 1,
    }))
    .filter((line) => line.value.length > 0);

  if (lines[0]?.value.toLowerCase().startsWith('tipo;')) lines.shift();

  const items = lines.flatMap(({ value, lineNumber }) => {
    const parsedLine = splitSemicolonLine(value);
    if (
      parsedLine.hasUnclosedQuote ||
      parsedLine.values.length < 4 ||
      parsedLine.values.length > 5
    ) {
      errors.push(
        `Linha ${lineNumber}: use 4 ou 5 colunas separadas por ponto e vírgula.`,
      );
      return [];
    }

    const [type, address, recipient, phone, observations = ''] =
      parsedLine.values;
    const normalizedType = type?.trim().toLowerCase();
    const digits = (phone || '').replace(/\D/g, '');

    if (normalizedType !== 'entrega' && normalizedType !== 'retirada') {
      errors.push(`Linha ${lineNumber}: tipo deve ser entrega ou retirada.`);
      return [];
    }
    if (!address || address.length < 5) {
      errors.push(`Linha ${lineNumber}: endereço inválido.`);
      return [];
    }
    if (!recipient || recipient.length < 3) {
      errors.push(`Linha ${lineNumber}: destinatário inválido.`);
      return [];
    }
    if (digits.length !== 10 && digits.length !== 11) {
      errors.push(`Linha ${lineNumber}: telefone inválido.`);
      return [];
    }

    return [
      {
        tipo: normalizedType as 'entrega' | 'retirada',
        endereco: address,
        destinatario: recipient,
        telefone: phone,
        observacoes: observations,
      },
    ];
  });

  return { items, errors };
}

export function BulkStopImporter({
  onImport,
  disabled = false,
}: BulkStopImporterProps) {
  const { theme } = useUnistyles();
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [resultErrors, setResultErrors] = useState<string[]>([]);
  const parsed = useMemo(() => parseBulkStops(text), [text]);

  const handleImport = async () => {
    if (parsed.items.length === 0 || parsed.errors.length > 0) return;
    setIsImporting(true);
    try {
      const result = await onImport(parsed.items);
      setResultErrors(result.erros);
      if (result.adicionadas > 0) {
        setText('');
        if (result.erros.length === 0) setVisible(false);
      }
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.openButton}
        onPress={() => setVisible(true)}
        disabled={disabled}
        accessibilityRole="button"
      >
        <Ionicons
          name="document-text-outline"
          size={18}
          color={theme.colors.primary}
        />
        <Text style={styles.openButtonText}>Importar em lote</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <Pressable
            style={styles.modal}
            onPress={(event) => event.stopPropagation()}
            accessibilityViewIsModal
          >
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Importar paradas em lote</Text>
                <Text style={styles.subtitle}>
                  Cole uma linha por parada, separada por ponto e vírgula
                </Text>
              </View>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.gray600} />
              </TouchableOpacity>
            </View>
            <Text style={styles.format}>
              tipo;endereço;destinatário;telefone;observações
            </Text>
            <TextInput
              style={styles.textArea}
              value={text}
              onChangeText={(value) => {
                setText(value);
                setResultErrors([]);
              }}
              multiline
              numberOfLines={10}
              placeholder={
                'entrega;Rua Exemplo, 100;Maria;(83) 99999-0000;Portaria'
              }
              textAlignVertical="top"
              accessibilityLabel="Linhas de paradas para importação"
            />
            <ScrollView style={styles.errorList}>
              {[...parsed.errors, ...resultErrors].map((error) => (
                <Text key={error} style={styles.errorText}>
                  • {error}
                </Text>
              ))}
            </ScrollView>
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setVisible(false)}
                disabled={isImporting}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.importButton,
                  (parsed.items.length === 0 || parsed.errors.length > 0) &&
                    styles.importButtonDisabled,
                ]}
                onPress={handleImport}
                disabled={
                  isImporting ||
                  parsed.items.length === 0 ||
                  parsed.errors.length > 0
                }
              >
                {isImporting ? (
                  <ActivityIndicator color={theme.colors.white} />
                ) : (
                  <Text style={styles.importText}>
                    Importar {parsed.items.length || ''} parada(s)
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
  },
  openButtonText: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.sm,
  },
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '90%',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  format: {
    color: theme.colors.primaryDark,
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.sm,
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primaryBg,
    borderRadius: theme.borderRadius.md,
  },
  textArea: {
    minHeight: 220,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    color: theme.colors.gray900,
    marginTop: theme.spacing.md,
  },
  errorList: {
    maxHeight: 100,
    marginTop: theme.spacing.sm,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.xs,
    marginBottom: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  cancelButton: {
    minHeight: 44,
    paddingHorizontal: theme.spacing.lg,
    justifyContent: 'center',
  },
  cancelText: {
    color: theme.colors.gray600,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  importButton: {
    minHeight: 44,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.primary,
  },
  importButtonDisabled: {
    backgroundColor: theme.colors.gray400,
    opacity: 0.6,
  },
  importText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansBold,
  },
}));
