# 📁 .claude/

Esta pasta contém **diretrizes e documentação** para Claude AI trabalhar neste projeto.

---

## 📄 Arquivos

### 1. DEVELOPMENT_GUIDELINES.md
**Propósito:** Regras de como Claude deve trabalhar no projeto

**Regra de Ouro:**
> "Nenhum código é criado sem aprovação explícita"

**Workflow:**
```
Explicar → Propor → Perguntar → Aguardar → Implementar
```

**Status:** ✅ Obrigatório - Deve ser seguido em TODAS as interações

---

### 2. ARCHITECTURE.md
**Propósito:** Arquitetura definitiva do projeto RotaMestre

**Decisão Principal:**
- `rotamestre.tec.br` → Site institucional (landing page)
- `app.rotamestre.tec.br` → Aplicação Web (PWA)

**Projetos separados, NÃO redirect!**

**Status:** ✅ Aprovado pelo desenvolvedor

---

### 3. Subagentes (subagents/)
**Propósito:** Especialistas Claude AI para domínios específicos

**3 Subagentes Criados:**

#### 3.1. frontend-mobile.md 📱
- **Domínio:** React Native, Expo, Mobile Development, UI/UX
- **Use para:** Telas, componentes, navegação, Expo Router, performance mobile
- **Não use para:** Banco de dados, integrações API, deploy

#### 3.2. backend-database.md 🗄️
- **Domínio:** Supabase, PostgreSQL, RLS, Database Architecture
- **Use para:** Migrations, RLS, queries, triggers, functions, otimização DB
- **Não use para:** UI/UX, componentes React, integração Maps

#### 3.3. integrations-specialist.md 🔌
- **Domínio:** Google Maps, PWA, SEO, APIs Externas, Deploy Web
- **Use para:** Maps API, geocoding, PWA, SEO, deploy Vercel, integrações
- **Não use para:** Componentes mobile, lógica de negócio, database

**Como usar:**
1. Identifique o domínio da tarefa
2. Chame o subagente apropriado
3. O subagente tem conhecimento especializado e contexto focado

**Status:** ✅ Ativo (3 subagentes)

---

## 🎯 Por que esta pasta existe?

### Problema que resolve:
- Claude AI às vezes assume comportamentos sem perguntar
- Pode criar código não solicitado
- Pode interpretar incorretamente requisitos

### Solução:
- Diretrizes claras e explícitas
- Workflow obrigatório
- Arquitetura documentada
- Aprovação sempre necessária

---

## 🤖 Para Claude AI

Se você é um Claude AI trabalhando neste projeto:

1. **LEIA** `DEVELOPMENT_GUIDELINES.md` primeiro
2. **LEIA** `ARCHITECTURE.md` para entender o projeto
3. **IDENTIFIQUE** qual subagente usar (se aplicável)
4. **SIGA** rigorosamente as diretrizes
5. **PERGUNTE** sempre antes de implementar
6. **AGUARDE** aprovação explícita

### 🎯 Quando Usar Subagentes

- **Frontend/Mobile?** → Use `subagents/frontend-mobile.md`
- **Database/Backend?** → Use `subagents/backend-database.md`
- **Integrações/Deploy?** → Use `subagents/integrations-specialist.md`
- **Múltiplos domínios?** → Use o subagente principal e consulte os outros
- **Dúvida?** → Leia os 3 subagentes para decidir

---

## 👨‍💻 Para Desenvolvedores

Estes arquivos servem como:
- **Contrato** com Claude AI
- **Documentação** de decisões arquiteturais
- **Referência** para novos desenvolvedores
- **Histórico** de decisões importantes

Você pode atualizar estes arquivos conforme o projeto evolui.

---

## 🔄 Atualizações

Estes documentos devem ser atualizados quando:
- Arquitetura mudar
- Novas regras forem definidas
- Decisões importantes forem tomadas
- Workflow precisar ser ajustado

---

## 📊 Estrutura Completa

```
.claude/
├── README.md                          # Este arquivo (índice)
├── DEVELOPMENT_GUIDELINES.md          # Workflow obrigatório
├── ARCHITECTURE.md                    # Decisões arquiteturais
└── subagents/                         # Subagentes especializados
    ├── frontend-mobile.md             # React Native + Expo + UI/UX
    ├── backend-database.md            # Supabase + PostgreSQL + RLS
    └── integrations-specialist.md     # Maps + PWA + SEO + Deploy
```

---

**Criado em:** 2025-10-20
**Última atualização:** 2025-10-20
**Responsável:** Wellinton Ribeiro
**Status:** ✅ Ativo (4 docs + 3 subagentes)
