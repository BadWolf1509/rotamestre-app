# Testing Guide - RotaMestre App

Este documento descreve a arquitetura de testes, padrões e convenções utilizadas no projeto rotamestre-app.

## Status Atual

**Framework:** Jest + React Native Testing Library
**Snapshot de 24/07/2026:** 312/312 suites, 5729/5729 testes e 5/5 snapshots passando
**Threshold de cobertura:** 73% lines (última medição ~74%)

> ⚠️ A execução `npm test -- --runInBand --forceExit` terminou com código 0,
> mas ainda precisou encerrar handles abertos à força. O timer de animação de
> `PictureInPictureMap` foi corrigido e essa suíte termina sem `--forceExit`;
> os handles restantes ainda precisam ser identificados. O critério final é
> obter a passagem completa sem `--forceExit`.

### Executando testes

```bash
npm test                  # execução completa
npm test -- --watch       # modo watch
npm run test:coverage     # com relatório de cobertura
npm test -- <padrão>      # filtrar por nome/caminho
```

### Layout dos testes

- Unitários/integração: `src/**/__tests__/*.test.ts(x)`
- E2E: `e2e/` (Playwright; ver `npm run test:e2e`)
- Regressão visual: `tools/scripts/run-visual-tests.cjs` (`npm run test:visual`)

### Caveats conhecidos

- `react-test-renderer` deve ter a mesma versão que `react` (restrição de paridade do jest-expo).
- `renderHook` em hooks com async/realtime pesado (`useGestaoRotas`, `offline.ts`, `useRealtimeRoutes`) pode causar OOM acima de 4 GB — prefira testar os helpers puros extraídos desses hooks.
- `src/components/motorista/__tests__/PictureInPictureMap.test.tsx` deixa timers
  do preset React Native ativos após o teardown em execução serial. Investigue
  com `--detectOpenHandles`, limpe timers no `afterEach` e preserve um exit code
  0 como critério de sucesso.

---

## Stack de Testes

| Ferramenta                    | Versão | Propósito                             |
| ----------------------------- | ------ | ------------------------------------- |
| Jest                          | 29.x   | Test runner e framework de testes     |
| jest-expo                     | 56.x   | Preset para projetos Expo             |
| @testing-library/react-native | 13.x   | Utilitários para testar componentes   |
| @testing-library/jest-native  | 5.x    | Matchers adicionais para React Native |
| jest-junit                    | 16.x   | Reporter XML para CI/CD               |

## Estrutura de Arquivos

```
rotamestre-app/
├── __mocks__/                    # Mocks globais
│   ├── @react-native-async-storage/
│   ├── @supabase/
│   ├── fileMock.js              # Mock para assets (imagens, fontes)
│   └── test-data.ts             # Dados de teste reutilizáveis
├── jest.mocks/                   # Mocks modulares
│   ├── expo.js                  # Mocks de módulos Expo
│   ├── reactNative.js           # Mocks de React Native
│   └── supabase.js              # Mocks do Supabase
├── jest.config.js               # Configuração do Jest
├── jest.setup.js                # Setup global (mocks, matchers)
├── src/
│   ├── components/__tests__/    # Testes de componentes
│   ├── hooks/__tests__/         # Testes de hooks
│   ├── lib/__tests__/           # Testes de utilitários
│   ├── services/__tests__/      # Testes de serviços
│   └── utils/__tests__/         # Testes de funções utilitárias
└── coverage/                     # Relatórios de cobertura
    ├── lcov-report/             # HTML report
    └── junit.xml                # XML para CI
```

## Executando Testes

```bash
# Rodar todos os testes
npm test

# Modo watch (desenvolvimento)
npm run test:watch

# Com cobertura
npm test -- --coverage

# Testes específicos
npm test -- --testPathPattern="storage"
npm test -- --testNamePattern="deve fazer upload"

# Atualizar snapshots
npm test -- -u

# Rodar testes de um arquivo
npm test -- src/hooks/__tests__/useAuth.test.ts
```

## Configuração Jest

### jest.config.js

```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Cobertura
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/types/**/*.ts',
    '!**/__tests__/**',
    '!**/__mocks__/**',
  ],

  // Thresholds globais
  coverageThreshold: {
    global: {
      branches: 65,
      functions: 68,
      lines: 69,
      statements: 69,
    },
  },

  // Alias
  moduleNameMapper: {
    '\\.(png|jpg|jpeg|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

## Padrões de Testes

### 1. Estrutura de Teste

```typescript
describe('NomeDoModulo', () => {
  // Setup comum
  const mockData = { ... };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('nomeDoMetodo', () => {
    it('deve fazer X quando Y', async () => {
      // Arrange
      const input = ...;

      // Act
      const result = await metodo(input);

      // Assert
      expect(result).toBe(...);
    });

    it('deve lançar erro quando Z', async () => {
      await expect(metodo(invalidInput))
        .rejects.toThrow('Mensagem de erro');
    });
  });
});
```

### 2. Testando Hooks

```typescript
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useMyHook } from '../useMyHook';

describe('useMyHook', () => {
  it('deve retornar estado inicial', () => {
    const { result } = renderHook(() => useMyHook());

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it('deve atualizar estado após ação', async () => {
    const { result } = renderHook(() => useMyHook());

    await act(async () => {
      result.current.fetchData();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).not.toBeNull();
    });
  });
});
```

### 3. Testando Componentes

```typescript
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button', () => {
  it('deve renderizar com título', () => {
    render(<Button title="Clique aqui" onPress={jest.fn()} />);

    expect(screen.getByText('Clique aqui')).toBeTruthy();
  });

  it('deve chamar onPress ao clicar', () => {
    const onPress = jest.fn();
    render(<Button title="Clique" onPress={onPress} />);

    fireEvent.press(screen.getByText('Clique'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('deve estar desabilitado quando disabled=true', () => {
    render(<Button title="Teste" onPress={jest.fn()} disabled />);

    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### 4. Mockando Supabase

```typescript
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase');

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('ServiceComSupabase', () => {
  beforeEach(() => {
    // Reset do mock
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: [{ id: '1', nome: 'Teste' }],
          error: null,
        }),
      }),
    } as any);
  });

  it('deve buscar dados', async () => {
    const resultado = await buscarDados();

    expect(mockSupabase.from).toHaveBeenCalledWith('tabela');
    expect(resultado).toHaveLength(1);
  });
});
```

### 5. Mockando Logger

```typescript
import { logger } from '@/lib/logger';

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('FuncaoComLogger', () => {
  it('deve logar erro quando falha', async () => {
    await funcaoQuePodefFalhar();

    expect(logger.error).toHaveBeenCalledWith(
      '[Contexto] Mensagem de erro',
      expect.any(Error),
    );
  });
});
```

## Mocks Globais

### jest.setup.js

O arquivo `jest.setup.js` configura:

1. **React Native Mocks**: Alert, Keyboard, Platform, Dimensions
2. **Expo Mocks**: expo-router, expo-camera, expo-image-picker
3. **Supabase Mock**: Cliente mockado com query builder
4. **Unistyles Mock**: Theme e StyleSheet para testes
5. **AsyncStorage Mock**: Operações de storage
6. **Console Mock**: Suprime logs em testes

### Exemplo de Mock Modular

```javascript
// jest.mocks/supabase.js
function setupSupabaseMocks() {
  jest.mock('@/lib/supabase', () => ({
    supabase: {
      auth: {
        signInWithPassword: jest.fn(),
        signOut: jest.fn(),
        getSession: jest.fn(),
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: { unsubscribe: jest.fn() } },
        })),
      },
      from: jest.fn(() => createMockQueryBuilder()),
      storage: {
        from: jest.fn(),
      },
    },
  }));
}
```

## Cobertura de Código

### Thresholds Atuais

| Métrica    | Threshold | Atual |
| ---------- | --------- | ----- |
| Branches   | 65%       | ~66%  |
| Functions  | 72%       | ~73%  |
| Lines      | 73%       | ~74%  |
| Statements | 72%       | ~73%  |

### Exclusões de Cobertura

Arquivos excluídos da cobertura (ver `jest.config.js`):

- Tipos TypeScript (`src/types/**/*.ts`)
- Testes e mocks (`**/__tests__/**`, `**/__mocks__/**`)
- Páginas do Expo Router (`app/**/*.tsx`)
- Módulos nativos específicos de plataforma
- Componentes web-only em ambiente mobile

### Visualizando Cobertura

```bash
# Gerar relatório HTML
npm test -- --coverage

# Abrir no navegador
open coverage/lcov-report/index.html
```

## CI/CD

### GitHub Actions

O workflow `.github/workflows/quality.yml` executa:

1. **Type Check**: `npm run type-check`
2. **Lint**: `npm run lint`
3. **Testes**: `npm test -- --coverage`
4. **Security Audit**: `npm audit --audit-level=moderate`

### Relatório JUnit

O Jest gera `coverage/junit.xml` para integração com CI:

```javascript
// jest.config.js
reporters: [
  'default',
  ['jest-junit', {
    outputDirectory: './coverage',
    outputName: 'junit.xml',
  }],
],
```

## Boas Práticas

### DO's

- Use `describe` para agrupar testes relacionados
- Use nomes descritivos: "deve X quando Y"
- Limpe mocks em `beforeEach`
- Teste casos de sucesso E erro
- Use `waitFor` para operações assíncronas
- Mantenha testes isolados e independentes

### DON'Ts

- Não use `any` desnecessariamente
- Não teste implementação, teste comportamento
- Não crie testes flaky (inconsistentes)
- Não ignore erros de tipo nos testes
- Não compartilhe estado entre testes

## Debugging

### Problemas Comuns

**1. "Cannot find module"**

```bash
# Limpar cache do Jest
npm test -- --clearCache
```

**2. "Timeout exceeded"**

```javascript
// Aumentar timeout do teste
jest.setTimeout(30000);

// Ou no teste específico
it('operação lenta', async () => {
  // ...
}, 30000);
```

**3. "Act warning"**

```typescript
// Envolver atualizações de estado em act()
await act(async () => {
  fireEvent.press(button);
});
```

**4. Snapshots desatualizados**

```bash
npm test -- -u
```

## Referências

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library React Native](https://callstack.github.io/react-native-testing-library/)
- [Expo Testing](https://docs.expo.dev/develop/unit-testing/)
