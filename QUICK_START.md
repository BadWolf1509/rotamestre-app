# 🚀 Quick Start - RotaMestre Android

## ⚡ Início Ultra-Rápido (3 passos)

```bash
# 1. Configurar Android SDK (apenas primeira vez)
setup-android-env.bat

# 2. Reiniciar terminal

# 3. Executar
start-android.bat
```

---

## 📱 Comandos Essenciais

### **Primeira Execução (Build Completo)**
```bash
npm run android
# Aguardar 5-10 minutos (compila código nativo)
```

### **Desenvolvimento Diário**
```bash
npm start
# Pressionar 'a' quando emulador abrir
```

### **Web (Mais Rápido)**
```bash
npm run web
# Acesse: http://localhost:8081
```

---

## 🛠️ Ferramentas Criadas

| Arquivo | Descrição |
|---------|-----------|
| `start-android.bat` | Menu interativo - todas as opções |
| `setup-android-env.bat` | Configura ANDROID_HOME automaticamente |
| `ANDROID_STUDIO_SETUP.md` | Guia completo detalhado |

---

## 🔍 Verificações Rápidas

```bash
# SDK configurado?
echo %ANDROID_HOME%

# ADB funcionando?
adb devices

# Emuladores disponíveis?
emulator -list-avds

# Dependências OK?
npm list --depth=0
```

---

## 🎯 Credenciais de Teste

**Gestor:**
- Email: `gestor@unidadesp.com`
- Senha: `senha123`

**Motorista:**
- Email: `motorista1@unidadesp.com`
- Senha: `senha123`

---

## 🐛 Problemas Comuns

### Erro: "SDK location not found"
```bash
setup-android-env.bat
# Reiniciar terminal
```

### Erro: "No emulator running"
```bash
# Android Studio > Tools > Device Manager > ▶️ Play
# Ou criar novo AVD
```

### App não abre
```bash
# Limpar cache
npm start -- --reset-cache

# Reinstalar
adb uninstall br.tec.rotamestre
npm run android
```

### Porta 8081 em uso
```bash
npx react-native start --reset-cache
```

---

## 📚 Documentação Completa

- **Setup detalhado:** `ANDROID_STUDIO_SETUP.md`
- **README geral:** `README.md`
- **Expo Go limitações:** `EXPO_GO_LIMITATION.md`

---

## 🎮 Workflow Recomendado

### Opção 1: Automático
```bash
start-android.bat
# Escolher: 1 (primeira vez) ou 2 (desenvolvimento)
```

### Opção 2: Manual
```bash
# Terminal 1
npm start

# Terminal 2 (ou pressionar 'a' no Terminal 1)
npm run android
```

---

## ✅ Checklist de Sucesso

- [ ] `echo %ANDROID_HOME%` mostra caminho do SDK
- [ ] `adb devices` lista emulador ou dispositivo
- [ ] `npm start` inicia sem erros
- [ ] App abre no emulador com tela de login
- [ ] Login funciona e mostra dashboard

---

**Status:** ✅ Pronto para desenvolvimento
**Ambiente:** Android Studio Narwhal 2025.1.4
**SO:** Windows 11