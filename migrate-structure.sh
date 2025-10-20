#!/bin/bash

# ============================================
# Script de Migração - Estrutura do Projeto
# ============================================
#
# IMPORTANTE: Crie um backup antes de executar!
#
# Uso:
#   chmod +x migrate-structure.sh
#   ./migrate-structure.sh [fase]
#
# Fases:
#   docs    - Apenas reorganizar documentação
#   code    - Apenas reorganizar código
#   all     - Migração completa
#   dry-run - Mostrar o que seria feito
# ============================================

set -e  # Exit on error

FASE="${1:-dry-run}"
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_RED='\033[0;31m'
COLOR_BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${COLOR_BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${COLOR_BLUE}║  Migração de Estrutura - RotaMestre          ║${NC}"
echo -e "${COLOR_BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# Verificações Iniciais
# ============================================

if [ "$FASE" != "dry-run" ]; then
    echo -e "${COLOR_YELLOW}⚠️  ATENÇÃO: Esta operação irá mover arquivos!${NC}"
    echo ""
    read -p "Você criou um backup? (s/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        echo -e "${COLOR_RED}❌ Cancelado. Crie um backup primeiro!${NC}"
        echo ""
        echo "Comando sugerido:"
        echo "  cp -r ../rotamestre-app ../rotamestre-app-backup"
        exit 1
    fi
fi

# ============================================
# Função: Executar ou Simular
# ============================================

execute_or_dry() {
    local cmd="$1"
    if [ "$FASE" = "dry-run" ]; then
        echo -e "${COLOR_YELLOW}[DRY-RUN]${NC} $cmd"
    else
        echo -e "${COLOR_GREEN}[EXEC]${NC} $cmd"
        eval "$cmd"
    fi
}

# ============================================
# FASE 1: Reorganizar Documentação
# ============================================

reorganizar_docs() {
    echo -e "\n${COLOR_BLUE}📚 FASE 1: Reorganizar Documentação${NC}\n"

    # Criar estrutura
    execute_or_dry "mkdir -p docs/{setup,development,testing,operations}"

    # Mover arquivos de setup
    execute_or_dry "mv DEPLOYMENT.md docs/setup/deployment.md 2>/dev/null || true"
    execute_or_dry "mv DEPLOY_WEB.md docs/setup/deploy-web.md 2>/dev/null || true"
    execute_or_dry "mv VERCEL_DOMAIN_SETUP.md docs/setup/vercel-domain-setup.md 2>/dev/null || true"
    execute_or_dry "mv VERCEL_ENV_SETUP.md docs/setup/vercel-env-setup.md 2>/dev/null || true"
    execute_or_dry "mv dns-config.md docs/setup/dns-config.md 2>/dev/null || true"

    # Mover arquivos de desenvolvimento
    execute_or_dry "mv PROJECT_ANALYSIS.md docs/development/project-analysis.md 2>/dev/null || true"
    execute_or_dry "mv ECOSYSTEM.md docs/development/ecosystem.md 2>/dev/null || true"
    execute_or_dry "mv IMPLEMENTATION_PLAN.md docs/development/implementation-plan.md 2>/dev/null || true"

    # Mover arquivos de teste
    execute_or_dry "mv CREATE_TEST_USERS.md docs/testing/create-test-users.md 2>/dev/null || true"
    execute_or_dry "mv MCP_TEST_REPORT.md docs/testing/mcp-test-report.md 2>/dev/null || true"
    execute_or_dry "mv MCP_TEST_EXECUTION.md docs/testing/mcp-test-execution.md 2>/dev/null || true"

    # Mover arquivos de operações
    execute_or_dry "mv DNS_STATUS.md docs/operations/dns-status.md 2>/dev/null || true"
    execute_or_dry "mv EMAIL_UPDATE_SUMMARY.md docs/operations/email-update-summary.md 2>/dev/null || true"

    echo -e "${COLOR_GREEN}✅ Documentação reorganizada${NC}"
}

# ============================================
# FASE 2: Reorganizar Código
# ============================================

reorganizar_codigo() {
    echo -e "\n${COLOR_BLUE}🧩 FASE 2: Reorganizar Código${NC}\n"

    # Criar estrutura src
    execute_or_dry "mkdir -p src/{components,hooks,lib,types,config}"

    # Mover código (se existirem e não estiverem vazios)
    if [ -d "components" ] && [ "$(ls -A components)" ]; then
        execute_or_dry "mv components/* src/components/ 2>/dev/null || true"
        execute_or_dry "rmdir components 2>/dev/null || true"
    fi

    if [ -d "hooks" ] && [ "$(ls -A hooks)" ]; then
        execute_or_dry "mv hooks/* src/hooks/ 2>/dev/null || true"
        execute_or_dry "rmdir hooks 2>/dev/null || true"
    fi

    if [ -d "lib" ] && [ "$(ls -A lib)" ]; then
        execute_or_dry "mv lib/* src/lib/ 2>/dev/null || true"
        execute_or_dry "rmdir lib 2>/dev/null || true"
    fi

    if [ -d "types" ] && [ "$(ls -A types)" ]; then
        execute_or_dry "mv types/* src/types/ 2>/dev/null || true"
        execute_or_dry "rmdir types 2>/dev/null || true"
    fi

    echo -e "${COLOR_GREEN}✅ Código reorganizado${NC}"
}

# ============================================
# FASE 3: Reorganizar Database
# ============================================

reorganizar_database() {
    echo -e "\n${COLOR_BLUE}🗄️  FASE 3: Reorganizar Database${NC}\n"

    # Criar estrutura database
    execute_or_dry "mkdir -p database/{migrations,seed}"

    # Mover migrations
    if [ -d "supabase/migrations" ]; then
        execute_or_dry "mv supabase/migrations/* database/migrations/ 2>/dev/null || true"
    fi

    echo -e "${COLOR_GREEN}✅ Database reorganizado${NC}"
}

# ============================================
# FASE 4: Reorganizar Tools
# ============================================

reorganizar_tools() {
    echo -e "\n${COLOR_BLUE}🛠️  FASE 4: Reorganizar Tools${NC}\n"

    # Criar estrutura tools
    execute_or_dry "mkdir -p tools/{mcp-server,scripts/{auth,db}}"

    # Mover MCP Server
    if [ -d "mcp-rotamestre" ]; then
        execute_or_dry "mv mcp-rotamestre/* tools/mcp-server/ 2>/dev/null || true"
        execute_or_dry "mv mcp-rotamestre/.env tools/mcp-server/.env 2>/dev/null || true"
        execute_or_dry "mv mcp-rotamestre/.env.example tools/mcp-server/.env.example 2>/dev/null || true"
        execute_or_dry "rmdir mcp-rotamestre 2>/dev/null || true"
    fi

    # Organizar scripts
    if [ -d "scripts" ]; then
        execute_or_dry "mv scripts/create-test-users.js tools/scripts/auth/ 2>/dev/null || true"
        execute_or_dry "mv scripts/update-user-emails.js tools/scripts/auth/ 2>/dev/null || true"
        execute_or_dry "mv scripts/validate-emails.js tools/scripts/auth/ 2>/dev/null || true"
        execute_or_dry "mv scripts/apply-seed.js tools/scripts/db/ 2>/dev/null || true"
        execute_or_dry "mv scripts/package*.json tools/scripts/ 2>/dev/null || true"
        execute_or_dry "rmdir scripts 2>/dev/null || true"
    fi

    echo -e "${COLOR_GREEN}✅ Tools reorganizado${NC}"
}

# ============================================
# FASE 5: Reorganizar Config
# ============================================

reorganizar_config() {
    echo -e "\n${COLOR_BLUE}⚙️  FASE 5: Reorganizar Config${NC}\n"

    # Criar pasta config
    execute_or_dry "mkdir -p config"

    # Mover configs não essenciais
    execute_or_dry "mv nginx.conf config/ 2>/dev/null || true"
    execute_or_dry "mv _redirects config/ 2>/dev/null || true"

    # vercel.json permanece na raiz (Vercel precisa)

    echo -e "${COLOR_GREEN}✅ Config reorganizado${NC}"
}

# ============================================
# FASE 6: Criar Docs Index
# ============================================

criar_docs_index() {
    echo -e "\n${COLOR_BLUE}📄 Criando README em docs/${NC}\n"

    if [ "$FASE" != "dry-run" ]; then
        cat > docs/README.md <<'EOF'
# 📚 Documentação - RotaMestre

## 📁 Estrutura

- **setup/** - Guias de instalação e configuração
- **development/** - Documentação técnica e arquitetura
- **testing/** - Guias de teste e QA
- **operations/** - Documentos operacionais

## 🚀 Início Rápido

1. [Deployment](setup/deployment.md) - Como fazer deploy
2. [Create Test Users](testing/create-test-users.md) - Criar usuários de teste
3. [Ecosystem](development/ecosystem.md) - Visão geral do sistema

## 📞 Suporte

Para dúvidas, consulte o README principal na raiz do projeto.
EOF
        echo -e "${COLOR_GREEN}✅ docs/README.md criado${NC}"
    else
        echo -e "${COLOR_YELLOW}[DRY-RUN]${NC} Criaria docs/README.md"
    fi
}

# ============================================
# Executar Fases
# ============================================

case "$FASE" in
    docs)
        reorganizar_docs
        criar_docs_index
        ;;
    code)
        reorganizar_codigo
        ;;
    database)
        reorganizar_database
        ;;
    tools)
        reorganizar_tools
        ;;
    config)
        reorganizar_config
        ;;
    all)
        reorganizar_docs
        reorganizar_codigo
        reorganizar_database
        reorganizar_tools
        reorganizar_config
        criar_docs_index
        ;;
    dry-run)
        echo -e "${COLOR_YELLOW}🔍 MODO DRY-RUN - Nenhum arquivo será movido${NC}\n"
        reorganizar_docs
        reorganizar_codigo
        reorganizar_database
        reorganizar_tools
        reorganizar_config
        criar_docs_index
        echo -e "\n${COLOR_BLUE}ℹ️  Execute com 'all' para aplicar mudanças:${NC}"
        echo "  ./migrate-structure.sh all"
        ;;
    *)
        echo -e "${COLOR_RED}❌ Fase inválida: $FASE${NC}"
        echo ""
        echo "Uso: ./migrate-structure.sh [fase]"
        echo ""
        echo "Fases disponíveis:"
        echo "  docs     - Reorganizar documentação"
        echo "  code     - Reorganizar código"
        echo "  database - Reorganizar database"
        echo "  tools    - Reorganizar tools"
        echo "  config   - Reorganizar config"
        echo "  all      - Migração completa"
        echo "  dry-run  - Simular (padrão)"
        exit 1
        ;;
esac

echo ""
echo -e "${COLOR_GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${COLOR_GREEN}║          MIGRAÇÃO CONCLUÍDA COM SUCESSO        ║${NC}"
echo -e "${COLOR_GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$FASE" != "dry-run" ]; then
    echo -e "${COLOR_YELLOW}⚠️  PRÓXIMOS PASSOS:${NC}"
    echo ""
    echo "1. Atualizar imports nos arquivos .tsx/.ts"
    echo "2. Adicionar path aliases no tsconfig.json"
    echo "3. Testar build: npx expo export --platform web"
    echo "4. Testar MCP: cd tools/mcp-server && npm start"
    echo "5. Commitar: git add . && git commit -m 'refactor: reorganize structure'"
    echo ""
fi
