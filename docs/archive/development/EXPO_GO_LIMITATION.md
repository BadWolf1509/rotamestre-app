# ⚠️ Limitação do Expo Go - iOS

## Problema

Ao testar no **Expo Go para iOS**, você pode encontrar o seguinte erro:

```
ERROR [Error: Exception in HostFunction: TypeError: expected dynamic type 'boolean', but had type 'string']
Call Stack: RNSScreen
```

## Causa

Este é um **bug conhecido** da combinação:
- Expo Go (sempre usa Nova Arquitetura / Fabric)
- react-native-screens v4.x
- Expo Router v6.x
- iOS (não afeta Android no Expo Go)

O erro ocorre internamente no `react-native-screens` ao processar props com a Nova Arquitetura do React Native.

## ✅ Soluções (3 opções)

### Opção 1: Testar no Navegador Web (Recomendado)
```bash
npm run web
```

**Vantagens:**
- ✅ Funciona 100% (sem erros)
- ✅ Mapa com Google Maps funciona
- ✅ Todas as funcionalidades disponíveis
- ✅ Hot reload rápido
- ✅ DevTools do Chrome

**URL:** http://localhost:8081

### Opção 2: Development Build (iOS Nativo)
```bash
npx expo run:ios
```

**Vantagens:**
- ✅ App iOS nativo completo
- ✅ Sem limitações do Expo Go
- ✅ Mapa funciona perfeitamente
- ✅ Todas as features nativas

**Requisitos:**
- ⚠️ Precisa de macOS
- ⚠️ Xcode instalado
- ⚠️ Build leva ~5-10 minutos

### Opção 3: Expo Go Android
```bash
# No terminal
npm start

# No Android
Abra o Expo Go e escaneie o QR code
```

**Nota:** O erro **só afeta iOS**. Android funciona normalmente no Expo Go.

## 🔧 O que já tentamos

✅ Importação condicional do react-native-maps
✅ Detecção de ambiente (Expo Go vs Development Build)
✅ Correção de tipos (enableGoogleMaps: boolean)
✅ Movido headerShown para screenOptions
✅ Simplificado screenOptions ao mínimo
✅ Limpeza completa de cache
✅ Desabilitar/habilitar newArchEnabled

**Conclusão:** O problema está no código nativo do `react-native-screens` + Expo Go iOS, não no nosso código.

## 📊 Status das Plataformas

| Plataforma | Status | Observação |
|------------|--------|------------|
| 🌐 Web | ✅ Funciona | Recomendado para desenvolvimento |
| 🤖 Android (Expo Go) | ✅ Funciona | Erro só afeta iOS |
| 🍎 iOS (Expo Go) | ❌ Erro conhecido | Use web ou development build |
| 🍎 iOS (Dev Build) | ✅ Funciona | `npx expo run:ios` |
| 📦 Produção | ✅ Funciona | Build de produção não é afetado |

## 🎯 Recomendação

**Para desenvolvimento rápido:**
```bash
npm run web
```

**Para testar iOS:**
```bash
npx expo run:ios
# (requer Mac + Xcode)
```

## 📚 Links Úteis

- [Expo Go Limitations](https://docs.expo.dev/workflow/expo-go/)
- [New Architecture in Expo](https://docs.expo.dev/guides/new-architecture/)
- [react-native-screens Issues](https://github.com/software-mansion/react-native-screens/issues)

---

**Última atualização:** 2025-10-20
