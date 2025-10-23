/**
 * ============================================
 * TESTE: Validação de Fontes Customizadas
 * ============================================
 *
 * Use este componente para validar que as fontes
 * Viga e Nunito Sans estão carregando corretamente.
 */

import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, typography, spacing } from '@/lib/design-tokens';

export default function FontTest() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Teste de Fontes - RotaMestre</Text>

        {/* Viga */}
        <View style={styles.fontGroup}>
          <Text style={styles.groupLabel}>Viga (Display Font)</Text>
          <Text style={styles.viga}>Dashboard do Gestor</Text>
          <Text style={[styles.viga, { fontSize: 24 }]}>Rotas de Entrega</Text>
          <Text style={[styles.viga, { fontSize: 20 }]}>Gerenciar Motoristas</Text>
        </View>

        {/* Nunito Sans - Regular */}
        <View style={styles.fontGroup}>
          <Text style={styles.groupLabel}>Nunito Sans - Regular (400)</Text>
          <Text style={styles.nunitoRegular}>
            Este é um texto de exemplo usando Nunito Sans Regular. A fonte deve
            ser arredondada e profissional.
          </Text>
        </View>

        {/* Nunito Sans - Medium */}
        <View style={styles.fontGroup}>
          <Text style={styles.groupLabel}>Nunito Sans - Medium (500)</Text>
          <Text style={styles.nunitoMedium}>
            Este é um texto de exemplo usando Nunito Sans Medium. Levemente mais
            pesado que Regular.
          </Text>
        </View>

        {/* Nunito Sans - SemiBold */}
        <View style={styles.fontGroup}>
          <Text style={styles.groupLabel}>Nunito Sans - SemiBold (600)</Text>
          <Text style={styles.nunitoSemibold}>
            Este é um texto de exemplo usando Nunito Sans SemiBold. Usado em
            botões e labels importantes.
          </Text>
        </View>

        {/* Nunito Sans - Bold */}
        <View style={styles.fontGroup}>
          <Text style={styles.groupLabel}>Nunito Sans - Bold (700)</Text>
          <Text style={styles.nunitoBold}>
            Este é um texto de exemplo usando Nunito Sans Bold. Usado em títulos
            H2 e H3.
          </Text>
        </View>

        {/* Design Tokens Styles */}
        <View style={styles.fontGroup}>
          <Text style={styles.groupLabel}>Design Tokens - Estilos Pré-Definidos</Text>

          <Text style={typography.styles.h1}>H1 - Título Principal (Viga 28px)</Text>
          <Text style={typography.styles.h2}>H2 - Subtítulo (Nunito Bold 20px)</Text>
          <Text style={typography.styles.h3}>H3 - Título de Card (Nunito SemiBold 16px)</Text>
          <Text style={typography.styles.body}>
            Body - Corpo de texto (Nunito Regular 14px)
          </Text>
          <Text style={typography.styles.caption}>
            Caption - Textos pequenos (Nunito Regular 12px)
          </Text>
          <Text style={typography.styles.button}>Button - Texto de Botão (Nunito SemiBold 16px)</Text>
        </View>

        {/* Comparação */}
        <View style={styles.fontGroup}>
          <Text style={styles.groupLabel}>Comparação: Sistema vs Customizada</Text>

          <Text style={styles.systemFont}>Fonte do Sistema (Default)</Text>
          <Text style={styles.nunitoRegular}>Nunito Sans (Customizada)</Text>

          <Text style={[styles.systemFont, { fontWeight: 'bold' }]}>
            Sistema Bold
          </Text>
          <Text style={styles.nunitoBold}>Nunito Sans Bold</Text>
        </View>

        {/* Validação */}
        <View style={styles.validationBox}>
          <Text style={styles.validationTitle}>✅ Validação</Text>
          <Text style={styles.validationText}>
            Se as fontes estão carregando corretamente:
          </Text>
          <Text style={styles.validationText}>
            1. "Dashboard do Gestor" deve estar em <Text style={{ fontWeight: 'bold' }}>Viga</Text> (geométrica, bold)
          </Text>
          <Text style={styles.validationText}>
            2. Textos corpo devem estar em <Text style={{ fontWeight: 'bold' }}>Nunito Sans</Text> (arredondada)
          </Text>
          <Text style={styles.validationText}>
            3. Deve haver diferença visual clara entre sistema e customizada
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  section: {
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.styles.h1,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  fontGroup: {
    backgroundColor: colors.background.primary,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },

  // Fontes Viga
  viga: {
    fontFamily: 'Viga',
    fontSize: 28,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },

  // Nunito Sans - Variantes
  nunitoRegular: {
    fontFamily: 'Nunito Sans',
    fontWeight: '400',
    fontSize: 16,
    color: colors.text.primary,
    lineHeight: 24,
  },
  nunitoMedium: {
    fontFamily: 'Nunito Sans',
    fontWeight: '500',
    fontSize: 16,
    color: colors.text.primary,
    lineHeight: 24,
  },
  nunitoSemibold: {
    fontFamily: 'Nunito Sans',
    fontWeight: '600',
    fontSize: 16,
    color: colors.text.primary,
    lineHeight: 24,
  },
  nunitoBold: {
    fontFamily: 'Nunito Sans',
    fontWeight: '700',
    fontSize: 16,
    color: colors.text.primary,
    lineHeight: 24,
  },

  // Fonte do Sistema (para comparação)
  systemFont: {
    fontSize: 16,
    color: colors.text.primary,
    lineHeight: 24,
    marginBottom: spacing.sm,
  },

  // Validation Box
  validationBox: {
    backgroundColor: '#D1FAE5', // Verde claro
    padding: spacing.md,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
    marginTop: spacing.lg,
  },
  validationTitle: {
    fontFamily: 'Nunito Sans',
    fontWeight: '700',
    fontSize: 18,
    color: '#065F46', // Verde escuro
    marginBottom: spacing.sm,
  },
  validationText: {
    fontFamily: 'Nunito Sans',
    fontSize: 14,
    color: '#065F46',
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
});

/**
 * ============================================
 * COMO USAR
 * ============================================
 *
 * 1. Adicione em alguma tela de teste:
 *
 * import FontTest from '@/components/examples/FontTest';
 *
 * export default function TestScreen() {
 *   return <FontTest />;
 * }
 *
 * 2. Ou adicione uma rota temporária:
 *
 * // app/test-fonts.tsx
 * import FontTest from '@/components/examples/FontTest';
 * export default FontTest;
 *
 * 3. Acesse no app e valide visualmente
 */
