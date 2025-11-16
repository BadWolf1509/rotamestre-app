# 🎯 Próximos Passos - RotaMestre App

Documento gerado automaticamente em 2025-11-16 após setup completo de CI/CD e análise de cobertura.

## 📊 Status Atual

| Métrica | Valor | Status |
|---------|-------|--------|
| **Testes** | 757/757 (100%) | ✅ Passando |
| **Suites** | 40/40 | ✅ Passando |
| **Cobertura** | 17.7% | ⚠️ Baseline estabelecido |
| **Workflows CI/CD** | 2/2 | ✅ Funcionando |
| **Dependabot PRs** | 13 | 🔄 Aguardando rebase |

### Workflows Ativos
- ✅ **Tests** (`.github/workflows/test.yml`) - 757 testes executados em ~90s
- ✅ **Code Quality** (`.github/workflows/quality.yml`) - TypeScript + ESLint
- 📦 **Dependabot** - Atualizações semanais automatizadas

---

## 🚀 Ações Imediatas (Próximas 24h)

### 1. Configurar Codecov (5 minutos)

**Por que:** Visualização de cobertura em PRs e tracking de progresso ao longo do tempo.

**Como fazer:**
```bash
# 1. Criar conta no Codecov (se não tiver)
# Acesse: https://codecov.io/

# 2. Adicionar repositório rotamestre-app

# 3. Copiar o CODECOV_TOKEN fornecido

# 4. Adicionar como secret no GitHub
# GitHub → rotamestre-app → Settings → Secrets and variables → Actions
# New repository secret:
#   Name: CODECOV_TOKEN
#   Value: [seu token aqui]
```

**Validação:**
- Próximo push para `main` deve enviar cobertura para Codecov
- Ver relatório em: `https://codecov.io/gh/BadWolf1509/rotamestre-app`

**Documentação:** [.github/SETUP_CODECOV.md](.github/SETUP_CODECOV.md)

---

### 2. Fechar/Reabrir PRs do Dependabot (10 minutos)

**Por que:** Os 13 PRs foram criados antes dos fixes de CI e estão falhando.

**Como fazer:**

**Opção A - Automática (Recomendado):**
```bash
cd rotamestre-app

# Fechar todos os PRs do Dependabot
gh pr list --author "app/dependabot" --json number --jq '.[].number' | \
  xargs -I {} gh pr close {}

# Aguardar 1 minuto

# Dependabot vai recriar os PRs automaticamente na próxima verificação
# (próxima segunda-feira ou pode forçar via GitHub UI)
```

**Opção B - Forçar Rebase Manual:**
```bash
# Para cada PR individualmente
gh pr comment 13 --body "@dependabot rebase"
gh pr comment 12 --body "@dependabot rebase"
# ... repetir para todos os 13 PRs
```

**Validação:**
- Novos PRs devem passar nos checks de Tests e Quality
- Revisar e mergear PRs de GitHub Actions primeiro (#1-4)
- Depois revisar PRs de dependências npm (#5-13)

---

### 3. Habilitar Branch Protection (5 minutos) ⚠️ Requer GitHub Pro

**Por que:** Garantir que código só entra em `main` após testes passarem e code review.

**⚠️ IMPORTANTE:** Branch Protection Rules em repositórios privados requerem GitHub Pro ou tornar o repositório público.

**Opções disponíveis:**

**Opção A - Tornar repositório público (Grátis):**
```bash
# GitHub → rotamestre-app → Settings → Danger Zone → Change visibility → Public
```

**Opção B - Upgrade para GitHub Pro ($4/mês):**
- Acesse: https://github.com/settings/billing
- Branch Protection + Features avançados

**Opção C - Proteção Manual (Alternativa grátis):**
- Criar regra de proteção básica via GitHub UI:
  - Settings → Branches → Add rule
  - Branch name pattern: `main`
  - ✅ Require a pull request before merging
  - ✅ Require status checks to pass before merging
    - Selecione: `Run Tests (20.x)` e `TypeScript & Linting`

**Opção D - Workflow Discipline (Sem custo):**
- Seguir workflow de PRs manualmente
- Nunca fazer push direto para `main`
- Sempre criar branch → PR → Merge após testes

**Se você tiver GitHub Pro:**
```bash
cd rotamestre-app
bash scripts/setup-branch-protection.sh
```

**Documentação:** [.github/BRANCH_PROTECTION.md](.github/BRANCH_PROTECTION.md)

---

## 📈 Próxima Semana - Fase 1: Quick Wins (Meta: 40% cobertura)

**Objetivo:** Aumentar cobertura de 17.7% para 40% focando em arquivos parcialmente cobertos.

**Estratégia:** Completar testes em arquivos que já têm 40-70% de cobertura.

### Arquivos Prioritários (Quick Wins)

| Arquivo | Cobertura Atual | Meta | Esforço |
|---------|----------------|------|---------|
| `src/lib/storage.ts` | 55.8% | 80% | 2h |
| `src/components/AddressAutocomplete.tsx` | 60.1% | 85% | 3h |
| `src/hooks/useBreakpoint.ts` | 60.6% | 80% | 1h |
| `src/hooks/useDesktopHeaderMenu.tsx` | 62.6% | 80% | 2h |
| `src/components/AlertDialog.tsx` | 53.0% | 80% | 2h |

**Total estimado:** 10 horas de desenvolvimento

**Como começar:**
```bash
cd rotamestre-app

# Ver análise completa de cobertura
npm run coverage-report

# Ver arquivos específicos com baixa cobertura
npm run test:coverage

# Ver relatório HTML detalhado
npm run test:coverage && open coverage/lcov-report/index.html
```

**Documentação:** [.github/COVERAGE_IMPROVEMENT_PLAN.md](.github/COVERAGE_IMPROVEMENT_PLAN.md)

---

## 🎯 Próximo Mês - Fases 2 e 3

### Fase 2 (Semanas 2-3): Core Business Logic - Meta: 60%
Focar em arquivos críticos com 0% cobertura:
- `src/lib/google.ts` (0% → 70%)
- `src/services/navigation.ts` (0% → 60%)
- `src/context/RouteStatusContext.tsx` (0% → 50%)

**Esforço estimado:** 20 horas

### Fase 3 (Semana 4): Complex Components - Meta: 70-80%
Completar testes de componentes complexos:
- Mapas e navegação
- Otimização de rotas
- Upload de fotos

**Esforço estimado:** 30 horas

---

## 📋 Checklist de Validação

Marque conforme completar:

### Imediato
- [ ] Codecov configurado e funcionando
- [ ] PRs do Dependabot fechados/rebaseados
- [ ] Branch Protection habilitado
- [ ] README badges atualizados (já feito ✅)

### Esta Semana
- [ ] Completar 5 arquivos Quick Wins
- [ ] Cobertura global atingir 40%
- [ ] Atualizar thresholds em `jest.config.js` para 35%
- [ ] Mergear pelo menos 5 PRs do Dependabot

### Este Mês
- [ ] Completar Fase 2 (60% cobertura)
- [ ] Completar Fase 3 (70-80% cobertura)
- [ ] Todos os PRs do Dependabot mergeados
- [ ] CI/CD rodando em <60s (otimizar cache)

---

## 🛠️ Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm test` | Executar todos os testes |
| `npm run test:coverage` | Executar testes com cobertura |
| `npm run coverage-report` | Gerar análise detalhada de cobertura |
| `npm run type-check` | Verificar tipos TypeScript |
| `npm run lint` | Verificar code style |
| `npm run verify-ci` | Validar configuração de CI/CD |

---

## 📚 Documentação de Referência

- [.github/COVERAGE_IMPROVEMENT_PLAN.md](.github/COVERAGE_IMPROVEMENT_PLAN.md) - Plano completo de 3 fases
- [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md) - Guia de contribuição
- [.github/SETUP_CODECOV.md](.github/SETUP_CODECOV.md) - Setup Codecov
- [.github/BRANCH_PROTECTION.md](.github/BRANCH_PROTECTION.md) - Branch Protection
- [scripts/coverage-report.js](scripts/coverage-report.js) - Script de análise

---

## 💡 Dicas

1. **Use o coverage report frequentemente:** `npm run coverage-report` mostra exatamente o que precisa ser feito
2. **Comece pelos Quick Wins:** Ganho rápido de cobertura motiva o time
3. **Rode os testes localmente antes do commit:** Evita falhas no CI
4. **Revise PRs do Dependabot semanalmente:** Manter dependências atualizadas previne security issues
5. **Acompanhe métricas no Codecov:** Visualizar progresso ajuda a manter foco

---

## 🔗 Links Úteis

- **Repositório:** https://github.com/BadWolf1509/rotamestre-app
- **CI/CD Workflows:** https://github.com/BadWolf1509/rotamestre-app/actions
- **Branch Protection:** https://github.com/BadWolf1509/rotamestre-app/settings/branches
- **Dependabot:** https://github.com/BadWolf1509/rotamestre-app/security/dependabot
- **Codecov (após setup):** https://codecov.io/gh/BadWolf1509/rotamestre-app

---

**Última atualização:** 2025-11-16
**Próxima revisão:** Após atingir 40% de cobertura (Fase 1)

**Dúvidas?** Consulte os documentos de referência ou abra uma issue.
