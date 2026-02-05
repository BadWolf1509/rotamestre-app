/**
 * Hook for handling drawer contact gestor logic
 */

import { useState, useCallback } from 'react';
import { Alert, Linking, Platform, ActionSheetIOS } from 'react-native';

import { useRouteStatus } from '@/context/RouteStatusContext';
import { useUser } from '@/hooks/useUser';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import { CONTACT_REASONS, type ContactReason } from '../constants';

import type { GestorData } from '../types';

interface UseDrawerContactOptions {
  onClose: () => void;
}

export function useDrawerContact({ onClose }: UseDrawerContactOptions) {
  const { route: rotaAtiva, currentStop } = useRouteStatus();
  const { userData: profile } = useUser();

  const [showContactModal, setShowContactModal] = useState(false);
  const [gestorDataForModal, setGestorDataForModal] = useState<GestorData | null>(null);

  // Gera mensagem contextualizada para o gestor
  const buildContactMessage = useCallback(
    (reason: ContactReason): string => {
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
    },
    [profile?.nome, rotaAtiva, currentStop]
  );

  // Abre WhatsApp ou ligação com mensagem contextualizada
  const openContactWithReason = useCallback(
    async (gestorData: GestorData, reason: ContactReason) => {
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
        const options: {
          text: string;
          onPress?: () => void;
          style?: 'cancel' | 'default' | 'destructive';
        }[] = [
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
              Linking.openURL(
                `mailto:${gestorData.email}?subject=Contato%20Motorista&body=${encodeURIComponent(message)}`
              );
              onClose();
            },
          });
        }

        Alert.alert('WhatsApp não disponível', `Como deseja contatar ${gestorData.nome}?`, options);
      }
    },
    [buildContactMessage, onClose]
  );

  // Handler para seleção de motivo no modal web
  const handleWebReasonSelect = useCallback(
    (reason: ContactReason) => {
      setShowContactModal(false);
      if (gestorDataForModal) {
        openContactWithReason(gestorDataForModal, reason);
      }
    },
    [gestorDataForModal, openContactWithReason]
  );

  // Mostra menu de motivos (iOS: ActionSheet, Android: Alert, Web: Modal)
  const showReasonMenu = useCallback(
    (gestorData: GestorData) => {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            title: `Contatar ${gestorData.nome}\nQual o motivo do contato?`,
            options: [...CONTACT_REASONS.map((r) => r.label), 'Cancelar'],
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
        Alert.alert(`Contatar ${gestorData.nome}`, 'Qual o motivo do contato?', [
          ...CONTACT_REASONS.map((reason) => ({
            text: reason.label,
            onPress: () => openContactWithReason(gestorData, reason),
          })),
          { text: 'Cancelar', style: 'cancel' },
        ]);
      }
    },
    [openContactWithReason]
  );

  // Função principal para abrir contato com gestor
  const handleContactGestor = useCallback(async () => {
    try {
      // Usar função RPC segura que bypassa RLS para motoristas
      const { data: gestorData, error } = await supabase
        .rpc('get_gestor_contato')
        .single<GestorData>();

      if (error) {
        logger.error('Erro ao buscar gestor:', error);
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
      logger.error('Erro ao contatar gestor:', error);
      Alert.alert('Erro', 'Não foi possível contatar o gestor');
    }
  }, [showReasonMenu]);

  const handleCloseContactModal = useCallback(() => {
    setShowContactModal(false);
  }, []);

  return {
    showContactModal,
    gestorDataForModal,
    handleContactGestor,
    handleWebReasonSelect,
    handleCloseContactModal,
  };
}
