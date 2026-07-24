import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Linking,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/design-system';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import type { ReactNode } from 'react';

interface LegalPageProps {
  title: string;
  updatedAt: string;
  children: ReactNode;
}

export function LegalPage({ title, updatedAt, children }: LegalPageProps) {
  const { theme } = useUnistyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles(theme).screen}
      contentContainerStyle={[
        styles(theme).content,
        { paddingBottom: Math.max(32, insets.bottom + 24) },
      ]}
    >
      <View style={styles(theme).topbar}>
        <TouchableOpacity
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/auth/login')
          }
          style={styles(theme).backButton}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={22} color={theme.colors.primary} />
          <Text style={styles(theme).backText}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles(theme).brand}>Rota Mestre</Text>
      </View>

      <View style={styles(theme).document}>
        <Text style={styles(theme).title}>{title}</Text>
        <Text style={styles(theme).updated}>
          Última atualização: {updatedAt}
        </Text>
        {children}
        <View style={styles(theme).contact}>
          <Text style={styles(theme).sectionTitle}>Contato</Text>
          <Text style={styles(theme).paragraph}>
            Dúvidas sobre privacidade e dados pessoais podem ser enviadas para:
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openURL('mailto:contato@rotamestre.tec.br')}
            accessibilityRole="link"
          >
            <Text style={styles(theme).link}>contato@rotamestre.tec.br</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { theme } = useUnistyles();
  return (
    <View style={styles(theme).section}>
      <Text style={styles(theme).sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function LegalParagraph({ children }: { children: ReactNode }) {
  const { theme } = useUnistyles();
  return <Text style={styles(theme).paragraph}>{children}</Text>;
}

export function LegalBullet({ children }: { children: ReactNode }) {
  const { theme } = useUnistyles();
  return (
    <View style={styles(theme).bulletRow}>
      <Text style={styles(theme).bullet}>•</Text>
      <Text style={styles(theme).bulletText}>{children}</Text>
    </View>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.gray50,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: Platform.OS === 'web' ? theme.spacing.xl : 0,
    },
    topbar: {
      width: '100%',
      maxWidth: 920,
      alignSelf: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
    },
    backText: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontSansSemiBold,
    },
    brand: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontDisplay,
      fontSize: theme.typography.lg,
    },
    document: {
      width: '100%',
      maxWidth: 920,
      alignSelf: 'center',
      backgroundColor: theme.colors.white,
      padding: theme.spacing.xl,
      borderRadius: Platform.OS === 'web' ? theme.borderRadius.xl : 0,
      borderWidth: Platform.OS === 'web' ? 1 : 0,
      borderColor: theme.colors.gray200,
    },
    title: {
      color: theme.colors.gray900,
      fontFamily: theme.typography.fontDisplay,
      fontSize: theme.typography['3xl'],
    },
    updated: {
      color: theme.colors.gray500,
      fontSize: theme.typography.sm,
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.xl,
    },
    section: {
      marginBottom: theme.spacing.xl,
    },
    sectionTitle: {
      color: theme.colors.gray900,
      fontFamily: theme.typography.fontSansBold,
      fontSize: theme.typography.lg,
      marginBottom: theme.spacing.sm,
    },
    paragraph: {
      color: theme.colors.gray700,
      fontFamily: theme.typography.fontSans,
      fontSize: theme.typography.base,
      lineHeight: 25,
      marginBottom: theme.spacing.sm,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },
    bullet: {
      color: theme.colors.primary,
      fontSize: theme.typography.base,
      lineHeight: 25,
    },
    bulletText: {
      flex: 1,
      color: theme.colors.gray700,
      fontFamily: theme.typography.fontSans,
      fontSize: theme.typography.base,
      lineHeight: 25,
    },
    contact: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.gray200,
      paddingTop: theme.spacing.xl,
    },
    link: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontSansSemiBold,
      fontSize: theme.typography.base,
    },
  });
