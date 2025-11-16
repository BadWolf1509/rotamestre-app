# 🛡️ Branch Protection Rules

Este guia mostra como configurar proteções para as branches principais do repositório.

## 🎯 Por que usar Branch Protection?

Branch protection garante que:
- ✅ Todos os testes passam antes do merge
- ✅ Code review é obrigatório
- ✅ Código mantém qualidade consistente
- ✅ Ninguém faz push direto para main/develop
- ✅ CI/CD valida todas as mudanças

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
- ✅ Require pull request before merging (1 approval)
- ✅ Require status checks (test + quality)
- ✅ Require conversation resolution
- ✅ Require linear history
- ✅ Block force pushes
- ✅ Block branch deletion

**Pré-requisitos:**
1. Instalar GitHub CLI: https://cli.github.com/
2. Autenticar: `gh auth login`
3. Ter permissões de admin no repositório

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
- Status checks obrigatórios:
  - `Run Tests` (do workflow test.yml)
  - `TypeScript & Linting` (do workflow quality.yml)

**✅ Require conversation resolution before merging**
- Garante que todos os comentários foram resolvidos

**✅ Require linear history**
- Mantém histórico limpo (usa squash ou rebase)

**⚠️ Do not allow bypassing the above settings**
- Nem admins podem pular as regras (recomendado)

**✅ Allow force pushes: Everyone**
- ❌ Desativado (nunca permitir force push em main)

**✅ Allow deletions**
- ❌ Desativado (nunca permitir deletar main)

#### Configuração Final

Clique em **"Save changes"**

---

### Para a branch `develop`

Repita o processo acima com configurações um pouco mais flexíveis:

#### Branch name pattern
```
develop
```

#### Regras para Develop

**✅ Require a pull request before merging**
- ☑️ Require approvals: `1` (pode ser 0 para times pequenos)

**✅ Require status checks to pass before merging**
- ☑️ Require branches to be up to date before merging
- Status checks obrigatórios:
  - `Run Tests`
  - `TypeScript & Linting`

**✅ Require conversation resolution before merging**

**⚠️ Allow force pushes**
- ❌ Desativado

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
git checkout develop
git pull origin develop
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
2. Base: `develop` ← Compare: `feature/nova-funcionalidade`
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
   - **Squash and merge** (recomendado): Une commits em 1
   - **Rebase and merge**: Mantém commits separados
   - **Create merge commit**: Cria merge commit
3. Confirme o merge

### 8. Limpar Branch
```bash
git checkout develop
git pull origin develop
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
- [ ] Branch protection ativada em `develop`
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
   - Use `git rebase develop` se necessário

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
