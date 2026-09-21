# Configura as Branch Protection Rules da `main`.
# Requer: GitHub CLI (gh) instalado, autenticado e com permissao de admin.
#
# ATENCAO - este script SOBRESCREVE a protecao inteira (PUT, nao PATCH). O que
# nao estiver declarado aqui e APAGADO da regra. Antes de rodar, guarde o estado
# atual:
#
#   gh api repos/BadWolf1509/rotamestre-app/branches/main/protection > protecao-backup.json
#
# OS CHECKS PRECISAM EXISTIR DE VERDADE. Exigir um check que nenhum workflow
# produz trava TODOS os PRs para sempre: o status nunca chega, e o merge nunca
# libera. Ate 21/09/2026 este script pedia `Run Tests (20.x)` enquanto a matriz
# do CI rodava em 22.x.
#
# (Ate 21/09/2026 este arquivo tambem nao EXECUTAVA: a linha do `gh api` usava
# `<<< $config`, que e here-string do bash. Em PowerShell `<` e operador
# reservado, entao o script morria com erro de parse antes de rodar. A versao
# atual passa o corpo por arquivo temporario, que e o caminho suportado.)

$ErrorActionPreference = "Stop"

$REPO = "BadWolf1509/rotamestre-app"
$BRANCH = "main"

# Os quatro checks BLOQUEANTES, conferidos em 21/09/2026:
#   Run Tests (22.x)          test.yml     -> jobs.test.name + matrix node 22.x
#   Visual Regression (22.x)  test.yml     -> bloqueante desde 25/08/2026
#   TypeScript & Linting      quality.yml  -> jobs.quality.name
#   Bundle Size Check         quality.yml  -> jobs.bundle-size.name (desde 21/09/2026)
#
# Nao-bloqueantes de proposito, por isso FORA daqui: `Design System Drift Check
# (22.x)` e o deploy do Vercel.
$CHECKS = @(
    "Run Tests (22.x)",
    "Visual Regression (22.x)",
    "TypeScript & Linting",
    "Bundle Size Check"
)

Write-Host "Configurando Branch Protection da branch '$BRANCH' em $REPO" -ForegroundColor Cyan
Write-Host ""

try {
    $null = Get-Command gh -ErrorAction Stop
    Write-Host "OK - GitHub CLI encontrado" -ForegroundColor Green
} catch {
    Write-Host "ERRO - GitHub CLI (gh) nao esta instalado." -ForegroundColor Red
    Write-Host "   Instale em: https://cli.github.com/" -ForegroundColor Yellow
    exit 1
}

gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO - GitHub CLI nao esta autenticado." -ForegroundColor Red
    Write-Host "   Execute: gh auth login" -ForegroundColor Yellow
    exit 1
}
Write-Host "OK - GitHub CLI autenticado" -ForegroundColor Green
Write-Host ""

# Recusa aplicar um check que nenhum workflow declara - e este o erro que trava
# o repositorio, e ele e barato de pegar aqui.
Write-Host "Conferindo se os checks existem nos workflows..." -ForegroundColor Cyan
$repoRoot = Split-Path -Parent $PSScriptRoot
$workflows = Get-ChildItem -Path (Join-Path $repoRoot ".github\workflows") -Filter "*.yml" |
    ForEach-Object { Get-Content $_.FullName -Raw }
$workflowsTexto = $workflows -join "`n"

$linhasNodeVersion = (($workflowsTexto -split "`n") | Where-Object { $_ -match 'node-version' }) -join "`n"

foreach ($CHECK in $CHECKS) {
    # O nome do job pode estar com ou sem aspas no YAML.
    $base = ($CHECK -split ' \(')[0]
    $achou = $workflowsTexto.Contains("name: $base") -or
             $workflowsTexto.Contains("name: `"$base`"") -or
             $workflowsTexto.Contains("name: '$base'")
    if (-not $achou) {
        Write-Host "ERRO - O check '$CHECK' nao corresponde a nenhum job em .github/workflows/." -ForegroundColor Red
        Write-Host "   Exigir um check inexistente TRAVA todos os PRs. Abortando." -ForegroundColor Yellow
        exit 1
    }

    # A VERSAO ENTRE PARENTESES TAMBEM PRECISA CONFERIR. O sufixo "(22.x)" vem da
    # matriz do Node, e e exatamente ai que o bug de 21/09/2026 morava: o script
    # pedia "Run Tests (20.x)" enquanto a matriz rodava 22.x. Conferir so o nome
    # base daria verde nesse caso - foi medido.
    if ($CHECK -match '\(([^)]+)\)') {
        $ver = $Matches[1]
        if (-not $linhasNodeVersion.Contains($ver)) {
            Write-Host "ERRO - O check '$CHECK' pede Node '$ver', que nao aparece em nenhuma" -ForegroundColor Red
            Write-Host "   matriz 'node-version' de .github/workflows/." -ForegroundColor Yellow
            Write-Host "   O status se chamaria outra coisa e nunca chegaria - isso TRAVA" -ForegroundColor Yellow
            Write-Host "   todos os PRs. Abortando." -ForegroundColor Yellow
            exit 1
        }
    }

    Write-Host "   OK - $CHECK" -ForegroundColor Green
}
Write-Host ""

$config = @{
    required_status_checks = @{
        strict = $true
        contexts = $CHECKS
    }
    enforce_admins = $false
    required_pull_request_reviews = @{
        dismiss_stale_reviews = $true
        require_code_owner_reviews = $false
        required_approving_review_count = 1
        require_last_push_approval = $false
    }
    required_conversation_resolution = @{ enabled = $true }
    restrictions = $null
    allow_force_pushes = @{ enabled = $false }
    allow_deletions = @{ enabled = $false }
    block_creations = @{ enabled = $false }
    required_linear_history = @{ enabled = $true }
    allow_fork_syncing = @{ enabled = $false }
} | ConvertTo-Json -Depth 10

# `gh api --input` le de arquivo (ou de '-' para stdin). Gravamos UTF-8 SEM BOM:
# o BOM entraria no corpo do JSON e a API recusaria.
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) "branch-protection-$PID.json"
[System.IO.File]::WriteAllText($tmp, $config, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "Aplicando protecao..." -ForegroundColor Cyan
try {
    gh api --method PUT -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" "/repos/$REPO/branches/$BRANCH/protection" --input $tmp | Out-Null

    # `gh` e executavel nativo: falha dele NAO vira excecao, so muda o
    # $LASTEXITCODE. Sem esta checagem o script imprimia "sucesso" tendo falhado.
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRO - a API recusou a alteracao (exit $LASTEXITCODE)." -ForegroundColor Red
        exit 1
    }
    Write-Host "   OK - protecao aplicada." -ForegroundColor Green
} finally {
    Remove-Item $tmp -ErrorAction SilentlyContinue
}
Write-Host ""

# Confirma lendo de volta: a resposta do PUT nao prova o estado final.
Write-Host "Conferindo o que ficou gravado:" -ForegroundColor Cyan
gh api "/repos/$REPO/branches/$BRANCH/protection" --jq '"  checks: " + ([.required_status_checks.checks[].context] | join(" | ")) + "\n  up-to-date obrigatorio: " + (.required_status_checks.strict | tostring) + "\n  aprovacoes exigidas: " + (.required_pull_request_reviews.required_approving_review_count | tostring) + "\n  historico linear: " + (.required_linear_history.enabled | tostring) + "\n  admins sujeitos as regras: " + (.enforce_admins.enabled | tostring)'

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Observacoes que mudam como isto se comporta:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  - enforce_admins=false e DELIBERADO. O gestor e autor de quase todos os"
Write-Host "    PRs e ninguem aprova o proprio PR no GitHub; sem segundo revisor, o"
Write-Host "    merge sai por 'gh pr merge --squash --admin'. Ligar enforce_admins"
Write-Host "    travaria todo merge do projeto."
Write-Host ""
Write-Host "  - required_linear_history=true proibe merge commit. So 'Squash and"
Write-Host "    merge' ou 'Rebase and merge' passam."
Write-Host ""
Write-Host "  - Existe so a branch 'main' - nao ha 'develop' neste repositorio."
Write-Host ""
Write-Host "Verifique em:" -ForegroundColor Cyan
Write-Host "   https://github.com/$REPO/settings/branches" -ForegroundColor Blue
Write-Host ""
