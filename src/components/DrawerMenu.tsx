import { useRouter, usePathname } from 'expo-router';
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  SafeAreaView,
  Linking,
  Alert,
  Platform,
  Image,
  ActionSheetIOS,
} from 'react-native';

import { useRouteStatus } from '@/context/RouteStatusContext';
import { ConfirmDialog } from '@/design-system';
import { useUser } from '@/hooks/useUser';
import { getVersionString } from '@/lib/appVersion';
import { supabase } from '@/lib/supabase';
import { StyleSheet, type Theme } from '@/utils/styles';

// Motivos de contato com o gestor
const CONTACT_REASONS = [
  { id: 'route_problem', label: '🚗 Problema na rota', message: 'problema na rota atual' },
  { id: 'wrong_address', label: '📍 Endereço incorreto', message: 'endereço incorreto/não encontrado' },
  { id: 'delivery_issue', label: '📦 Problema com entrega', message: 'problema com a entrega' },
  { id: 'question', label: '❓ Dúvida geral', message: 'uma dúvida' },
  { id: 'emergency', label: '🆘 Emergência', message: 'uma emergência' },
] as const;

interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
}

// Tipo para dados do gestor
type GestorData = { nome: string; telefone: string | null; email: string | null };

export function DrawerMenu({ visible, onClose }: DrawerMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { route: rotaAtiva, currentStop } = useRouteStatus();
  // Usar useUser para obter perfil (aguarda auth estar pronto, evita 406)
  const { userData: profile, unidade } = useUser();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  // Estado para modal de contato (web)
  const [showContactModal, setShowContactModal] = useState(false);
  const [gestorDataForModal, setGestorDataForModal] = useState<GestorData | null>(null);

  function navigate(path: string) {
    onClose();
    router.push(path);
  }

  function handleLogoutPress() {

    setShowLogoutDialog(true);

  }



  async function handleLogoutConfirm() {

    setShowLogoutDialog(false);

    try {

      await supabase.auth.signOut();

      onClose();

      router.replace('/auth/login');

    } catch (error) {

      console.error('Erro ao fazer logout:', error);

      setShowErrorDialog(true);

    }

  }

  const gestorMenuItems = [
    { icon: '🏠', label: 'Início', path: '/gestor/inicio', show: true },
    { icon: '📦', label: 'Nova Rota', path: '/gestor/nova-entrega', show: true },
    { icon: '📋', label: 'Gestão de Rotas', path: '/gestor/gestao-rotas', show: true },
    { icon: '⚠️', label: 'Incidentes', path: '/gestor/incidentes', show: true },
    { icon: '🧑‍✈️', label: 'Motoristas', path: '/gestor/motoristas', show: true },
    { icon: '🏢', label: 'Minha Unidade', path: '/unidade', show: profile?.papel === 'gestor' },
    { icon: '👥', label: 'Equipe', path: '/unidade/equipe', show: profile?.papel === 'gestor' },
  ];

  // Gera mensagem contextualizada para o gestor
  function buildContactMessage(reason: typeof CONTACT_REASONS[number]): string {
    const motoristaNome = profile?.nome || 'Motorista';
    const hasActiveRoute = rotaAtiva && rotaAtiva.status === 'em_andamento';

    let message = `Olá! Sou ${motoristaNome}, motorista.`;

    if (hasActiveRoute) {
      message = `Olá! Sou ${motoristaNome}, motorista da rota #${rotaAtiva.id.slice(0, 8)}.`;

      if (currentStop) {
        message += `\n📍 Endereço atual: ${currentStop.endereco}`;
      }
    }

    message += `\n\n🔔 Motivo: ${reason.message}`;
    message += '\n\nPreciso de ajuda.';

    return message;
  }

  // Abre WhatsApp ou ligação com mensagem contextualizada
  async function openContactWithReason(
    gestorData: { nome: string; telefone: string | null; email: string | null },
    reason: typeof CONTACT_REASONS[number]
  ) {
    const telefone = gestorData.telefone?.replace(/\D/g, '');

    if (!telefone) {
      Alert.alert(
        'Telefone não cadastrado',
        `O gestor ${gestorData.nome} não possui telefone cadastrado. Entre em contato por email: ${gestorData.email || 'não informado'}`
      );
      return;
    }

    const message = buildContactMessage(reason);

    // Tentar abrir WhatsApp primeiro
    const whatsappUrl = Platform.select({
      ios: `whatsapp://send?phone=55${telefone}&text=${encodeURIComponent(message)}`,
      android: `whatsapp://send?phone=55${telefone}&text=${encodeURIComponent(message)}`,
      default: `https://wa.me/55${telefone}?text=${encodeURIComponent(message)}`,
    });

    const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl);

    if (canOpenWhatsApp) {
      await Linking.openURL(whatsappUrl);
      onClose();
    } else {
      // Fallback: Oferece opções de ligação ou email
      const options: { text: string; onPress?: () => void; style?: 'cancel' | 'default' | 'destructive' }[] = [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: '📞 Ligar',
          onPress: () => {
            Linking.openURL(`tel:${telefone}`);
            onClose();
          },
        },
      ];

      if (gestorData.email) {
        options.push({
          text: '📧 Email',
          onPress: () => {
            Linking.openURL(`mailto:${gestorData.email}?subject=Contato%20Motorista&body=${encodeURIComponent(message)}`);
            onClose();
          },
        });
      }

      Alert.alert(
        'WhatsApp não disponível',
        `Como deseja contatar ${gestorData.nome}?`,
        options
      );
    }
  }

  // Handler para seleção de motivo no modal web
  function handleWebReasonSelect(reason: typeof CONTACT_REASONS[number]) {
    setShowContactModal(false);
    if (gestorDataForModal) {
      openContactWithReason(gestorDataForModal, reason);
    }
  }

  // Mostra menu de motivos (iOS: ActionSheet, Android: Alert, Web: Modal)
  function showReasonMenu(gestorData: GestorData) {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `Contatar ${gestorData.nome}\nQual o motivo do contato?`,
          options: [...CONTACT_REASONS.map(r => r.label), 'Cancelar'],
          cancelButtonIndex: CONTACT_REASONS.length,
          userInterfaceStyle: 'light',
        },
        (buttonIndex) => {
          if (buttonIndex < CONTACT_REASONS.length) {
            openContactWithReason(gestorData, CONTACT_REASONS[buttonIndex]);
          }
        }
      );
    } else if (Platform.OS === 'web') {
      // Web: usa modal customizado com botões
      setGestorDataForModal(gestorData);
      setShowContactModal(true);
    } else {
      // Android: usa Alert com botões
      Alert.alert(
        `Contatar ${gestorData.nome}`,
        'Qual o motivo do contato?',
        [
          ...CONTACT_REASONS.map(reason => ({
            text: reason.label,
            onPress: () => openContactWithReason(gestorData, reason),
          })),
          { text: 'Cancelar', style: 'cancel' },
        ]
      );
    }
  }

  // Função principal para abrir contato com gestor
  async function handleContactGestor() {
    try {
      // Usar função RPC segura que bypassa RLS para motoristas
      const { data: gestorData, error } = await supabase
        .rpc('get_gestor_contato')
        .single<{ nome: string; telefone: string | null; email: string | null }>();

      if (error) {
        console.error('Erro ao buscar gestor:', error);
        Alert.alert('Erro', 'Não foi possível obter os dados do gestor');
        return;
      }

      if (!gestorData) {
        Alert.alert('Erro', 'Gestor não encontrado para esta unidade');
        return;
      }

      // Mostrar menu de motivos
      showReasonMenu(gestorData);
    } catch (error) {
      console.error('Erro ao contatar gestor:', error);
      Alert.alert('Erro', 'Não foi possível contatar o gestor');
    }
  }

  // Itens do menu para motorista
  // Ações principais (Início, Paradas, Mapa, Histórico) estão nas tabs
  // Aqui mostramos apenas ações secundárias
  const motoristaMenuItems = [
    { icon: '👤', label: 'Meu Perfil', path: '/motorista/perfil', show: true },
    { icon: '📊', label: 'Meu Desempenho', path: '/motorista/desempenho', show: true },
    { icon: '📞', label: 'Falar com Gestor', path: null, action: 'contactGestor', show: true },
    { icon: '🆘', label: 'SOS / Emergência', path: '/motorista/sos', show: true, danger: true },
    { icon: '❓', label: 'Ajuda', path: '/motorista/ajuda', show: true },
    { icon: '⚙️', label: 'Configurações', path: '/motorista/perfil/configuracoes', show: true },
  ];

  const isMotorista = profile?.papel === 'motorista';
  const menuItems = isMotorista ? motoristaMenuItems : gestorMenuItems;


  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.drawer}
          onPress={(e) => e.stopPropagation()}
        >
          <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.content}>
              {/* Header */}
              <View style={styles.header}>
                {profile?.foto_url ? (
                  <Image
                    source={{ uri: profile.foto_url }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {profile?.nome?.charAt(0) || '?'}
                    </Text>
                  </View>
                )}
                <Text style={styles.userName}>{profile?.nome}</Text>
                <Text style={styles.userEmail}>{profile?.email}</Text>
                {unidade && (
                  <View style={styles.unitBadge}>
                    <Text style={styles.unitBadgeText}>
                      {unidade.nome}
                    </Text>
                  </View>
                )}
                {profile?.is_gestor_principal && (
                  <View style={styles.principalBadge}>
                    <Text style={styles.principalBadgeText}>
                      ⭐ Gestor Principal
                    </Text>
                  </View>
                )}
              </View>

              {/* Menu Items */}
              <View style={styles.menuSection}>
                {menuItems
                  .filter((item) => item.show)
                  .map((item, index) => {
                    const isActive = item.path ? pathname === item.path : false;
                    const isDanger = 'danger' in item && item.danger;
                    const hasAction = 'action' in item && item.action;

                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.menuItem,
                          isActive && styles.menuItemActive,
                          isDanger && styles.menuItemDanger,
                        ]}
                        onPress={() => {
                          if (hasAction && item.action === 'contactGestor') {
                            handleContactGestor();
                          } else if (item.path) {
                            navigate(item.path);
                          }
                        }}
                      >
                        <Text style={[styles.menuIcon, isDanger && styles.menuIconDanger]}>
                          {item.icon}
                        </Text>
                        <Text
                          style={[
                            styles.menuLabel,
                            isActive && styles.menuLabelActive,
                            isDanger && styles.menuLabelDanger,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>

              {/* Footer Actions */}
              <View style={styles.footer}>
                {/* Meu Perfil apenas para gestor (motorista já tem no menu) */}
                {!isMotorista && (
                  <TouchableOpacity
                    style={styles.footerItem}
                    onPress={() => navigate('/perfil')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.footerIcon}>👤</Text>
                    <Text style={styles.footerLabel}>Meu Perfil</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.footerItem}
                  onPress={handleLogoutPress}
                  activeOpacity={0.7}
                >
                  <Text style={styles.footerIcon}>🚪</Text>
                  <Text style={styles.footerLabel}>Sair</Text>
                </TouchableOpacity>

                <View style={styles.versionContainer}>
                  <Text style={styles.versionText}>{getVersionString()}</Text>
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </TouchableOpacity>
      </TouchableOpacity>
      <ConfirmDialog
        visible={showLogoutDialog}
        title="Sair da conta"
        message="Deseja realmente encerrar sua sessão?"
        confirmText="Sair"
        cancelText="Cancelar"
        type="destructive"
        onConfirm={handleLogoutConfirm}
        onCancel={() => setShowLogoutDialog(false)}
      />
      <ConfirmDialog
        visible={showErrorDialog}
        title="Erro ao sair"
        message="Não foi possível encerrar sua sessão. Tente novamente."
        confirmText="Entendi"
        cancelText="Fechar"
        type="destructive"
        onConfirm={() => setShowErrorDialog(false)}
        onCancel={() => setShowErrorDialog(false)}
      />

      {/* Modal de contato com gestor (Web) */}
      <Modal
        visible={showContactModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowContactModal(false)}
      >
        <TouchableOpacity
          style={styles.contactModalOverlay}
          activeOpacity={1}
          onPress={() => setShowContactModal(false)}
        >
          <View style={styles.contactModalContainer}>
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={styles.contactModalContent}>
                <Text style={styles.contactModalTitle}>
                  📞 Contatar {gestorDataForModal?.nome}
                </Text>
                <Text style={styles.contactModalSubtitle}>
                  Qual o motivo do contato?
                </Text>

                <View style={styles.contactModalOptions}>
                  {CONTACT_REASONS.map((reason) => (
                    <TouchableOpacity
                      key={reason.id}
                      style={styles.contactModalOption}
                      onPress={() => handleWebReasonSelect(reason)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.contactModalOptionText}>
                        {reason.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.contactModalCancel}
                  onPress={() => setShowContactModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.contactModalCancelText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-start',
  },
  drawer: {
    width: '80%',
    maxWidth: 320,
    height: '100%',
    backgroundColor: theme.colors.white,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
    alignItems: 'center',
  },
  avatar: {
    width: theme.components.drawer.avatarSize,
    height: theme.components.drawer.avatarSize,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  avatarImage: {
    width: theme.components.drawer.avatarSize,
    height: theme.components.drawer.avatarSize,
    borderRadius: theme.borderRadius.full,
    marginBottom: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.gray200,
  },
  avatarText: {
    fontSize: theme.typography.fontSize['2xl'],
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.white,
  },
  userName: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  userEmail: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.sm,
  },
  unitBadge: {
    backgroundColor: `${theme.colors.primary}10`,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
  },
  unitBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primaryDark,
  },
  principalBadge: {
    backgroundColor: `${theme.colors.secondary}20`,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
  },
  principalBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.secondary,
  },
  menuSection: {
    paddingVertical: theme.spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.components.drawer.itemPaddingV,
    paddingHorizontal: theme.spacing.xl,
  },
  menuItemActive: {
    backgroundColor: `${theme.colors.primary}10`,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  menuItemDanger: {
    backgroundColor: `${theme.colors.error}10`,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.error,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  menuIcon: {
    fontSize: theme.components.drawer.menuIconSize,
    marginRight: theme.spacing.lg,
    width: theme.components.drawer.menuIconWidth,
  },
  menuIconDanger: {
    fontSize: theme.typography.fontSize['2xl'],
  },
  menuLabel: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray700,
  },
  menuLabelActive: {
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
  },
  menuLabelDanger: {
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.error,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
    marginTop: 'auto',
    gap: 4,
    backgroundColor: theme.colors.gray50,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.components.drawer.itemPaddingV,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.white,
  },
  footerIcon: {
    fontSize: theme.typography.fontSize.lg,
    marginRight: theme.spacing.md,
    width: theme.components.drawer.menuIconWidth,
  },
  footerLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray600,
  },
  versionContainer: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    alignItems: 'center',
  },
  versionText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray400,
    fontFamily: theme.typography.fontSansMedium,
  },
  // Estilos do modal de contato (Web)
  contactModalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactModalContainer: {
    width: '90%',
    maxWidth: 400,
  },
  contactModalContent: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  contactModalTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  contactModalSubtitle: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray500,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  contactModalOptions: {
    gap: theme.spacing.sm,
  },
  contactModalOption: {
    backgroundColor: theme.colors.gray50,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  contactModalOptionText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray700,
    textAlign: 'center',
  },
  contactModalCancel: {
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  contactModalCancelText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
}));


