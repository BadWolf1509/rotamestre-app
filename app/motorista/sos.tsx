import * as Location from 'expo-location';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useRouteStatus } from '@/context/RouteStatusContext';
import { useAlert } from '@/hooks/useAlert';
import { useUser } from '@/hooks/useUser';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { withOpacity } from '@/utils/color';
import { heavyHaptic, warningHaptic } from '@/utils/haptics';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// Contatos de emergência
const EMERGENCY_CONTACTS = [
  { id: 'gestor', label: 'Ligar para Gestor', icon: '📞', number: null, description: 'Contato direto com seu gestor' },
  { id: 'policia', label: 'Polícia (190)', icon: '🚔', number: '190', description: 'Emergências de segurança' },
  { id: 'samu', label: 'SAMU (192)', icon: '🚑', number: '192', description: 'Emergências médicas' },
  { id: 'bombeiros', label: 'Bombeiros (193)', icon: '🚒', number: '193', description: 'Incêndio e resgate' },
];

export default function SOSScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { userData, loading: userLoading } = useUser();
  const routeStatus = useRouteStatus();
  const { showWarning, showSuccess, showError, showConfirm, AlertDialog } = useAlert();

  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [gestorTelefone, setGestorTelefone] = useState<string | null>(null);
  const [gestorNome, setGestorNome] = useState<string | null>(null);

  // Carregar localização atual
  useEffect(() => {
    async function getLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          setLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch (error) {
        logger.error('Erro ao obter localização:', error);
      } finally {
        setLoadingLocation(false);
      }
    }
    getLocation();
  }, []);

  // Carregar dados do gestor (aguarda userData estar carregado para evitar 406)
  useEffect(() => {
    async function loadGestor() {
      // Aguardar carregamento completo do userData antes de fazer query
      if (userLoading || !userData?.unidade_id) return;

      // Usar maybeSingle() em vez de single() para evitar erro 406 quando não há gestor
      const { data, error } = await supabase
        .from('usuarios')
        .select('nome, telefone')
        .eq('unidade_id', userData.unidade_id)
        .eq('papel', 'gestor')
        .limit(1)
        .maybeSingle();

      if (error) {
        logger.warn('[SOS] Erro ao carregar gestor:', error.message);
        return;
      }

      if (data) {
        setGestorNome(data.nome);
        setGestorTelefone(data.telefone?.replace(/\D/g, '') || null);
      }
    }
    loadGestor();
  }, [userLoading, userData?.unidade_id]);

  async function handleEmergencyCall(contactId: string, number: string | null) {
    await warningHaptic();

    if (contactId === 'gestor') {
      if (!gestorTelefone) {
        showWarning('Telefone não cadastrado', `O gestor ${gestorNome || ''} não possui telefone cadastrado.`);
        return;
      }

      // Tentar WhatsApp primeiro
      const whatsappUrl = Platform.select({
        ios: `whatsapp://send?phone=55${gestorTelefone}&text=${encodeURIComponent('EMERGÊNCIA: Preciso de ajuda!')}`,
        android: `whatsapp://send?phone=55${gestorTelefone}&text=${encodeURIComponent('EMERGÊNCIA: Preciso de ajuda!')}`,
        default: `https://wa.me/55${gestorTelefone}?text=${encodeURIComponent('EMERGÊNCIA: Preciso de ajuda!')}`,
      });

      try {
        const canOpen = await Linking.canOpenURL(whatsappUrl);
        if (canOpen) {
          await Linking.openURL(whatsappUrl);
        } else {
          // Fallback para ligação
          await Linking.openURL(`tel:${gestorTelefone}`);
        }
      } catch {
        await Linking.openURL(`tel:${gestorTelefone}`);
      }
    } else if (number) {
      await Linking.openURL(`tel:${number}`);
    }
  }

  async function handleSOSActivation() {
    await heavyHaptic();

    const confirmed = await showConfirm({
      title: 'Confirmar SOS',
      message: 'Isso vai notificar seu gestor e registrar sua localização atual. Deseja continuar?',
      confirmText: 'CONFIRMAR SOS',
      cancelText: 'Cancelar',
      type: 'danger',
    });
    if (confirmed) {
      await enviarSOS();
    }
  }

  async function enviarSOS() {
    if (!userData?.id) {
      showError({ title: 'Erro', message: 'Usuário não identificado' });
      return;
    }

    setEnviando(true);

    try {
      // Registrar log no banco
      const logData: Record<string, unknown> = {
        usuario_id: userData.id,
        evento: 'sos_acionado',
        detalhes: {
          descricao: descricao || 'SOS acionado sem descrição',
          timestamp: new Date().toISOString(),
        },
      };

      // Adicionar rota se existir
      if (routeStatus?.route?.id) {
        logData.rota_id = routeStatus.route.id;
        (logData.detalhes as Record<string, unknown>).rota_id = routeStatus.route.id;
        (logData.detalhes as Record<string, unknown>).rota_status = routeStatus.route.status;
      }

      // Adicionar localização se disponível
      if (location) {
        (logData.detalhes as Record<string, unknown>).localizacao = {
          latitude: location.latitude,
          longitude: location.longitude,
          google_maps_url: `https://www.google.com/maps?q=${location.latitude},${location.longitude}`,
        };
      }

      const { error } = await supabase.from('logs').insert(logData);

      if (error) throw error;

      showSuccess(
        'SOS Enviado',
        'Seu gestor foi notificado da emergência. Se precisar de ajuda imediata, use os botões de ligação abaixo.'
      );

      setDescricao('');
    } catch (error) {
      logger.error('Erro ao enviar SOS:', error);
      showError({ title: 'Erro', message: 'Não foi possível enviar o SOS. Tente ligar diretamente para os números de emergência.' });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ErrorBoundary>
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: Math.max(20, insets.bottom + 20) }}
    >
        {/* Botão Grande de Emergência */}
        <View style={styles.emergencySection}>
          <TouchableOpacity
            style={styles.emergencyButton}
            onPress={handleSOSActivation}
            disabled={enviando}
            activeOpacity={0.8}
          >
            {enviando ? (
              <ActivityIndicator size="large" color={theme.colors.white} />
            ) : (
              <>
                <Text style={styles.emergencyIcon}>🆘</Text>
                <Text style={styles.emergencyText}>ACIONAR SOS</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.emergencySubtext}>
            Toque para notificar seu gestor e enviar sua localização
          </Text>
        </View>

        {/* Campo de Descrição */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Descreva a situação (opcional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Ex: Pneu furado, acidente, problema mecânico..."
            placeholderTextColor={theme.colors.gray500}
            value={descricao}
            onChangeText={setDescricao}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Localização Atual */}
        <View style={styles.locationSection}>
          <Text style={styles.sectionTitle}>Sua localização</Text>
          {loadingLocation ? (
            <View style={styles.locationLoading}>
              <ActivityIndicator size="small" color={theme.colors.gray500} />
              <Text style={styles.locationLoadingText}>Obtendo localização...</Text>
            </View>
          ) : location ? (
            <TouchableOpacity
              style={styles.locationCard}
              onPress={() => {
                const url = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
                Linking.openURL(url);
              }}
            >
              <Text style={styles.locationIcon}>📍</Text>
              <View style={styles.locationInfo}>
                <Text style={styles.locationCoords}>
                  {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </Text>
                <Text style={styles.locationHint}>Toque para ver no mapa</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <Text style={styles.locationError}>Localização não disponível</Text>
          )}
        </View>

        {/* Contatos de Emergência */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ligação de Emergência</Text>
          <View style={styles.contactsList}>
            {EMERGENCY_CONTACTS.map((contact) => (
              <TouchableOpacity
                key={contact.id}
                style={[
                  styles.contactItem,
                  contact.id === 'gestor' && styles.contactItemGestor,
                ]}
                onPress={() => handleEmergencyCall(contact.id, contact.number)}
              >
                <Text style={styles.contactIcon}>{contact.icon}</Text>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactLabel}>{contact.label}</Text>
                  <Text style={styles.contactDescription}>{contact.description}</Text>
                </View>
                <Text style={styles.contactArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Informações de Segurança */}
        <View style={styles.safetySection}>
          <Text style={styles.safetyTitle}>Dicas de Segurança</Text>
          <Text style={styles.safetyText}>
            • Em caso de acidente, ligue primeiro para o SAMU (192){'\n'}
            • Se estiver em perigo, ligue para a Polícia (190){'\n'}
            • Mantenha a calma e informe sua localização{'\n'}
            • Não saia do veículo em rodovias movimentadas
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
  emergencySection: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.white,
    marginBottom: theme.spacing.md,
  },
  emergencyButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: theme.colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  emergencyIcon: {
    fontSize: theme.typography['4xl'],
    marginBottom: theme.spacing.xs,
  },
  emergencyText: {
    color: theme.colors.white,
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansBold,
    // Brand guideline: text shadow for white text on colored background
    textShadowColor: withOpacity(theme.colors.black, 0.3),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  emergencySubtext: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  section: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.md,
  },
  textInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.base,
    color: theme.colors.gray900,
    backgroundColor: theme.colors.gray50,
    minHeight: 100,
  },
  locationSection: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  locationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  locationLoadingText: {
    color: theme.colors.gray500,
    fontSize: theme.typography.sm,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.blue50,
    borderRadius: theme.borderRadius.md,
  },
  locationIcon: {
    fontSize: theme.typography['2xl'],
    marginRight: theme.spacing.md,
  },
  locationInfo: {
    flex: 1,
  },
  locationCoords: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  locationHint: {
    fontSize: theme.typography.xs,
    color: theme.colors.primary,
    marginTop: theme.spacing.xs,
  },
  locationError: {
    color: theme.colors.gray500,
    fontSize: theme.typography.sm,
  },
  contactsList: {
    gap: theme.spacing.sm,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  contactItemGestor: {
    backgroundColor: theme.colors.primary + '10',
    borderColor: theme.colors.primary + '40',
  },
  contactIcon: {
    fontSize: theme.typography['3xl'],
    marginRight: theme.spacing.md,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  contactDescription: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginTop: theme.spacing.xs,
  },
  contactArrow: {
    fontSize: theme.typography.xl,
    color: theme.colors.gray400,
  },
  safetySection: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.warningBg,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.warning + '40',
  },
  safetyTitle: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.warningDark,
    marginBottom: theme.spacing.sm,
  },
  safetyText: {
    fontSize: theme.typography.sm,
    color: theme.colors.warningText,
    lineHeight: theme.typography.xl,
  },
  footer: {
    height: theme.spacing['3xl'],
  },
}));
