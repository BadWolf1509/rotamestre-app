# 🚀 MELHORIAS IMEDIATAS - RotaMestre

**Data:** 22/10/2025  
**Status:** Pendente  
**Prioridade:** 🔴 ALTA

---

## 📋 Visão Geral

Este documento contém o plano de ação detalhado para implementar as **TOP 11 melhorias mais urgentes** do sistema RotaMestre. As melhorias foram priorizadas com base no impacto na experiência do usuário e na qualidade do código.

**Tempo Estimado Total:** 5-6 dias de desenvolvimento
**Pré-requisito:** Development Build (react-native-maps para mapa mobile)

---

## 🎯 TOP 11 MELHORIAS IMEDIATAS

### ✅ Checklist Rápido

**Pré-requisito (OBRIGATÓRIO):**
- [ ] 0. **Setup Development Build** ← COMEÇAR AQUI

**Essenciais (1-8):**
- [ ] 1. Padronizar Cores (Design System)
- [ ] 2. Instalar e Configurar Fontes
- [ ] 3. **Adicionar Mapa Mobile com Navegação** ← PRIORIDADE ALTA
- [ ] 4. Criar Componente `<Button>`
- [ ] 5. Criar Componente `<Card>`
- [ ] 6. Implementar Skeleton Loading
- [ ] 7. Substituir Alerts por Toast/Snackbar
- [ ] 8. Adicionar Filtros no Dashboard

**Avançadas (9-11) - OPCIONAL:**
- [ ] 9. Criar Wizard de Criação de Rota
- [ ] 10. Adicionar Preview de Mapa na Criação
- [ ] 11. Criar Design Tokens Completos (BONUS)

---

## 0️⃣ PRÉ-REQUISITO: Development Build Setup

### 🎯 Objetivo
Configurar development build para suportar **react-native-maps** e habilitar mapa mobile com navegação.

### ⚠️ IMPORTANTE

**Este passo é OBRIGATÓRIO antes de implementar o Mapa (Melhoria #3).**

Sem development build:
- ❌ react-native-maps não funciona no Expo Go
- ❌ Mapa mobile não renderiza
- ❌ Motoristas não conseguem visualizar rotas

Com development build:
- ✅ Mapa funciona em iOS e Android
- ✅ Google Maps nativo integrado
- ✅ Navegação turn-by-turn disponível

### 📝 Passos de Configuração

#### 1. Instalar react-native-maps

```bash
npx expo install react-native-maps
```

#### 2. Configurar app.json

Adicionar plugin react-native-maps e API keys:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-maps",
        {
          "enableGoogleMaps": true
        }
      ]
    ],
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "AIza..."  // Sua chave do Google Maps
        }
      }
    },
    "ios": {
      "config": {
        "googleMapsApiKey": "AIza..."  // Mesma chave ou chave iOS separada
      }
    }
  }
}
```

#### 3. Habilitar APIs no Google Cloud Console

Acesse: https://console.cloud.google.com/apis/library

**APIs necessárias:**
- ✅ Maps SDK for Android
- ✅ Maps SDK for iOS
- ✅ Directions API (para navegação)
- ✅ Geocoding API (se usar busca de endereços)

**Configurar restrições de API Key:**
```
Tipo: Aplicativos Android/iOS
Pacote Android: br.tec.rotamestre
Bundle iOS: br.tec.rotamestre
```

#### 4. Gerar Código Nativo (Prebuild)

```bash
# Limpar build anterior (se existir)
rm -rf android ios

# Gerar código nativo
npx expo prebuild --clean
```

**O que acontece:**
- Cria pastas `android/` e `ios/` com código nativo
- Aplica plugins configurados (react-native-maps)
- Vincula dependências nativas

#### 5. Rodar Development Build

**Android:**
```bash
# Device físico conectado via USB
npx expo run:android

# Ou emulador Android Studio
npx expo run:android --device
```

**iOS (Requer Mac):**
```bash
# Simulador
npx expo run:ios

# Device físico
npx expo run:ios --device
```

**Web (continua funcionando):**
```bash
npm run web
```

### ✅ Validação

Após rodar `npx expo run:android`, validar:

1. **App abre sem crash**
   - Tela de login aparece
   - Não há erro vermelho

2. **Metro bundler conectado**
   - Console mostra: "Bundling complete"
   - Hot reload funciona (Ctrl+S recarrega)

3. **Pronto para próximo passo**
   - Development build rodando
   - Pode implementar MapaRN.tsx

### 🐛 Troubleshooting

**Erro: "Android SDK not found"**
```bash
# Instalar Android Studio
# Configurar ANDROID_HOME no .bashrc/.zshrc
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

**Erro: "Unable to resolve module react-native-maps"**
```bash
# Limpar cache Metro
npx expo start -c

# Reinstalar dependências
rm -rf node_modules
npm install
```

**Erro: "Google Play Services not available"**
- Usar device físico (não emulador antigo)
- Ou atualizar Google Play no emulador

### 📊 Tempo Estimado

- **Instalação:** 30 minutos
- **Configuração:** 30 minutos
- **Primeiro build:** 30-60 minutos (download de dependências)
- **Validação:** 15 minutos

**Total:** 2-3 horas

### ✅ Critério de Conclusão

- [ ] `npx expo install react-native-maps` executado
- [ ] app.json configurado com plugin e API keys
- [ ] Google Cloud Console: APIs habilitadas
- [ ] `npx expo prebuild --clean` executado
- [ ] `npx expo run:android` rodando sem erros
- [ ] App abre e mostra tela de login
- [ ] Metro bundler conectado (hot reload funciona)

---

## 1️⃣ Padronizar Cores (Design System)

### 🎯 Objetivo
Criar um sistema de cores centralizado e substituir todas as cores hardcoded no código.

### 📁 Arquivos a Criar

#### `src/styles/colors.ts`

```typescript
/**
 * Sistema de Cores - RotaMestre
 * Alinhado com identidade visual do Mestre da Obra
 */

export const colors = {
  // ===== CORES PRIMÁRIAS =====
  primary: {
    main: '#1e5aa8',      // Azul RotaMestre (principal)
    dark: '#0D5A9C',      // Azul escuro (header, elementos importantes)
    light: '#4a90e2',     // Azul claro (hover, active states) - Alinhado com Brand Guidelines
  },

  // ===== CORES SECUNDÁRIAS =====
  secondary: {
    main: '#f7a02a',      // Laranja RotaMestre (alinhado com Mestre da Obra)
    dark: '#e68a00',      // Laranja escuro (hover)
    light: '#ffb84d',     // Laranja claro (backgrounds)
  },

  // ===== CORES SEMÂNTICAS (Status) =====
  status: {
    success: '#10b981',   // Verde - Concluído, Sucesso
    warning: '#f59e0b',   // Amarelo - Pendente, Atenção
    error: '#ef4444',     // Vermelho - Erro, Cancelado, Perigo
    info: '#3b82f6',      // Azul - Informação
  },

  // ===== CORES DE STATUS DE ROTA =====
  routeStatus: {
    pending: '#f59e0b',       // Pendente
    inProgress: '#3b82f6',    // Em Andamento
    completed: '#10b981',     // Concluída
    cancelled: '#ef4444',     // Cancelada
  },

  // ===== ESCALA DE CINZAS =====
  gray: {
    50: '#f9fafb',   // Background muito claro
    100: '#f3f4f6',  // Background claro
    200: '#e5e7eb',  // Borders, divisores
    300: '#d1d5db',  // Borders mais escuros
    400: '#9ca3af',  // Texto desabilitado
    500: '#6b7280',  // Texto secundário
    600: '#4b5563',  // Texto normal
    700: '#374151',  // Texto escuro
    800: '#1f2937',  // Texto muito escuro
    900: '#111827',  // Texto preto
  },

  // ===== CORES BASE =====
  white: '#ffffff',
  black: '#000000',

  // ===== BACKGROUNDS =====
  background: {
    primary: '#ffffff',   // Fundo principal
    secondary: '#f9fafb', // Fundo secundário
    tertiary: '#f3f4f6',  // Fundo terciário
  },

  // ===== BORDERS =====
  border: {
    light: '#e5e7eb',
    medium: '#d1d5db',
    dark: '#9ca3af',
  },

  // ===== OVERLAYS =====
  overlay: {
    light: 'rgba(0, 0, 0, 0.1)',
    medium: 'rgba(0, 0, 0, 0.5)',
    dark: 'rgba(0, 0, 0, 0.8)',
  },
};

export type Colors = typeof colors;
```

### 📝 Tarefas

1. **Criar arquivo `src/styles/colors.ts`** com o código acima
2. **Substituir todas as cores hardcoded:**
   - Buscar por `'#` no projeto
   - Substituir por `colors.*`
   
**Exemplo de substituição:**

```typescript
// ❌ ANTES (hardcoded)
backgroundColor: '#2563eb'
color: '#6b7280'

// ✅ DEPOIS (usando theme)
import { colors } from '@/styles/colors';

backgroundColor: colors.primary.main
color: colors.gray.500
```

3. **Arquivos prioritários para refatorar:**
   - `app/auth/login.tsx`
   - `app/gestor/dashboard.tsx`
   - `app/motorista/rota.tsx`
   - `app/gestor/_layout.tsx`
   - `app/motorista/_layout.tsx`

### ✅ Critério de Conclusão
- [ ] Arquivo `colors.ts` criado
- [ ] Pelo menos 80% das cores hardcoded substituídas
- [ ] App compila sem erros
- [ ] Cores visuais permanecem consistentes

---

## 2️⃣ Instalar e Configurar Fontes

### 🎯 Objetivo
Implementar as fontes Viga e Nunito Sans para dar identidade visual ao app.

### 📦 Instalação

```bash
# Instalar dependências de fontes (Viga + Nunito Sans)
npx expo install expo-font @expo-google-fonts/viga @expo-google-fonts/nunito-sans
```

### 📁 Arquivos a Criar/Modificar

#### `src/styles/typography.ts`

```typescript
/**
 * Sistema de Tipografia - RotaMestre
 * Fontes: Viga (display) + Nunito Sans (interface)
 */

export const typography = {
  // ===== FAMÍLIAS DE FONTE =====
  fontFamily: {
    primary: 'Nunito Sans',        // Interface principal (90%)
    display: 'Viga',               // Títulos grandes
    system: '-apple-system, BlinkMacSystemFont, sans-serif', // Fallback
  },

  // ===== TAMANHOS =====
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 36,
  },

  // ===== PESOS (Nunito Sans suporta) =====
  fontWeight: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },

  // ===== LINE HEIGHTS =====
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },

  // ===== ESTILOS PRÉ-DEFINIDOS =====
  styles: {
    // Título de tela (Dashboard, Nova Rota)
    h1: {
      fontFamily: 'Viga',
      fontSize: 28,
      fontWeight: '400', // Viga já é naturalmente bold
      lineHeight: 36,
    },

    // Subtítulo de seção
    h2: {
      fontFamily: 'Nunito Sans',
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 28,
    },

    // Card headers
    h3: {
      fontFamily: 'Nunito Sans',
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 24,
    },

    // Corpo de texto
    body: {
      fontFamily: 'Nunito Sans',
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 20,
    },

    // Textos pequenos
    caption: {
      fontFamily: 'Nunito Sans',
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 16,
    },

    // Botões
    button: {
      fontFamily: 'Nunito Sans',
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 24,
    },
  },
};

export type Typography = typeof typography;
```

#### Modificar `app/_layout.tsx`

```typescript
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Font from 'expo-font';
import {
  NunitoSans_400Regular,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
} from '@expo-google-fonts/nunito-sans';
import { Viga_400Regular } from '@expo-google-fonts/viga';

export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    loadFonts();
  }, []);

  async function loadFonts() {
    try {
      await Font.loadAsync({
        'Nunito Sans': NunitoSans_400Regular,
        'Nunito Sans SemiBold': NunitoSans_600SemiBold,
        'Nunito Sans Bold': NunitoSans_700Bold,
        'Viga': Viga_400Regular, // ✅ Fonte display para títulos grandes
      });
      setFontsLoaded(true);
    } catch (error) {
      console.error('Erro ao carregar fontes:', error);
    }
  }

  if (!fontsLoaded) {
    return null; // Ou um splash screen
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1e5aa8', // Usar colors depois
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontFamily: 'Nunito Sans Bold',
        },
        headerShown: false,
      }}
    >
      {/* ... resto do código */}
    </Stack>
  );
}
```

### 📝 Tarefas

1. **Instalar pacotes do Expo Font**
2. **Criar `typography.ts`**
3. **Modificar `_layout.tsx` para carregar fontes**
4. **Aplicar em componentes prioritários:**
   - Títulos de tela: usar `typography.styles.h1`
   - Botões: usar `typography.styles.button`
   - Textos: usar `typography.styles.body`

### ✅ Critério de Conclusão
- [ ] Pacotes instalados
- [ ] Fontes carregando sem erro
- [ ] Tipografia aplicada em pelo menos 3 telas
- [ ] Visual atualizado com fontes corretas

---

## 3️⃣ Adicionar Mapa Mobile com Navegação

### 🎯 Objetivo
Implementar mapa **mobile e web** com navegação de rotas para motoristas.

### ✅ MAPA MOBILE COM NAVEGAÇÃO

**Pré-requisito:** Development Build Setup (Melhoria #0) ✅

**Funcionalidades:**
- ✅ Mapa em iOS, Android e Web
- ✅ Visualização de rota otimizada (Google Directions API)
- ✅ Marcadores de paradas numerados
- ✅ Polyline conectando paradas
- ✅ Botão "🧭 Iniciar Navegação" (abre Google Maps nativo)
- ✅ Cálculo automático de distância e tempo

### 🏗️ Arquitetura

```
┌──────────────────────────────────────┐
│ MapaRotas.tsx (Wrapper)              │
├──────────────────────────────────────┤
│ Platform.OS === 'web'                │
│   → MapaWeb.tsx (Google Maps JS)     │
│                                      │
│ Platform.OS !== 'web'                │
│   → MapaRN.tsx (react-native-maps)   │
│     + Google Directions API          │
│     + Botão Navegação                │
└──────────────────────────────────────┘
```

### 📁 Arquivos a Criar

#### 1. `src/components/MapaRN.tsx` (React Native Maps)

```typescript
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Linking, Platform, Alert } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { colors } from '@/styles/colors';

interface Parada {
  id: string;
  endereco: string;
  latitude: number;
  longitude: number;
  ordem: number;
  status: string;
}

interface MapaRNProps {
  paradas: Parada[];
  rotaAtiva?: boolean;
}

export function MapaRN({ paradas, rotaAtiva = false }: MapaRNProps) {
  const [directions, setDirections] = useState<{latitude: number; longitude: number}[]>([]);
  const [distancia, setDistancia] = useState<string>('');
  const [duracao, setDuracao] = useState<string>('');

  useEffect(() => {
    if (paradas.length >= 2) {
      fetchDirections();
    }
  }, [paradas]);

  async function fetchDirections() {
    try {
      const origem = paradas[0];
      const destino = paradas[paradas.length - 1];
      const waypoints = paradas.slice(1, -1);

      const waypointsParam = waypoints.length > 0
        ? `&waypoints=${waypoints.map(w => `${w.latitude},${w.longitude}`).join('|')}`
        : '';

      const url =
        `https://maps.googleapis.com/maps/api/directions/json?` +
        `origin=${origem.latitude},${origem.longitude}` +
        `&destination=${destino.latitude},${destino.longitude}` +
        `${waypointsParam}` +
        `&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];

        // Decodificar polyline
        const points = decodePolyline(route.overview_polyline.points);
        setDirections(points);

        // Extrair distância e tempo
        setDistancia(route.legs.reduce((acc, leg) => acc + leg.distance.value, 0) / 1000 + ' km');
        setDuracao(Math.ceil(route.legs.reduce((acc, leg) => acc + leg.duration.value, 0) / 60) + ' min');
      }
    } catch (error) {
      console.error('Erro ao buscar direções:', error);
    }
  }

  // Decode Google Polyline
  function decodePolyline(encoded: string) {
    const points: {latitude: number; longitude: number}[] = [];
    let index = 0, lat = 0, lng = 0;

    while (index < encoded.length) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  }

  async function handleIniciarNavegacao() {
    const origem = paradas[0];
    const destino = paradas[paradas.length - 1];

    const url = Platform.select({
      ios: `maps://app?saddr=${origem.latitude},${origem.longitude}&daddr=${destino.latitude},${destino.longitude}`,
      android: `google.navigation:q=${destino.latitude},${destino.longitude}&mode=d`,
    });

    if (!url) return;

    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Erro', 'Google Maps não está instalado no dispositivo.');
    }
  }

  if (paradas.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Nenhuma parada para exibir</Text>
      </View>
    );
  }

  const region = {
    latitude: paradas[0].latitude,
    longitude: paradas[0].longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
      >
        {/* Marcadores de Paradas */}
        {paradas.map((parada, index) => (
          <Marker
            key={parada.id}
            coordinate={{
              latitude: parada.latitude,
              longitude: parada.longitude,
            }}
            title={`Parada ${parada.ordem}`}
            description={parada.endereco}
            pinColor={parada.status === 'concluida' ? colors.status.success : colors.primary.main}
          >
            <View style={styles.markerContainer}>
              <View style={[
                styles.marker,
                parada.status === 'concluida' && styles.markerConcluida
              ]}>
                <Text style={styles.markerText}>{parada.ordem}</Text>
              </View>
            </View>
          </Marker>
        ))}

        {/* Polyline da Rota */}
        {directions.length > 0 && (
          <Polyline
            coordinates={directions}
            strokeColor={colors.primary.main}
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Info da Rota */}
      {(distancia || duracao) && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            📍 {distancia} · ⏱️ {duracao}
          </Text>
        </View>
      )}

      {/* Botão Iniciar Navegação */}
      {rotaAtiva && (
        <TouchableOpacity
          style={styles.botaoNavegar}
          onPress={handleIniciarNavegacao}
          activeOpacity={0.8}
        >
          <Text style={styles.botaoTexto}>🧭 Iniciar Navegação</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
  },
  emptyText: {
    fontSize: 16,
    color: colors.gray[500],
  },
  markerContainer: {
    alignItems: 'center',
  },
  marker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  markerConcluida: {
    backgroundColor: colors.status.success,
  },
  markerText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  infoBox: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: colors.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    fontSize: 14,
    color: colors.gray[700],
    textAlign: 'center',
  },
  botaoNavegar: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: colors.secondary.main,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  botaoTexto: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
```

#### 2. `src/components/MapaRotas.tsx` (Wrapper Multiplataforma)

```typescript
import React from 'react';
import { Platform } from 'react-native';
import { MapaWeb } from './MapaWeb';
import { MapaRN } from './MapaRN';

interface Parada {
  id: string;
  endereco: string;
  latitude: number;
  longitude: number;
  ordem: number;
  status: string;
}

interface MapaRotasProps {
  paradas: Parada[];
  rotaAtiva?: boolean;
}

/**
 * Componente de mapa multiplataforma
 * - Web: Usa MapaWeb.tsx (Google Maps JavaScript API)
 * - Mobile: Usa MapaRN.tsx (react-native-maps)
 */
export function MapaRotas(props: MapaRotasProps) {
  if (Platform.OS === 'web') {
    // Transformar para formato do MapaWeb
    const { paradas } = props;
    const origem = paradas[0] ? { latitude: paradas[0].latitude, longitude: paradas[0].longitude } : undefined;
    const destino = paradas[paradas.length - 1]
      ? { latitude: paradas[paradas.length - 1].latitude, longitude: paradas[paradas.length - 1].longitude }
      : undefined;
    const waypoints = paradas.slice(1, -1).map(p => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));

    if (!origem || !destino) return null;

    return <MapaWeb origem={origem} destino={destino} waypoints={waypoints} />;
  }

  return <MapaRN {...props} />;
}
```

#### 3. Atualizar `app/motorista/rota.tsx`

```typescript
import { MapaRotas } from '@/components/MapaRotas'; // ✅ ADICIONAR

export default function RotaMotorista() {
  const [mapaVisivel, setMapaVisivel] = useState(false);
  // ... resto do código existente ...

  return (
    <ScrollView style={styles.container}>
      {/* Header existente */}

      {/* Botão Toggle Mapa/Lista */}
      {paradas.length > 0 && (
        <TouchableOpacity
          style={styles.mapToggleButton}
          onPress={() => setMapaVisivel(!mapaVisivel)}
        >
          <Text style={styles.mapToggleText}>
            {mapaVisivel ? '📋 Ver Lista' : '🗺️ Ver Mapa'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Mapa (quando visível) */}
      {mapaVisivel && (
        <View style={styles.mapContainer}>
          <MapaRotas
            paradas={paradas}
            rotaAtiva={rota.status === 'em_andamento'}
          />
        </View>
      )}

      {/* Lista (quando mapa não visível) */}
      {!mapaVisivel && (
        <>
          {/* Info da Rota e Lista de Paradas existentes */}
        </>
      )}
    </ScrollView>
  );
}
```

### 📝 Tarefas

1. **Criar `src/components/MapaRN.tsx`** - Mapa mobile com react-native-maps
2. **Criar `src/components/MapaRotas.tsx`** - Wrapper multiplataforma
3. **Atualizar `app/motorista/rota.tsx`** - Integrar componente
4. **Habilitar Directions API** no Google Cloud Console
5. **Testar navegação** em device físico Android/iOS

### ✅ Critério de Conclusão

- [ ] MapaRN.tsx criado e compilando
- [ ] MapaRotas.tsx criado (wrapper)
- [ ] Mapa renderiza em Android/iOS (development build)
- [ ] Marcadores numerados aparecem
- [ ] Polyline azul conecta as paradas
- [ ] Info de distância/tempo calculada
- [ ] Botão "Iniciar Navegação" abre Google Maps nativo
- [ ] Web continua usando MapaWeb.tsx
- [ ] Toggle Mapa/Lista funcionando

---

## 4️⃣ Criar Componente `<Button>`

### 🎯 Objetivo
Criar componente reutilizável de botão com variantes para eliminar duplicação.

### 📁 Arquivo a Criar

`src/components/Button.tsx`

```typescript
import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/styles/colors';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? colors.primary.main : colors.white}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={size === 'small' ? 16 : size === 'large' ? 24 : 20}
              color={
                variant === 'outline' || variant === 'ghost'
                  ? colors.primary.main
                  : colors.white
              }
              style={styles.iconLeft}
            />
          )}
          <Text style={[styles.text, styles[`${variant}Text`], styles[`${size}Text`], textStyle]}>
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <Ionicons
              name={icon}
              size={size === 'small' ? 16 : size === 'large' ? 24 : 20}
              color={
                variant === 'outline' || variant === 'ghost'
                  ? colors.primary.main
                  : colors.white
              }
              style={styles.iconRight}
            />
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    minHeight: 44, // Acessibilidade
  },
  
  // Variantes
  primary: {
    backgroundColor: colors.primary.main,
  },
  secondary: {
    backgroundColor: colors.secondary.main,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary.main,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.status.error,
  },
  
  // Tamanhos
  small: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  medium: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  large: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  
  // Textos
  text: {
    fontWeight: '600',
  },
  primaryText: {
    color: colors.white,
    fontSize: 16,
  },
  secondaryText: {
    color: colors.white,
    fontSize: 16,
  },
  outlineText: {
    color: colors.primary.main,
    fontSize: 16,
  },
  ghostText: {
    color: colors.primary.main,
    fontSize: 16,
  },
  dangerText: {
    color: colors.white,
    fontSize: 16,
  },
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },
  
  // Estados
  disabled: {
    opacity: 0.5,
  },
  fullWidth: {
    width: '100%',
  },
  
  // Ícones
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
```

### 📝 Tarefas de Refatoração

**Substituir botões existentes:**

```typescript
// ❌ ANTES
<TouchableOpacity
  style={styles.button}
  onPress={handleLogin}
  disabled={loading}
>
  {loading ? (
    <ActivityIndicator color="#fff" />
  ) : (
    <Text style={styles.buttonText}>Entrar</Text>
  )}
</TouchableOpacity>

// ✅ DEPOIS
import { Button } from '@/components/Button';

<Button
  title="Entrar"
  onPress={handleLogin}
  loading={loading}
/>
```

**Arquivos para refatorar:**
1. `app/auth/login.tsx` - Botão de login
2. `app/gestor/dashboard.tsx` - Ações rápidas
3. `app/motorista/rota.tsx` - Botão iniciar rota

### ✅ Critério de Conclusão
- [ ] Componente `Button.tsx` criado
- [ ] Pelo menos 5 botões substituídos
- [ ] Todas as variantes funcionando
- [ ] Loading e disabled funcionando

---

## 5️⃣ Criar Componente `<Card>`

### 🎯 Objetivo
Padronizar containers/cards usados em todo o app.

### 📁 Arquivo a Criar

`src/components/Card.tsx`

```typescript
import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { colors } from '@/styles/colors';

interface CardProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'outlined' | 'filled';
  padding?: 'none' | 'small' | 'medium' | 'large';
  onPress?: () => void;
  style?: ViewStyle;
}

export function Card({
  children,
  variant = 'elevated',
  padding = 'medium',
  onPress,
  style,
}: CardProps) {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={[
        styles.card,
        styles[variant],
        styles[`padding${padding.charAt(0).toUpperCase() + padding.slice(1)}` as keyof typeof styles],
        style,
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {children}
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  
  // Variantes
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  outlined: {
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  filled: {
    backgroundColor: colors.background.secondary,
  },
  
  // Paddings
  paddingNone: {
    padding: 0,
  },
  paddingSmall: {
    padding: 12,
  },
  paddingMedium: {
    padding: 16,
  },
  paddingLarge: {
    padding: 20,
  },
});
```

### 📝 Tarefas de Refatoração

```typescript
// ❌ ANTES
<View style={styles.rotaCard}>
  <View style={styles.rotaHeader}>
    <Text style={styles.rotaMotorista}>{rota.motorista_nome}</Text>
  </View>
</View>

// ✅ DEPOIS
import { Card } from '@/components/Card';

<Card onPress={() => handleRotaPress(rota.id)}>
  <View style={styles.rotaHeader}>
    <Text style={styles.rotaMotorista}>{rota.motorista_nome}</Text>
  </View>
</Card>
```

**Arquivos para refatorar:**
1. `app/gestor/dashboard.tsx` - Cards de estatísticas e rotas
2. `app/motorista/rota.tsx` - Card de info e paradas
3. Qualquer outro lugar com estrutura de card

### ✅ Critério de Conclusão
- [ ] Componente `Card.tsx` criado
- [ ] Pelo menos 10 cards substituídos
- [ ] Sombras e bordas consistentes
- [ ] Variantes funcionando

---

## 6️⃣ Implementar Skeleton Loading

### 🎯 Objetivo
Substituir tela branca de loading por placeholders animados.

### 📁 Arquivo a Criar

`src/components/SkeletonLoader.tsx`

```typescript
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { colors } from '@/styles/colors';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 4, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

// Componentes específicos
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <Skeleton width={60} height={60} borderRadius={30} style={{ marginBottom: 12 }} />
      <Skeleton width="80%" height={20} style={{ marginBottom: 8 }} />
      <Skeleton width="60%" height={16} />
    </View>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  // ⚠️ PERFORMANCE: Limitar a 7 skeletons para evitar lag em dispositivos antigos
  const safeCount = Math.min(count, 7);

  return (
    <View>
      {Array.from({ length: safeCount }).map((_, i) => (
        <View key={i} style={styles.listItem}>
          <Skeleton width={40} height={40} borderRadius={8} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Skeleton width="70%" height={16} style={{ marginBottom: 8 }} />
            <Skeleton width="50%" height={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function SkeletonDashboard() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Skeleton width={150} height={24} style={{ marginBottom: 8 }} />
        <Skeleton width={100} height={16} />
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.statCard}>
            <Skeleton width={50} height={40} style={{ marginBottom: 8 }} />
            <Skeleton width={60} height={14} />
          </View>
        ))}
      </View>

      {/* List */}
      <SkeletonList count={5} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.gray[200],
  },
  card: {
    padding: 16,
    backgroundColor: colors.white,
    borderRadius: 12,
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: colors.white,
    borderRadius: 12,
    marginBottom: 12,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.white,
    borderRadius: 12,
    alignItems: 'center',
  },
});
```

### 📝 Tarefas de Implementação

**Substituir loading em `app/gestor/dashboard.tsx`:**

```typescript
// ❌ ANTES
if (loading) {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#0D5A9C" />
      <Text>Carregando...</Text>
    </View>
  );
}

// ✅ DEPOIS
import { SkeletonDashboard } from '@/components/SkeletonLoader';

if (loading) {
  return <SkeletonDashboard />;
}
```

**Arquivos para aplicar:**
1. `app/gestor/dashboard.tsx`
2. `app/motorista/rota.tsx`
3. `app/gestor/historico.tsx`

### 📊 Nota de Performance

**Boas Práticas:**
```typescript
// ✅ BOM: Poucos skeletons (3-5 itens)
<SkeletonList count={3} />

// ⚠️ ATENÇÃO: Muitos skeletons podem causar lag em dispositivos antigos
<SkeletonList count={20} />  // Evitar!

// 💡 SOLUÇÃO: O componente já limita automaticamente a 7 itens
<SkeletonList count={100} />  // Renderiza apenas 7
```

**Por quê limitar:**
- Cada skeleton tem animação Animated.loop
- Múltiplas animações simultâneas = alto uso de CPU
- Dispositivos antigos podem ter lag perceptível
- 5-7 skeletons são suficientes para indicar carregamento

### ✅ Critério de Conclusão
- [ ] Componente criado com animação
- [ ] Pelo menos 3 telas com skeleton
- [ ] Animação suave (shimmer)
- [ ] Não há mais tela branca de loading
- [ ] Performance testada (sem lag com 5-7 skeletons)

---

## 7️⃣ Substituir Alerts por Toast/Snackbar

### 🎯 Objetivo
Substituir `Alert.alert` intrusivo por feedback não-bloqueante.

### 📦 Instalação

```bash
npm install react-native-toast-message
```

### 📁 Implementação

#### Modificar `app/_layout.tsx`

```typescript
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
import { colors } from '@/styles/colors';

// ✅ Configuração customizada para alinhar com Brand Guidelines
const toastConfig = {
  success: (props: any) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: colors.status.success }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'Nunito Sans Bold',
      }}
      text2Style={{
        fontSize: 14,
        fontFamily: 'Nunito Sans',
      }}
    />
  ),
  error: (props: any) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: colors.status.error }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'Nunito Sans Bold',
      }}
      text2Style={{
        fontSize: 14,
        fontFamily: 'Nunito Sans',
      }}
    />
  ),
  info: (props: any) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: colors.status.info }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'Nunito Sans Bold',
      }}
      text2Style={{
        fontSize: 14,
        fontFamily: 'Nunito Sans',
      }}
    />
  ),
  warning: (props: any) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: colors.status.warning }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'Nunito Sans Bold',
      }}
      text2Style={{
        fontSize: 14,
        fontFamily: 'Nunito Sans',
      }}
    />
  ),
};

export default function RootLayout() {
  return (
    <>
      <Stack>
        {/* ... screens ... */}
      </Stack>

      {/* ✅ ADICIONAR Toast no final com config customizado */}
      <Toast config={toastConfig} />
    </>
  );
}
```

#### Criar utilitário `src/utils/toast.ts`

```typescript
import Toast from 'react-native-toast-message';

export const toast = {
  success: (message: string, title?: string) => {
    Toast.show({
      type: 'success',
      text1: title || 'Sucesso!',
      text2: message,
      position: 'top',
      visibilityTime: 3000,
    });
  },

  error: (message: string, title?: string) => {
    Toast.show({
      type: 'error',
      text1: title || 'Erro',
      text2: message,
      position: 'top',
      visibilityTime: 4000,
    });
  },

  info: (message: string, title?: string) => {
    Toast.show({
      type: 'info',
      text1: title || 'Informação',
      text2: message,
      position: 'top',
      visibilityTime: 3000,
    });
  },

  warning: (message: string, title?: string) => {
    Toast.show({
      type: 'warning',
      text1: title || 'Atenção',
      text2: message,
      position: 'top',
      visibilityTime: 3500,
    });
  },
};
```

### 📝 Tarefas de Refatoração

```typescript
// ❌ ANTES
Alert.alert('Erro', 'Não foi possível carregar');

// ✅ DEPOIS
import { toast } from '@/utils/toast';

toast.error('Não foi possível carregar');
```

**Manter Alert apenas para:**
- Confirmações críticas (deletar, cancelar)
- Uso do `ConfirmDialog.tsx` existente

**Arquivos para refatorar:**
1. `app/auth/login.tsx`
2. `app/gestor/dashboard.tsx`
3. `app/motorista/rota.tsx`
4. `app/gestor/nova-entrega.tsx`

### ✅ Critério de Conclusão
- [ ] Toast instalado e configurado
- [ ] Pelo menos 80% dos Alerts substituídos
- [ ] Toast aparece e desaparece corretamente
- [ ] Mantém ConfirmDialog para ações críticas

---

## 8️⃣ Adicionar Filtros no Dashboard

### 🎯 Objetivo
Facilitar busca e filtro de rotas no dashboard do gestor.

### 📁 Arquivo a Modificar

`app/gestor/dashboard.tsx`

### 🔧 Implementação

```typescript
// ✅ ADICIONAR estados de filtro
const [filtroStatus, setFiltroStatus] = useState<string | null>(null);
const [buscaTexto, setBuscaTexto] = useState('');

// ✅ MODIFICAR loadDashboard para aceitar filtros
async function loadDashboard(status?: string, busca?: string) {
  try {
    setLoading(true);
    const hoje = new Date().toISOString().split('T')[0];

    let query = supabase
      .from('rotas')
      .select(`
        id,
        data,
        status,
        distancia_total,
        usuarios!motorista_id (nome)
      `)
      .eq('unidade_id', userData!.unidade_id)
      .gte('data', hoje)
      .order('created_at', { ascending: false });

    // ✅ Aplicar filtro de status
    if (status) {
      query = query.eq('status', status);
    }

    const { data: rotasData, error: rotasError } = await query;

    if (rotasError) throw rotasError;

    let rotas = rotasData || [];

    // ✅ Aplicar busca por texto (motorista ou endereço)
    if (busca) {
      rotas = rotas.filter(r =>
        r.usuarios?.nome?.toLowerCase().includes(busca.toLowerCase())
      );
    }

    // ... resto do processamento ...
  } catch (error) {
    toast.error('Erro ao carregar rotas');
  } finally {
    setLoading(false);
  }
}

// ✅ ADICIONAR componente de filtros no JSX (antes da lista de rotas)
<View style={styles.filtrosContainer}>
  <TextInput
    style={styles.searchInput}
    placeholder="Buscar por motorista..."
    value={buscaTexto}
    onChangeText={(text) => {
      setBuscaTexto(text);
      loadDashboard(filtroStatus, text);
    }}
  />

  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={styles.filtrosChips}
  >
    <TouchableOpacity
      style={[
        styles.chip,
        !filtroStatus && styles.chipActive,
      ]}
      onPress={() => {
        setFiltroStatus(null);
        loadDashboard(null, buscaTexto);
      }}
    >
      <Text style={[
        styles.chipText,
        !filtroStatus && styles.chipTextActive,
      ]}>
        Todas
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[
        styles.chip,
        filtroStatus === 'pendente' && styles.chipActive,
      ]}
      onPress={() => {
        setFiltroStatus('pendente');
        loadDashboard('pendente', buscaTexto);
      }}
    >
      <Text style={[
        styles.chipText,
        filtroStatus === 'pendente' && styles.chipTextActive,
      ]}>
        Pendentes
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[
        styles.chip,
        filtroStatus === 'em_andamento' && styles.chipActive,
      ]}
      onPress={() => {
        setFiltroStatus('em_andamento');
        loadDashboard('em_andamento', buscaTexto);
      }}
    >
      <Text style={[
        styles.chipText,
        filtroStatus === 'em_andamento' && styles.chipTextActive,
      ]}>
        Em Andamento
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[
        styles.chip,
        filtroStatus === 'concluida' && styles.chipActive,
      ]}
      onPress={() => {
        setFiltroStatus('concluida');
        loadDashboard('concluida', buscaTexto);
      }}
    >
      <Text style={[
        styles.chipText,
        filtroStatus === 'concluida' && styles.chipTextActive,
      ]}>
        Concluídas
      </Text>
    </TouchableOpacity>
  </ScrollView>
</View>

// ✅ ADICIONAR estilos
const styles = StyleSheet.create({
  // ... estilos existentes ...
  
  filtrosContainer: {
    padding: 16,
    backgroundColor: colors.white,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  filtrosChips: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.gray[100],
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: colors.primary.main,
  },
  chipText: {
    fontSize: 14,
    color: colors.gray[700],
  },
  chipTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
});
```

### ✅ Critério de Conclusão
- [ ] Barra de busca funcional
- [ ] Chips de filtro funcionando
- [ ] Filtros podem ser combinados
- [ ] Visual limpo e intuitivo

---

## 9️⃣ Criar Wizard de Criação de Rota

### 🎯 Objetivo
Simplificar processo de criação dividindo em steps.

### 📁 Arquivo a Modificar

`app/gestor/nova-entrega.tsx`

### 🔧 Implementação (Resumida)

```typescript
// ✅ ADICIONAR estado de step
const [currentStep, setCurrentStep] = useState(1);
const TOTAL_STEPS = 3;

// Steps:
// 1. Informações Básicas (motorista, data)
// 2. Adicionar Paradas
// 3. Revisar e Criar

const renderStep = () => {
  switch (currentStep) {
    case 1:
      return <StepInformacoes />; // Motorista, data, observações
    case 2:
      return <StepParadas />;     // Formulário de paradas
    case 3:
      return <StepRevisao />;     // Preview da rota + otimização
    default:
      return null;
  }
};

return (
  <View style={styles.container}>
    {/* ✅ Stepper Header */}
    <View style={styles.stepperHeader}>
      {[1, 2, 3].map((step) => (
        <View key={step} style={styles.stepItem}>
          <View style={[
            styles.stepCircle,
            currentStep >= step && styles.stepCircleActive,
          ]}>
            <Text style={[
              styles.stepNumber,
              currentStep >= step && styles.stepNumberActive,
            ]}>
              {step}
            </Text>
          </View>
          {step < 3 && (
            <View style={[
              styles.stepLine,
              currentStep > step && styles.stepLineActive,
            ]} />
          )}
        </View>
      ))}
    </View>

    {/* ✅ Step Content */}
    <ScrollView style={styles.stepContent}>
      {renderStep()}
    </ScrollView>

    {/* ✅ Navigation Buttons */}
    <View style={styles.stepNav}>
      {currentStep > 1 && (
        <Button
          title="Voltar"
          onPress={() => setCurrentStep(currentStep - 1)}
          variant="outline"
        />
      )}
      
      <View style={{ flex: 1 }} />
      
      {currentStep < TOTAL_STEPS ? (
        <Button
          title="Próximo"
          onPress={() => setCurrentStep(currentStep + 1)}
          disabled={!canProceed()}
        />
      ) : (
        <Button
          title="Criar Rota"
          onPress={handleCreateRoute}
          loading={isCreating}
        />
      )}
    </View>
  </View>
);
```

### 📝 Nota
Esta é uma refatoração mais complexa. Pode ser feita de forma incremental:
1. Adicionar stepper visual
2. Separar em componentes
3. Adicionar validação por step

### ✅ Critério de Conclusão
- [ ] Stepper visual implementado
- [ ] Pelo menos 2 steps funcionando
- [ ] Navegação entre steps
- [ ] Validação por step

---

## 🔟 Adicionar Preview de Mapa na Criação

### 🎯 Objetivo
Mostrar preview visual das paradas no mapa durante criação.

### 📁 Arquivo a Modificar

`app/gestor/nova-entrega.tsx`

### 🔧 Implementação

```typescript
// No Step 2 (Paradas) ou Step 3 (Revisão)

import { MapaWeb } from '@/components/MapaWeb';

// ✅ ADICIONAR após lista de paradas:
{paradas.length >= 2 && Platform.OS === 'web' && (
  <View style={styles.mapPreview}>
    <Text style={styles.mapPreviewTitle}>Preview da Rota</Text>
    <View style={styles.mapContainer}>
      <MapaWeb
        origem={{
          latitude: paradas[0].latitude!,
          longitude: paradas[0].longitude!,
        }}
        destino={{
          latitude: paradas[paradas.length - 1].latitude!,
          longitude: paradas[paradas.length - 1].longitude!,
        }}
        waypoints={paradas.slice(1, -1).map(p => ({
          latitude: p.latitude!,
          longitude: p.longitude!,
        }))}
      />
    </View>
    
    {/* ✅ Informações da rota */}
    {rotaOtimizada && (
      <View style={styles.routeInfo}>
        <Text style={styles.routeInfoText}>
          📍 {paradas.length} paradas
        </Text>
        <Text style={styles.routeInfoText}>
          🚗 {rotaOtimizada.distancia.toFixed(1)} km
        </Text>
        <Text style={styles.routeInfoText}>
          ⏱️ ~{Math.round(rotaOtimizada.tempo / 60)} min
        </Text>
      </View>
    )}
  </View>
)}
```

### 📝 Estilos

```typescript
const styles = StyleSheet.create({
  // ... estilos existentes ...
  
  mapPreview: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: 20,
  },
  mapPreviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: colors.gray[900],
  },
  mapContainer: {
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  routeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
  },
  routeInfoText: {
    fontSize: 14,
    color: colors.gray[700],
  },
});
```

### ✅ Critério de Conclusão
- [ ] Mapa aparece após 2+ paradas
- [ ] Waypoints marcados corretamente
- [ ] Informações de distância/tempo
- [ ] Atualiza ao adicionar/remover paradas

---

## 1️⃣1️⃣ Criar Design Tokens Completos (BONUS)

### 🎯 Objetivo
Centralizar TODOS os valores de design (não só cores e fontes), criando um sistema completo de design tokens.

### 📁 Arquivo a Criar

`src/styles/tokens.ts`

```typescript
import { colors } from './colors';
import { typography } from './typography';

/**
 * Design Tokens Completos - RotaMestre
 * Sistema centralizado de valores de design
 */

export const tokens = {
  // Re-exportar cores e tipografia
  colors,
  typography,

  // ===== ESPAÇAMENTO (múltiplos de 4) =====
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
    '6xl': 64,
  },

  // ===== BORDER RADIUS =====
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 20,
    '3xl': 24,
    full: 9999,
  },

  // ===== SOMBRAS (React Native) =====
  shadows: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
  },

  // ===== TRANSIÇÕES/ANIMAÇÕES (duração em ms) =====
  transitions: {
    fast: 150,
    normal: 300,
    slow: 500,
    verySlow: 800,
  },

  // ===== OPACIDADES =====
  opacity: {
    disabled: 0.5,
    hover: 0.8,
    overlay: 0.6,
  },

  // ===== Z-INDEX =====
  zIndex: {
    base: 0,
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },

  // ===== BREAKPOINTS (para web) =====
  breakpoints: {
    xs: 0,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
  },
};

export type Tokens = typeof tokens;

// ===== UTILITÁRIOS =====

/**
 * Retorna espaçamento consistente
 * @example spacing(2) => 8
 */
export const spacing = (multiplier: number): number => {
  return tokens.spacing.xs * multiplier;
};

/**
 * Verifica se é tela pequena (mobile)
 */
export const isMobile = (width: number): boolean => {
  return width < tokens.breakpoints.md;
};

/**
 * Verifica se é tela grande (desktop)
 */
export const isDesktop = (width: number): boolean => {
  return width >= tokens.breakpoints.lg;
};
```

### 📝 Como Usar

```typescript
import { tokens, spacing } from '@/styles/tokens';

// Espaçamento consistente
<View style={{ padding: tokens.spacing.lg }}> // 16px
<View style={{ marginTop: spacing(3) }}> // 12px (3 * 4)

// Border Radius
<View style={{ borderRadius: tokens.borderRadius.md }}> // 8px

// Sombras
<View style={[styles.card, tokens.shadows.md]}>

// Animações
Animated.timing(fadeAnim, {
  toValue: 1,
  duration: tokens.transitions.normal, // 300ms
  useNativeDriver: true,
}).start();

// Cores e tipografia (já existentes)
<Text style={{
  color: tokens.colors.primary.main,
  ...tokens.typography.styles.h1
}}>
```

### ✅ Critério de Conclusão
- [ ] Arquivo `tokens.ts` criado
- [ ] Utilitários `spacing()` testados
- [ ] Pelo menos 5 componentes usando tokens
- [ ] Sombras e espaçamentos consistentes

### 🎯 Benefício

Antes você tinha:
- `colors.ts` - apenas cores
- `typography.ts` - apenas fontes

Agora você tem:
- `tokens.ts` - **TUDO** (cores, fontes, spacing, shadows, transitions, etc)

**Um único arquivo para controlar TODO o design system!**

---

## 🎯 ORDEM DE IMPLEMENTAÇÃO RECOMENDADA

**Ordem Otimizada (Melhor Fluxo):**

```
Dia 1 - Fundação (3-4h):
✅ 1. Padronizar Cores (1h)
✅ 2. Instalar Fontes (1h)
✅ 7. Toast/Snackbar (30min) - Feedback imediato em todas as telas
✅ Testar e validar (30min)

Dia 2 - Componentes Core (6-7h):
✅ 4. Criar Componente Button (2h)
✅ 5. Criar Componente Card (1.5h)
✅ Refatorar 3-5 telas com Button e Card (3h)
✅ Testar e validar (30min)

Dia 3 - Loading e Filtros (7h):
✅ 6. Skeleton Loading (2h)
✅ Aplicar Skeleton em 3 telas (2h)
✅ 8. Filtros Dashboard (3h)

Dia 4 - Mapa (6h):
✅ 3. Mapa Motorista (4h)
✅ Testes web e mobile (2h)

Dia 5 - Features Avançadas (OPCIONAL - pode virar Sprint 2):
⏸️ 9. Wizard Criação (5h) - Refatoração grande
⏸️ 10. Preview Mapa (2h) - Depende de 9
```

**Por quê essa ordem é melhor:**
1. **Dia 1** → Toast no início dá feedback imediato em TODAS as telas
2. **Dia 2** → Foca em refatoração completa (não adianta criar Button e não usar)
3. **Dia 3** → Loading states + filtros melhoram UX rapidamente
4. **Dia 4** → Mapa é feature isolada, pode ser feita depois
5. **Dia 5** → Wizard é complexo, pode virar Sprint 2 sem problemas

**Tempo Total Realista:** 3-4 dias (sem Dia 5)

---

## ✅ CHECKLIST DE VALIDAÇÃO

Após implementar todas as melhorias, verificar:

### Qualidade de Código
- [ ] Sem cores hardcoded (usar `colors.*`)
- [ ] Fontes aplicadas em todos os textos
- [ ] Componentes Button e Card usados consistentemente
- [ ] Sem duplicação de código visual

### Experiência do Usuário
- [ ] Sem tela branca de loading (skeleton)
- [ ] Feedback visual não-bloqueante (toast)
- [ ] Filtros funcionando no dashboard
- [ ] Mapa integrado para motorista

### Performance
- [ ] App compila sem erros
- [ ] Sem warnings no console
- [ ] Carregamento rápido de telas
- [ ] Animações suaves

### Acessibilidade
- [ ] Botões com minHeight 44px
- [ ] Contraste adequado
- [ ] Labels descritivos

---

## 🧪 TESTES VISUAIS POR MELHORIA

Execute estes testes após cada melhoria para garantir qualidade:

### Após Melhoria #1 (Cores)

**Checklist:**
- [ ] Abrir `app/auth/login.tsx`
- [ ] Verificar botão "Entrar" está com `#1e5aa8` (azul RotaMestre)
- [ ] Verificar header está com `#0D5A9C` (azul escuro)
- [ ] Badges de status usam cores corretas (success=#10b981, error=#ef4444)
- [ ] Nenhuma cor hardcoded visível no código
- [ ] Tirar screenshot e comparar com mockup

**Comando:**
```bash
# Buscar cores hardcoded restantes
grep -r "#[0-9a-fA-F]\{6\}" app/ --include="*.tsx" --include="*.ts"
```

---

### Após Melhoria #2 (Fontes)

**Checklist:**
- [ ] Fontes carregam sem erro no console
- [ ] Títulos de tela usam Viga (ex: "Dashboard", "Nova Rota")
- [ ] Botões usam Nunito Sans SemiBold (600)
- [ ] Textos de corpo usam Nunito Sans Regular (400)
- [ ] Inspecionar elementos e verificar font-family

**Teste Manual:**
```typescript
// No DevTools do navegador
document.fonts.ready.then(() => {
  console.log('Fontes carregadas:', document.fonts);
});
```

---

### Após Melhoria #4 (Button)

**Checklist Completo:**
- [ ] Testar todas as variantes:
  - `variant="primary"` (azul)
  - `variant="secondary"` (laranja)
  - `variant="outline"` (borda azul, fundo transparente)
  - `variant="ghost"` (sem borda, sem fundo)
  - `variant="danger"` (vermelho)
- [ ] Testar estados:
  - Normal (cor sólida)
  - Pressed (opacidade 0.7)
  - Disabled (opacity 0.5)
  - Loading (ActivityIndicator)
- [ ] Testar tamanhos:
  - `size="small"` (padding 8/12)
  - `size="medium"` (padding 12/16)
  - `size="large"` (padding 16/24)
- [ ] Testar com ícones:
  - `icon="checkmark"` + `iconPosition="left"`
  - `icon="arrow-forward"` + `iconPosition="right"`
- [ ] Verificar acessibilidade (minHeight 44px)

**Teste de Código:**
```tsx
<View style={{ padding: 20, gap: 10 }}>
  <Button title="Primary" onPress={() => {}} />
  <Button title="Secondary" onPress={() => {}} variant="secondary" />
  <Button title="Outline" onPress={() => {}} variant="outline" />
  <Button title="Disabled" onPress={() => {}} disabled />
  <Button title="Loading" onPress={() => {}} loading />
  <Button title="With Icon" onPress={() => {}} icon="checkmark" />
</View>
```

---

### Após Melhoria #5 (Card)

**Checklist:**
- [ ] `variant="elevated"` mostra sombra
- [ ] `variant="outlined"` mostra borda
- [ ] `variant="filled"` tem fundo cinza claro
- [ ] `padding="small"` (12px), `medium` (16px), `large` (20px)
- [ ] `onPress` funciona (card clicável)
- [ ] Border radius consistente (12px)

---

### Após Melhoria #6 (Skeleton)

**Checklist:**
- [ ] Animação shimmer suave (fade 0.3 → 1)
- [ ] Não causa lag (máx 5-7 skeletons)
- [ ] `SkeletonDashboard` replica layout real
- [ ] `SkeletonList` replica cards de lista
- [ ] Skeleton desaparece quando dados carregam

**Teste de Performance:**
```tsx
// Testar com muitos skeletons
<SkeletonList count={100} /> // Deve limitar a 7 e não travar
```

---

### Após Melhoria #7 (Toast)

**Checklist:**
- [ ] `toast.success()` - borda verde, título "Sucesso"
- [ ] `toast.error()` - borda vermelha, título "Erro"
- [ ] `toast.info()` - borda azul, título "Informação"
- [ ] `toast.warning()` - borda amarela, título "Atenção"
- [ ] Toast customizado com fontes RotaMestre
- [ ] Desaparece automaticamente (3-4s)
- [ ] Múltiplos toasts empilham corretamente

**Teste Manual:**
```tsx
<Button title="Testar Todos os Toasts" onPress={() => {
  toast.success('Operação concluída!');
  setTimeout(() => toast.error('Algo deu errado'), 500);
  setTimeout(() => toast.info('Você sabia que...'), 1000);
  setTimeout(() => toast.warning('Atenção necessária'), 1500);
}} />
```

---

### Após Melhoria #8 (Filtros)

**Checklist:**
- [ ] Busca por texto filtra em tempo real
- [ ] Chips de status são clicáveis
- [ ] Chip ativo tem cor azul (#1e5aa8)
- [ ] Filtros podem ser combinados (busca + status)
- [ ] Limpar busca restaura lista completa
- [ ] Sem resultados mostra mensagem apropriada

---

### Após Melhoria #3 (Mapa Mobile com Navegação)

**Checklist:**
- [ ] MapaRN.tsx criado e sem erros de compilação
- [ ] MapaRotas.tsx criado (wrapper Platform.OS)
- [ ] Botão toggle "🗺️ Ver Mapa" / "📋 Ver Lista"
- [ ] **Web:** MapaWeb.tsx renderiza corretamente
- [ ] **Android:** MapaRN.tsx renderiza com react-native-maps
- [ ] **iOS:** MapaRN.tsx renderiza (se tiver Mac)
- [ ] Marcadores numerados aparecem (1, 2, 3...)
- [ ] Marcadores verdes para paradas concluídas
- [ ] Polyline azul conecta paradas em ordem
- [ ] Info de distância/tempo calculada (ex: "15 km · 30 min")
- [ ] Botão "🧭 Iniciar Navegação" visível quando rota ativa
- [ ] Botão abre Google Maps nativo ao clicar
- [ ] Directions API retorna rota otimizada

**Teste Multiplataforma:**
```bash
npm run web                # ✅ MapaWeb (Google Maps JS)
npx expo run:android       # ✅ MapaRN (react-native-maps)
npx expo run:ios           # ✅ MapaRN (se tiver Mac)
```

**Teste de Navegação:**
1. Login como motorista
2. Abrir rota com status "em_andamento"
3. Clicar em "🗺️ Ver Mapa"
4. Validar: marcadores, polyline, info de distância
5. Clicar em "🧭 Iniciar Navegação"
6. Verificar: Google Maps abre com navegação ativa

---

### Após Melhorias #9 e #10 (Wizard + Preview)

**Checklist:**
- [ ] Stepper visual mostra 3 steps
- [ ] Step ativo destacado (círculo azul)
- [ ] Botão "Voltar" funciona (exceto no Step 1)
- [ ] Botão "Próximo" desabilitado se dados inválidos
- [ ] Preview do mapa aparece no Step 2/3
- [ ] Informações de distância/tempo calculadas
- [ ] Criar rota funciona no último step

---

## 🚨 PROBLEMAS COMUNS E SOLUÇÕES

### Erro: "Cannot find module '@/styles/colors'"

**Solução:**
```typescript
// Verificar tsconfig.json tem:
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Erro: "Expo Font não carrega"

**Solução:**
```bash
# Limpar cache
npx expo start -c
```

### Toast não aparece

**Solução:**
```typescript
// Verificar que <Toast /> está no root layout
// DEPOIS de todos os Stack.Screen
```

### Mapa não renderiza

**Web:**
```typescript
// Verificar que MapaWeb.tsx está sendo usado
// Google Maps JavaScript API só funciona no browser
if (Platform.OS === 'web') {
  return <MapaWeb {...props} />;
}
```

**Mobile:**
```bash
# Verificar que fez development build
npx expo run:android  # Não funciona com 'npx expo start'

# Verificar que react-native-maps está instalado
npx expo install react-native-maps

# Limpar e recompilar
rm -rf android ios
npx expo prebuild --clean
npx expo run:android
```

**Erro: "Google Maps API key not found"**
```json
// Verificar app.json tem:
{
  "android": {
    "config": {
      "googleMaps": {
        "apiKey": "AIza..."
      }
    }
  }
}
```

---

## 📚 RECURSOS ADICIONAIS

- **Design System:** Consultar `MANUAL.pdf` (Mestre da Obra)
- **Tipografia:** Viga + Nunito Sans (Google Fonts)
- **Ícones:** Ionicons (já instalado)
- **Toast:** [react-native-toast-message](https://github.com/calintamas/react-native-toast-message)

---

## 🎉 PRÓXIMOS PASSOS

Após concluir estas 10 melhorias imediatas:

1. **Sprint 2 - UX Avançado**
   - Notificações push
   - Modo offline
   - Câmera para fotos de entrega

2. **Sprint 3 - Performance**
   - Cache de dados
   - Virtualização de listas
   - Otimização de imagens

3. **Sprint 4 - Acessibilidade**
   - Dark mode
   - Font scaling
   - Screen reader completo

---

**Data de Criação:** 22/10/2025
**Última Atualização:** 22/10/2025
**Versão:** 2.0 (Corrigida)

---

## 📝 CHANGELOG

### v2.0 (22/10/2025) - Versão Corrigida
**Correções Críticas:**
- ✅ Cor azul light atualizada: `#3b82f6` → `#4a90e2` (alinhado com Brand Guidelines)
- ✅ Adicionada instalação do `@expo-google-fonts/viga` na Melhoria #2
- ✅ Adicionado import do Viga no código de exemplo
- ✅ Adicionada customização completa do Toast (cores + fontes RotaMestre)

**Melhorias Adicionadas:**
- ✅ Documentação detalhada da limitação de plataforma do Mapa (web-only)
- ✅ Nota de performance para Skeleton Loading (limite de 7 itens)
- ✅ Ordem de implementação repriorizada (Toast no Dia 1)
- ✅ **Nova Melhoria #11:** Design Tokens Completos (spacing, shadows, transitions, etc)
- ✅ **Nova seção:** Testes Visuais por Melhoria (checklist completo)

**Linhas:** 1708 → 2200+ (~500 linhas adicionadas)

### v1.0 (22/10/2025) - Versão Original
- 10 melhorias imediatas documentadas
- Código completo e pronto para uso
- Checklist e ordem de implementação

---

_Este documento foi gerado automaticamente pela análise completa de UI/UX do sistema RotaMestre._
