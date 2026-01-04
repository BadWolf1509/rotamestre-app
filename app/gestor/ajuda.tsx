import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
} from 'react-native';

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
    answer: 'Acesse "Nova Entrega" no menu. Adicione os endereços de entrega usando o autocomplete. O sistema irá automaticamente otimizar a ordem das paradas para reduzir a distância total. Você pode revisar e ajustar a ordem antes de salvar.',
  },
  {
    id: '2',
    question: 'Como atribuir uma rota a um motorista?',
    answer: 'Ao criar uma nova rota, selecione o motorista no campo "Motorista Responsável". Você também pode editar rotas existentes para alterar o motorista atribuído. O motorista receberá uma notificação automática.',
  },
  {
    id: '3',
    question: 'Como gerenciar motoristas?',
    answer: 'Acesse "Motoristas" no menu para ver sua equipe. Você pode adicionar novos motoristas, editar informações, ativar/desativar contas e ver o histórico de rotas de cada um. Para adicionar, use o botão "+" no canto superior.',
  },
  {
    id: '4',
    question: 'Como analisar relatórios e métricas?',
    answer: 'O Dashboard mostra métricas em tempo real: rotas do dia, entregas concluídas, taxa de sucesso e tempo médio. Acesse "Gestão de Rotas" para histórico detalhado e use o botão "Exportar" para baixar relatórios em CSV.',
  },
  {
    id: '5',
    question: 'Como resolver incidentes?',
    answer: 'Quando um motorista reporta um incidente, você recebe uma notificação. Acesse "Incidentes" no menu para ver detalhes, fotos e localização. Você pode adicionar comentários, resolver o incidente ou escalar para suporte.',
  },
  {
    id: '6',
    question: 'Como acompanhar uma rota em tempo real?',
    answer: 'Toque em qualquer rota ativa para ver o mapa com a posição do motorista em tempo real. Você verá quais paradas foram concluídas, o progresso da rota e estimativa de conclusão.',
  },
  {
    id: '7',
    question: 'Como editar uma rota em andamento?',
    answer: 'Abra a rota no mapa e toque no ícone de edição. Você pode adicionar novas paradas, remover paradas ou reordenar a sequência. O motorista será notificado automaticamente sobre alterações.',
  },
  {
    id: '8',
    question: 'Como ver fotos de comprovante de entrega?',
    answer: 'Acesse o histórico da rota e toque em uma parada concluída. A foto de comprovante (se existir) será exibida junto com horário de conclusão e assinatura do destinatário.',
  },
  {
    id: '9',
    question: 'O que fazer se um motorista não conseguir entregar?',
    answer: 'Quando o motorista pula uma parada, você recebe uma notificação com o motivo. Você pode reagendar a entrega criando uma nova rota ou adicionando a parada a uma rota existente.',
  },
  {
    id: '10',
    question: 'Como exportar dados para Excel?',
    answer: 'Na tela de Gestão de Rotas, aplique os filtros desejados e toque em "Exportar CSV". O arquivo será baixado automaticamente (web) ou você poderá compartilhar (mobile).',
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
    description: 'suporte@rotamestre.tec.br',
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
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  function toggleFAQ(id: string) {
    setExpandedFAQ((prev) => (prev === id ? null : id));
  }

  async function handleSupportAction(action: string) {
    const supportPhone = '5511999999999';
    const supportEmail = 'suporte@rotamestre.tec.br';

    switch (action) {
      case 'whatsapp': {
        const whatsappUrl = Platform.select({
          ios: `whatsapp://send?phone=${supportPhone}&text=${encodeURIComponent('Olá! Sou gestor e preciso de suporte com o RotaMestre.')}`,
          android: `whatsapp://send?phone=${supportPhone}&text=${encodeURIComponent('Olá! Sou gestor e preciso de suporte com o RotaMestre.')}`,
          default: `https://wa.me/${supportPhone}?text=${encodeURIComponent('Olá! Sou gestor e preciso de suporte com o RotaMestre.')}`,
        });
        try {
          const canOpen = await Linking.canOpenURL(whatsappUrl);
          if (canOpen) {
            await Linking.openURL(whatsappUrl);
          } else {
            Alert.alert('WhatsApp não instalado', 'Tente outro método de contato.');
          }
        } catch {
          Alert.alert('Erro', 'Não foi possível abrir o WhatsApp.');
        }
        break;
      }

      case 'email': {
        const emailUrl = `mailto:${supportEmail}?subject=${encodeURIComponent('Suporte Gestor - RotaMestre')}&body=${encodeURIComponent('Olá,\n\nSou gestor e preciso de ajuda com:\n\n')}`;
        await Linking.openURL(emailUrl);
        break;
      }

      case 'phone': {
        const phoneUrl = `tel:${supportPhone.replace(/\D/g, '')}`;
        await Linking.openURL(phoneUrl);
        break;
      }
    }
  }

  return (
    <ScrollView style={styles.container}>
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
                <Text style={styles.supportDescription}>{option.description}</Text>
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
          <TouchableOpacity
            style={styles.linkItem}
            onPress={() => Linking.openURL('https://rotamestre.tec.br/central-de-ajuda')}
          >
            <Text style={styles.linkIcon}>📚</Text>
            <Text style={styles.linkLabel}>Central de Ajuda</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkItem}
            onPress={() => Linking.openURL('https://rotamestre.tec.br/tutoriais')}
          >
            <Text style={styles.linkIcon}>🎬</Text>
            <Text style={styles.linkLabel}>Tutoriais em Vídeo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkItem}
            onPress={() => Linking.openURL('https://rotamestre.tec.br/termos-de-uso')}
          >
            <Text style={styles.linkIcon}>📄</Text>
            <Text style={styles.linkLabel}>Termos de Uso</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkItem}
            onPress={() => Linking.openURL('https://rotamestre.tec.br/politica-de-privacidade')}
          >
            <Text style={styles.linkIcon}>🔐</Text>
            <Text style={styles.linkLabel}>Política de Privacidade</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* App Info */}
      <View style={styles.appInfoSection}>
        <Text style={styles.appName}>RotaMestre</Text>
        <Text style={styles.appCopyright}>
          © {new Date().getFullYear()} RotaMestre. Todos os direitos reservados.
        </Text>
      </View>

      <View style={styles.footer} />
    </ScrollView>
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
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  sectionSubtitle: {
    fontSize: 14,
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
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.gray800,
    paddingRight: theme.spacing.sm,
  },
  faqChevron: {
    fontSize: 12,
    color: theme.colors.gray400,
  },
  faqAnswer: {
    marginTop: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.gray600,
    lineHeight: 22,
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
    fontSize: 28,
    marginRight: theme.spacing.md,
  },
  supportInfo: {
    flex: 1,
  },
  supportLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  supportDescription: {
    fontSize: 13,
    color: theme.colors.gray500,
    marginTop: 2,
  },
  supportArrow: {
    fontSize: 18,
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
    fontSize: 20,
    marginRight: theme.spacing.md,
  },
  linkLabel: {
    fontSize: 15,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  appInfoSection: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
  },
  appName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  appCopyright: {
    fontSize: 12,
    color: theme.colors.gray400,
    textAlign: 'center',
  },
  footer: {
    height: 40,
  },
}));
