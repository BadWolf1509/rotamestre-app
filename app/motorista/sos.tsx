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
import {
  useLocationWatcher,
  type OpcoesDoWatcher,
} from '@/hooks/useLocationWatcher';
import { useUser } from '@/hooks/useUser';
import { logger } from '@/lib/logger';
import { COPY_LOCALIZACAO_SOS } from '@/lib/motorista/copyDePermissao';
import {
  oferecerSaidaParaConfiguracoes,
  pedirPermissao,
  type ResultadoPermissao,
} from '@/lib/permissoes';
import { supabase } from '@/lib/supabase';
import { withOpacity } from '@/utils/color';
import { heavyHaptic, warningHaptic } from '@/utils/haptics';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// Contatos de emergência
const EMERGENCY_CONTACTS = [
  {
    id: 'gestor',
    label: 'Ligar para Gestor',
    icon: '📞',
    number: null,
    description: 'Contato direto com seu gestor',
  },
  {
    id: 'policia',
    label: 'Polícia (190)',
    icon: '🚔',
    number: '190',
    description: 'Emergências de segurança',
  },
  {
    id: 'samu',
    label: 'SAMU (192)',
    icon: '🚑',
    number: '192',
    description: 'Emergências médicas',
  },
  {
    id: 'bombeiros',
    label: 'Bombeiros (193)',
    icon: '🚒',
    number: '193',
    description: 'Incêndio e resgate',
  },
];

/**
 * O servidor sem a Migration 46 (app publicado antes dela): a RPC não existe.
 * PGRST202 é o PostgREST não achando a função; 42883, o Postgres.
 */
const CODIGOS_SEM_RPC = new Set(['PGRST202', '42883']);

/** O que dizer quando ninguém confirmou o recebimento do SOS. */
const AVISO_SEM_GESTOR = {
  nenhum: {
    titulo: 'Nenhum gestor recebeu o SOS',
    corpo: 'O SOS foi registrado, mas nenhum gestor recebeu o aviso.',
    faixa: 'Nenhum gestor recebeu o seu SOS. Ligue agora pelos botões abaixo.',
  },
  semConfirmacao: {
    titulo: 'SOS registrado sem confirmação',
    corpo:
      'O SOS foi registrado, mas não foi possível confirmar que um gestor recebeu o aviso.',
    faixa:
      'Não foi possível confirmar que um gestor recebeu o seu SOS. Ligue agora pelos botões abaixo.',
  },
  // A gravação falhou (rede, servidor): nem o registro é certo.
  falhaNoEnvio: {
    titulo: 'SOS sem confirmação de envio',
    corpo:
      'Não foi possível confirmar o envio do SOS. Ligue agora para os números de emergência pelos botões abaixo.',
    faixa:
      'Não foi possível confirmar o envio do seu SOS. Ligue agora pelos botões abaixo.',
  },
} as const;

/**
 * Grava o SOS e devolve quantos gestores receberam o aviso — `null` quando não
 * dá para saber (servidor sem a RPC: o SOS sai pelo INSERT antigo, que o
 * gatilho também avisa, mas sem devolver nada).
 */
async function registrarSOS(
  usuarioId: string,
  detalhes: Record<string, unknown>,
  rotaId: string | null,
): Promise<number | null> {
  const { data, error } = await supabase.rpc('registrar_sos', {
    p_detalhes: detalhes,
    p_rota_id: rotaId,
  });

  if (!error) return typeof data === 'number' ? data : null;
  if (!CODIGOS_SEM_RPC.has(error.code ?? '')) throw error;

  // O SOS não pode se perder por causa da ordem entre o deploy e a migration.
  logger.warn('[SOS] registrar_sos indisponível; gravando pelo INSERT', error);
  const { error: erroInsert } = await supabase.from('logs').insert({
    usuario_id: usuarioId,
    evento: 'sos_acionado',
    detalhes,
    ...(rotaId ? { rota_id: rotaId } : {}),
  });
  if (erroInsert) throw erroInsert;
  return null;
}

/**
 * Precisão folgada de propósito: aqui a pergunta é "onde essa pessoa está",
 * não "em qual faixa da via" — e `Balanced` pega um fix bem mais rápido que
 * `High` num GPS frio, que é a situação de quem abre esta tela.
 */
const OPCOES_SOS: OpcoesDoWatcher = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 5000,
  distanceInterval: 10,
};

export default function SOSScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { userData, loading: userLoading } = useUser();
  const routeStatus = useRouteStatus();
  const { showWarning, showSuccess, showError, showConfirm, AlertDialog } =
    useAlert();

  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [permissao, setPermissao] = useState<ResultadoPermissao | null>(null);
  const [gestorTelefone, setGestorTelefone] = useState<string | null>(null);
  const [gestorNome, setGestorNome] = useState<string | null>(null);
  /** Faixa sobre os botões de ligar quando nenhum gestor confirmou o SOS. */
  const [avisoSemGestor, setAvisoSemGestor] = useState<string | null>(null);

  // Carregar localização atual
  useEffect(() => {
    async function getLocation() {
      try {
        const resultado = await pedirPermissao(
          () => Location.requestForegroundPermissionsAsync(),
          () => Location.getForegroundPermissionsAsync(),
        );
        setPermissao(resultado);
        if (!resultado.concedida) return;

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch (error) {
        // Não-crítico: o watcher abaixo continua tentando enquanto a tela
        // viver. Falhar aqui é o caso COMUM, não a exceção.
        logger.warn('[SOS] Não foi possível obter a posição inicial', error);
      } finally {
        setLoadingLocation(false);
      }
    }
    getLocation();
  }, []);

  // O one-shot acima falha com GPS frio — e GPS frio é justamente o estado de
  // quem acabou de abrir esta tela. Sem isto, a coordenada que chega três
  // segundos depois era descartada e o SOS saía sem localização à toa. O
  // watcher se desliga sozinho quando `location` deixa de ser null.
  useLocationWatcher({
    enabled: !location && permissao?.concedida === true,
    options: OPCOES_SOS,
    onLocation: (loc) =>
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      }),
  });

  /**
   * Remédio para os DOIS motivos de não haver coordenada, que são diferentes:
   * permissão negada se resolve nas Configurações, GPS sem fix se resolve
   * tentando de novo.
   */
  async function tentarLocalizacaoDeNovo() {
    if (permissao && !permissao.concedida) {
      await oferecerSaidaParaConfiguracoes(
        permissao,
        COPY_LOCALIZACAO_SOS,
        showConfirm,
      );
      return;
    }

    setLoadingLocation(true);
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch (error) {
      logger.warn('[SOS] Nova tentativa de posição falhou', error);
    } finally {
      setLoadingLocation(false);
    }
  }

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
        showWarning(
          'Telefone não cadastrado',
          `O gestor ${gestorNome || ''} não possui telefone cadastrado.`,
        );
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
      // A mensagem muda com o fato, e não com a intenção: prometer "registrar
      // sua localização" quando `location` é null era dizer a quem está em
      // emergência que o gestor saberia onde ela está.
      message: location
        ? 'Isso vai notificar seu gestor e registrar sua localização atual. Deseja continuar?'
        : 'Seu gestor será notificado, mas sem sua localização — ele não vai saber onde você está. Descreva onde você está no campo acima, ou ligue direto pelos botões abaixo. Deseja continuar?',
      confirmText: 'CONFIRMAR SOS',
      cancelText: 'Cancelar',
      type: 'danger',
      // Sem ícone próprio, 'danger' desenha a lixeira (é o de excluir).
      icon: 'alert-circle-outline',
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
      const detalhes: Record<string, unknown> = {
        descricao: descricao || 'SOS acionado sem descrição',
        timestamp: new Date().toISOString(),
      };

      const rotaId = routeStatus?.route?.id ?? null;
      if (rotaId) {
        detalhes.rota_id = rotaId;
        detalhes.rota_status = routeStatus?.route?.status;
      }

      if (location) {
        detalhes.localizacao = {
          latitude: location.latitude,
          longitude: location.longitude,
          google_maps_url: `https://www.google.com/maps?q=${location.latitude},${location.longitude}`,
        };
      }

      const avisados = await registrarSOS(userData.id, detalhes, rotaId);

      // "Notificado" só quando o servidor confirmou que alguém recebeu (B1:
      // sem rota, o gatilho antigo não avisava ninguém e a tela dizia que sim).
      if (avisados === null || avisados === 0) {
        const resultado =
          AVISO_SEM_GESTOR[avisados === 0 ? 'nenhum' : 'semConfirmacao'];
        setAvisoSemGestor(resultado.faixa);
        showWarning(
          resultado.titulo,
          location
            ? `${resultado.corpo} Ligue agora pelos botões abaixo.`
            : `${resultado.corpo} Ligue agora pelos botões abaixo e diga onde você está.`,
        );
      } else if (location) {
        setAvisoSemGestor(null);
        showSuccess(
          'SOS Enviado',
          'Seu gestor foi notificado da emergência. Se precisar de ajuda imediata, use os botões de ligação abaixo.',
        );
      } else {
        setAvisoSemGestor(null);
        // Omitir isso aqui seria a mesma mentira da confirmação, uma tela
        // depois: o motorista precisa saber que ninguém sabe onde ele está.
        showSuccess(
          'SOS enviado sem localização',
          'Seu gestor foi notificado, mas não recebeu sua localização. Use os botões de ligação abaixo para dizer onde você está.',
        );
      }

      setDescricao('');
    } catch (error) {
      logger.error('Erro ao enviar SOS:', error);
      // Sem rede ou com erro do servidor, nenhum gestor foi confirmado: a
      // faixa e o destaque dos botões valem aqui tanto quanto com 0 avisados.
      setAvisoSemGestor(AVISO_SEM_GESTOR.falhaNoEnvio.faixa);
      showError({
        title: AVISO_SEM_GESTOR.falhaNoEnvio.titulo,
        message: AVISO_SEM_GESTOR.falhaNoEnvio.corpo,
      });
    } finally {
      setEnviando(false);
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
          {/*
            Mesma regra do diálogo de confirmação: a promessa muda com o FATO,
            não com a intenção.

            Este subtítulo era fixo e prometia "enviar sua localização" mesmo na
            tela que já mostrava, logo abaixo, "o gestor não vai saber onde você
            está". Duas afirmações opostas no mesmo lugar — e quem está numa
            emergência lê o botão, não a linha de status. O #492 corrigiu o
            diálogo e deixou esta para trás; verificado no aparelho em
            08/09/2026, com a permissão de localização negada.
          */}
          <Text style={styles.emergencySubtext}>
            {location
              ? 'Toque para notificar seu gestor e enviar sua localização'
              : 'Toque para notificar seu gestor. Sem localização, descreva onde você está no campo acima.'}
          </Text>
        </View>

        {/* Campo de Descrição */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Descreva a situação (opcional)
          </Text>
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
              <Text style={styles.locationLoadingText}>
                Obtendo localização...
              </Text>
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
                  {location.latitude.toFixed(6)},{' '}
                  {location.longitude.toFixed(6)}
                </Text>
                <Text style={styles.locationHint}>Toque para ver no mapa</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.locationUnavailable}>
              <Text style={styles.locationError}>
                {permissao && !permissao.concedida
                  ? 'Sem permissão de localização. O gestor não vai saber onde você está.'
                  : 'Localização ainda não disponível. O SOS funciona mesmo assim.'}
              </Text>
              <TouchableOpacity
                style={styles.locationRetry}
                onPress={tentarLocalizacaoDeNovo}
                accessibilityRole="button"
                accessibilityLabel={
                  permissao && !permissao.concedida
                    ? 'Liberar acesso à localização'
                    : 'Tentar obter a localização de novo'
                }
              >
                <Text style={styles.locationRetryText}>
                  {permissao && !permissao.concedida
                    ? 'Liberar acesso'
                    : 'Tentar de novo'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Contatos de Emergência */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ligação de Emergência</Text>
          {avisoSemGestor && (
            <View style={styles.avisoSemGestor} accessibilityRole="alert">
              <Text style={styles.avisoSemGestorTexto}>{avisoSemGestor}</Text>
            </View>
          )}
          <View style={styles.contactsList}>
            {EMERGENCY_CONTACTS.map((contact) => (
              <TouchableOpacity
                key={contact.id}
                testID={`contato-emergencia-${contact.id}`}
                style={[
                  styles.contactItem,
                  contact.id === 'gestor' && styles.contactItemGestor,
                  avisoSemGestor && styles.contactItemDestaque,
                ]}
                onPress={() => handleEmergencyCall(contact.id, contact.number)}
              >
                <Text style={styles.contactIcon}>{contact.icon}</Text>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactLabel}>{contact.label}</Text>
                  <Text style={styles.contactDescription}>
                    {contact.description}
                  </Text>
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
            • Em caso de acidente, ligue primeiro para o SAMU (192){'\n'}• Se
            estiver em perigo, ligue para a Polícia (190){'\n'}• Mantenha a
            calma e informe sua localização{'\n'}• Não saia do veículo em
            rodovias movimentadas
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
  locationUnavailable: {
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.md,
  },
  locationRetry: {
    alignSelf: 'flex-start',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.blue50,
    borderRadius: theme.borderRadius.md,
  },
  locationRetryText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
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
  // Sem gestor avisado, ligar é o único caminho: os botões ganham o destaque.
  contactItemDestaque: {
    borderWidth: 2,
    borderColor: theme.colors.error,
  },
  avisoSemGestor: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.errorBg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  avisoSemGestorTexto: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.error,
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
