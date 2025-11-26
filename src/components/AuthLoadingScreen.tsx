import { View, Text, ActivityIndicator } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

/**
 * Tela de loading exibida enquanto verifica autenticação.
 * Usada pelos layouts protegidos durante a verificação de sessão.
 */
export function AuthLoadingScreen() {
  const { theme } = useUnistyles();

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.text}>Verificando autenticação...</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
  },
  text: {
    marginTop: theme.spacing.lg,
    fontSize: theme.typography.base,
    color: theme.colors.gray500,
    fontFamily: theme.typography.fontSansMedium,
  },
}));
