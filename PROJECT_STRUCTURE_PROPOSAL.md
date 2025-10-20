# 🗂️ Proposta de Reorganização - RotaMestre

**Data:** 2025-10-20
**Status:** Proposta para aprovação

---

## 📊 Estrutura Atual (Problemas)

### ❌ Problemas Identificados

1. **13 arquivos .md na raiz** - Dificulta navegação
2. **Documentação misturada** - Docs técnicos + guias + relatórios
3. **Scripts soltos** - Pasta scripts sem organização clara
4. **Falta de separação** - App + MCP + Scripts + Docs no mesmo nível
5. **Arquivos temporários** - VERCEL_*, EMAIL_UPDATE_*, etc na raiz

### 📁 Estrutura Atual

```
rotamestre-app/
├── .claude/                    # Configurações Claude
├── .expo/                      # Expo cache
├── .git/                       # Git
├── .vercel/                    # Vercel config
├── android/                    # Android build
├── app/                        # Expo Router pages
├── assets/                     # Imagens, fontes
├── components/                 # React components
├── database/                   # ???
├── dist/                       # Build output
├── hooks/                      # React hooks
├── lib/                        # Utilities
├── mcp-rotamestre/            # MCP Server
├── scripts/                   # Scripts utilitários
├── supabase/                  # Migrations
├── types/                     # TypeScript types
├── 13 arquivos .md            # ❌ Desorganizado
├── .env
├── app.json
├── package.json
├── tsconfig.json
├── vercel.json
└── ...
```

---

## ✅ Estrutura Proposta

### 🎯 Objetivos

1. **Separação clara** - Docs / Tools / App / Config
2. **Facilitar navegação** - Estrutura lógica e intuitiva
3. **Manter raiz limpa** - Apenas configs essenciais
4. **Agrupar relacionados** - Docs juntos, tools juntos

### 📁 Nova Estrutura (Opção 1 - Recomendada)

```
rotamestre-app/
│
├── 📱 app/                           # Expo App (código-fonte)
│   ├── (auth)/                       # Rotas de autenticação
│   ├── (gestor)/                     # Rotas do gestor
│   ├── (motorista)/                  # Rotas do motorista
│   └── _layout.tsx
│
├── 🧩 src/                           # Código compartilhado
│   ├── components/                   # React components
│   ├── hooks/                        # Custom hooks
│   ├── lib/                          # Libraries & utilities
│   │   ├── supabase.ts
│   │   ├── auth.ts
│   │   └── google.ts
│   ├── types/                        # TypeScript definitions
│   └── config/                       # App configurations
│
├── 🗄️ database/                      # Database related
│   ├── migrations/                   # Supabase migrations
│   │   └── *.sql
│   └── seed/                         # Seed data
│       └── test-data.sql
│
├── 🛠️ tools/                         # Development tools
│   ├── mcp-server/                   # MCP Server
│   │   ├── src/
│   │   │   └── index.js
│   │   ├── .env
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── scripts/                      # Utility scripts
│       ├── auth/                     # Auth related scripts
│       │   ├── create-test-users.js
│       │   └── update-user-emails.js
│       ├── db/                       # Database scripts
│       │   └── apply-seed.js
│       ├── package.json
│       └── README.md
│
├── 📚 docs/                          # Documentação
│   ├── setup/                        # Guias de instalação
│   │   ├── deployment.md
│   │   ├── deploy-web.md
│   │   ├── vercel-setup.md
│   │   └── dns-config.md
│   │
│   ├── development/                  # Desenvolvimento
│   │   ├── project-analysis.md
│   │   ├── ecosystem.md
│   │   └── implementation-plan.md
│   │
│   ├── testing/                      # Testes e QA
│   │   ├── create-test-users.md
│   │   ├── mcp-test-report.md
│   │   └── mcp-test-execution.md
│   │
│   └── operations/                   # Operações
│       ├── dns-status.md
│       └── email-update-summary.md
│
├── 📦 build/                         # Build artifacts
│   ├── web/                          # Web build (Expo)
│   └── android/                      # Android build
│
├── 🌐 public/                        # Static assets (web)
│   ├── favicon.ico
│   └── robots.txt
│
├── 🎨 assets/                        # App assets
│   ├── images/
│   ├── fonts/
│   └── icons/
│
├── ⚙️ config/                        # Configuration files
│   ├── nginx.conf                    # Nginx config
│   ├── vercel.json                   # Vercel config
│   └── _redirects                    # Netlify redirects
│
├── 🔧 .claude/                       # Claude Code settings
├── .expo/                            # Expo cache (gitignored)
├── .git/                             # Git
├── .vercel/                          # Vercel (gitignored)
├── node_modules/                     # Dependencies (gitignored)
│
├── .env                              # Environment variables
├── .env.example                      # Example env vars
├── .gitignore                        # Git ignore rules
├── app.json                          # Expo config
├── package.json                      # Dependencies
├── package-lock.json                 # Lock file
├── tsconfig.json                     # TypeScript config
├── README.md                         # Main README
└── LICENSE                           # License file
```

---

## 📁 Estrutura Proposta (Opção 2 - Monorepo Style)

Se o projeto crescer muito, considere:

```
rotamestre-monorepo/
│
├── apps/
│   ├── mobile/                       # App mobile (Expo)
│   ├── web/                          # App web (Expo Web)
│   └── admin/                        # Painel admin (Next.js) [futuro]
│
├── packages/
│   ├── database/                     # Database & Supabase
│   ├── ui/                           # Componentes compartilhados
│   ├── auth/                         # Autenticação
│   └── api/                          # API clients
│
├── tools/
│   ├── mcp-server/                   # MCP Server
│   └── scripts/                      # Dev scripts
│
├── docs/                             # Documentação
│
└── infrastructure/                   # Infra as Code
    ├── vercel/
    └── supabase/
```

**Nota:** Opção 2 é mais complexa e recomendada apenas se houver múltiplas apps.

---

## 🔄 Plano de Migração (Opção 1)

### Fase 1: Reorganizar Documentação (5 min)

```bash
# Criar estrutura de docs
mkdir -p docs/{setup,development,testing,operations}

# Mover arquivos de setup
mv DEPLOYMENT.md docs/setup/deployment.md
mv DEPLOY_WEB.md docs/setup/deploy-web.md
mv VERCEL_DOMAIN_SETUP.md docs/setup/vercel-domain-setup.md
mv VERCEL_ENV_SETUP.md docs/setup/vercel-env-setup.md
mv dns-config.md docs/setup/dns-config.md

# Mover arquivos de desenvolvimento
mv PROJECT_ANALYSIS.md docs/development/project-analysis.md
mv ECOSYSTEM.md docs/development/ecosystem.md
mv IMPLEMENTATION_PLAN.md docs/development/implementation-plan.md

# Mover arquivos de teste
mv CREATE_TEST_USERS.md docs/testing/create-test-users.md
mv MCP_TEST_REPORT.md docs/testing/mcp-test-report.md
mv MCP_TEST_EXECUTION.md docs/testing/mcp-test-execution.md

# Mover arquivos de operações
mv DNS_STATUS.md docs/operations/dns-status.md
mv EMAIL_UPDATE_SUMMARY.md docs/operations/email-update-summary.md
```

### Fase 2: Reorganizar Código (10 min)

```bash
# Criar estrutura src
mkdir -p src/{components,hooks,lib,types,config}

# Mover código compartilhado
mv components/* src/components/
mv hooks/* src/hooks/
mv lib/* src/lib/
mv types/* src/types/

# Remover diretórios vazios
rmdir components hooks lib types
```

### Fase 3: Reorganizar Database (5 min)

```bash
# Renomear e organizar
mkdir -p database/migrations
mv supabase/migrations/* database/migrations/

# Opcional: mover seed separado
mkdir database/seed
# (mover seed files se existirem)
```

### Fase 4: Reorganizar Tools (10 min)

```bash
# Criar estrutura tools
mkdir -p tools/mcp-server
mkdir -p tools/scripts/{auth,db}

# Mover MCP Server
mv mcp-rotamestre/* tools/mcp-server/
rmdir mcp-rotamestre

# Organizar scripts
mv scripts/create-test-users.js tools/scripts/auth/
mv scripts/update-user-emails.js tools/scripts/auth/
mv scripts/validate-emails.js tools/scripts/auth/
mv scripts/apply-seed.js tools/scripts/db/
mv scripts/package.json tools/scripts/
mv scripts/package-lock.json tools/scripts/

rmdir scripts
```

### Fase 5: Reorganizar Config (5 min)

```bash
# Criar pasta config
mkdir -p config

# Mover configs não essenciais
mv nginx.conf config/
mv _redirects config/

# Manter na raiz: vercel.json (Vercel precisa na raiz)
```

### Fase 6: Atualizar Imports (15 min)

**Arquivos a atualizar:**

1. **app.json** - Atualizar paths se necessário
2. **Todos os arquivos .tsx/.ts** - Atualizar imports:
   ```diff
   - import { useAuth } from '../hooks/useAuth';
   + import { useAuth } from '@/hooks/useAuth';

   - import supabase from '../lib/supabase';
   + import supabase from '@/lib/supabase';
   ```

3. **tsconfig.json** - Adicionar path aliases:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./src/*"],
         "@components/*": ["./src/components/*"],
         "@hooks/*": ["./src/hooks/*"],
         "@lib/*": ["./src/lib/*"],
         "@types/*": ["./src/types/*"]
       }
     }
   }
   ```

4. **tools/mcp-server/.env** - Atualizar path se necessário

5. **README.md** - Atualizar com nova estrutura

### Fase 7: Atualizar .gitignore (2 min)

```gitignore
# Build outputs
build/
dist/
.expo/
.vercel/

# Dependencies
node_modules/
tools/*/node_modules/

# Environment
.env
.env.local
tools/*/.env

# OS
.DS_Store
Thumbs.db
```

---

## 📝 Checklist de Migração

### Preparação
- [ ] Fazer commit de tudo antes de começar
- [ ] Criar branch: `git checkout -b refactor/project-structure`
- [ ] Fazer backup: `cp -r ../rotamestre-app ../rotamestre-app-backup`

### Execução
- [ ] Fase 1: Reorganizar Documentação
- [ ] Fase 2: Reorganizar Código (src/)
- [ ] Fase 3: Reorganizar Database
- [ ] Fase 4: Reorganizar Tools
- [ ] Fase 5: Reorganizar Config
- [ ] Fase 6: Atualizar Imports
- [ ] Fase 7: Atualizar .gitignore

### Validação
- [ ] Testar build: `npx expo export --platform web`
- [ ] Testar MCP: `cd tools/mcp-server && npm start`
- [ ] Testar scripts: `cd tools/scripts && npm run create-users`
- [ ] Verificar imports: Nenhum erro no editor
- [ ] Rodar app: `npx expo start`

### Finalização
- [ ] Commitar mudanças: `git add . && git commit -m "refactor: reorganize project structure"`
- [ ] Testar deploy: `vercel --prod`
- [ ] Atualizar documentação
- [ ] Merge para main

---

## 🎯 Benefícios da Reorganização

### ✅ Melhorias

1. **Navegação clara** - Fácil encontrar arquivos
2. **Separação de conceitos** - Docs / Code / Tools / Config
3. **Escalabilidade** - Fácil adicionar novos módulos
4. **Onboarding** - Novos devs entendem rápido
5. **Manutenção** - Mais fácil manter código organizado
6. **Path aliases** - Imports mais limpos com `@/`

### 📊 Comparação

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Arquivos na raiz | 25+ arquivos | ~10 arquivos |
| Documentação | Espalhada | Organizada em docs/ |
| Código | Misturado | Separado em src/ |
| Tools | Soltos | Agrupados em tools/ |
| Navegação | Difícil | Intuitiva |

---

## 🚨 Riscos e Mitigações

### ⚠️ Riscos

1. **Imports quebrados** - Ao mover arquivos
   - **Mitigação:** Usar path aliases + busca global

2. **Build quebrado** - Paths incorretos
   - **Mitigação:** Testar build após cada fase

3. **Deploy quebrado** - Vercel/Expo configs
   - **Mitigação:** Manter configs na raiz quando necessário

4. **MCP parado** - Paths do .env
   - **Mitigação:** Atualizar paths antes de testar

### ✅ Rollback Plan

```bash
# Se algo der errado:
git reset --hard HEAD
# ou
git checkout main
rm -rf rotamestre-app
mv rotamestre-app-backup rotamestre-app
```

---

## 🤔 Decisão Necessária

### Escolher Opção:

- **Opção 1 (Recomendada):** Estrutura reorganizada single-repo
  - ✅ Mais simples
  - ✅ Suficiente para projeto atual
  - ✅ Migração rápida (50 min)

- **Opção 2:** Monorepo com Turborepo/Nx
  - ⚠️ Mais complexo
  - ⚠️ Necessário apenas se houver múltiplas apps
  - ⚠️ Migração longa (4-6 horas)

### Executar Agora?

- **Sim, executar agora** - Rodar script de migração
- **Não, só documentar** - Apenas registrar proposta
- **Parcial** - Só reorganizar docs primeiro

---

## 📞 Próximos Passos

Aguardando decisão:

1. **Aprovar estrutura?** Opção 1 ou Opção 2?
2. **Executar migração?** Agora ou depois?
3. **Qual escopo?** Completa ou apenas docs?

---

**Criado em:** 2025-10-20
**Tempo estimado:** 50 minutos (Opção 1 completa)
**Status:** ⏳ Aguardando aprovação
