# 🚗 RotaMestre - Project Context

**Última atualização:** 24/10/2025 15:15
**Versão:** 2.1
**Status:** Fase 1 - Sprint 1.1 ✅ COMPLETO | Sprint 1.2 ⏳ PRÓXIMO

---

## 🎯 O que é o RotaMestre?

SaaS para otimização de rotas de entrega/coleta usando Google Maps API.

**Problema resolvido:** Empresas perdem 15-20% em combustível e tempo com rotas não otimizadas.

**Solução:** App mobile que cria rotas otimizadas automaticamente e guia motoristas turn-by-turn.

---

## 👥 Usuários

1. **Gestor** - Cria rotas, atribui motoristas, monitora execução
2. **Motorista** - Recebe rota, navega para paradas, marca conclusão

---

## 🛠️ Stack Tecnológica

- **Frontend:** React Native + Expo v54 + TypeScript
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + Storage)
- **Maps:** Google Maps API (Directions, Geocoding, Places)
- **Deploy:** Vercel (web), EAS (mobile)
- **URL:** https://app.rotamestre.tec.br

---

## 📊 Status Atual: 65% Completo ⬆️ (+10%)

### ✅ Implementado

**Infraestrutura (90%)**
- Database PostgreSQL com 5 tabelas (unidades, usuarios, rotas, paradas, logs)
- Auth com Supabase (papéis: gestor, motorista)
- RLS (Row Level Security) por unidade
- Triggers automáticos e views otimizadas
- **Metro bundler configurado para web** (resolve async-require do Supabase Realtime)

**Gestor (70%)**
- Dashboard com cards de estatísticas
- Criar rota com formulário completo
- Geocoding de endereços (Google Geocoding API)
- **Otimização de rota (100%)** - Google Directions API com optimize:true
- Seleção de motorista
- Visualizar rota no mapa (componente MapaRN)
- Histórico de rotas (lista básica)

**Motorista (75%)** ⬆️ (+30%)
- Ver rotas do dia
- Lista de paradas em ordem
- Botões concluir/pular parada
- Atualização de status no banco
- **🎉 NAVEGAÇÃO GPS IMPLEMENTADA** - Botão "Como Chegar" integrado
  - Menu de escolha: Waze, Google Maps, Apple Maps (iOS)
  - Fallback para versão web
  - Validação de coordenadas
  - Funciona em iOS, Android e Web

**Design System (100%)**
- Design tokens (`@/lib/design-tokens`)
- 9 componentes reutilizáveis (AppButton, AppCard, AppInput, etc)
- Fontes customizadas (Viga, Nunito Sans)
- Grid de 4 pontos

---

### 🔴 Gaps Críticos (Bloqueadores)

| # | Gap | Etapa | Impacto | Status |
|---|-----|-------|---------|--------|
| 1 | ~~**Navegação GPS**~~ | Motorista #4 | 🔴 BLOQUEADOR TOTAL | ✅ **RESOLVIDO** |
| 2 | **Autocomplete** | Gestor #3 | 🔴 20%+ erro geocoding | ⏳ **PRÓXIMO** (2-3 dias) |
| 3 | **Upload Foto** | Motorista #5 | 🟡 Sem prova entrega | 🔜 Pendente (3-4 dias) |

**Detalhes completos:** `docs/development/ANALISE_GAPS_POR_FLUXO.md`

---

### 🟡 Gaps Importantes (Fase 2)

| # | Gap | Prioridade | Estimativa |
|---|-----|------------|------------|
| 4 | Real-time tracking | ALTA | 5-7 dias |
| 5 | Mapa visual motorista | MÉDIA | 1 dia |
| 6 | Filtros/Exportação | MÉDIA | 3-4 dias |
| 7 | Notificações push | MÉDIA | 2-3 dias |

---

## ✅ Sprint 1.1 CONCLUÍDO: Navegação GPS (24/10/2025)

**Status:** ✅ **IMPLEMENTADO E TESTADO**

### 🎯 Objetivo Alcançado
Motorista agora abre navegação com 1 clique para chegar às paradas

### 📦 Entregáveis

**Arquivos Criados:**
1. ✅ [src/lib/navigation.ts](src/lib/navigation.ts) - Helper principal (330 linhas, 6 funções)
2. ✅ [src/lib/navigation.web.ts](src/lib/navigation.web.ts) - Versão web (70 linhas)

**Arquivos Modificados:**
3. ✅ [app/motorista/rota.tsx](app/motorista/rota.tsx#L214-L223) - Botão "Como Chegar" 🧭
4. ✅ [app/motorista/checkpoints.tsx](app/motorista/checkpoints.tsx) - Botão "Como Chegar" 🧭
5. ✅ [metro.config.js](metro.config.js#L19-L32) - Resolver para Supabase Realtime

**Arquivos Movidos:**
6. ✅ `app/motorista/rota-backup.tsx` → `backup-files/` (evita bundling desnecessário)

### ✨ Funcionalidades

**Mobile (iOS/Android):**
- Menu nativo de escolha (ActionSheet iOS / Alert Android)
- Suporte para: Waze 🚗, Google Maps 🗺️, Apple Maps 🍎
- Fallback automático para web se app não instalado
- Validação de coordenadas (-90/90, -180/180)

**Web:**
- Abre Google Maps em nova aba do navegador
- URL: `google.com/maps/dir/?api=1&destination=lat,lng`

### 🎉 Critérios de Sucesso (TODOS ATINGIDOS)

- ✅ Motorista navega para qualquer parada com 1-2 cliques
- ✅ Funciona em iOS, Android e Web
- ✅ Suporta Waze, Google Maps e Apple Maps
- ✅ Fallback para versão web se app não instalado
- ✅ Build web sem erros (1035 módulos compilados)

### 🔧 Problemas Resolvidos

1. ✅ Erro react-native-maps no web → Movido `rota-backup.tsx` para fora do `app/`
2. ✅ Erro Supabase Realtime (async-require) → Configurado resolver customizado no metro.config.js
3. ✅ Web bundling → 100% funcional, servidor em http://localhost:8083

---

## 🚀 Próximo Sprint: Sprint 1.2 - Autocomplete de Endereços (2-3 dias)

**Objetivo:** Reduzir erros de geocoding de 20%+ para <5% com autocomplete Google Places

**Problema:** Gestor digita endereços manualmente, causando 20%+ de erro no geocoding (endereços incompletos, erros de digitação)

**Solução:** Adicionar autocomplete com Google Places API no formulário de criação de rota

**Arquivos a modificar:**
1. `app/gestor/criar-rota.tsx` - Substituir TextInput por autocomplete
2. `src/components/AddressAutocomplete.tsx` (criar) - Componente reutilizável
3. `src/lib/google.ts` - Adicionar helper `autocompleteAddress()`

**Referência:** `docs/development/ANALISE_GAPS_POR_FLUXO.md` linhas 600-800

**Critério de sucesso:**
- ⏳ Autocomplete funciona com mínimo 3 caracteres
- ⏳ Retorna sugestões em tempo real (<500ms)
- ⏳ Preenche endereço completo ao selecionar
- ⏳ Valida e obtém coordenadas automaticamente
- ⏳ Taxa de erro de geocoding < 5%

---

## 📁 Estrutura do Projeto

```
rotamestre-app/
├── app/                    # Expo Router (telas)
│   ├── auth/              # Login, cadastro
│   ├── gestor/            # Dashboard, criar rota, histórico, mapa
│   └── motorista/         # Rotas, checkpoints (com navegação GPS ✅)
├── src/
│   ├── components/        # 9 componentes reutilizáveis
│   │   ├── MapaRN.tsx    # Mapa nativo (react-native-maps)
│   │   ├── MapaWeb.tsx   # Mapa web (Google Maps JS)
│   │   ├── MapaAdapter.tsx # Wrapper inteligente (detecta plataforma)
│   │   └── ...
│   ├── hooks/
│   │   └── useUser.ts    # Hook de autenticação
│   └── lib/
│       ├── supabase.ts   # Cliente Supabase (mobile)
│       ├── supabase.web.ts # Cliente Supabase (web, sem realtime)
│       ├── navigation.ts # Helper de navegação GPS (mobile) ✨ NOVO
│       ├── navigation.web.ts # Helper navegação (web) ✨ NOVO
│       ├── google.ts     # Google Maps API helpers
│       ├── auth.ts       # Auth helpers
│       └── design-tokens.ts
├── database/
│   └── migrations/        # 22 migrations SQL
├── backup-files/          # Arquivos de backup (fora do bundle)
└── docs/
    ├── development/
    │   ├── ANALISE_GAPS_POR_FLUXO.md          # ← Gaps detalhados + código
    │   ├── ANALISE_FUNCIONALIDADES_CORE.md    # ← Status 65%
    │   ├── VISAO_GERAL_USABILIDADE.md         # Jornadas UX
    │   └── COMPONENTS_LIBRARY.md              # Design system
    └── setup/
        └── DEPLOYMENT_GUIDE.md
```

---

## 🔗 Documentação Importante

**Para entender gaps e implementação:**
- **Gaps por Fluxo:** `docs/development/ANALISE_GAPS_POR_FLUXO.md` (código completo de cada gap)
- **Funcionalidades Core:** `docs/development/ANALISE_FUNCIONALIDADES_CORE.md` (status detalhado)

**Para entender arquitetura:**
- **Arquitetura:** `.claude/ARCHITECTURE.md`
- **Design Tokens:** `docs/development/DESIGN_TOKENS_GUIDE.md`
- **Biblioteca de Componentes:** `docs/development/COMPONENTS_LIBRARY.md`

**Para deployment:**
- **Deployment Guide:** `docs/setup/DEPLOYMENT_GUIDE.md`
- **DNS Setup:** `docs/setup/DOMAIN_COMPLETE_GUIDE.md`

---

## 💡 Princípios de Desenvolvimento

1. **Funcionalidade antes de monetização** - Produto usável > planos/trial
2. **Mobile-first** - Motorista usa 90% no celular
3. **"Tudo em um clique"** - Princípio UX central (ver `VISAO_GERAL_USABILIDADE.md`)
4. **Design tokens** - Sempre usar `@/lib/design-tokens`, nunca hardcode cores/fontes
5. **RLS por unidade** - Cada unidade vê apenas seus dados

---

## 🧪 Como Testar

```bash
# Web (navegador)
npm run web

# Mobile (Expo Go)
npm start
# Scan QR code no celular

# Mobile (Development Build - recomendado para testar Maps)
npx expo run:android
npx expo run:ios      # Requer Mac
```

**Nota:** React Native Maps não funciona no Expo Go iOS (limitação conhecida).
**Solução:** Usar web ou development build.
**Ref:** `docs/development/EXPO_GO_LIMITATION.md`

---

## 📞 Informações Técnicas

**Database:**
- Supabase Project ID: `xezslsyxjivunmhhyxtd`
- URL: `https://xezslsyxjivunmhhyxtd.supabase.co`
- Region: `us-east-1`

**Domínio:**
- Produção: `https://app.rotamestre.tec.br`
- Vercel: `https://rotamestre-app.vercel.app`

**MCP Servers Configurados:**
- ✅ filesystem (read, write, edit)
- ✅ git (log, diff, blame, branches)
- ✅ database (queries, analytics, quotes)

---

## 🎯 Roadmap Resumido

### **Fase 1: DESBLOQUEIO CRÍTICO (5-7 dias restantes)**
- ✅ Sprint 1.1: Navegação GPS (COMPLETO - 24/10/2025)
- ⏳ Sprint 1.2: Autocomplete (2-3 dias) ← **PRÓXIMO**
- 🔜 Sprint 1.3: Upload Foto (3-4 dias)

**Progresso Fase 1:** 33% (1/3 sprints completos)

**Após Fase 1:** Produto TESTÁVEL em produção com clientes piloto

### **Fase 2: OTIMIZAÇÃO (11-17 dias)**
- Real-time tracking
- Mapa visual motorista
- Filtros e relatórios
- Notificações push

### **Fase 3: POLIMENTO (6-8 dias)**
- Métricas avançadas
- Resumo do motorista
- Assinatura digital

### **Fase 4: MONETIZAÇÃO (depois)**
- Sistema de planos
- Integração Asaas
- Trial de 7 dias
- NPS automation

---

## 🔧 Troubleshooting Rápido

**Erro: "RNMapsAirModule not found" no Expo Go iOS**
- Usar web (`npm run web`) ou development build (`npx expo run:ios`)
- Ver: `docs/development/EXPO_GO_LIMITATION.md`

**Erro: RLS ao criar rota**
- Executar: `node tools/scripts/db/apply-rls-fix.js`
- Ver: `docs/operations/RLS_FIX_GUIDE.md`

**Geocoding retorna null**
- Verificar `.env`: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- Usar endereço completo: "Rua X, 123 - Bairro - Cidade, Estado"
- Implementar Autocomplete (Sprint 1.2 resolve isso)

---

**Última atualização:** 24/10/2025 15:15 (Sprint 1.1 concluído)
**Próxima atualização:** Após completar Sprint 1.2 (Autocomplete)
**Manter este arquivo atualizado a cada sprint concluído** ✅

---

## 📈 Histórico de Atualizações

- **v2.1** (24/10/2025 15:15) - ✅ Sprint 1.1 (Navegação GPS) concluído
  - Navegação GPS implementada (mobile + web)
  - Metro bundler configurado para web
  - Status atualizado: 55% → 65%
  - Motorista 45% → 75%

- **v2.0** (24/10/2025) - Análise de gaps e planejamento Sprint 1.1
- **v1.0** (inicial) - Criação do project context
