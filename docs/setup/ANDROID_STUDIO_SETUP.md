# 🤖 Guia Completo: Android Studio Narwhal 2025.1.4

## ✅ Pré-requisitos Verificados

- ✅ Android Studio Narwhal 2025.1.4 instalado
- ✅ Runtime: OpenJDK 21.0.8
- ✅ Windows 11
- ✅ .env configurado com Supabase e Google Maps

---

## 🚀 Configuração Passo a Passo

### **1️⃣ Configurar Android SDK**

#### Opção A: Automática (Recomendado)
```bash
# Executar script de configuração
setup-android-env.bat

# IMPORTANTE: Reiniciar o terminal após executar
```

#### Opção B: Manual

1. Abrir Android Studio
2. **File > Settings** (Ctrl+Alt+S)
3. **Appearance & Behavior > System Settings > Android SDK**
4. Copiar o caminho do **Android SDK Location**

Exemplo: `C:\Users\welli\AppData\Local\Android\Sdk`

5. Abrir **PowerShell como Administrador** e executar:

```powershell
# Configurar ANDROID_HOME
[System.Environment]::SetEnvironmentVariable('ANDROID_HOME', 'C:\Users\welli\AppData\Local\Android\Sdk', [System.EnvironmentVariableTarget]::User)

# Adicionar ao PATH
$currentPath = [System.Environment]::GetEnvironmentVariable('Path', [System.EnvironmentVariableTarget]::User)
$newPath = "$currentPath;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:ANDROID_HOME\tools"
[System.Environment]::SetEnvironmentVariable('Path', $newPath, [System.EnvironmentVariableTarget]::User)
```

6. **Reiniciar o terminal**

---

### **2️⃣ Verificar Instalação**

Abrir **novo terminal** e executar:

```bash
# Verificar variável
echo %ANDROID_HOME%
# Deve mostrar: C:\Users\welli\AppData\Local\Android\Sdk

# Verificar ADB
adb version
# Deve mostrar: Android Debug Bridge version 1.x.x

# Listar emuladores
emulator -list-avds
```

---

### **3️⃣ Criar/Configurar AVD (Android Virtual Device)**

#### Verificar emuladores existentes:
```bash
emulator -list-avds
```

#### Se não houver emuladores, criar um:

1. Abrir **Android Studio**
2. **Tools > Device Manager** (ou Ctrl+Shift+F12)
3. Clicar em **Create Device**
4. Selecionar:
   - **Phone** > **Pixel 5** (recomendado)
   - **Next**
5. Download do System Image:
   - **API Level 34 (Android 14)** - UpsideDownCake
   - **x86_64** (para melhor performance)
   - **Next**
6. Configurar AVD:
   - Nome: `Pixel_5_API_34`
   - Startup orientation: **Portrait**
   - **Show Advanced Settings**:
     - RAM: **2048 MB** (mínimo)
     - VM heap: **512 MB**
     - Internal Storage: **2048 MB**
   - **Finish**

#### Iniciar emulador manualmente (opcional):
```bash
emulator -avd Pixel_5_API_34
```

---

### **4️⃣ Instalar Dependências do Projeto**

```bash
# Navegar até o projeto
cd C:\Users\welli\rotamestre-app

# Instalar dependências npm
npm install

# Limpar cache (se necessário)
npm cache clean --force
```

---

### **5️⃣ Executar no Emulador Android**

#### Método 1: Build Automático (Recomendado)

```bash
# Inicia o emulador e compila automaticamente
npm run android
```

**O que acontece:**
1. Expo verifica se há emulador rodando
2. Inicia o emulador se necessário
3. Compila o código nativo (primeira vez: 5-10 minutos)
4. Instala o app no emulador
5. Abre o app automaticamente

#### Método 2: Servidor de Desenvolvimento

```bash
# Terminal 1: Iniciar Metro Bundler
npm start

# Terminal 2: Compilar e instalar no emulador
npm run android

# Ou pressionar 'a' no Terminal 1 após emulador iniciar
```

---

## 🎯 Workflow Diário Recomendado

### **Primeira Execução (compilação completa):**
```bash
npm run android
# Aguardar 5-10 minutos (compila código nativo)
```

### **Execuções Seguintes (hot reload):**
```bash
# Terminal 1
npm start

# Terminal 2 (ou pressionar 'a' no Terminal 1)
a  # Abre no Android
```

---

## 🛠️ Troubleshooting

### ❌ Erro: "SDK location not found"

**Solução:**
```bash
# Executar setup novamente
setup-android-env.bat

# Reiniciar terminal
```

---

### ❌ Erro: "No emulator running"

**Solução 1: Iniciar emulador manualmente**
```bash
# Listar emuladores
emulator -list-avds

# Iniciar emulador específico
emulator -avd Pixel_5_API_34
```

**Solução 2: Via Android Studio**
- **Tools > Device Manager**
- Clicar no ▶️ ao lado do emulador

---

### ❌ Erro: "Gradle build failed"

**Solução:**
```bash
# Limpar build do Android
cd android
gradlew clean

cd ..
npm run android
```

---

### ❌ Erro: "INSTALL_FAILED_INSUFFICIENT_STORAGE"

**Solução:**
1. Abrir **Device Manager** no Android Studio
2. Editar AVD (ícone de lápis)
3. **Show Advanced Settings**
4. Aumentar **Internal Storage** para **4096 MB**
5. **Finish**

---

### ❌ Erro: "Metro bundler port 8081 already in use"

**Solução:**
```bash
# Matar processos na porta 8081
npx react-native start --reset-cache

# Ou limpar cache
npm start -- --reset-cache
```

---

### ❌ App crasha ao abrir

**Solução 1: Verificar logs**
```bash
# Ver logs do Android
adb logcat *:E
```

**Solução 2: Reinstalar app**
```bash
# Desinstalar
adb uninstall br.tec.rotamestre

# Reinstalar
npm run android
```

---

## 📊 Performance Tips

### **1. Habilitar Hardware Acceleration**
- **Settings > Tools > Emulator**
- Marcar: ✅ **Launch in a tool window**
- Marcar: ✅ **Enable hardware keyboard input**

### **2. Alocar mais RAM ao Emulator**
- **Device Manager > Edit AVD > Show Advanced Settings**
- RAM: **4096 MB** (se tiver memória disponível)

### **3. Usar Native x86_64**
- Sempre usar imagens x86_64 (não ARM)
- Melhor performance no Windows/Intel

---

## 🧪 Validação Final

Execute estes comandos para verificar tudo está OK:

```bash
# 1. SDK configurado
echo %ANDROID_HOME%

# 2. ADB funcionando
adb version

# 3. Emuladores disponíveis
emulator -list-avds

# 4. Dependências instaladas
npm list

# 5. Build do projeto
npm run android
```

---

## 🎯 Comandos Úteis

```bash
# Ver dispositivos conectados
adb devices

# Reiniciar ADB
adb kill-server
adb start-server

# Logs do app
adb logcat | grep "ReactNativeJS"

# Capturar screenshot
adb exec-out screencap -p > screenshot.png

# Abrir DevTools
adb shell input keyevent 82  # Shake gesture

# Reload app
adb shell input text "RR"  # Fast refresh
```

---

## 📱 Após Executar com Sucesso

O app abrirá no emulador e você verá:

1. **Splash Screen** (azul com logo RotaMestre)
2. **Tela de Login**
3. Fazer login com:
   - Email: `gestor@unidadesp.com`
   - Senha: `senha123`
4. **Dashboard do Gestor** com mapa e rotas

---

## 🔗 Próximos Passos

- [ ] Testar criação de rota
- [ ] Testar visualização no mapa
- [ ] Testar login como motorista
- [ ] Verificar permissões de localização
- [ ] Testar em dispositivo físico (via USB)

---

## 📚 Recursos Adicionais

- [Expo Android Development](https://docs.expo.dev/workflow/android-studio-emulator/)
- [Android Studio User Guide](https://developer.android.com/studio/intro)
- [React Native Debugging](https://reactnative.dev/docs/debugging)

---

**Versão:** 1.0.0
**Última atualização:** 2025-10-22
**Android Studio:** Narwhal 2025.1.4