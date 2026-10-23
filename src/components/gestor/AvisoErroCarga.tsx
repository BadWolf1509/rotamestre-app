/**
 * Aviso de falha de carga nas telas do gestor (Dashboard, Gestão de Rotas).
 *
 * Substitui o `Alert.alert` (no-op no react-native-web) e o silêncio do
 * `logger.error`: a tela dizia "Nenhuma rota" ou mostrava dados velhos como
 * se fossem atuais. Com `dadosDe`, a tela está mostrando dados anteriores
 * (cache ou carga anterior) e o selo diz de quando são.
 */
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import {
  formatDateBR,
  formatTimeBR,
  getTodayISO,
  toLocalISODate,
} from '@/lib/dateUtils';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface AvisoErroCargaProps {
  mensagem: string;
  /** Epoch ms dos dados exibidos; null = não há dados anteriores. */
  dadosDe: number | null;
  onTentarNovamente: () => void;
  testID?: string;
}

/** "HH:MM" se for de hoje; "DD/MM/AAAA às HH:MM" se for de outro dia. */
function quando(epochMs: number): string {
  // Timestamp (carrega fuso): pode passar por new Date. O dia sai de
  // toLocalISODate (local), nunca de toISOString().
  const momento = new Date(epochMs);
  const hora = formatTimeBR(momento.toISOString());
  const dia = toLocalISODate(momento);
  return dia === getTodayISO() ? hora : `${formatDateBR(dia)} às ${hora}`;
}

export function AvisoErroCarga({
  mensagem,
  dadosDe,
  onTentarNovamente,
  testID = 'aviso-erro-carga',
}: AvisoErroCargaProps) {
  const { theme } = useUnistyles();
  const selo = dadosDe != null ? ` Mostrando dados de ${quando(dadosDe)}.` : '';

  return (
    <View style={styles.container} testID={testID} accessibilityRole="alert">
      <Ionicons
        name="cloud-offline-outline"
        size={20}
        color={theme.colors.errorDark}
      />
      <Text style={styles.texto}>
        {mensagem}
        {selo}
      </Text>
      <Button
        title="Tentar novamente"
        variant="outline"
        size="small"
        icon="refresh"
        onPress={onTentarNovamente}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.errorLight,
  },
  texto: {
    flex: 1,
    minWidth: 180,
    fontSize: theme.typography.sm,
    color: theme.colors.gray900,
  },
}));
