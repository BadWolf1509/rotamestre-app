#!/bin/bash

# Configura as Branch Protection Rules da `main`.
# Requer: GitHub CLI (gh) instalado, autenticado e com permissao de admin.
#
# ATENCAO — este script SOBRESCREVE a protecao inteira (PUT, nao PATCH). O que
# nao estiver declarado aqui e APAGADO da regra. Antes de rodar, guarde o estado
# atual:
#
#   gh api repos/BadWolf1509/rotamestre-app/branches/main/protection > protecao-backup.json
#
# OS CHECKS PRECISAM EXISTIR DE VERDADE. Exigir um check que nenhum workflow
# produz trava TODOS os PRs para sempre: o status nunca chega, e o merge nunca
# libera. Ate 21/09/2026 este script pedia `Run Tests (20.x)` enquanto a matriz
# do CI rodava em 22.x — rodar o script teria travado o repositorio. Os nomes
# abaixo saem do campo `name:` dos jobs em .github/workflows/{test,quality}.yml
# e precisam bater LETRA POR LETRA, incluindo a versao do Node entre parenteses.

set -euo pipefail

REPO="BadWolf1509/rotamestre-app"
BRANCH="main"

# Os quatro checks BLOQUEANTES, conferidos em 21/09/2026:
#   Run Tests (22.x)          test.yml     -> jobs.test.name + matrix node 22.x
#   Visual Regression (22.x)  test.yml     -> bloqueante desde 25/08/2026
#   TypeScript & Linting      quality.yml  -> jobs.quality.name
#   Bundle Size Check         quality.yml  -> jobs.bundle-size.name (desde 21/09/2026)
#
# Nao-bloqueantes de proposito, por isso FORA daqui: `Design System Drift Check
# (22.x)` e o deploy do Vercel.
CHECKS=(
    "Run Tests (22.x)"
    "Visual Regression (22.x)"
    "TypeScript & Linting"
    "Bundle Size Check"
)

echo "🔒 Configurando Branch Protection da branch '$BRANCH' em $REPO"
echo ""

if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) não está instalado."
    echo "   Instale em: https://cli.github.com/"
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo "❌ GitHub CLI não está autenticado."
    echo "   Execute: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI autenticado"
echo ""

# Recusa aplicar um check que nenhum workflow declara — e este o erro que trava
# o repositorio, e ele e barato de pegar aqui.
echo "🔍 Conferindo se os checks existem nos workflows..."
for CHECK in "${CHECKS[@]}"; do
    # O nome do job pode estar com ou sem aspas no YAML.
    BASE="${CHECK%% (*}"
    if ! grep -qF "name: $BASE" .github/workflows/*.yml && \
       ! grep -qF "name: \"$BASE\"" .github/workflows/*.yml && \
       ! grep -qF "name: '$BASE'" .github/workflows/*.yml; then
        echo "❌ O check '$CHECK' não corresponde a nenhum job em .github/workflows/."
        echo "   Exigir um check inexistente TRAVA todos os PRs. Abortando."
        exit 1
    fi

    # A VERSAO ENTRE PARENTESES TAMBEM PRECISA CONFERIR. O sufixo "(22.x)" vem da
    # matriz do Node, e e exatamente ai que o bug de 21/09/2026 morava: o script
    # pedia "Run Tests (20.x)" enquanto a matriz rodava 22.x. Conferir so o nome
    # base daria verde nesse caso — foi medido.
    if [[ "$CHECK" == *"("* ]]; then
        VER="${CHECK##*(}"
        VER="${VER%)}"
        if ! grep -h "node-version" .github/workflows/*.yml | grep -qF "$VER"; then
            echo "❌ O check '$CHECK' pede Node '$VER', que não aparece em nenhuma"
            echo "   matriz 'node-version' de .github/workflows/."
            echo "   O status se chamaria outra coisa e nunca chegaria — isso TRAVA"
            echo "   todos os PRs. Abortando."
            exit 1
        fi
    fi

    echo "   ✅ $CHECK"
done
echo ""

echo "📍 Aplicando proteção..."

# `set -e` derruba o script se o gh falhar. NAO use `|| echo "pode já estar
# configurada"`: era o que a versao anterior fazia, e transformava falha de API
# em mensagem tranquilizadora.
gh api \
    --method PUT \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/repos/$REPO/branches/$BRANCH/protection" \
    -f required_status_checks[strict]=true \
    -f "required_status_checks[contexts][]=${CHECKS[0]}" \
    -f "required_status_checks[contexts][]=${CHECKS[1]}" \
    -f "required_status_checks[contexts][]=${CHECKS[2]}" \
    -f "required_status_checks[contexts][]=${CHECKS[3]}" \
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
    -f allow_fork_syncing[enabled]=false \
    > /dev/null

echo "   ✅ Proteção aplicada."
echo ""

# Confirma lendo de volta: a resposta do PUT nao prova o estado final.
echo "🔍 Conferindo o que ficou gravado:"
gh api "/repos/$REPO/branches/$BRANCH/protection" \
    --jq '"  checks: " + ([.required_status_checks.checks[].context] | join(" | "))
        + "\n  up-to-date obrigatório: " + (.required_status_checks.strict | tostring)
        + "\n  aprovações exigidas: " + (.required_pull_request_reviews.required_approving_review_count | tostring)
        + "\n  histórico linear: " + (.required_linear_history.enabled | tostring)
        + "\n  admins sujeitos às regras: " + (.enforce_admins.enabled | tostring)'

echo ""
echo "===================================================="
echo "📋 Observações que mudam como isto se comporta:"
echo ""
echo "  • enforce_admins=false é DELIBERADO. O gestor é autor de quase todos os"
echo "    PRs e ninguém aprova o próprio PR no GitHub; sem segundo revisor, o"
echo "    merge sai por 'gh pr merge --squash --admin'. Ligar enforce_admins"
echo "    travaria todo merge do projeto."
echo ""
echo "  • required_linear_history=true proíbe merge commit. Só 'Squash and"
echo "    merge' ou 'Rebase and merge' passam."
echo ""
echo "  • Existe só a branch 'main' — não há 'develop' neste repositório."
echo ""
echo "🔍 Verifique em:"
echo "   https://github.com/$REPO/settings/branches"
echo ""
