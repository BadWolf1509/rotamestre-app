# 🎨 Visão Geral de Usabilidade – Rota Mestre v2.0

**Versão:** 2.0
**Data:** 23/10/2025
**Status:** Revisado e Aprovado
**Autor:** Equipe RotaMestre

---

## 📋 Índice

1. [Princípio Central de UX](#-princípio-central-de-ux)
2. [Perfis e Jornadas de Uso](#-perfis-e-jornadas-de-uso)
3. [Fluxos de Exceção](#-fluxos-de-exceção)
4. [Gestão de Imprevistos](#-gestão-de-imprevistos)
5. [Fluxo de Interação Unificado](#-fluxo-de-interação-unificado)
6. [Diretrizes de Design e Interação](#-diretrizes-de-design-e-interação)
7. [Sistema de Design](#-sistema-de-design)
8. [Usabilidade por Dispositivo](#-usabilidade-por-dispositivo)
9. [Modo Offline](#-modo-offline)
10. [Princípios de Experiência](#-princípios-de-experiência)
11. [Acessibilidade](#-acessibilidade)
12. [Fluxogramas de Interação](#-fluxogramas-de-interação)

---

## 🎯 PRINCÍPIO CENTRAL DE UX

### **"Tudo em um clique."**

A usabilidade deve transmitir **simplicidade** e **confiança**, com foco em:
- ✅ Reduzir o esforço do usuário
- ✅ Tornar decisões automáticas e intuitivas
- ✅ Eliminar fricção na experiência

### **Benchmark de Referência:**

> "O Rota Mestre deve ser **fácil como usar o Google Maps** e **funcional como um painel de gestão** – sem exigir treinamento técnico."

### **Princípios Fundamentais:**

1. **Simplicidade Extrema** – Cada tela tem UMA ação principal clara
2. **Feedback Imediato** – Sistema sempre confirma ações importantes
3. **Zero Fricção** – Usuário nunca deve "pensar demais"
4. **Autonomia** – Usuário tem controle total, pode corrigir erros facilmente
5. **Consistência** – App mobile e web compartilham mesma linguagem visual

---

## 👤 PERFIS E JORNADAS DE USO

### 1️⃣ GESTOR DA UNIDADE

**Papel:** Responsável por criar rotas, designar motoristas e acompanhar resultados.

**Jobs-to-be-Done:**
- "Preciso planejar rotas de forma rápida e eficiente"
- "Quero saber onde estão meus motoristas em tempo real"
- "Preciso de dados para tomar decisões melhores"

#### **Jornada Completa do Gestor**

##### **Etapa 1: Login Seguro**
- Email/senha com Supabase Auth
- Opção "Lembrar de mim"
- Link "Esqueci minha senha"
- Redirect automático para Dashboard

##### **Etapa 2: Dashboard Inicial**
- Header com logo, notificações, avatar
- Cards de status (Em Andamento, Concluídas, Pendentes, Estatísticas)
- Ação principal: "🔶 [+ Criar Nova Rota]"
- Lista de rotas recentes
- Mapa overview (Profissional+)

##### **Etapa 3: Criação de Rota**

**Passo 1: Informações Básicas**
- Nome da rota (opcional, sugestão automática)
- Seleção de motorista (com indicador de disponibilidade)
- Data picker (default: hoje)
- Observações (opcional)

**Passo 2: Adicionar Paradas**
- Input com Google Places Autocomplete
- Tipo: Entrega / Retirada
- Destinatário e telefone (opcional)
- Drag & Drop para reordenar
- Botão "✨ Otimizar Rota" (Google Routes API)
- Feedback: "Rota otimizada! Economize 12 km e 18 min"

**Passo 3: Salvar e Atribuir**
- Salvar como rascunho
- Salvar e atribuir ao motorista
- Notificação automática ao motorista

##### **Etapa 4: Visualização da Rota**
- Mapa interativo com marcadores numerados
- Polyline conectando paradas
- Posição do motorista em tempo real
- Progresso (barra + contador de paradas)
- Lista de paradas com status
- Estatísticas (distância, tempo, economia)

##### **Etapa 5: Monitoramento (Profissional+)**
- Mapa com todos os motoristas ativos
- Sidebar com motoristas e progresso
- Filtros (status, período, motorista)
- Alertas automáticos (atrasos, problemas)

##### **Etapa 6: Histórico e Relatórios**
- Filtros avançados (data, motorista, status)
- Tabela de rotas concluídas
- Exportação (CSV, PDF, Excel)
- Relatórios:
  - Combustível economizado
  - Tempo economizado
  - Produtividade por motorista
  - Km rodados vs otimizados

---

### 2️⃣ MOTORISTA

**Papel:** Responsável por executar rotas atribuídas de forma rápida e precisa.

**Jobs-to-be-Done:**
- "Preciso seguir a ordem correta das entregas"
- "Quero navegar facilmente até cada parada"
- "Preciso registrar o que aconteceu em cada entrega"

#### **Jornada Completa do Motorista**

##### **Etapa 1: Login Simples**
- Email/CPF + senha
- Opção "Lembrar de mim"
- Redirect para "Minhas Rotas"
- Solicitação de permissões (GPS, câmera, notificações)

##### **Etapa 2: Minhas Rotas**
- Card destacado com rota ativa
- Barra de progresso (6/10 paradas - 60%)
- Informações (km total, tempo restante)
- Próxima parada com ETA
- Botão primário: "Continuar Rota"

##### **Etapa 3: Visualização da Rota**
- Minimap compacto com todas as paradas
- Botão flutuante: "🧭 Abrir navegação"
- Progresso visual
- Lista de paradas (scroll vertical)
- Status por parada:
  - ✅ Concluída (com horário)
  - 🚀 Próxima (destacada)
  - ⏳ Pendente

##### **Etapa 4: Navegação Integrada**
- Modal com opções:
  - 🗺️ Waze
  - 🔍 Google Maps
- Deep link para app escolhido
- Passa endereço completo + coordenadas
- Ao voltar: "Chegou na parada?" [Sim] [Ainda não]

##### **Etapa 5: Concluir Parada**

**Modal de Confirmação:**
- Status:
  - ● Entregue com sucesso
  - ○ Cliente ausente
  - ○ Endereço incorreto
  - ○ Outro problema
- 📸 Adicionar foto (opcional)
- Observações (opcional)
- Botão: "✅ Confirmar"

**Após Confirmar:**
- Animação de sucesso (checkmark verde)
- Toast: "Parada concluída! 7/10 paradas"
- Atualiza progresso
- Notifica gestor (Supabase Realtime)

##### **Etapa 6: Resumo Final**
- 🎯 Estatísticas da rota
- 📍 10/10 paradas concluídas
- 🕐 Tempo total
- Lista de todas as paradas com horários
- Opções:
  - Ver detalhes completos
  - Compartilhar resumo
  - Voltar para início

---

## 🚨 FLUXOS DE EXCEÇÃO

### **EXCEÇÃO 1: Motorista Indisponível**

**Cenário:** Gestor tenta atribuir rota a motorista que já tem rota ativa.

**Resposta do Sistema:**
- ⚠️ Alerta: "Motorista já tem rota ativa"
- Mostra rota atual e previsão de término
- Opções:
  - Aguardar término
  - Atribuir a outro motorista
  - Salvar como rascunho

---

### **EXCEÇÃO 2: Endereço Não Encontrado**

**Cenário:** Google Places não encontra endereço digitado.

**Resposta do Sistema:**
- ⚠️ "Endereço não encontrado"
- Sugestões:
  - Verificar ortografia
  - Incluir bairro e cidade
  - Usar ponto de referência
- Alternativas:
  - 📍 Marcar no mapa
  - ✏️ Adicionar manualmente (com aviso)
  - ❌ Cancelar

---

### **EXCEÇÃO 3: Falha na Otimização**

**Cenário:** Google Routes API retorna erro (timeout, limite excedido).

**Resposta do Sistema:**
- ❌ "Não foi possível otimizar"
- Opções:
  - 🔄 Tentar novamente (retry automático, max 3x)
  - Manter ordem atual
  - Reordenar manualmente
- Aviso: "Rota não otimizada. Pode ter km extras."

---

### **EXCEÇÃO 4: Conexão Perdida (Motorista)**

**Cenário:** Motorista perde conexão durante execução da rota.

**Resposta do Sistema:**
- 🔴 Banner: "Sem conexão"
- Mensagem: "Suas ações serão sincronizadas quando voltar online"

**Funcionalidades Offline:**
- ✅ Ver lista de paradas (pré-carregada)
- ✅ Marcar paradas como concluídas (salva localmente)
- ✅ Ver mapa offline (tiles pré-baixados)
- ✅ Adicionar observações
- ❌ Tracking GPS em tempo real
- ❌ Receber novas rotas

**Ao Reconectar:**
- ✅ "Conexão restaurada"
- Sincronização automática
- Confirmação: "3 paradas foram sincronizadas"

---

## 🛠️ GESTÃO DE IMPREVISTOS

### **IMPREVISTO 1: Cliente Ausente**

**Fluxo:**
1. Motorista seleciona "Cliente ausente"
2. Escolhe o que fez:
   - Deixei aviso na porta
   - Liguei mas não atendeu
   - Entreguei a vizinho
   - Retornei com a encomenda
3. Adiciona detalhes e foto (opcional)
4. Sistema marca parada com badge amarelo
5. Notificação automática para gestor
6. Gestor pode reagendar

---

### **IMPREVISTO 2: Endereço Incorreto**

**Fluxo:**
1. Motorista reporta "Endereço incorreto"
2. Escolhe o problema:
   - Número não existe
   - Endereço não corresponde
   - Local inacessível
3. Opções:
   - **Corrigir:** Input com Google Autocomplete ou marcar GPS atual
   - **Retornar:** Marca como problema e volta
4. Sistema re-otimiza rota automaticamente
5. Notifica gestor da alteração
6. Atualiza ETA de paradas seguintes

---

### **IMPREVISTO 3: Veículo com Problema**

**Fluxo:**
1. Botão "⚠️ Reportar Problema Crítico" sempre visível
2. Motorista escolhe:
   - Veículo quebrado
   - Acidente
   - Problema de saúde
   - Outro
3. Adiciona descrição (obrigatório) e fotos
4. Sistema envia:
   - 🚨 Push notification URGENTE para gestor
   - SMS para número de emergência
   - Localização GPS atual
5. Rota pausada automaticamente
6. Gestor pode:
   - Enviar motorista substituto
   - Remarcar paradas restantes
   - Contatar motorista

---

## 💡 FLUXO DE INTERAÇÃO UNIFICADO

```
┌───────────────────────────────────────────────────────────────┐
│                         SISTEMA ROTAMESTRE                    │
└───────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
              ┌─────▼─────┐             ┌───────▼───────┐
              │   GESTOR  │             │   MOTORISTA  │
              │ (Web/PWA) │             │   (Mobile)   │
              └─────┬─────┘             └───────┬───────┘
                    │                           │
    ┌───────────────┼───────────────┐          │
    │               │               │          │
┌───▼───┐   ┌───────▼───────┐   ┌───▼────┐    │
│ LOGIN │   │ CRIAR ROTA   │   │ EDITAR │    │
└───┬───┘   └───────┬───────┘   └───┬────┘    │
    │               │               │         │
    ▼               ▼               ▼         │
┌────────────┐ ┌────────────┐ ┌────────────┐ │
│ DASHBOARD  │ │ ATRIBUIR   │ │ MONITORAR  │ │
│ (KPIs)     │ │ MOTORISTA  │ │ (TEMPO     │ │
│            │ │            │ │  REAL)     │ │
└────────────┘ └─────┬──────┘ └────────────┘ │
                     │                        │
                     │  [ROTA ATRIBUÍDA]      │
                     │                        │
                     └────────────────────────┼──────┐
                                              │      │
                                         ┌────▼────┐ │
                                         │  LOGIN  │ │
                                         └────┬────┘ │
                                              │      │
                                         ┌────▼──────▼────┐
                                         │ MINHAS ROTAS   │
                                         └────┬───────────┘
                                              │
                                    ┌─────────┼─────────┐
                                    │         │         │
                               ┌────▼────┐ ┌──▼─────┐ ┌──▼──────┐
                               │ VER    │ │INICIAR│ │NAVEGAR │
                               │DETALHES│ │ ROTA  │ │(Waze/  │
                               │        │ │       │ │ Maps)  │
                               └────────┘ └───┬───┘ └────────┘
                                              │
                                         ┌────▼──────────┐
                                         │ EXECUTAR     │
                                         │ CHECKPOINTS  │
                                         └────┬─────────┘
                                              │
                                    ┌─────────┼─────────┐
                                    │         │         │
                               ┌────▼────┐ ┌──▼──────┐ ┌─▼────────┐
                               │CONCLUIR│ │ PULAR  │ │REPORTAR│
                               │ PARADA │ │ PARADA │ │PROBLEMA│
                               └────┬───┘ └───┬────┘ └───┬────┘
                                    │         │          │
                                    └─────────┼──────────┘
                                              │
                                        ┌─────▼──────────┐
                                        │  RESUMO       │
                                        │   FINAL       │
                                        └─────┬─────────┘
                                              │
                            ┌─────────────────┼─────────────────┐
                            │                 │                 │
                    ┌───────▼────────┐  ┌─────▼──────┐  ┌──────▼────┐
                    │ ATUALIZA       │  │ LOGS       │  │ NOTIFICA  │
                    │ DASHBOARD      │  │ AUTOMÁTICOS│  │ GESTOR    │
                    │ (KPIs)         │  │            │  │           │
                    └────────────────┘  └────────────┘  └───────────┘
                            │                 │                 │
                            └─────────────────┴─────────────────┘
                                              │
                                    ┌─────────▼──────────────┐
                                    │ REALTIME SYNC         │
                                    │ (Supabase)            │
                                    └───────────────────────┘
```

**Legenda:**
- 🔵 **Gestor:** Cria, atribui, monitora
- 🟢 **Motorista:** Executa, confirma, reporta
- ⚡ **Realtime:** Sincronização automática entre perfis
- 📊 **Dashboard:** Atualiza KPIs automaticamente
- 🔔 **Notificações:** Alertas para ambos os perfis

---

## 🎨 DIRETRIZES DE DESIGN E INTERAÇÃO

| Princípio | Descrição | Implementação | Exemplo |
|-----------|-----------|---------------|---------|
| **Clareza Visual** | Design limpo, ícones intuitivos, cores consistentes | Usar paleta Brand Guidelines v3.0 | Azul (#2563EB) para ações secundárias, Laranja (#FB923C) para CTAs |
| **Foco em Ação** | Cada tela tem UMA ação principal evidente | Botão primário sempre destacado (laranja, maior) | Dashboard: "+ Criar Nova Rota" |
| **Feedback Imediato** | Sistema sempre confirma ações importantes | Toasts, animações, sons (opcional) | "Rota otimizada com sucesso! ✅" |
| **Consistência** | App mobile e web compartilham mesma linguagem | Mesmos componentes, cores, tipografia | Button, Card, Badge funcionam igual em ambos |
| **Autonomia** | Evitar etapas desnecessárias, permitir correções | Undo/Redo, editar rota, remarcar paradas | Modal "Tem certeza?" em ações críticas |
| **Desempenho** | Interface reage instantaneamente | Cache, pré-carregamento, skeleton loaders | Lista de rotas carrega em <500ms |
| **Acessibilidade** | WCAG 2.1 AA, touch targets ≥44px | Contraste adequado, navegação por teclado | Botões grandes, labels descritivos |
| **Resiliência** | Funciona mesmo com conexão instável | Modo offline, sync automático, retry logic | Motorista marca paradas offline |

---

## 🎨 SISTEMA DE DESIGN

### **CORES**

#### **Principais:**

| Cor | Hex | Uso |
|-----|-----|-----|
| **Azul Primário** | `#2563EB` | Botões secundários, links, bordas (focus) |
| **Laranja Destaque** | `#FB923C` | Botões primários (CTAs), highlights |

#### **Semânticas:**

| Cor | Hex | Uso |
|-----|-----|-----|
| **Verde Sucesso** | `#10B981` | Confirmações, paradas concluídas |
| **Vermelho Erro** | `#EF4444` | Erros, alertas críticos |
| **Amarelo Aviso** | `#F59E0B` | Avisos, paradas puladas |
| **Azul Info** | `#3B82F6` | Informações neutras |

#### **Cinzas (Escala 50-900):**

| Tom | Hex | Uso |
|-----|-----|-----|
| **Gray 50** | `#F9FAFB` | Background secundário |
| **Gray 100** | `#F3F4F6` | Background terciário |
| **Gray 200** | `#E5E7EB` | Bordas, dividers |
| **Gray 300** | `#D1D5DB` | Bordas (hover) |
| **Gray 400** | `#9CA3AF` | Placeholders |
| **Gray 500** | `#6B7280` | Texto secundário |
| **Gray 600** | `#4B5563` | Texto terciário |
| **Gray 700** | `#374151` | Texto hover |
| **Gray 800** | `#1F2937` | Texto forte |
| **Gray 900** | `#111827` | Texto primário |

---

### **TIPOGRAFIA**

#### **Famílias de Fonte:**

| Família | Uso | Pesos Disponíveis |
|---------|-----|-------------------|
| **Viga** | Display (Títulos H1, Logos) | Regular (400) |
| **Nunito Sans** | UI (Corpo, Botões, Labels) | Light (300), Regular (400), Medium (500), SemiBold (600), Bold (700), ExtraBold (800) |

#### **Hierarquia Tipográfica:**

| Elemento | Fonte | Tamanho | Line Height | Peso | Uso |
|----------|-------|---------|-------------|------|-----|
| **H1** | Viga | 28px | 36px | Regular | Títulos de páginas, dashboards |
| **H2** | Nunito Sans | 20px | 28px | Bold | Subtítulos, seções |
| **H3** | Nunito Sans | 16px | 24px | SemiBold | Cards, títulos de componentes |
| **Body** | Nunito Sans | 14px | 22px | Regular | Corpo de texto, parágrafos |
| **Caption** | Nunito Sans | 12px | 18px | Regular | Textos pequenos, labels secundários |
| **Button** | Nunito Sans | 16px | 24px | SemiBold | Texto de botões |

---

### **ESPAÇAMENTO (4-Point Grid)**

| Token | Valor | Uso |
|-------|-------|-----|
| `spacing.xs` | 4px | Gaps pequenos (ícone + texto) |
| `spacing.sm` | 8px | Padding interno de badges, gaps entre elementos |
| `spacing.md` | 16px | Padding padrão de cards, gaps entre seções |
| `spacing.lg` | 24px | Margin entre seções principais |
| `spacing.xl` | 32px | Padding de páginas, espaçamento grande |
| `spacing.2xl` | 40px | Margin top de títulos, espaçamento extra |
| `spacing.3xl` | 48px | Margin entre blocos principais |

---

### **BORDER RADIUS**

| Token | Valor | Uso |
|-------|-------|-----|
| `borderRadius.sm` | 6px | Inputs, tags, badges |
| `borderRadius.md` | 8px | Botões |
| `borderRadius.lg` | 12px | Cards |
| `borderRadius.xl` | 16px | Modals, sheets |
| `borderRadius.full` | 9999px | Pills, avatares circulares |

---

### **SOMBRAS (Elevações)**

```css
/* Elevação 1 - Cards */
.shadow-card {
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1),
              0 1px 2px -1px rgba(0, 0, 0, 0.1);
}

/* Elevação 2 - Modals */
.shadow-modal {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
              0 4px 6px -4px rgba(0, 0, 0, 0.1);
}

/* Elevação 3 - FABs */
.shadow-fab {
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
              0 8px 10px -6px rgba(0, 0, 0, 0.1);
}
```

---

## 📱 USABILIDADE POR DISPOSITIVO

### **Mobile (React Native)**

**Características:**
- Touch-first (botões ≥44px)
- Bottom navigation
- Swipe gestures
- Pull to refresh
- Haptic feedback (opcional)

**Otimizações:**
- Skeleton loaders
- Lazy loading de listas
- Cache de imagens
- Compressão de fotos (antes de upload)

---

### **Web (PWA)**

**Características:**
- Desktop-first (sidebar + content)
- Atalhos de teclado
- Hover states
- Drag & drop
- Multi-select

**Otimizações:**
- Code splitting
- Service workers
- CDN para assets
- Gzip/Brotli compression

---

## 🔌 MODO OFFLINE

### **Motorista (Prioridade Alta)**

**O que funciona:**
- ✅ Ver rotas atribuídas (pré-carregadas)
- ✅ Ver lista de paradas
- ✅ Marcar paradas como concluídas
- ✅ Adicionar observações e fotos
- ✅ Ver mapa offline (tiles pré-baixados)

**O que NÃO funciona:**
- ❌ Tracking GPS em tempo real (para gestor)
- ❌ Receber novas rotas
- ❌ Otimizar rotas

**Sincronização:**
- Ao reconectar: sync automático
- Fila de ações pendentes (AsyncStorage/IndexedDB)
- Resolução de conflitos (timestamp mais recente vence)

---

### **Gestor (Prioridade Média)**

**O que funciona:**
- ✅ Ver dashboard (dados em cache)
- ✅ Ver rotas existentes
- ✅ Criar rascunhos de rotas

**O que NÃO funciona:**
- ❌ Monitoramento em tempo real
- ❌ Atribuir rotas
- ❌ Ver atualizações de status

---

## ♿ ACESSIBILIDADE

### **WCAG 2.1 Nível AA**

**Contraste:**
- Texto normal: ≥4.5:1
- Texto grande (≥18px): ≥3:1
- Componentes interativos: ≥3:1

**Navegação:**
- Tab order lógico
- Focus visible (outline azul)
- Skip links ("Pular para conteúdo")
- Landmarks ARIA

**Screen Readers:**
- Labels descritivos
- ARIA roles apropriados
- Live regions para updates
- Alt text para imagens

**Touch Targets:**
- Mínimo: 44x44px (iOS/Android)
- Espaçamento entre targets: ≥8px

**Texto:**
- Zoom até 200% sem scroll horizontal
- Fonte mínima: 14px (corpo)
- Line height: ≥1.5

---

## 📊 PRINCÍPIOS DE EXPERIÊNCIA

### **1. Redução de Carga Cognitiva**
- **O quê:** Não fazer usuário pensar demais
- **Como:** Defaults inteligentes, sugestões, autocomplete
- **Exemplo:** Nome da rota auto-gerado ("Rota 23/10 - João Silva")

### **2. Lei de Hick**
- **O quê:** Quanto mais opções, mais tempo para decidir
- **Como:** Máximo 3-5 opções visíveis por vez
- **Exemplo:** Modal "Concluir Parada" com 4 opções de status

### **3. Lei de Fitts**
- **O quê:** Quanto maior e mais próximo, mais fácil de clicar
- **Como:** CTAs grandes, bem posicionados
- **Exemplo:** Botão "Continuar Rota" ocupa 80% da largura

### **4. Princípio de Proximidade (Gestalt)**
- **O quê:** Elementos relacionados devem estar próximos
- **Como:** Agrupar informações logicamente
- **Exemplo:** Dados da parada (endereço + destinatário + telefone) em um card

### **5. Feedback Loops**
- **O quê:** Usuário sempre sabe o que está acontecendo
- **Como:** Loading states, toasts, animações
- **Exemplo:** "Otimizando rota... 🧠" → "Rota otimizada! ✅"

---

## 🗺️ FLUXOGRAMAS DE INTERAÇÃO

### **Fluxo: Criar e Executar Rota**

```
[GESTOR]
  │
  ├─ 1. Login
  │    └─ Dashboard
  │
  ├─ 2. Clicar "+ Criar Nova Rota"
  │    └─ Formulário
  │         ├─ Nome (opcional)
  │         ├─ Motorista
  │         ├─ Data
  │         └─ Observações
  │
  ├─ 3. Adicionar Paradas
  │    ├─ Endereço (Autocomplete)
  │    ├─ Tipo (Entrega/Retirada)
  │    ├─ Destinatário
  │    └─ Telefone
  │    └─ Repetir para N paradas
  │
  ├─ 4. Otimizar Rota (opcional)
  │    ├─ Loading: "Otimizando..."
  │    ├─ Sucesso: "Economize 12 km!"
  │    └─ Erro: "Manter ordem atual?"
  │
  ├─ 5. Salvar e Atribuir
  │    ├─ Salva no DB (Supabase)
  │    └─ Notifica motorista (Push)
  │
  └─ 6. Monitorar
       ├─ Mapa em tempo real
       ├─ Progresso (6/10 paradas)
       └─ Alertas automáticos

[MOTORISTA]
  │
  ├─ 1. Login
  │    └─ Minhas Rotas
  │
  ├─ 2. Ver Rota Atribuída
  │    ├─ Card destacado
  │    ├─ Progresso: 0/10
  │    └─ Clicar "Continuar Rota"
  │
  ├─ 3. Ver Lista de Paradas
  │    ├─ Próxima parada destacada
  │    ├─ Minimap
  │    └─ Clicar "🧭 Navegar"
  │
  ├─ 4. Navegar
  │    ├─ Escolher app (Waze/Maps)
  │    ├─ Deep link
  │    └─ Ao voltar: "Chegou?"
  │
  ├─ 5. Concluir Parada
  │    ├─ Escolher status
  │    ├─ Foto (opcional)
  │    ├─ Observações (opcional)
  │    └─ Confirmar
  │         ├─ Animação ✅
  │         ├─ Toast: "7/10 paradas"
  │         └─ Notifica gestor
  │
  ├─ 6. Repetir (3-5) para cada parada
  │
  └─ 7. Resumo Final
       ├─ 🎯 10/10 paradas
       ├─ 📍 38 km
       ├─ ⏱️ 2h 15min
       └─ Compartilhar/Voltar
```

---

## 📝 PRÓXIMOS PASSOS

### **Fase 1: Validação (Sprint 1-2)**
- [ ] Criar protótipos navegáveis (Figma)
- [ ] Testes de usabilidade com 5 gestores
- [ ] Testes de usabilidade com 5 motoristas
- [ ] Ajustar fluxos baseado em feedback

### **Fase 2: Implementação (Sprint 3-8)**
- [ ] Desenvolver componentes do Design System
- [ ] Implementar telas (Gestor)
- [ ] Implementar telas (Motorista)
- [ ] Integração com APIs (Google Maps, Supabase)
- [ ] Testes automatizados (E2E)

### **Fase 3: Refinamento (Sprint 9-10)**
- [ ] Otimizações de performance
- [ ] Ajustes de acessibilidade
- [ ] Modo offline completo
- [ ] Testes beta com usuários reais

### **Fase 4: Lançamento (Sprint 11)**
- [ ] Deploy em produção
- [ ] Documentação final
- [ ] Treinamento de usuários
- [ ] Monitoramento e analytics

---

## 📚 REFERÊNCIAS

- [Brand Guidelines v3.0](./BRAND_GUIDELINES.md)
- [Design Tokens](./DESIGN_TOKENS_QUICK_START.md)
- [Biblioteca de Componentes](./COMPONENT_LIBRARY.md)
- [Arquitetura do Sistema](./ARCHITECTURE.md)
- [Google Maps Platform - Best Practices](https://developers.google.com/maps/documentation/routes/best-practices)
- [Material Design 3 - Components](https://m3.material.io/components)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Última atualização:** 23/10/2025
**Responsável:** Equipe RotaMestre
**Próxima revisão:** Sprint 12 (validação pós-lançamento)
