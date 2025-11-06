# Estratégia de Testes - Rota Mestre

## Visão Geral

Este documento descreve a estratégia completa de testes para o sistema Rota Mestre, incluindo testes automatizados, manuais e de integração.

## Tipos de Testes

### 1. Testes Unitários (Jest)
- Testam funções e componentes isolados
- Rápidos e confiáveis
- Executam em milissegundos

### 2. Testes de Integração (React Native Testing Library)
- Testam fluxos completos de tela
- Verificam interação entre componentes
- Simulam comportamento do usuário

### 3. Testes E2E (End-to-End)
- Testam o app completo em dispositivo real
- Verificam integração com backend
- Testam navegação e deep links

### 4. Testes Manuais
- Validação visual e UX
- Testes exploratórios
- Verificação em diferentes dispositivos

## Comandos de Teste

```bash
# Testes unitários
npm test

# Testes com coverage
npm test -- --coverage

# Testes em watch mode (desenvolvimento)
npm test -- --watch

# Testes de um arquivo específico
npm test auth.test.ts

# Testes E2E (requer dispositivo/emulador)
npm run test:e2e
```

## Estrutura de Testes

```
rotamestre-app/
├── __tests__/
│   ├── unit/              # Testes unitários
│   │   ├── lib/
│   │   │   ├── auth.test.ts
│   │   │   └── supabase.test.ts
│   │   └── utils/
│   ├── integration/       # Testes de integração
│   │   ├── auth/
│   │   │   ├── login.test.tsx
│   │   │   ├── forgot-password.test.tsx
│   │   │   └── reset-password.test.tsx
│   │   └── gestor/
│   └── e2e/              # Testes E2E
│       ├── auth-flow.test.ts
│       └── delivery-flow.test.ts
├── __mocks__/            # Mocks para testes
│   ├── @react-native-async-storage/
│   ├── expo-router/
│   └── supabase.ts
└── jest.config.js
```

## Áreas Críticas para Testes

### Autenticação (ALTA PRIORIDADE)
- ✅ Login com email/senha
- ✅ Recuperação de senha
- ✅ Reset de senha
- ✅ Logout
- ✅ Persistência de sessão
- ✅ Redirecionamento após login (gestor vs motorista)

### Gestão de Rotas (ALTA PRIORIDADE)
- ⏳ Criação de nova rota
- ⏳ Listagem de rotas
- ⏳ Edição de rota
- ⏳ Exclusão de rota
- ⏳ Otimização de rota

### Rastreamento (MÉDIA PRIORIDADE)
- ⏳ Captura de localização do motorista
- ⏳ Atualização em tempo real
- ⏳ Visualização no mapa

### Motoristas (MÉDIA PRIORIDADE)
- ⏳ Cadastro de motorista
- ⏳ Listagem de motoristas
- ⏳ Atribuição de rota

### UI/UX (BAIXA PRIORIDADE)
- ⏳ Responsividade (mobile/tablet/desktop)
- ⏳ Temas (light/dark)
- ⏳ Animações

## Cobertura de Testes Alvo

| Área | Cobertura Alvo | Status Atual |
|------|---------------|--------------|
| Auth Service | 90% | 0% |
| Telas de Auth | 80% | 0% |
| Componentes UI | 70% | 0% |
| Utils | 90% | 0% |
| API Calls | 80% | 0% |

## Ferramentas de Teste

### Já Instaladas
- Jest (test runner)
- React Native Testing Library
- @testing-library/react-hooks

### A Instalar (Opcional)
- Detox (E2E testing)
- MSW (Mock Service Worker para API mocking)
- Faker.js (dados de teste)

## Próximos Passos

1. ✅ Criar estrutura de testes
2. ⏳ Implementar testes de autenticação
3. ⏳ Implementar testes de componentes
4. ⏳ Configurar CI/CD para rodar testes automaticamente
5. ⏳ Criar checklist de testes manuais

## Executando Testes pela Primeira Vez

```bash
# 1. Instalar dependências de teste (se necessário)
npm install --save-dev @testing-library/react-native @testing-library/jest-native

# 2. Rodar todos os testes
npm test

# 3. Ver relatório de cobertura
npm test -- --coverage
open coverage/lcov-report/index.html
```

## Ambiente de Teste

### Variáveis de Ambiente
```bash
# .env.test
EXPO_PUBLIC_SUPABASE_URL=https://test.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=test-key-123
```

### Dados de Teste
```javascript
// __mocks__/test-data.ts
export const mockUsuario = {
  id: 'test-user-123',
  email: 'test@rotamestre.com',
  nome: 'Usuário Teste',
  papel: 'gestor'
};

export const mockRota = {
  id: 'test-rota-123',
  titulo: 'Rota Teste',
  paradas: [...]
};
```

## Relatórios de Teste

Os testes geram relatórios em:
- `coverage/` - Cobertura de código (HTML)
- `test-results/` - Resultados detalhados (JSON)
- Console - Resumo rápido

## CI/CD Integration

### GitHub Actions (Exemplo)
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test -- --coverage
      - run: npm run test:e2e
```

## Contato e Suporte

Para dúvidas sobre testes:
1. Verifique este documento
2. Consulte `docs/TESTING-MANUAL.md` para testes manuais
3. Consulte `docs/TESTING-E2E.md` para testes E2E
