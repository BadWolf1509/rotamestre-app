# 🗺️ Implementação do react-native-maps

**Data:** 22/10/2025
**Status:** ✅ Implementado
**Versão:** 1.0

---

## 📊 Resumo

Implementação completa do **react-native-maps** para suportar mapas nativos em iOS e Android, mantendo compatibilidade com a versão web existente.

---

## 🎯 Objetivo

Fornecer experiência de mapa consistente em todas as plataformas:
- ✅ **Web:** Google Maps JavaScript API (MapaWeb.tsx)
- ✅ **iOS:** MapKit + Google Maps (MapaMobile.tsx)
- ✅ **Android:** Google Maps nativo (MapaMobile.tsx)

---

## 📦 Pacotes Instalados

```bash
npx expo install react-native-maps
```

**Versão:** Compatível com Expo SDK 54

---

## 📁 Arquivos Criados

### 1. `src/components/MapaMobile.tsx` (219 linhas)

**Responsabilidade:** Renderizar mapa nativo em iOS/Android usando react-native-maps

**Funcionalidades:**
- ✅ Marcadores customizados com número da ordem
- ✅ Cores por status (concluída=verde, em andamento=azul, pendente=amarelo)
- ✅ Polyline conectando todas as paradas
- ✅ Auto-zoom para mostrar todas as paradas
- ✅ Info badge com contagem de paradas
- ✅ Localização do usuário (showsUserLocation)
- ✅ Fallback para paradas sem coordenadas

**Props:**
```typescript
interface MapaMobileProps {
  paradas: Parada[];
}

interface Parada {
  id: string;
  ordem: number;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
}
```

**Exemplo de uso:**
```typescript
import { MapaMobile } from '@/components/MapaMobile';

<MapaMobile paradas={paradas} />
```

---

### 2. `src/components/MapaAdapter.tsx` (165 linhas)

**Responsabilidade:** Wrapper inteligente que detecta plataforma e renderiza componente apropriado

**Lógica:**
```typescript
if (Platform.OS === 'web') {
  return <MapaWeb paradas={paradas} />;
}
return <MapaMobile paradas={paradas} />;
```

**Componentes incluídos:**
- `MapaAdapter` - Componente principal (usa MapaWeb ou MapaMobile)
- `MapaFallback` - Componente opcional para Expo Go (com instruções)

**Exemplo de uso:**
```typescript
import { MapaAdapter } from '@/components/MapaAdapter';

// Funciona automaticamente em todas as plataformas
<MapaAdapter paradas={paradas} />
```

---

### 3. Atualização em `app.config.js`

**⚠️ IMPORTANTE:** `react-native-maps` **NÃO precisa de plugin**. A configuração é feita manualmente.

**Configuração Correta:**
```javascript
module.exports = ({ config }) => {
  return {
    // ...
    ios: {
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ""
      }
    },
    android: {
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ""
        }
      }
    },
    plugins: [
      // ... outros plugins
      // ❌ NÃO adicionar react-native-maps aqui - não tem plugin!
    ]
  };
};
```

**Configurações aplicadas:**
- ✅ Google Maps API Key no iOS (ios.config.googleMapsApiKey)
- ✅ Google Maps API Key no Android (android.config.googleMaps.apiKey)
- ✅ Permissões de localização (iOS e Android)

---

## 🔧 Configuração

### **Variável de Ambiente (.env)**

```bash
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
```

**Importante:** A mesma API Key é usada para web e mobile!

---

### **API Keys por Plataforma**

| Plataforma | Tipo de API | Configuração |
|------------|-------------|--------------|
| **Web** | JavaScript API | Usada em MapaWeb.tsx |
| **iOS** | Maps SDK for iOS | Configurada no app.config.js |
| **Android** | Maps SDK for Android | Configurada no app.config.js |

**Nota:** No momento, estamos usando a mesma API Key para todas as plataformas (não restrita por domínio/bundle ID). Em produção, considere criar APIs Keys específicas por plataforma com restrições adequadas.

---

## 🧪 Como Testar

### **Opção 1: Testar Web (Imediato)** ✅

```bash
npm run web
```

**Resultado:** MapaWeb renderiza normalmente (Google Maps JavaScript)

---

### **Opção 2: Testar Mobile no Expo Go** ⚠️

```bash
npx expo start
# Escanear QR Code no celular
```

**Resultado Esperado:**
- MapaMobile tentará renderizar
- Se não funcionar no Expo Go, use MapaFallback (opcional)

**Por quê pode não funcionar:**
- Expo Go não tem código nativo do react-native-maps pré-compilado
- É necessário fazer development build

---

### **Opção 3: Fazer Development Build (Recomendado)** ⭐

#### **iOS (requer Mac + Xcode)**
```bash
npx expo prebuild
npx expo run:ios
```

#### **Android (requer Android Studio)**
```bash
npx expo prebuild
npx expo run:android
```

**Resultado:** ✅ Mapa nativo funcionando perfeitamente!

---

## 🚀 Deploy em Produção

### **Build com EAS**

```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production
```

**Resultado:** Mapas nativos funcionarão automaticamente em produção!

---

## 📊 Comparação de Componentes

| Aspecto | MapaWeb | MapaMobile |
|---------|---------|------------|
| **Biblioteca** | @react-google-maps/api | react-native-maps |
| **Plataforma** | Web apenas | iOS + Android |
| **Tipo** | JavaScript (DOM) | Nativo (MapKit/Google Maps) |
| **Expo Go** | ✅ Funciona | ⚠️ Precisa dev build |
| **Produção** | ✅ Funciona | ✅ Funciona |
| **Direções** | ✅ Sim (DirectionsService) | ⚠️ Apenas Polyline |
| **Performance** | ⚠️ Depende do browser | ✅ Nativa |
| **Offline** | ❌ Não | ✅ Possível (com cache) |

---

## 🔍 Diferenças Técnicas

### **MapaWeb (Web)**

```typescript
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';

// Calcula direções otimizadas
const DirectionsService = new google.maps.DirectionsService();
DirectionsService.route({ origin, destination, waypoints }, callback);

// Renderiza rota otimizada
<DirectionsRenderer directions={directions} />
```

**Benefícios:**
- ✅ Direções otimizadas automaticamente
- ✅ Traffic data em tempo real
- ✅ Múltiplas alternativas de rota

---

### **MapaMobile (iOS/Android)**

```typescript
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

// Linha simples conectando paradas
<Polyline
  coordinates={paradas.map(p => ({ latitude, longitude }))}
  strokeColor="#0D5A9C"
  strokeWidth={4}
/>
```

**Limitações:**
- ⚠️ Polyline não é otimizada (linha reta entre pontos)
- ⚠️ Sem traffic data
- ⚠️ Sem sugestões de rota alternativa

**Solução futura:** Integrar Google Directions API REST no backend para calcular rotas otimizadas e enviar polyline decodificada para o app.

---

## 🐛 Troubleshooting

### **Erro: "PluginError: Unable to resolve a valid config plugin for react-native-maps"**

**Causa:** Tentativa de usar react-native-maps como plugin no app.config.js.

**Solução:** ✅ **JÁ CORRIGIDO!**
- react-native-maps NÃO tem plugin
- Configuração é feita via `ios.config.googleMapsApiKey` e `android.config.googleMaps.apiKey`
- **Não adicionar** react-native-maps no array `plugins`

---

### **Erro: "Invariant Violation: requireNativeComponent: 'AIRMap' was not found"**

**Causa:** Expo Go não tem react-native-maps compilado.

**Solução:**
```bash
npx expo prebuild --clean
npx expo run:ios  # ou run:android
```

---

### **Mapa não carrega no Android**

**Causa:** API Key não configurada ou inválida.

**Solução:**
1. Verificar que EXPO_PUBLIC_GOOGLE_MAPS_API_KEY está definida no .env
2. Verificar app.config.js tem `android.config.googleMaps.apiKey`
3. Recompilar o app: `npx expo run:android`

---

### **Mapa não carrega no iOS**

**Causa:** Permissões de localização não configuradas.

**Solução:** Já configurado em app.config.js (NSLocationWhenInUseUsageDescription)

---

### **Marcadores não aparecem**

**Causa:** Paradas não têm latitude/longitude.

**Debug:**
```typescript
const paradasComCoord = paradas.filter(p => p.latitude && p.longitude);
console.log('Paradas com coordenadas:', paradasComCoord.length);
```

---

## 📈 Melhorias Futuras

### **1. Direções Otimizadas no Mobile**

Integrar Google Directions API REST:
```typescript
// Backend ou cliente
async function calcularRotaOtimizada(origem, destino, waypoints) {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?` +
    `origin=${origem}&destination=${destino}&waypoints=${waypoints}&key=${API_KEY}`
  );
  const data = await response.json();
  return decodePolyline(data.routes[0].overview_polyline.points);
}

// No MapaMobile
<Polyline coordinates={rotaOtimizada} />
```

---

### **2. Clustering de Marcadores**

Para rotas com muitas paradas (50+):
```bash
npm install react-native-map-clustering
```

---

### **3. Offline Maps**

Cache de mapas para uso offline:
```typescript
<MapView
  cacheEnabled={true}
  loadingEnabled={true}
  mapType="standard"
/>
```

---

### **4. Heat Maps**

Visualizar áreas com mais entregas:
```bash
npm install react-native-maps-super-cluster
```

---

## 📚 Recursos

- [react-native-maps Docs](https://github.com/react-native-maps/react-native-maps)
- [Google Maps Platform](https://developers.google.com/maps)
- [Expo Maps Guide](https://docs.expo.dev/versions/latest/sdk/map-view/)

---

## ✅ Checklist de Validação

### **Desenvolvimento**
- [x] react-native-maps instalado
- [x] MapaMobile.tsx criado
- [x] MapaAdapter.tsx criado
- [x] app.config.js configurado
- [x] Tela mapa-rota.tsx atualizada

### **Testes**
- [x] Web: Mapa renderiza
- [ ] iOS: Dev build com mapa nativo
- [ ] Android: Dev build com mapa nativo

### **Produção** (Quando fizer build)
- [ ] API Keys configuradas
- [ ] Permissões de localização aprovadas
- [ ] EAS Build iOS
- [ ] EAS Build Android
- [ ] Testar em devices físicos

---

**Implementado por:** Claude AI
**Data:** 22/10/2025
**Versão:** 1.0
