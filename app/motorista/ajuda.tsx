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
  SUPORTE_EMAIL,
  SUPORTE_MENSAGEM_MOTORISTA,
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
    question: 'Como iniciar uma rota?',
    answer:
      'Na aba "Início" aparece a sua rota do dia (se houver mais de uma, aparece um selo como "+1"). Toque em "Iniciar Rota", no fim da tela. O GPS precisa estar ligado: sem ele o botão não funciona. Para iniciar a rota é preciso internet.',
  },
  {
    id: '2',
    question: 'Como marcar uma parada como concluída?',
    answer:
      'Toque em "Concluir" no cartão da parada, na "Início" ou na aba "Paradas". Você também pode deslizar o cartão para a direita e tocar em "Concluir". Depois aparece a tela "Foto de Comprovante": tire a foto, toque em "Enviar Foto" e confirme em "Concluir". Se não puder tirar a foto, use "Continuar sem foto".',
  },
  {
    id: '3',
    question: 'Como tirar foto de comprovante?',
    answer:
      'Na tela "Foto de Comprovante", toque em "Adicionar Foto do Comprovante" e escolha "Tirar Foto" ou "Escolher da Galeria". Confira a foto, toque em "Enviar Foto" e confirme em "Concluir". Sem internet, a foto fica guardada no celular e é enviada quando o sinal voltar.',
  },
  {
    id: '4',
    question: 'O que fazer se não conseguir entregar?',
    answer:
      'Toque em "Pular" no cartão da parada (ou deslize o cartão para a esquerda e toque em "Pular"). Escolha o motivo: Cliente ausente, Recusou receber/entregar, Endereço incorreto, Acesso bloqueado, Renovação de contrato ou Outro motivo. Em "Outro motivo", escreva pelo menos 10 letras. O gestor recebe um aviso. Se pulou por engano, toque em "Retomar Parada" na aba "Paradas".',
  },
  {
    id: '5',
    question: 'O que fazer em caso de emergência?',
    answer:
      'No menu lateral, toque em "SOS / Emergência". Ali você liga para o gestor, chama o WhatsApp dele ou liga para a Polícia (190), o SAMU (192) e os Bombeiros (193). O botão "ACIONAR SOS" avisa o gestor e envia a sua localização, se o GPS estiver ligado. Sem internet o aviso não sai: ligue pelos botões.',
  },
  {
    id: '6',
    question: 'Como alterar minha senha?',
    answer:
      'Acesse "Meu Perfil" no menu lateral, depois toque na seção "Segurança" e selecione "Alterar Senha". Você precisará informar sua senha atual e a nova senha.',
  },
  {
    id: '7',
    question: 'Como ver meu histórico de rotas?',
    answer:
      'Na barra inferior, toque em "Histórico" para ver todas as suas rotas anteriores. Toque numa rota para ver o horário de início e de conclusão, o tempo total, a distância e quantas paradas foram feitas. Use os filtros de período e de situação para encontrar uma rota.',
  },
  {
    id: '8',
    question: 'O app funciona offline?',
    answer:
      'Em parte. Sem internet você ainda conclui e pula paradas e reporta problemas: o que você registrou (inclusive a foto) fica guardado no aparelho e sobe sozinho quando a internet voltar, e a tela Início mostra um aviso enquanto houver algo pendente. Para iniciar e finalizar a rota, carregar a rota e receber novidades do gestor é preciso internet. O botão "ACIONAR SOS" também precisa de internet; sem ela, ligue pelos botões da tela de emergência.',
  },
  {
    id: '9',
    question: 'Quais são os modos de navegação?',
    answer:
      'São dois:\n\n' +
      '• Mapa do app: na "Início", toque em "Navegar". Abre um mapa em tela cheia com a distância e o tempo até a parada e os botões "Pular", "Concluir" e o do seu app de navegação (como "Waze", "Google Maps" ou "Abrir no GPS"). Quando você chega, o app avisa, mas a parada só é concluída quando você toca em "Concluir". Depois, a navegação segue para a próxima parada.\n\n' +
      '• App externo (Waze ou Google Maps; no iPhone, também o Apple Maps): toque no botão com o nome do seu app dentro do mapa do app, ou em "Como Chegar" no cartão da parada, na aba "Paradas". As instruções curva a curva vêm desse app.',
  },
  {
    id: '10',
    question: 'Por que o "Navegar" abriu o mapa do app e não o Waze?',
    answer:
      'Depende do ajuste "Navegar com", em Configurações (menu lateral) > "Navegação". "Mapa do RotaMestre" (o padrão) abre o mapa do app, que avisa quando você chega e mantém a tela acesa. "Waze / Google Maps" abre direto o app escolhido em "App de Navegação", com instruções por voz. Nos dois casos, a parada só é concluída quando você toca em "Concluir".',
  },
  {
    id: '11',
    question: 'O que são os badges na lista de paradas?',
    answer:
      'Cada parada mostra o tipo ("Entrega" ou "Retirada") e a situação: "Pendente" (amarelo), "Em rota" (azul), "Concluída" (verde) e "Pulada" (vermelho).',
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
    description: SUPORTE_EMAIL,
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
          `https://wa.me/${SUPORTE_TELEFONE}?text=${encodeURIComponent(SUPORTE_MENSAGEM_MOTORISTA)}`,
          'o WhatsApp',
        );
        break;

      case 'email':
        await abrirContato(
          `mailto:${SUPORTE_EMAIL}?subject=${encodeURIComponent('Suporte RotaMestre App')}&body=${encodeURIComponent('Olá,\n\nPreciso de ajuda com:\n\n')}`,
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
