import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';

import { Text } from '@/design-system';
import { isRecruitmentEnabled } from '@/lib/testerLinks';
import { StyleSheet, type Theme } from '@/utils/styles';

/**
 * Link discreto na tela de login que leva ao hub /testar.
 * Só renderiza quando o recrutamento está ativo (env de opt-in presente).
 * O gate de plataforma (web only) é aplicado por quem monta este componente.
 */
export function TesterLoginLink() {
  const router = useRouter();

  if (!isRecruitmentEnabled()) return null;

  return (
    <TouchableOpacity
      style={styles.link}
      onPress={() => router.push('/testar')}
      accessibilityRole="link"
      accessibilityLabel="Seja um testador do app"
    >
      <Text style={styles.linkText}>📱 Seja um testador do app</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  link: {
    alignSelf: 'center',
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  linkText: {
    fontFamily: theme.typography.fontSansMedium,
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
}));
