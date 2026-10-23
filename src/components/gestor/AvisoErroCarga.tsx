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
import { formatTimeBR } from '@/lib/dateUtils';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface AvisoErroCargaProps {
  mensagem: string;
  /** Epoch ms dos dados exibidos; null = não há dados anteriores. */
  dadosDe: number | null;
  onTentarNovamente: () => void;
  testID?: string;
}

export function AvisoErroCarga({
  mensagem,
  dadosDe,
  onTentarNovamente,
  testID = 'aviso-erro-carga',
}: AvisoErroCargaProps) {
  const { theme } = useUnistyles();
  const selo =
    dadosDe != null
      ? ` Mostrando dados de ${formatTimeBR(new Date(dadosDe).toISOString())}.`
      : '';

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
