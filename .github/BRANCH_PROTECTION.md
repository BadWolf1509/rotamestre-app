# 🛡️ Branch Protection Rules

Este guia mostra como configurar a proteção da branch `main`.

> **Só existe `main` neste repositório.** Não há `develop` — se você encontrar
> referência a ela em algum trecho antigo, é resíduo.

## 🎯 Por que usar Branch Protection?

Branch protection garante que:

- ✅ Todos os testes passam antes do merge
- ✅ Código mantém qualidade consistente
- ✅ Ninguém faz push direto para `main`
- ✅ CI/CD valida todas as mudanças

## ⚠️ Antes de rodar qualquer coisa daqui

**Os scripts usam `PUT`, que SOBRESCREVE a regra inteira.** O que não estiver
declarado neles é apagado da proteção. Guarde o estado atual primeiro:

```bash
gh api repos/BadWolf1509/rotamestre-app/branches/main/protection > protecao-backup.json
```

**O nome de cada check precisa bater letra por letra com o `name:` do job**,
incluindo o sufixo de versão do Node. Exigir um check que nenhum workflow produz
**trava todos os PRs para sempre**: o status nunca chega e o merge nunca libera.
Até 21/09/2026 os scripts deste diretório pediam `Run Tests (20.x)` enquanto a
matriz do CI rodava em `22.x` — rodá-los teria travado o repositório. Hoje os
dois abortam se o nome ou a versão não existirem nos workflows.

## 🚀 Configuração Rápida (Automatizada)

### Usando GitHub CLI

Se você tem o [GitHub CLI](https://cli.github.com/) instalado, pode configurar tudo automaticamente:

**Windows (PowerShell):**

```powershell
cd rotamestre-app
.\scripts\setup-branch-protection.ps1
```

**Linux/macOS (Bash):**

```bash
cd rotamestre-app
chmod +x scripts/setup-branch-protection.sh
./scripts/setup-branch-protection.sh
```

O script configura automaticamente:

- ✅ Require pull request before merging (1 approval, dismiss stale reviews)
- ✅ Require status checks — os **quatro** bloqueantes (lista abaixo)
- ✅ Require branches to be up to date before merging (`strict`)
- ✅ Require conversation resolution
- ✅ Require linear history
- ✅ Block force pushes
- ✅ Block branch deletion
- ⚙️ `enforce_admins = false` — **deliberado**, ver "Por que admins não são
  bloqueados" abaixo

**Pré-requisitos:**

1. Instalar GitHub CLI: https://cli.github.com/
2. Autenticar: `gh auth login`
3. Ter permissões de admin no repositório

---

## ✅ Os checks obrigatórios (conferidos em 21/09/2026)

| Check                      | Workflow      | Desde      |
| -------------------------- | ------------- | ---------- |
| `Run Tests (22.x)`         | `test.yml`    | —          |
| `TypeScript & Linting`     | `quality.yml` | —          |
| `Visual Regression (22.x)` | `test.yml`    | 25/08/2026 |
| `Bundle Size Check`        | `quality.yml` | 21/09/2026 |

**Não-bloqueantes de propósito**, por isso fora da lista: `Design System Drift
Check (22.x)` e o deploy do Vercel.

O `Bundle Size Check` entrou porque foi o único check que pegou a duplicação da
árvore do Sentry (bundle de 3,39 MB → 3,9 MB, contra o limite de 3,5 MB) — e,
sendo não-bloqueante até então, não impedia o merge.

## 🔓 Por que admins não são bloqueados

`enforce_admins` é **`false`**, e isso é intencional. A proteção exige 1
aprovação, mas o gestor é autor de quase todos os PRs e **ninguém aprova o
próprio PR no GitHub** — não há segundo revisor no projeto. Com
`enforce_admins = true`, nenhum merge sairia.

Na prática o merge é:

```bash
gh pr merge <n> --squash --admin --delete-branch
```

`--squash` é obrigatório porque `required_linear_history` está ligado.

**Consequência a encarar de frente:** os quatro checks acima **aparecem** como
bloqueio, mas `--admin` passa por cima deles. Eles informam a decisão de quem
mergeia; não a impedem.

---

## 🔧 Configuração Manual (Alternativa)

### Para a branch `main`

1. Vá para o repositório no GitHub
2. Clique em **Settings** → **Branches**
3. Clique em **"Add rule"** ou edite a regra existente
4. Configure:

#### Branch name pattern

```
main
```

#### Regras Recomendadas

**✅ Require a pull request before merging**

- ☑️ Require approvals: `1`
- ☑️ Dismiss stale pull request approvals when new commits are pushed
- ☑️ Require review from Code Owners (opcional, se tiver CODEOWNERS)

**✅ Require status checks to pass before merging**

- ☑️ Require branches to be up to date before merging
- Status checks obrigatórios — os quatro da tabela acima:
  - `Run Tests (22.x)` (test.yml)
  - `Visual Regression (22.x)` (test.yml)
  - `TypeScript & Linting` (quality.yml)
  - `Bundle Size Check` (quality.yml)

**✅ Require conversation resolution before merging**

- Garante que todos os comentários foram resolvidos

**✅ Require linear history**

- Mantém histórico limpo (usa squash ou rebase)

**⚠️ Do not allow bypassing the above settings**

- ❌ **Desativado neste repositório, de propósito.** Ligar isto trava todo
  merge — ver "Por que admins não são bloqueados" acima.

**✅ Allow force pushes: Everyone**

- ❌ Desativado (nunca permitir force push em main)

**✅ Allow deletions**

- ❌ Desativado (nunca permitir deletar main)

#### Configuração Final

Clique em **"Save changes"**

---

### E a branch `develop`?

**Não existe.** O fluxo aqui é feature branch → `main`, e os workflows refletem
isso: `test.yml` e `quality.yml` disparam em `pull_request` para `main` e
`develop`, mas como `develop` não existe, só a primeira vale.

Isso tem uma consequência que já custou um PR: **PR apontando para uma branch de
feature não roda nenhum dos checks** — só o Vercel. Não empilhe PRs; aponte
sempre para `main`.

---

## 📋 Arquivo CODEOWNERS (Opcional)

Crie `.github/CODEOWNERS` para definir revisores automáticos:

```
# Padrão: todos os arquivos
* @BadWolf1509

# Workflows de CI/CD
/.github/workflows/ @BadWolf1509

# Testes
**/__tests__/ @BadWolf1509

# Configurações críticas
/jest.config.js @BadWolf1509
/package.json @BadWolf1509
```

## 🔄 Workflow com Branch Protection

### 1. Criar Feature Branch

```bash
git checkout main
git pull --ff-only
git checkout -b feature/nova-funcionalidade
```

### 2. Desenvolver e Testar

```bash
# Trabalhe na sua feature
npm test         # Garante que testes passam
npm run type-check  # Valida TypeScript
npm run lint     # Verifica linting
```

### 3. Commit e Push

```bash
git add .
git commit -m "feat: adiciona nova funcionalidade"
git push origin feature/nova-funcionalidade
```

### 4. Criar Pull Request

No GitHub:

1. Vá para **Pull requests** → **New pull request**
2. Base: `main` ← Compare: `feature/nova-funcionalidade`
3. Preencha descrição usando o template
4. Clique em **"Create pull request"**

### 5. Aguardar Validações

O GitHub automaticamente:

- 🔄 Roda workflows de Tests e Quality
- 📊 Mostra status checks
- 💬 Codecov comenta com coverage
- ⏳ Espera aprovação (se configurado)

### 6. Resolver Problemas

Se algum check falhar:

```bash
# Corrigir localmente
npm test -- --coverage
npm run type-check

# Commitar correções
git add .
git commit -m "fix: corrige testes"
git push origin feature/nova-funcionalidade
```

O PR é atualizado automaticamente e checks rodam novamente.

### 7. Merge

Quando tudo estiver ✅ verde:

1. Clique em **"Merge pull request"**
2. Escolha o tipo de merge:
   - **Squash and merge** (recomendado): une commits em 1
   - **Rebase and merge**: mantém commits separados
   - ~~**Create merge commit**~~ — **não funciona aqui**: `required_linear_history`
     está ligado e recusa merge commit
3. Confirme o merge

Na prática, como não há segundo revisor, o merge sai pela linha de comando:

```bash
gh pr merge <n> --squash --admin --delete-branch
```

Ele completa com **saída vazia** — silêncio ali é sucesso, não falha. Confirme
com `gh api repos/BadWolf1509/rotamestre-app/pulls/<n> --jq '.merged'` em vez de
confiar no código de saída.

### 8. Limpar Branch

```bash
git checkout main
git pull --ff-only
git branch -d feature/nova-funcionalidade
```

## 🚨 Regras de Emergência

### Bypass Temporário (apenas emergências!)

Se precisar fazer hotfix urgente:

1. **Opção 1 - Através de PR (recomendado)**

   ```bash
   git checkout -b hotfix/critical-bug
   # Faça a correção
   git push origin hotfix/critical-bug
   # Crie PR normalmente
   ```

2. **Opção 2 - Admin override (última opção)**
   - Settings → Branches → Edite a regra
   - Temporariamente desmarque "Do not allow bypassing"
   - Faça o push direto
   - **IMEDIATAMENTE** reative a proteção

## 📊 Monitoramento

### Insights → Pulse

Veja estatísticas de:

- PRs abertas/mergeadas
- Status de checks
- Contribuidores ativos

### Insights → Actions

Monitore workflows:

- Taxa de sucesso/falha
- Tempo de execução
- Custos (minutos usados)

## ✅ Checklist de Configuração

- [ ] Branch protection ativada em `main`
- [ ] Os quatro checks bloqueantes conferidos contra os `name:` dos jobs
- [ ] Status checks obrigatórios configurados
- [ ] Require approvals habilitado
- [ ] Force push desabilitado
- [ ] Arquivo CODEOWNERS criado (opcional)
- [ ] Time notificado sobre novas regras
- [ ] Documentação lida por todos os contribuidores

## 🎓 Boas Práticas

1. **Nunca force push em branches protegidas**
   - Use `git revert` para desfazer commits

2. **Mantenha PRs pequenos e focados**
   - Mais fácil de revisar
   - Menor chance de conflitos

3. **Sempre revisar PRs com atenção**
   - Olhe os testes
   - Verifique coverage
   - Teste localmente se necessário

4. **Resolva conflitos antes do merge**
   - Mantenha branch atualizada com base
   - Use `git rebase main` se necessário

5. **Escreva descrições claras em PRs**
   - O que mudou?
   - Por que mudou?
   - Como testar?

## 📚 Recursos

- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)
- [CODEOWNERS File](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [Status Checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks)

---

**Proteção configurada? Seu código está mais seguro!** 🛡️
