import { Linking, Platform, Alert, ActionSheetIOS } from 'react-native';

import { logger } from '@/lib/logger';
import LocationTrackingService from '@/services/locationTracking';

/**
 * Tipo para preferência de app de navegação (usado no NavigationSettings)
 */
type NavAppPreference = 'waze' | 'google_maps' | 'apple_maps' | 'default';

/**
 * Mapeia preferência do usuário para formato interno
 */
function mapPreferenceToApp(pref: NavAppPreference): 'waze' | 'google' | 'apple' | null {
  switch (pref) {
    case 'waze':
      return 'waze';
    case 'google_maps':
      return 'google';
    case 'apple_maps':
      return 'apple';
    default:
      return null;
  }
}

/**
 * Interface para representar coordenadas de uma parada
 */
export interface Coordenadas {
  latitude: number;
  longitude: number;
  endereco?: string; // Opcional: para mostrar no título
}

/**
 * Interface para opções de navegação
 */
interface OpcaoNavegacao {
  nome: string;
  url: string;
  fallback: string | null;
  icone?: string; // Para usar com ícones customizados no futuro
}

/**
 * Gera URL de navegação para Waze
 */
function gerarUrlWaze(coords: Coordenadas): OpcaoNavegacao {
  return {
    nome: 'Waze',
    url: `waze://ul?ll=${coords.latitude},${coords.longitude}&navigate=yes`,
    fallback: `https://waze.com/ul?ll=${coords.latitude},${coords.longitude}&navigate=yes`,
    icone: '🚗',
  };
}

/**
 * Gera URL de navegação para Google Maps
 */
function gerarUrlGoogleMaps(coords: Coordenadas): OpcaoNavegacao {
  const url = Platform.select({
    ios: `comgooglemaps://?daddr=${coords.latitude},${coords.longitude}&directionsmode=driving`,
    android: `google.navigation:q=${coords.latitude},${coords.longitude}&mode=d`,
  }) || '';

  return {
    nome: 'Google Maps',
    url,
    fallback: `https://www.google.com/maps/dir/?api=1&destination=${coords.latitude},${coords.longitude}`,
    icone: '🗺️',
  };
}

/**
 * Gera URL de navegação para Apple Maps (iOS apenas)
 */
function gerarUrlAppleMaps(coords: Coordenadas): OpcaoNavegacao {
  return {
    nome: 'Apple Maps',
    url: `maps://app?daddr=${coords.latitude},${coords.longitude}`,
    fallback: null, // Apple Maps não tem versão web
    icone: '🍎',
  };
}

/**
 * Tenta abrir um app de navegação
 * Se o app não estiver instalado, abre a versão web (fallback)
 */
async function tentarAbrirApp(opcao: OpcaoNavegacao): Promise<boolean> {
  try {
    const supported = await Linking.canOpenURL(opcao.url);

    if (supported) {
      await Linking.openURL(opcao.url);
      return true;
    } else if (opcao.fallback) {
      // App não instalado, abrir versão web
      await Linking.openURL(opcao.fallback);
      return true;
    } else {
      Alert.alert(
        'App não instalado',
        `${opcao.nome} não está instalado neste dispositivo.`
      );
      return false;
    }
  } catch (error) {
    logger.error('[Navigation] Erro ao abrir navegação:', error);
    Alert.alert(
      'Erro',
      `Não foi possível abrir ${opcao.nome}. Tente novamente.`
    );
    return false;
  }
}

/**
 * Abre menu de escolha de app de navegação (iOS - ActionSheet nativo)
 */
function abrirMenuIOS(opcoes: OpcaoNavegacao[], coords: Coordenadas) {
  const opcaoNomes = opcoes.map((o) => `${o.icone} ${o.nome}`);

  ActionSheetIOS.showActionSheetWithOptions(
    {
      title: coords.endereco
        ? `Navegar para:\n${coords.endereco}`
        : 'Escolha o app de navegação:',
      options: [...opcaoNomes, 'Cancelar'],
      cancelButtonIndex: opcoes.length,
      userInterfaceStyle: 'light',
    },
    async (buttonIndex) => {
      if (buttonIndex < opcoes.length) {
        const opcaoSelecionada = opcoes[buttonIndex];
        await tentarAbrirApp(opcaoSelecionada);
      }
    }
  );
}

/**
 * Abre menu de escolha de app de navegação (Android - Alert com botões)
 */
function abrirMenuAndroid(opcoes: OpcaoNavegacao[], coords: Coordenadas) {
  Alert.alert(
    'Abrir navegação',
    coords.endereco
      ? `Navegar para:\n${coords.endereco}`
      : 'Escolha o app de navegação:',
    [
      ...opcoes.map((opcao) => ({
        text: `${opcao.icone} ${opcao.nome}`,
        onPress: () => tentarAbrirApp(opcao),
      })),
      { text: 'Cancelar', style: 'cancel' },
    ]
  );
}

/**
 * FUNÇÃO PRINCIPAL: Abre navegação para uma parada
 *
 * Se o usuário configurou um app preferido, abre diretamente nele.
 * Caso contrário, mostra menu de escolha com Waze, Google Maps e Apple Maps (iOS).
 * Se app não estiver instalado, abre versão web automaticamente.
 *
 * @param coords - Coordenadas da parada (latitude, longitude)
 *
 * @example
 * ```typescript
 * // Uso básico
 * abrirNavegacao({
 *   latitude: -23.5505,
 *   longitude: -46.6333
 * });
 *
 * // Com endereço (mostra no título)
 * abrirNavegacao({
 *   latitude: -23.5505,
 *   longitude: -46.6333,
 *   endereco: 'Av. Paulista, 1000 - São Paulo, SP'
 * });
 * ```
 */
export async function abrirNavegacao(coords: Coordenadas): Promise<void> {
  // Validar coordenadas
  if (!coords.latitude || !coords.longitude) {
    Alert.alert(
      'Coordenadas Inválidas',
      'Não foi possível obter a localização desta parada.'
    );
    return;
  }

  // Validar range de coordenadas
  if (
    coords.latitude < -90 ||
    coords.latitude > 90 ||
    coords.longitude < -180 ||
    coords.longitude > 180
  ) {
    Alert.alert(
      'Coordenadas Inválidas',
      'As coordenadas fornecidas estão fora do range válido.'
    );
    return;
  }

  // Verificar se há um app preferido configurado
  try {
    const prefs = await LocationTrackingService.getNavigationPreferences();
    const preferredNavApp = prefs.preferredNavApp as NavAppPreference | undefined;
    const appPreferido = preferredNavApp ? mapPreferenceToApp(preferredNavApp) : null;

    if (appPreferido) {
      // Usuário tem app preferido - abrir diretamente
      const sucesso = await abrirNavegacaoDireta(coords, appPreferido);
      if (sucesso) {
        return; // App abriu com sucesso
      }
      // Se falhou, continua para mostrar menu de escolha
    }
  } catch (error) {
    // Se falhar ao ler preferências, continua com comportamento padrão (menu)
    logger.warn('[Navigation] Erro ao ler preferências:', error);
  }

  // Comportamento padrão: mostrar menu de escolha
  mostrarMenuNavegacao(coords);
}

/**
 * Mostra o menu de escolha de app de navegação
 */
function mostrarMenuNavegacao(coords: Coordenadas): void {
  // Gerar opções de navegação
  const opcoes: OpcaoNavegacao[] = [
    gerarUrlWaze(coords),
    gerarUrlGoogleMaps(coords),
  ];

  // Adicionar Apple Maps apenas no iOS
  if (Platform.OS === 'ios') {
    opcoes.push(gerarUrlAppleMaps(coords));
  }

  // Abrir menu de escolha (diferente por plataforma)
  if (Platform.OS === 'ios') {
    abrirMenuIOS(opcoes, coords);
  } else {
    abrirMenuAndroid(opcoes, coords);
  }
}

/**
 * Abre navegação diretamente no app preferido (sem menu de escolha)
 * Útil para quando usuário já escolheu app padrão
 *
 * @param coords - Coordenadas da parada
 * @param appPreferido - 'waze' | 'google' | 'apple'
 */
export async function abrirNavegacaoDireta(
  coords: Coordenadas,
  appPreferido: 'waze' | 'google' | 'apple'
): Promise<boolean> {
  let opcao: OpcaoNavegacao;

  switch (appPreferido) {
    case 'waze':
      opcao = gerarUrlWaze(coords);
      break;
    case 'google':
      opcao = gerarUrlGoogleMaps(coords);
      break;
    case 'apple':
      opcao = gerarUrlAppleMaps(coords);
      break;
    default:
      opcao = gerarUrlGoogleMaps(coords);
  }

  return await tentarAbrirApp(opcao);
}

/**
 * Verifica se um app de navegação está instalado
 * Útil para mostrar/ocultar opções na UI
 *
 * @param app - 'waze' | 'google' | 'apple'
 * @returns Promise<boolean>
 */
export async function verificarAppInstalado(
  app: 'waze' | 'google' | 'apple'
): Promise<boolean> {
  let url: string;

  switch (app) {
    case 'waze':
      url = 'waze://';
      break;
    case 'google':
      url = Platform.select({
        ios: 'comgooglemaps://',
        android: 'google.navigation:q=0,0',
      }) || '';
      break;
    case 'apple':
      url = 'maps://';
      break;
    default:
      return false;
  }

  try {
    return await Linking.canOpenURL(url);
  } catch {
    return false;
  }
}

/**
 * Abre navegação para múltiplas paradas (rota completa)
 * Útil para abrir rota completa no Waze ou Google Maps
 *
 * NOTA: Apenas Waze e Google Maps suportam waypoints.
 * Apple Maps não suporta múltiplos waypoints via URL scheme.
 *
 * @param paradas - Array de coordenadas ordenadas
 */
export function abrirNavegacaoRotaCompleta(paradas: Coordenadas[]) {
  if (paradas.length < 2) {
    Alert.alert(
      'Rota Incompleta',
      'É necessário pelo menos 2 paradas para iniciar navegação.'
    );
    return;
  }

  const origem = paradas[0];
  const destino = paradas[paradas.length - 1];
  const opcoes: OpcaoNavegacao[] = [
    {
      nome: 'Waze',
      url: `waze://ul?ll=${origem.latitude},${origem.longitude}&navigate=yes`,
      fallback: `https://waze.com/ul?ll=${origem.latitude},${origem.longitude}&navigate=yes`,
      icone: '🚗',
    },
    {
      nome: 'Google Maps',
      url: Platform.select({
        ios: `comgooglemaps://?saddr=${origem.latitude},${origem.longitude}&daddr=${destino.latitude},${destino.longitude}&directionsmode=driving`,
        android: `google.navigation:q=${destino.latitude},${destino.longitude}&mode=d`,
      }) || '',
      fallback: `https://www.google.com/maps/dir/?api=1&origin=${origem.latitude},${origem.longitude}&destination=${destino.latitude},${destino.longitude}`,
      icone: '🗺️',
    },
  ];

  if (Platform.OS === 'ios') {
    abrirMenuIOS(opcoes, {
      latitude: origem.latitude,
      longitude: origem.longitude,
      endereco: `Rota com ${paradas.length} paradas`,
    });
  } else {
    abrirMenuAndroid(opcoes, {
      latitude: origem.latitude,
      longitude: origem.longitude,
      endereco: `Rota com ${paradas.length} paradas`,
    });
  }
}
