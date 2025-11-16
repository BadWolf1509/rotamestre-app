# 🧪 Guia de Testes - RotaMestre

Este guia documenta a estratégia e execução de testes do aplicativo RotaMestre.

## 📋 Índice

- [Estrutura de Testes](#estrutura-de-testes)
- [Testes Unitários (Jest + RNTL)](#testes-unitários)
- [Testes E2E (Maestro)](#testes-e2e-maestro)
- [Executando Testes](#executando-testes)
- [Cobertura de Código](#cobertura-de-código)
- [CI/CD](#cicd)

---

## 🗂️ Estrutura de Testes

```
rotamestre-app/
├── __tests__/              # Testes unitários e de componentes
│   ├── utils/              # Testes de funções utilitárias
│   │   ├── phoneValidation.test.ts
│   │   └── dateFormat.test.ts
│   ├── components/         # Testes de componentes React
│   │   ├── DataTable.test.tsx
│   │   ├── Toast.test.tsx
│   │   └── AddressAutocomplete.test.tsx
│   ├── hooks/              # Testes de hooks personalizados
│   │   └── useToast.test.ts
│   └── README.md           # Este arquivo
│
├── .maestro/               # Testes E2E (End-to-End)
│   ├── login-gestor.yaml
│   ├── criar-rota.yaml
│   ├── executar-rota-motorista.yaml
│   └── gerenciar-incidentes.yaml
│
└── jest.config.js          # Configuração do Jest
```

---

## 🎯 Testes Unitários

### Tecnologias

- **Jest** - Framework de testes JavaScript
- **React Native Testing Library (RNTL)** - Utilities para testar componentes React Native
- **@testing-library/jest-native** - Matchers customizados para Jest

### O que testamos

#### 1. **Utilitários (Utils)**

Testa funções puras de lógica de negócio:

```typescript
// Exemplo: phoneValidation.test.ts
import { cleanPhone, formatPhone, validatePhone } from '@/utils/phoneValidation';

describe('cleanPhone', () => {
  it('deve remover caracteres não numéricos', () => {
    expect(cleanPhone('(11) 98765-4321')).toBe('11987654321');
  });
});
```

**Arquivos testados:**
- `phoneValidation.ts` - Validação e formatação de telefone
- `dateFormat.ts` - Formatação de datas
- `distanceCalculation.ts` - Cálculo de distâncias

#### 2. **Componentes React**

Testa renderização e comportamento de componentes:

```typescript
// Exemplo: DataTable.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { DataTable } from '@/components/DataTable';

it('deve renderizar tabela com dados', () => {
  render(<DataTable data={mockData} columns={mockColumns} />);
  expect(screen.getByText('João Silva')).toBeTruthy();
});
```

**Componentes testados:**
- `DataTable.tsx` - Tabela de dados com paginação
- `Toast.tsx` - Notificações de feedback
- `AddressAutocomplete.tsx` - Autocomplete de endereços

#### 3. **Hooks Personalizados**

Testa lógica de hooks customizados:

```typescript
// Exemplo: useToast.test.ts
import { renderHook, act } from '@testing-library/react-native';
import { useToast } from '@/hooks/useToast';

it('deve mostrar toast com mensagem', () => {
  const { result } = renderHook(() => useToast());

  act(() => {
    result.current.showToast('Teste', 'success');
  });

  expect(result.current.toast.visible).toBe(true);
});
```

---

## 🤖 Testes E2E (Maestro)

### Por que Maestro?

✅ **Recomendado oficialmente pela Expo (2025)**
✅ Testes em YAML (mais fácil que JavaScript)
✅ Setup rápido (minutos vs. horas do Detox)
✅ Suporte nativo a iOS e Android
✅ Integração com EAS Build e EAS Update
✅ Maestro Cloud para testes em paralelo

### Instalação do Maestro

#### macOS/Linux
```bash
curl -Ls https://get.maestro.mobile.dev | bash
```

#### Windows (via WSL + Homebrew)
```bash
brew tap mobile-dev-inc/tap
brew install maestro
```

### Fluxos E2E Disponíveis

#### 1. **Login de Gestor** (`login-gestor.yaml`)
Testa autenticação e acesso ao dashboard:
```yaml
- launchApp
- tapOn: "E-mail"
- inputText: "gestor@test.com"
- tapOn: "Senha"
- inputText: "senha123"
- tapOn: "Entrar"
- assertVisible: "Dashboard"
```

#### 2. **Criação de Rota** (`criar-rota.yaml`)
Testa fluxo completo de criação de rota:
- Adicionar 3 paradas (2 entregas + 1 retirada)
- Otimizar rota com Google Directions API
- Selecionar motorista
- Gerar rota circular

#### 3. **Execução de Rota (Motorista)** (`executar-rota-motorista.yaml`)
Testa fluxo do motorista:
- Visualizar rotas disponíveis
- Iniciar rota
- Completar paradas com foto de comprovação
- Reportar incidente
- Finalizar rota

---

## ▶️ Executando Testes

### Testes Unitários

```bash
# Executar todos os testes
npm test

# Executar em modo watch (desenvolvimento)
npm run test:watch

# Executar com cobertura de código
npm run test:coverage

# Executar testes específicos
npm test phoneValidation

# Modo verbose (mais detalhes)
npm run test:verbose
```

### Testes E2E com Maestro

#### Pré-requisitos

1. **Android:** Emulador Android rodando ou dispositivo conectado
2. **iOS:** Simulador iOS rodando (macOS only)
3. **App buildado:** Build de desenvolvimento ou produção

#### Executar testes

```bash
# Executar todos os fluxos E2E
maestro test .maestro/

# Executar fluxo específico
maestro test .maestro/login-gestor.yaml

# Executar com Maestro Studio (modo interativo)
maestro studio

# Executar em dispositivo específico
maestro test --device "Pixel 7" .maestro/criar-rota.yaml
```

#### Maestro Studio (Gravação de testes)

Ferramenta visual para criar/debugar testes:

```bash
maestro studio
```

Abre interface visual onde você pode:
- Gravar interações com o app
- Inspecionar elementos
- Debugar testes que falharam

---

## 📊 Cobertura de Código

### Gerar relatório de cobertura

```bash
npm run test:coverage
```

### Visualizar relatório HTML

```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

### Metas de cobertura

| Tipo | Meta |
|------|------|
| **Statements** | ≥ 70% |
| **Branches** | ≥ 65% |
| **Functions** | ≥ 70% |
| **Lines** | ≥ 70% |

### Arquivos críticos para 100% de cobertura

- `src/utils/phoneValidation.ts` ✅
- `src/hooks/useToast.ts` ✅
- `src/services/googleMapsService.ts` ⚠️
- `src/lib/supabase.ts` ⚠️

---

## 🚀 CI/CD (Integração Contínua)

### GitHub Actions (exemplo)

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Maestro
        run: |
          curl -Ls https://get.maestro.mobile.dev | bash
          echo "${HOME}/.maestro/bin" >> $GITHUB_PATH

      - name: Run E2E tests
        run: maestro test .maestro/
```

### EAS Build + Maestro Cloud

```bash
# Build para testes E2E
eas build --profile test --platform android

# Executar testes no Maestro Cloud
maestro cloud .maestro/ --app-binary app.apk
```

---

## 📝 Best Practices

### 1. **Testes Unitários**

✅ **DO:**
- Teste lógica de negócio pura (funções utils)
- Mock de dependências externas (Supabase, Google Maps API)
- Um teste por cenário (evite testes "god")
- Nomes descritivos: `deve [ação esperada] quando [condição]`

❌ **DON'T:**
- Testar implementação interna (teste comportamento)
- Testar bibliotecas de terceiros
- Criar testes frágeis (dependentes de timing)

### 2. **Testes de Componentes**

✅ **DO:**
- Teste comportamento do usuário (cliques, digitação)
- Use `screen.getByText()`, `screen.getByRole()` (accessibility)
- Teste estados (loading, error, success)

❌ **DON'T:**
- Testar estilos CSS (use snapshot tests com moderação)
- Testar detalhes de implementação (state interno)

### 3. **Testes E2E**

✅ **DO:**
- Teste fluxos críticos de negócio
- Use `waitForAnimationToEnd` entre interações
- Adicione `assertVisible` para verificar estado
- Mantenha testes independentes (sem dependências entre fluxos)

❌ **DON'T:**
- Testar todos os cenários possíveis (E2E é lento)
- Hardcoded wait times (use `waitFor`)
- Testes muito longos (quebre em fluxos menores)

---

## 🐛 Troubleshooting

### Problema: Jest não encontra módulos com `@/`

**Solução:** Verificar `moduleNameMapper` no `package.json`:

```json
"jest": {
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/src/$1"
  }
}
```

### Problema: Maestro não encontra elemento

**Solução:**
1. Use `maestro studio` para inspecionar hierarquia
2. Adicione `testID` aos componentes:
   ```tsx
   <TouchableOpacity testID="login-button">
   ```
3. Use seletores mais específicos:
   ```yaml
   - tapOn:
       id: "login-button"
   ```

### Problema: Testes E2E falhando com timeout

**Solução:**
```yaml
# Aumentar timeout
- waitForAnimationToEnd:
    timeout: 5000

# Ou adicionar wait explícito
- waitFor:
    visible: "Carregando..."
    timeout: 10000
```

---

## 📚 Recursos

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Maestro Documentation](https://maestro.mobile.dev/)
- [Expo Testing Guide](https://docs.expo.dev/develop/unit-testing/)

---

## 🤝 Contribuindo

Ao adicionar novas features:

1. ✅ Escreva testes unitários para lógica nova
2. ✅ Atualize testes de componentes se UI mudou
3. ✅ Adicione fluxo E2E se é feature crítica
4. ✅ Rode `npm run test:coverage` antes de commit
5. ✅ Garanta que testes passam localmente

---

**Última atualização:** 2025-11-16
**Versão:** 1.0.0
