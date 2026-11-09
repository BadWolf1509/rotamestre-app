import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  avisoContatoIndisponivel,
  SUPORTE_EMAIL_GESTOR,
  SUPORTE_MENSAGEM_GESTOR,
  SUPORTE_TELEFONE,
  SUPORTE_TELEFONE_LOCAL,
} from '@/constants/suporte';
import { useAlert } from '@/hooks/useAlert';
import { logger } from '@/lib/logger';
import { StyleSheet, type Theme, useUnistyles } from '@/utils/styles';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    id: '1',
    question: 'Como criar rotas otimizadas?',
    answer:
      'Abra "Nova Rota" no menu e adicione os endereços pelo autocomplete. Toque em "Otimizar melhor percurso" para o sistema propor a menor rota, ou arraste as paradas se preferir a sua ordem. Antes de criar, "Revisar e Criar Rota" mostra base, motorista, data, distância (quando calculada), alertas e a sequência das paradas.',
  },
  {
    id: '2',
    question: 'Como atribuir uma rota a um motorista?',
    answer:
      'Em "Nova Rota", escolha o motorista em "Selecionar Motorista". Para mudar o motorista de uma rota que ainda não começou, abra a rota em "Gestão de Rotas" > "Ver detalhes" e toque em "Trocar" (no celular, "Trocar motorista"). O novo motorista recebe uma notificação automática.',
  },
  {
    id: '3',
    question: 'Como gerenciar motoristas?',
    answer:
      'Abra "Motoristas" no menu para ver a equipe. Use "Adicionar motorista" (no celular, "+ Novo Motorista") para cadastrar, "Editar" para mudar nome e telefone, e o menu "⋯" para ativar ou desativar o motorista na sua loja. Em "Ver perfil" aparecem as rotas recentes dele.',
  },
  {
    id: '4',
    question: 'Como analisar relatórios e métricas?',
    answer:
      'A tela "Início" mostra o resumo do dia, atualizado em tempo real: rotas por situação e paradas feitas. No celular, ela mostra também taxa de sucesso, tempo médio e as rotas da semana e do mês. Em "Gestão de Rotas" fica o histórico, que você pode exportar em CSV ou Excel (XLSX).',
  },
  {
    id: '5',
    question: 'Como resolver incidentes?',
    answer:
      'Quando um motorista reporta um incidente, você recebe uma notificação. Abra "Incidentes" e toque em "Ver detalhes" para ver motorista, endereço, rota, descrição e foto. Use "Alterar status" para marcar como Em análise, Resolvido ou Fechado e deixar uma observação.',
  },
  {
    id: '6',
    question: 'Como acompanhar uma rota em tempo real?',
    answer:
      'Em "Gestão de Rotas", toque na rota ou em "Ver detalhes" para abrir o mapa. Com a rota em andamento, o mapa mostra a posição do motorista, enquanto o celular dele estiver enviando a localização. Você também vê quantas paradas estão concluídas, pendentes e puladas.',
  },
  {
    id: '7',
    question: 'Como editar uma rota em andamento?',
    answer:
      'No mapa da rota, use "+ Parada" para adicionar e "Reordenar" para mudar a sequência (no celular, "Adicionar parada" e "Reordenar"). Em cada parada pendente há "Editar" e "Remover". Paradas já iniciadas, concluídas ou puladas não mudam. O motorista recebe uma notificação a cada alteração.',
  },
  {
    id: '8',
    question: 'Como ver fotos de comprovante de entrega?',
    answer:
      'Em "Gestão de Rotas", toque em "Ver detalhes". Na parada concluída aparece a miniatura da foto; toque em "Ver foto" para ampliar. Sem comprovante, aparece "Sem foto registrada". O horário de conclusão fica na "Timeline" da rota.',
  },
  {
    id: '9',
    question: 'O que fazer se um motorista não conseguir entregar?',
    answer:
      'Quando o motorista pula uma parada, você recebe uma notificação com o endereço. O motivo que ele informou aparece na parada, no mapa da rota. Para tentar de novo, adicione a parada à rota com "+ Parada" ou crie uma "Nova Rota". Se a rota inteira ficou "Não executada", use "Reativar".',
  },
  {
    id: '10',
    question: 'Como exportar dados para Excel?',
    answer:
      'Em "Gestão de Rotas", filtre por status ou pela busca e toque em "Exportar". Escolha "Exportar CSV" ou "Exportar Excel (XLSX)" (no celular, "CSV" ou "Excel (XLSX)"). No computador o arquivo é baixado; no celular, abre o compartilhamento.',
  },
];

const SUPPORT_OPTIONS = [
  {
    id: 'whatsapp',
    icon: '💬',
    label: 'WhatsApp Empresarial',
    description: 'Suporte prioritário',
    action: 'whatsapp',
  },
  {
    id: 'email',
    icon: '📧',
    label: 'Email',
    description: SUPORTE_EMAIL_GESTOR,
    action: 'email',
  },
  {
    id: 'phone',
    icon: '📞',
    label: 'Telefone',
    description: 'Horário comercial (8h-18h)',
    action: 'phone',
  },
];

export default function AjudaGestorScreen() {
  const { theme: _theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { showWarning, AlertDialog } = useAlert();
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  function toggleFAQ(id: string) {
    setExpandedFAQ((prev) => (prev === id ? null : id));
  }

  // `openURL` direto, sem `canOpenURL`: no Android 11+ ele responde false para
  // `whatsapp:`/`tel:`/`mailto:` sem <queries> no manifest, mesmo com o app
  // instalado. Se abrir falhar, avisa (mesma regra do SupportModal).
  async function abrirContato(url: string, canal: string) {
    try {
      await Linking.openURL(url);
    } catch (error) {
      logger.warn('[Ajuda] Falha ao abrir o contato:', error);
      showWarning('Contato indisponível', avisoContatoIndisponivel(canal));
    }
  }

  async function handleSupportAction(action: string) {
    switch (action) {
      case 'whatsapp':
        await abrirContato(
          `https://wa.me/${SUPORTE_TELEFONE}?text=${encodeURIComponent(SUPORTE_MENSAGEM_GESTOR)}`,
          'o WhatsApp',
        );
        break;

      case 'email':
        await abrirContato(
          `mailto:${SUPORTE_EMAIL_GESTOR}?subject=${encodeURIComponent('Suporte Gestor - RotaMestre')}&body=${encodeURIComponent('Olá,\n\nSou gestor e preciso de ajuda com:\n\n')}`,
          'o aplicativo de e-mail',
        );
        break;

      case 'phone':
        await abrirContato(`tel:${SUPORTE_TELEFONE_LOCAL}`, 'o discador');
        break;
    }
  }

  return (
    <ErrorBoundary>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingBottom: Math.max(20, insets.bottom + 20),
        }}
      >
        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Perguntas Frequentes - Gestor</Text>
          <View style={styles.faqList}>
            {FAQ_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.faqItem}
                onPress={() => toggleFAQ(item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.faqHeader}>
                  <Text style={styles.faqQuestion}>{item.question}</Text>
                  <Text style={styles.faqChevron}>
                    {expandedFAQ === item.id ? '▼' : '▶'}
                  </Text>
                </View>
                {expandedFAQ === item.id && (
                  <Text style={styles.faqAnswer}>{item.answer}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Support Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suporte ao Gestor</Text>
          <Text style={styles.sectionSubtitle}>
            Atendimento prioritário para gestores:
          </Text>
          <View style={styles.supportList}>
            {SUPPORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={styles.supportItem}
                onPress={() => handleSupportAction(option.action)}
              >
                <Text style={styles.supportIcon}>{option.icon}</Text>
                <View style={styles.supportInfo}>
                  <Text style={styles.supportLabel}>{option.label}</Text>
                  <Text style={styles.supportDescription}>
                    {option.description}
                  </Text>
                </View>
                <Text style={styles.supportArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Links Úteis</Text>
          <View style={styles.linksList}>
            {/* "Central de Ajuda" e "Tutoriais em Vídeo" saíram em 08/11/2026:
                as duas páginas davam 404. Voltam quando existirem. */}
            <TouchableOpacity
              style={styles.linkItem}
              onPress={() =>
                Linking.openURL('https://rotamestre.tec.br/termos-de-uso')
              }
            >
              <Text style={styles.linkIcon}>📄</Text>
              <Text style={styles.linkLabel}>Termos de Uso</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkItem}
              onPress={() =>
                Linking.openURL(
                  'https://rotamestre.tec.br/politica-de-privacidade',
                )
              }
            >
              <Text style={styles.linkIcon}>🔐</Text>
              <Text style={styles.linkLabel}>Política de Privacidade</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkItem}
              onPress={() =>
                Linking.openURL('https://rotamestre.tec.br/exclusao-de-conta')
              }
            >
              <Text style={styles.linkIcon}>🗑️</Text>
              <Text style={styles.linkLabel}>Exclusão de Conta</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfoSection}>
          <Text style={styles.appName}>RotaMestre</Text>
          <Text style={styles.appCopyright}>
            © {new Date().getFullYear()} RotaMestre. Todos os direitos
            reservados.
          </Text>
        </View>

        <View style={styles.footer} />
        {AlertDialog}
      </ScrollView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  section: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  sectionSubtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.md,
  },
  faqList: {
    gap: theme.spacing.sm,
  },
  faqItem: {
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    flex: 1,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray800,
    paddingRight: theme.spacing.sm,
  },
  faqChevron: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray400,
  },
  faqAnswer: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.sm,
    color: theme.colors.gray600,
    lineHeight: theme.typography.xl,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
  },
  supportList: {
    gap: theme.spacing.sm,
  },
  supportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  supportIcon: {
    fontSize: theme.typography['2xl'],
    marginRight: theme.spacing.md,
  },
  supportInfo: {
    flex: 1,
  },
  supportLabel: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  supportDescription: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginTop: theme.spacing.xs,
  },
  supportArrow: {
    fontSize: theme.typography.lg,
    color: theme.colors.gray400,
  },
  linksList: {
    gap: theme.spacing.sm,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.md,
  },
  linkIcon: {
    fontSize: theme.typography.xl,
    marginRight: theme.spacing.md,
  },
  linkLabel: {
    fontSize: theme.typography.base,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansMedium,
  },
  appInfoSection: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
  },
  appName: {
    fontSize: theme.typography.xl,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  appCopyright: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray400,
    textAlign: 'center',
  },
  footer: {
    height: theme.spacing['3xl'],
  },
}));
