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
    question: 'Como iniciar uma rota?',
    answer: 'Na tela inicial, você verá suas rotas atribuídas. Toque em "Iniciar Rota" para começar. Certifique-se de que seu GPS está ativado para melhor navegação.',
  },
  {
    id: '2',
    question: 'Como marcar uma parada como concluída?',
    answer: 'Quando chegar na parada, deslize o card para a DIREITA para concluí-la. Você pode ser solicitado a tirar uma foto como comprovante. Alternativamente, toque no card para expandir e ver mais opções.',
  },
  {
    id: '3',
    question: 'Como tirar foto de comprovante?',
    answer: 'Ao concluir uma parada, toque no ícone da câmera. Você pode tirar uma nova foto ou escolher uma da galeria. A foto é enviada automaticamente e anexada à parada.',
  },
  {
    id: '4',
    question: 'O que fazer se não conseguir entregar?',
    answer: 'Se não for possível completar uma entrega, deslize o card para a ESQUERDA para pular a parada. Será solicitado um motivo. O gestor será notificado e poderá reprogramar a entrega.',
  },
  {
    id: '5',
    question: 'O que fazer em caso de emergência?',
    answer: 'Use a opção "SOS / Emergência" no menu lateral. Você pode contatar seu gestor, ligar para serviços de emergência (190, 192, 193) e enviar sua localização.',
  },
  {
    id: '6',
    question: 'Como alterar minha senha?',
    answer: 'Acesse "Meu Perfil" no menu lateral, depois toque na seção "Segurança" e selecione "Alterar Senha". Você precisará informar sua senha atual e a nova senha.',
  },
  {
    id: '7',
    question: 'Como ver meu histórico de rotas?',
    answer: 'Na barra inferior, toque em "Histórico" para ver todas as suas rotas anteriores com detalhes de cada entrega, incluindo fotos e horários.',
  },
  {
    id: '8',
    question: 'O app funciona offline?',
    answer: 'Algumas funcionalidades básicas funcionam offline, mas a sincronização de dados e o envio de fotos requerem conexão com a internet. Recomendamos manter o 4G/WiFi ativo.',
  },
  {
    id: '9',
    question: 'Como usar a navegação integrada?',
    answer: 'Ao expandir uma parada, toque em "Como Chegar" para abrir o endereço no app de navegação de sua preferência (Waze, Google Maps ou Apple Maps).',
  },
  {
    id: '10',
    question: 'O que são os badges na lista de paradas?',
    answer: 'Os badges indicam o tipo (Entrega/Retirada) e status (Pendente, Concluída, Pulada) de cada parada. Cores verdes indicam conclusão, amarelo pendente e vermelho pulada.',
  },
];

const SUPPORT_OPTIONS = [
  {
    id: 'whatsapp',
    icon: '💬',
    label: 'WhatsApp',
    description: 'Atendimento rápido',
    action: 'whatsapp',
  },
  {
    id: 'email',
    icon: '📧',
    label: 'Email',
    description: 'contato@rotamestre.tec.br',
    action: 'email',
  },
  {
    id: 'phone',
    icon: '📞',
    label: 'Telefone',
    description: 'Horário comercial',
    action: 'phone',
  },
];

export default function AjudaScreen() {
  const { theme: _theme } = useUnistyles();
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  function toggleFAQ(id: string) {
    setExpandedFAQ((prev) => (prev === id ? null : id));
  }

  async function handleSupportAction(action: string) {
    const supportPhone = '5511999999999'; // Número de suporte
    const supportEmail = 'contato@rotamestre.tec.br';

    switch (action) {
      case 'whatsapp': {
        const whatsappUrl = Platform.select({
          ios: `whatsapp://send?phone=${supportPhone}&text=${encodeURIComponent('Olá! Preciso de ajuda com o app RotaMestre.')}`,
          android: `whatsapp://send?phone=${supportPhone}&text=${encodeURIComponent('Olá! Preciso de ajuda com o app RotaMestre.')}`,
          default: `https://wa.me/${supportPhone}?text=${encodeURIComponent('Olá! Preciso de ajuda com o app RotaMestre.')}`,
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
        const emailUrl = `mailto:${supportEmail}?subject=${encodeURIComponent('Suporte RotaMestre App')}&body=${encodeURIComponent('Olá,\n\nPreciso de ajuda com:\n\n')}`;
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
          <Text style={styles.sectionTitle}>Perguntas Frequentes</Text>
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
          <Text style={styles.sectionTitle}>Fale Conosco</Text>
          <Text style={styles.sectionSubtitle}>
            Não encontrou sua resposta? Entre em contato:
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

            <TouchableOpacity
              style={styles.linkItem}
              onPress={() => Linking.openURL('https://rotamestre.tec.br')}
            >
              <Text style={styles.linkIcon}>🌐</Text>
              <Text style={styles.linkLabel}>Site Oficial</Text>
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
