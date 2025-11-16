# Script para configurar Branch Protection Rules automaticamente
# Requer: GitHub CLI (gh) instalado e autenticado

$ErrorActionPreference = "Stop"

$REPO = "BadWolf1509/rotamestre-app"
$BRANCHES = @("main", "develop")

Write-Host "🔒 Configurando Branch Protection Rules..." -ForegroundColor Cyan
Write-Host ""

# Verificar se gh está instalado
try {
    $null = Get-Command gh -ErrorAction Stop
    Write-Host "✅ GitHub CLI encontrado" -ForegroundColor Green
} catch {
    Write-Host "❌ GitHub CLI (gh) não está instalado." -ForegroundColor Red
    Write-Host "   Instale em: https://cli.github.com/" -ForegroundColor Yellow
    exit 1
}

# Verificar autenticação
try {
    gh auth status 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw }
    Write-Host "✅ GitHub CLI autenticado" -ForegroundColor Green
} catch {
    Write-Host "❌ GitHub CLI não está autenticado." -ForegroundColor Red
    Write-Host "   Execute: gh auth login" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Configurar proteção para cada branch
foreach ($BRANCH in $BRANCHES) {
    Write-Host "📍 Configurando proteção para branch: $BRANCH" -ForegroundColor Cyan

    # JSON de configuração
    $config = @{
        required_status_checks = @{
            strict = $true
            contexts = @("test", "quality")
        }
        enforce_admins = $false
        required_pull_request_reviews = @{
            dismiss_stale_reviews = $true
            require_code_owner_reviews = $false
            required_approving_review_count = 1
            require_last_push_approval = $false
        }
        required_conversation_resolution = @{
            enabled = $true
        }
        restrictions = $null
        allow_force_pushes = @{
            enabled = $false
        }
        allow_deletions = @{
            enabled = $false
        }
        block_creations = @{
            enabled = $false
        }
        required_linear_history = @{
            enabled = $true
        }
        allow_fork_syncing = @{
            enabled = $true
        }
    } | ConvertTo-Json -Depth 10

    # Aplicar configuração
    try {
        $response = gh api `
            --method PUT `
            -H "Accept: application/vnd.github+json" `
            -H "X-GitHub-Api-Version: 2022-11-28" `
            "/repos/$REPO/branches/$BRANCH/protection" `
            --input - <<< $config

        Write-Host "   ✅ Branch $BRANCH protegida com sucesso!" -ForegroundColor Green
    } catch {
        Write-Host "   ⚠️  Erro ao proteger branch $BRANCH" -ForegroundColor Yellow
        Write-Host "   Detalhes: $_" -ForegroundColor DarkGray
    }

    Write-Host ""
}

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "✅ Branch Protection Rules configuradas!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Configurações aplicadas:" -ForegroundColor Cyan
Write-Host "  • Require pull request before merging"
Write-Host "  • Require 1 approval"
Write-Host "  • Require status checks to pass (test + quality)"
Write-Host "  • Require conversation resolution"
Write-Host "  • Require linear history"
Write-Host "  • Block force pushes"
Write-Host "  • Block branch deletion"
Write-Host ""
Write-Host "🔍 Verifique em:" -ForegroundColor Cyan
Write-Host "   https://github.com/$REPO/settings/branches" -ForegroundColor Blue
Write-Host ""
