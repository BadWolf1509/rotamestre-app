# Contributing to RotaMestre App

Obrigado por contribuir com o RotaMestre! 🚀

## 🔄 CI/CD Pipeline

### Workflows Automatizados

Este projeto possui dois workflows principais no GitHub Actions:

#### 1. **Tests** (`test.yml`)

- **Triggers:** Push e Pull Request para `main` e `develop`
- **Execução:** Roda todos os testes unitários e de integração
- **Coverage:** Gera relatório de cobertura e envia para Codecov
- **Duração estimada:** ~2-3 minutos

#### 2. **Code Quality** (`quality.yml`)

- **Triggers:** Push e Pull Request para `main` e `develop`
- **Validações:**
  - TypeScript type checking
  - ESLint linting
- **Duração estimada:** ~1-2 minutos

### ✅ Checklist antes de fazer Push

Antes de enviar seu código, certifique-se de que:

```bash
# 1. Todos os testes passam
npm test

# 2. TypeScript não tem erros
npm run type-check

# 3. Código está formatado
npm run lint
```

### 📊 Coverage Requirements

O projeto mantém os seguintes limites mínimos de cobertura:

- **Linhas:** ~73%
- **Funções:** ~72%
- **Branches:** ~65%
- **Statements:** ~72%

### 🚨 Se o CI Falhar

1. **Tests falhando:**
   - Execute `npm test` localmente
   - Corrija os testes quebrados
   - Certifique-se de que novos recursos têm testes

2. **Type errors:**
   - Execute `npm run type-check`
   - Corrija erros de tipagem
   - Use tipos adequados, evite `any`

3. **Coverage baixo:**
   - Adicione testes para código não coberto
   - Execute `npm test -- --coverage` para ver detalhes

### 🔧 Setup de Secrets (Opcional)

Para habilitar upload de coverage para Codecov:

1. Vá para https://codecov.io e conecte seu repositório
2. Copie o token do Codecov
3. No GitHub: Settings → Secrets → Actions → New repository secret
4. Nome: `CODECOV_TOKEN`
5. Valor: seu token do Codecov

### 📝 Convenções de Commit

Usamos Conventional Commits:

```
feat: adiciona novo componente de mapa
fix: corrige bug no cálculo de rotas
test: adiciona testes para AuthService
docs: atualiza README com instruções
chore: atualiza dependências
```

### 🎯 Workflow de Desenvolvimento

```bash
# 1. Crie uma branch a partir de main
git checkout main
git pull origin main
git checkout -b feature/sua-feature

# 2. Desenvolva e teste
npm test -- --watch

# 3. Commit seguindo convenções
git add .
git commit -m "feat: sua feature"

# 4. Push e crie PR
git push origin feature/sua-feature
```

### ⚡ Otimizações de CI

O CI utiliza:

- **Cache de dependências:** npm packages são cacheados entre builds
- **Matrix strategy:** Testa em Node.js 20.x
- **Parallel jobs:** Tests e Quality rodam em paralelo
- **maxWorkers:** Jest usa no máximo 2 workers para economizar recursos

### 📚 Recursos Úteis

- [Jest Documentation](https://jestjs.io/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

**Dúvidas?** Abra uma issue ou entre em contato com a equipe! 💬
