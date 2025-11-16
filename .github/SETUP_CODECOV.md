# 📊 Setup Codecov - Coverage Reporting

Este guia mostra como configurar o Codecov para visualizar relatórios de cobertura de código.

## 🔧 Configuração (5 minutos)

### 1. Criar Conta no Codecov

1. Acesse https://codecov.io
2. Clique em **"Sign up with GitHub"**
3. Autorize o Codecov a acessar seus repositórios

### 2. Adicionar Repositório

1. No dashboard do Codecov, clique em **"Add new repository"**
2. Encontre `BadWolf1509/rotamestre-app` na lista
3. Clique em **"Set up repo"**
4. Copie o **token** gerado (você precisará dele no próximo passo)

### 3. Adicionar Token ao GitHub

1. No GitHub, vá para o repositório `rotamestre-app`
2. Clique em **Settings** → **Secrets and variables** → **Actions**
3. Clique em **"New repository secret"**
4. Preencha:
   - **Name:** `CODECOV_TOKEN`
   - **Secret:** Cole o token copiado do Codecov
5. Clique em **"Add secret"**

### 4. Verificar Funcionamento

Após o próximo push/PR, o workflow de testes irá:
1. Executar todos os testes
2. Gerar relatório de coverage
3. Fazer upload automático para o Codecov
4. Comentar no PR com o relatório (se for um PR)

## 📈 Visualizando Reports

### No Codecov Dashboard

Acesse: https://codecov.io/gh/BadWolf1509/rotamestre-app

Você verá:
- **Coverage %** geral do projeto
- **Gráficos** de evolução da cobertura
- **Sunburst chart** mostrando cobertura por arquivo
- **Commit history** com mudanças de coverage

### Em Pull Requests

O Codecov comenta automaticamente em cada PR com:
- Mudança de coverage (+/- %)
- Arquivos afetados
- Comparação com a branch base
- Links para o relatório completo

### Badge no README

O badge já está configurado no README.md:

```markdown
[![codecov](https://codecov.io/gh/BadWolf1509/rotamestre-app/branch/main/graph/badge.svg)](https://codecov.io/gh/BadWolf1509/rotamestre-app)
```

## 🎯 Coverage Thresholds

O projeto tem os seguintes limites mínimos configurados em `jest.config.js`:

```javascript
coverageThreshold: {
  global: {
    branches: 70,    // 70% das branches cobertas
    functions: 70,   // 70% das funções testadas
    lines: 80,       // 80% das linhas executadas
    statements: 80,  // 80% dos statements testados
  },
}
```

**Se o coverage cair abaixo desses limites, os testes falham!** ❌

## 📊 Arquivos de Coverage Gerados

Após rodar `npm test -- --coverage`, são gerados:

```
coverage/
├── lcov.info           # Formato LCOV (usado pelo Codecov)
├── coverage-summary.json
├── junit.xml           # Resultados em formato JUnit
└── html/               # Relatório HTML navegável
    └── index.html      # Abra no browser para visualizar
```

Para ver o relatório HTML local:
```bash
npm test -- --coverage
open coverage/html/index.html  # macOS
start coverage/html/index.html # Windows
```

## 🔒 Configuração Avançada

### .codecov.yml

O projeto já possui um arquivo `.codecov.yml` configurado com:

- **Target de cobertura:** 80% para o projeto, 70% para patches
- **Threshold:** 2% para projeto (permite pequenas quedas), 5% para patches
- **Comentários em PRs:** Habilitados com layout completo
- **Arquivos ignorados:** Testes, mocks, e arquivos de build
- **Flags:** `unittests` para categorizar cobertura de testes unitários

**Você pode ajustar o arquivo `.codecov.yml` na raiz do projeto se necessário.**

### Principais Opções de Configuração

```yaml
coverage:
  precision: 2              # Precisão de 2 casas decimais
  range: "70...100"         # Range de cobertura aceitável

  status:
    project:
      target: 80%           # Meta global de cobertura
      threshold: 2%         # Permite queda de até 2%

    patch:
      target: 70%           # Meta para código novo em PRs
      threshold: 5%         # Permite queda de até 5%

comment:
  layout: "reach,diff,flags,tree"  # Layout completo em PRs
  behavior: default               # Comportamento padrão
```

### Desabilitar Comentários em PRs (Opcional)

Se não quiser comentários automáticos, edite `.codecov.yml`:

```yaml
comment: false
```

## 🐛 Troubleshooting

### Token inválido
**Erro:** `Error uploading to Codecov: HTTP Error 401`

**Solução:**
1. Verifique se o `CODECOV_TOKEN` está correto nos secrets
2. Regenere o token no Codecov dashboard
3. Atualize o secret no GitHub

### Upload não acontece
**Sintoma:** Workflow passa mas não aparece no Codecov

**Solução:**
1. Verifique se o token está configurado
2. Confirme que o coverage está sendo gerado (`coverage/lcov.info` existe)
3. Veja os logs do workflow no GitHub Actions

### Coverage 0%
**Sintoma:** Codecov mostra 0% mesmo com testes

**Solução:**
1. Verifique se `collectCoverageFrom` em `jest.config.js` está correto
2. Confirme que os arquivos estão nos paths configurados
3. Execute local: `npm test -- --coverage` e verifique o output

## 📚 Recursos Úteis

- [Codecov Documentation](https://docs.codecov.com/)
- [GitHub Actions Integration](https://docs.codecov.com/docs/github-actions)
- [Coverage Configuration](https://docs.codecov.com/docs/codecov-yaml)
- [Badge Options](https://docs.codecov.com/docs/status-badges)

## ✅ Checklist de Verificação

- [ ] Token `CODECOV_TOKEN` adicionado aos secrets do GitHub
- [ ] Workflow de testes executou com sucesso após setup
- [ ] Badge do Codecov aparecendo no README
- [ ] Relatório disponível em codecov.io
- [ ] Coverage acima dos thresholds (70%/80%)

---

**Dúvidas?** Abra uma issue ou consulte a [documentação oficial](https://docs.codecov.com/).
