#!/bin/bash

# Script para configurar Branch Protection Rules automaticamente
# Requer: GitHub CLI (gh) instalado e autenticado

set -e

REPO="BadWolf1509/rotamestre-app"
BRANCHES=("main" "develop")

echo "🔒 Configurando Branch Protection Rules..."
echo ""

# Verificar se gh está instalado
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) não está instalado."
    echo "   Instale em: https://cli.github.com/"
    exit 1
fi

# Verificar autenticação
if ! gh auth status &> /dev/null; then
    echo "❌ GitHub CLI não está autenticado."
    echo "   Execute: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI autenticado"
echo ""

# Configurar proteção para cada branch
for BRANCH in "${BRANCHES[@]}"; do
    echo "📍 Configurando proteção para branch: $BRANCH"

    # Criar ou atualizar branch protection
    gh api \
        --method PUT \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "/repos/$REPO/branches/$BRANCH/protection" \
        -f required_status_checks[strict]=true \
        -f "required_status_checks[contexts][]=Run Tests (20.x)" \
        -f "required_status_checks[contexts][]=TypeScript & Linting" \
        -f enforce_admins=false \
        -f required_pull_request_reviews[dismiss_stale_reviews]=true \
        -f required_pull_request_reviews[require_code_owner_reviews]=false \
        -f required_pull_request_reviews[required_approving_review_count]=1 \
        -f required_pull_request_reviews[require_last_push_approval]=false \
        -f required_conversation_resolution[enabled]=true \
        -f restrictions=null \
        -f allow_force_pushes[enabled]=false \
        -f allow_deletions[enabled]=false \
        -f block_creations[enabled]=false \
        -f required_linear_history[enabled]=true \
        -f allow_fork_syncing[enabled]=true \
        && echo "   ✅ Branch $BRANCH protegida com sucesso!" \
        || echo "   ⚠️  Erro ao proteger branch $BRANCH (pode já estar configurada)"

    echo ""
done

echo "===================================================="
echo "✅ Branch Protection Rules configuradas!"
echo ""
echo "📋 Configurações aplicadas:"
echo "  • Require pull request before merging"
echo "  • Require 1 approval"
echo "  • Require status checks to pass (test + quality)"
echo "  • Require conversation resolution"
echo "  • Require linear history"
echo "  • Block force pushes"
echo "  • Block branch deletion"
echo ""
echo "🔍 Verifique em:"
echo "   https://github.com/$REPO/settings/branches"
echo ""
