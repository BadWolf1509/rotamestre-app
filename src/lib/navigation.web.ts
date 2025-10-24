import { Alert } from 'react-native';

/**
 * Interface para representar coordenadas de uma parada
 */
export interface Coordenadas {
  latitude: number;
  longitude: number;
  endereco?: string;
}

/**
 * Versão WEB da função abrirNavegacao
 * Abre Google Maps diretamente no navegador
 */
export function abrirNavegacao(coords: Coordenadas) {
  // Validar coordenadas
  if (!coords.latitude || !coords.longitude) {
    Alert.alert(
      'Coordenadas Inválidas',
      'Não foi possível obter a localização desta parada.'
    );
    return;
  }

  // Abrir Google Maps na web
  const url = `https://www.google.com/maps/dir/?api=1&destination=${coords.latitude},${coords.longitude}`;

  window.open(url, '_blank');
}

/**
 * Versão web - não implementado (não faz sentido escolher app na web)
 */
export async function abrirNavegacaoDireta(
  coords: Coordenadas,
  appPreferido: 'waze' | 'google' | 'apple'
): Promise<boolean> {
  abrirNavegacao(coords);
  return true;
}

/**
 * Versão web - sempre retorna true (sempre pode abrir Google Maps)
 */
export async function verificarAppInstalado(
  app: 'waze' | 'google' | 'apple'
): Promise<boolean> {
  return true;
}

/**
 * Versão web - abre rota completa no Google Maps
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

  const url = `https://www.google.com/maps/dir/?api=1&origin=${origem.latitude},${origem.longitude}&destination=${destino.latitude},${destino.longitude}`;

  window.open(url, '_blank');
}
