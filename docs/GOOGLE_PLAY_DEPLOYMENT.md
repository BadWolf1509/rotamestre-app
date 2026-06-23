# 🚀 Guia de Publicação do RotaMestre na Google Play Store

> **⚠️ STATUS + CORREÇÕES (2026-06-16):** app **reconstruído** (contas originais perdidas) — package `br.tec.rotamestre.app`, EAS `c6401a59…`, Firebase `rota-mestre-97084`; conta Play criada, `.aab` **3019** no **Teste interno**, Play App Signing ligado. Correções a este guia (genérico/antigo):
>
> 1. **Mapas via MapLibre**, mas **geocoding/autocomplete de endereço usa a Google Places API** (via Edge Functions `google-places-autocomplete`/`google-place-details`) — `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` **é obrigatória** no build de produção (sem ela o autocomplete de endereço quebra; custo ~R$2,83/1000 sessões). O `config.googleMaps.apiKey` nativo no `app.config.js` é vestígio (os mapas são MapLibre), mas a env var da chave continua necessária para o Places.
> 2. **NÃO confie em "EAS gerencia o keystore"** — a perda do keystore/conta causou TODO o retrabalho do rebuild. **Baixe e guarde o keystore você mesmo** (`eas credentials` → download, ou dashboard) + as senhas, em ≥2 lugares.
> 3. **Env Supabase fica por-ambiente no EAS** (`eas env:*`), não inline no `eas.json`.
> 4. Estado atual do rollout: ver a **memória do Claude** + `docs/REBUILD_RELAUNCH_PLAN.md`.

## 📋 Checklist Geral

- [ ] Conta de Desenvolvedor Google Play ($25 USD única vez)
- [ ] App testado e estável
- [ ] Assets de marketing prontos
- [ ] Política de Privacidade publicada
- [ ] Build de produção gerado

---

## 📝 Fase 1: Preparação do App

### 1.1 Atualizar Configurações do App

#### app.json

```json
{
  "expo": {
    "name": "RotaMestre",
    "slug": "rotamestre",
    "version": "1.0.0",
    "android": {
      "package": "br.tec.rotamestre.app",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FF8C42"
      },
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "CAMERA"
      ],
      "config": {
        "googleMaps": {
          "apiKey": "YOUR_PRODUCTION_API_KEY"
        }
      }
    }
  }
}
```

### 1.2 Assets Obrigatórios

#### Ícones

- [ ] **Ícone do App**: 512x512px PNG (já existe em `assets/icon.png`)
- [ ] **Ícone Adaptativo**: 1024x1024px PNG com área segura

#### Screenshots (Obrigatório: 2-8 por tipo)

- [ ] **Telefone**: 1080x1920px ou 9:16
- [ ] **Tablet 7"**: 1200x1920px (opcional)
- [ ] **Tablet 10"**: 1600x2560px (opcional)

#### Gráficos da Loja

- [ ] **Feature Graphic**: 1024x500px (banner principal)
- [ ] **Ícone Hi-res**: 512x512px PNG 32-bit

### 1.3 Textos da Loja

#### Título (máx 30 caracteres)

```
Rota Mestre - Rotas Otimizadas
```

#### Descrição Curta (máx 80 caracteres)

```
Otimize suas rotas de entrega e economize até 30% de combustível
```

#### Descrição Completa (máx 4000 caracteres)

```
Rota Mestre é a solução definitiva para empresas que precisam otimizar suas rotas de entrega e coleta. Economize tempo, combustível e aumente a produtividade da sua equipe.

🚗 PRINCIPAIS FUNCIONALIDADES:

✅ Otimização Automática de Rotas
• Algoritmo inteligente que define a melhor sequência de paradas
• Economia de até 30% no combustível
• Redução de 3 horas diárias no planejamento

📍 Gestão Completa de Entregas
• Criação rápida de rotas com múltiplas paradas
• Atribuição de motoristas
• Acompanhamento em tempo real
• Fotos de comprovação de entrega

👥 Perfis Especializados
• Gestor: Cria e gerencia rotas
• Motorista: Executa entregas com navegação integrada
• Admin: Gerenciamento completo da plataforma

🗺️ Integração com GPS
• Navegação turn-by-turn
• Integração com Waze e Google Maps
• Visualização de todas as paradas no mapa

📊 Relatórios e Métricas
• Dashboard com estatísticas em tempo real
• Histórico completo de rotas
• Métricas de desempenho por motorista

💼 IDEAL PARA:
• Empresas de logística
• Distribuidoras
• E-commerce com entrega própria
• Locadoras de equipamentos
• Qualquer empresa com operação de entregas

🔒 SEGURANÇA E PRIVACIDADE:
• Dados criptografados
• Conformidade com LGPD
• Backup automático na nuvem

📱 REQUISITOS:
• Android 6.0 ou superior
• Conexão com internet
• GPS habilitado

Experimente grátis por 7 dias!

Dúvidas? contato@rotamestre.tec.br
```

---

## 🔧 Fase 2: Build de Produção

### 2.1 Instalar EAS CLI

```bash
npm install -g eas-cli
```

### 2.2 Configurar EAS

```bash
# Login no Expo
eas login

# Configurar projeto
eas build:configure
```

### 2.3 Arquivo eas.json

```json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle",
        "image": "latest"
      },
      "env": {
        "EXPO_PUBLIC_ENV": "production",
        "EXPO_PUBLIC_SUPABASE_URL": "YOUR_PROD_URL",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "YOUR_PROD_KEY",
        "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY": "YOUR_PROD_KEY"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

### 2.4 Gerar Build de Produção

```bash
# Build AAB (Android App Bundle) para Play Store
eas build --platform android --profile production

# Aguardar conclusão (15-30 minutos)
# URL para download será fornecida
```

---

## 🏪 Fase 3: Google Play Console

### 3.1 Criar Conta de Desenvolvedor

1. Acesse: https://play.google.com/console
2. Pague taxa de $25 USD (única vez)
3. Preencha informações da empresa
4. Aguarde aprovação (até 48h)

### 3.2 Criar Novo App

1. **Console** → **Criar app**
2. Preencher:
   - Nome: Rota Mestre
   - Idioma padrão: Português (Brasil)
   - Tipo: Aplicativo
   - Categoria: Negócios
   - É gratuito/pago: Gratuito

### 3.3 Configurar Listagem da Loja

#### Principais informações

- Título do app
- Descrição curta e completa
- Ícone do app
- Feature graphic
- Screenshots (mínimo 2)
- Categoria: Negócios
- Tags: rotas, entrega, logística, otimização

#### Classificação de conteúdo

1. Responder questionário
2. Provável resultado: **Livre (E)**

#### Preços e distribuição

- Países: Brasil (inicialmente)
- Preço: Gratuito
- Contém anúncios: Não
- Compras no app: Sim (assinaturas)

### 3.4 Política de Privacidade

Criar e hospedar política de privacidade:

```html
https://rotamestre.tec.br/privacidade
```

Conteúdo mínimo:

- Dados coletados (localização, fotos, dados pessoais)
- Como os dados são usados
- Compartilhamento de dados
- Segurança
- Direitos do usuário (LGPD)
- Contato para privacidade

---

## 📤 Fase 4: Upload do App

### 4.1 Criar Release

1. **Produção** → **Criar novo release**
2. Upload do AAB gerado pelo EAS Build
3. Adicionar notas de lançamento:

```
Versão inicial do RotaMestre

✨ Novidades:
• Otimização automática de rotas
• Gestão de motoristas e entregas
• Navegação integrada
• Fotos de comprovação
• Dashboard com métricas
```

### 4.2 Revisão e Lançamento

1. Revisar todos os avisos/erros
2. Iniciar lançamento → **Revisar lançamento**
3. Taxa de lançamento: 100% (lançamento completo)
4. **Iniciar lançamento para produção**

---

## ⏱️ Fase 5: Revisão do Google

### Tempo de Revisão

- Primeiro app: 2-3 dias úteis
- Atualizações: 2-24 horas

### Possíveis Problemas Comuns

#### 1. Permissões de Localização

**Solução**: Justificar uso em "Declarações" no Console

```
O Rota Mestre usa localização para:
- Mostrar posição do motorista no mapa
- Calcular rotas otimizadas
- Navegação turn-by-turn
- Registrar local de entrega
```

#### 2. Permissão de Câmera

**Solução**: Justificar uso

```
Câmera usada exclusivamente para:
- Capturar fotos de comprovação de entrega
- Documentar problemas na entrega
```

#### 3. Política de Privacidade

**Requisito**: Link acessível e conteúdo completo

---

## 🔄 Atualizações Futuras

### Processo Simplificado

1. Incrementar `versionCode` no app.json
2. Atualizar `version` se necessário
3. Gerar novo build: `eas build --platform android --profile production`
4. Upload no Console → Produção → Novo release
5. Adicionar notas de lançamento
6. Lançar

### Versionamento Recomendado

- **Major.Minor.Patch**: 1.0.0
- **versionCode**: Sempre incrementar (1, 2, 3...)
- Exemplo:
  - v1.0.0 → versionCode 1
  - v1.0.1 → versionCode 2
  - v1.1.0 → versionCode 3

---

## 📊 Monitoramento Pós-Lançamento

### Métricas Importantes

- Taxa de instalação/desinstalação
- Avaliações e reviews
- Crashes e ANRs
- Vitals do Android

### Responder Reviews

- Responder rapidamente (< 24h)
- Ser profissional e solícito
- Indicar correções em próximas versões

---

## 🚨 Comandos Úteis

```bash
# Verificar configuração atual
eas build:list

# Build de teste (APK)
eas build --platform android --profile preview

# Build de produção (AAB)
eas build --platform android --profile production

# Submeter automaticamente (após configurar)
eas submit --platform android

# Ver status dos builds
eas build:view

# Baixar build
eas build:download --platform android
```

---

## 📱 Testando Antes de Publicar

### Teste Interno (Recomendado)

1. Play Console → Teste → Teste interno
2. Criar release de teste
3. Adicionar testadores (até 100 emails)
4. Testar por 1-2 semanas
5. Coletar feedback
6. Promover para produção

### Requisitos para Teste

- [ ] Todas funcionalidades principais funcionando
- [ ] Sem crashes conhecidos
- [ ] Performance aceitável
- [ ] Login/cadastro funcionando
- [ ] Pagamentos configurados (se aplicável)

---

## 💡 Dicas Importantes

1. **ASO (App Store Optimization)**
   - Use keywords relevantes no título e descrição
   - Screenshots atrativos com texto explicativo
   - Ícone profissional e reconhecível

2. **Primeira Impressão**
   - Os primeiros 7 dias são cruciais
   - Responda reviews rapidamente
   - Corrija bugs críticos imediatamente

3. **Conformidade**
   - Sempre declare uso de dados sensíveis
   - Mantenha política de privacidade atualizada
   - Siga guidelines do Google rigorosamente

4. **Performance**
   - App < 100MB ideal (use assets on-demand se necessário)
   - Startup time < 5 segundos
   - Minimize uso de bateria

---

## 🔗 Links Úteis

- [Google Play Console](https://play.google.com/console)
- [Diretrizes de Qualidade](https://developer.android.com/docs/quality-guidelines)
- [Material Design](https://material.io/design)
- [Expo EAS Build](https://docs.expo.dev/build/introduction/)
- [Play Console Help](https://support.google.com/googleplay/android-developer)

---

## ✅ Checklist Final Antes de Publicar

- [ ] App testado em diferentes dispositivos
- [ ] Sem dados de teste/desenvolvimento
- [ ] APIs apontando para produção
- [ ] Backup do keystore (EAS gerencia isso)
- [ ] Screenshots profissionais
- [ ] Textos revisados (sem erros)
- [ ] Política de privacidade publicada
- [ ] Termos de uso (se aplicável)
- [ ] Suporte configurado (email/site)
- [ ] Plano de marketing pronto

---

**Tempo Total Estimado**: 3-5 dias úteis do início ao app publicado

**Custo Total**: $25 USD (taxa única do Google)
