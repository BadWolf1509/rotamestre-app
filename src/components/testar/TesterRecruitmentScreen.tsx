import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/design-system';
import { logger } from '@/lib/logger';
import { getTesterLinks, isRecruitmentEnabled } from '@/lib/testerLinks';
import { detectWebPlatform } from '@/utils/detectWebPlatform';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';
import { toast } from '@/utils/toast';

interface StepData {
  n: number;
  title: string;
  description: string;
  cta: string;
  url: string;
}

const SHARE_URL =
  typeof window !== 'undefined' && window.location?.origin
    ? `${window.location.origin}/testar`
    : 'https://app.rotamestre.tec.br/testar';

/**
 * Abre um link externo (grupo, opt-in, Play Store) tratando falhas.
 * Sem isso, uma rejeição de `Linking.openURL` (ex.: navegador bloqueou popup,
 * nenhum app pra abrir o link) deixa o toque no CTA sem nenhum feedback —
 * dead-end silencioso no funil de recrutamento.
 */
async function handleOpenLink(url: string): Promise<void> {
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch (err) {
    logger.warn('Não foi possível abrir o link externo', err as Error);
    toast.error('Não foi possível abrir o link. Tente novamente.');
  }
}

export function TesterRecruitmentScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const enabled = isRecruitmentEnabled();
  const platform = detectWebPlatform();
  const links = getTesterLinks();

  const steps: StepData[] = [
    {
      n: 1,
      title: 'Entre no grupo de testadores',
      description:
        'Participe com sua Conta Google. É esse cadastro que libera o app de teste para você.',
      cta: 'Entrar no grupo',
      url: links.groupUrl,
    },
    {
      n: 2,
      title: 'Aceite o teste',
      description:
        "Abra o convite e toque em 'Tornar-se testador'. Use a mesma Conta Google do passo anterior.",
      cta: 'Abrir convite de teste',
      url: links.optInUrl,
    },
    {
      n: 3,
      title: 'Instale o app',
      description:
        'Abra a Play Store e instale o Rota Mestre. Pode levar alguns minutos até o app de teste aparecer.',
      cta: 'Abrir na Play Store',
      url: links.storeUrl,
    },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(32, insets.bottom + 24) },
      ]}
    >
      <View style={styles.topbar}>
        <TouchableOpacity
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/auth/login')
          }
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={22} color={theme.colors.primary} />
          <Text style={styles.backText}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.brand}>Rota Mestre</Text>
      </View>

      <View style={styles.document}>
        {!enabled ? (
          <View>
            <Text style={styles.title}>Programa de testadores</Text>
            <Text style={styles.paragraph}>
              O recrutamento de testadores está indisponível no momento. Tente
              novamente mais tarde.
            </Text>
          </View>
        ) : platform === 'ios' ? (
          <View>
            <Text style={styles.title}>Ainda não disponível para iPhone</Text>
            <Text style={styles.paragraph}>
              O app de teste ainda é só para Android. A versão para iPhone está
              a caminho — por enquanto, você pode usar o Rota Mestre pelo
              navegador.
            </Text>
            <TouchableOpacity
              style={styles.secondaryCta}
              onPress={() => router.replace('/auth/login')}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryCtaText}>Ir para o login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={styles.title}>Seja um testador do app</Text>
            <Text style={styles.paragraph}>
              Ajude a testar o app de motorista do Rota Mestre no Android. São
              três passos rápidos:
            </Text>

            <View style={styles.warning}>
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color={theme.colors.secondary}
              />
              <Text style={styles.warningText}>
                Use a mesma Conta Google (e-mail) nos três passos. Com contas
                diferentes, a Play não reconhece você como testador.
              </Text>
            </View>

            {steps.map((step) => (
              <View key={step.n} style={styles.step}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{step.n}</Text>
                </View>
                <View style={styles.stepBody}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDescription}>{step.description}</Text>
                  <TouchableOpacity
                    style={[
                      styles.stepCta,
                      !step.url && styles.stepCtaDisabled,
                    ]}
                    disabled={!step.url}
                    onPress={() => handleOpenLink(step.url)}
                    accessibilityRole="link"
                    accessibilityLabel={step.cta}
                  >
                    <Text style={styles.stepCtaText}>{step.cta}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {platform === 'desktop' && (
              <View style={styles.desktopHint}>
                <Text style={styles.desktopHintTitle}>Está no computador?</Text>
                <Text style={styles.paragraph}>
                  Abra este endereço no seu celular Android para continuar:
                </Text>
                <Text
                  style={styles.shareUrl}
                  accessibilityRole="text"
                  selectable
                >
                  {SHARE_URL}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.xl,
  },
  topbar: {
    width: '100%',
    maxWidth: 720,
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
    maxWidth: 720,
    alignSelf: 'center',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  title: {
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography['2xl'],
    marginBottom: theme.spacing.sm,
  },
  paragraph: {
    color: theme.colors.gray700,
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.base,
    lineHeight: 25,
    marginBottom: theme.spacing.md,
  },
  warning: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  warningText: {
    flex: 1,
    color: theme.colors.gray700,
    fontFamily: theme.typography.fontSansMedium,
    fontSize: theme.typography.sm,
    lineHeight: 21,
  },
  step: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.base,
  },
  stepBody: {
    flex: 1,
  },
  stepTitle: {
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.lg,
    marginBottom: theme.spacing.xs,
  },
  stepDescription: {
    color: theme.colors.gray700,
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.base,
    lineHeight: 23,
    marginBottom: theme.spacing.sm,
  },
  stepCta: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
  },
  stepCtaDisabled: {
    backgroundColor: theme.colors.gray300,
  },
  stepCtaText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.sm,
  },
  secondaryCta: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.sm,
  },
  secondaryCtaText: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.sm,
  },
  desktopHint: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
    paddingTop: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  desktopHintTitle: {
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.base,
    marginBottom: theme.spacing.xs,
  },
  shareUrl: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.lg,
  },
}));
