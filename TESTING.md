# Guia de Testes - Rotamestre App

## 📚 Índice

1. [O que são Testes Automatizados](#o-que-são-testes-automatizados)
2. [Por que Testar](#por-que-testar)
3. [Ferramentas Utilizadas](#ferramentas-utilizadas)
4. [Instalação](#instalação)
5. [Executando Testes](#executando-testes)
6. [Estrutura de Testes](#estrutura-de-testes)
7. [Exemplos Práticos](#exemplos-práticos)
8. [Boas Práticas](#boas-práticas)
9. [Cobertura de Código](#cobertura-de-código)

---

## O que são Testes Automatizados

Testes automatizados são scripts que verificam se o código funciona como esperado. Eles simulam interações do usuário e validam os resultados, garantindo que:

- **Componentes renderizam corretamente**: Todos os elementos visuais aparecem na tela
- **Interações funcionam**: Cliques, digitação e navegação funcionam
- **Lógica de negócio está correta**: Validações, cálculos e regras funcionam
- **Não há regressões**: Mudanças não quebram funcionalidades existentes

---

## Por que Testar

### Benefícios:

✅ **Confiança**: Saiba que seu código funciona antes de enviar para produção
✅ **Documentação**: Testes servem como documentação viva do comportamento esperado
✅ **Refatoração segura**: Mude o código sem medo de quebrar funcionalidades
✅ **Detecção precoce de bugs**: Encontre problemas antes dos usuários
✅ **Velocidade de desenvolvimento**: Menos tempo debugando, mais tempo criando

### O que testar:

- ✅ Componentes visuais (Button, Toast, Cards)
- ✅ Hooks customizados (useToast, useProfile, useUser)
- ✅ Fluxos de usuário (login, editar perfil, criar rota)
- ✅ Validações de formulários
- ✅ Navegação entre telas
- ✅ Integração com APIs (mocked)

### O que NÃO testar:

- ❌ Bibliotecas de terceiros (React Native, Expo Router, etc.)
- ❌ Código gerado automaticamente
- ❌ Constantes e configurações simples

---

## Ferramentas Utilizadas

### Jest
Framework de testes JavaScript. Fornece:
- Função `describe()` para agrupar testes relacionados
- Função `it()` ou `test()` para cada teste individual
- Função `expect()` para fazer asserções
- Mocks para simular módulos e funções

### React Native Testing Library
Biblioteca para testar componentes React Native. Fornece:
- `render()`: Renderiza componentes para teste
- `fireEvent`: Simula eventos (clique, digitação, etc.)
- `waitFor()`: Aguarda mudanças assíncronas
- Queries: `getByText()`, `getByTestId()`, etc.

### jest-expo
Preset do Jest otimizado para projetos Expo, configurando:
- Transformação de código TypeScript
- Mocks de módulos nativos
- Suporte a assets (imagens, fontes)

---

## Instalação

### 1. Instalar Dependências

```bash
cd rotamestre-app
npm install --save-dev jest jest-expo @testing-library/react-native @testing-library/jest-native @types/jest
```

### 2. Verificar Arquivos de Configuração

Os seguintes arquivos já foram criados:

- `jest.config.js` - Configuração principal do Jest
- `jest.setup.js` - Mocks globais e configurações iniciais
- `tsconfig.json` - Já configurado com path aliases

---

## Executando Testes

### Comandos Disponíveis:

```bash
# Executar todos os testes uma vez
npm test

# Executar testes em modo watch (re-executa ao salvar)
npm run test:watch

# Executar testes com relatório de cobertura
npm run test:coverage

# Executar testes com saída detalhada
npm run test:verbose
```

### Executar Testes Específicos:

```bash
# Testar apenas um arquivo
npm test Button.test.tsx

# Testar arquivos que contêm "Button" no nome
npm test Button

# Testar apenas testes com "deve renderizar" na descrição
npm test -t "deve renderizar"
```

---

## Estrutura de Testes

### Organização de Arquivos:

```
rotamestre-app/
├── src/
│   ├── components/
│   │   ├── Button.tsx
│   │   ├── Toast.tsx
│   │   └── __tests__/
│   │       ├── Button.test.tsx       ✅ Testes de componentes
│   │       └── Toast.test.tsx
│   │
│   └── hooks/
│       ├── useToast.ts
│       └── __tests__/
│           └── useToast.test.tsx      ✅ Testes de hooks
│
└── app/
    ├── perfil/
    │   └── index.tsx
    └── __tests__/
        └── perfil.test.tsx             ✅ Testes de telas
```

### Anatomia de um Teste:

```typescript
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button Component', () => {  // 1. Agrupa testes relacionados

  it('deve renderizar corretamente', () => {  // 2. Descreve o comportamento esperado
    const { getByText } = render(<Button>Clique</Button>);  // 3. Renderiza o componente

    expect(getByText('Clique')).toBeTruthy();  // 4. Faz a asserção
  });

  it('deve chamar onPress quando clicado', () => {
    const mockOnPress = jest.fn();  // 5. Cria um mock
    const { getByText } = render(<Button onPress={mockOnPress}>Clique</Button>);

    fireEvent.press(getByText('Clique'));  // 6. Simula interação

    expect(mockOnPress).toHaveBeenCalledTimes(1);  // 7. Verifica o resultado
  });
});
```

---

## Exemplos Práticos

### 1. Testando Componente Button

Ver arquivo completo: `src/components/__tests__/Button.test.tsx`

```typescript
it('deve aplicar variante primary corretamente', () => {
  const { getByText } = render(<Button variant="primary">Primário</Button>);
  const button = getByText('Primário').parent;

  expect(button).toHaveStyle({ backgroundColor: '#1e5aa8' });
});
```

**O que testa**: Verifica se a prop `variant="primary"` aplica o estilo correto.

### 2. Testando Hook useToast

Ver arquivo completo: `src/hooks/__tests__/useToast.test.tsx`

```typescript
it('deve mostrar toast de sucesso', () => {
  const { result } = renderHook(() => useToast());

  act(() => {
    result.current.showToast('Operação realizada!', 'success');
  });

  expect(result.current.toast.visible).toBe(true);
  expect(result.current.toast.message).toBe('Operação realizada!');
  expect(result.current.toast.type).toBe('success');
});
```

**O que testa**: Verifica se o hook gerencia corretamente o estado do toast.

### 3. Testando Tela de Perfil

Ver arquivo completo: `app/__tests__/perfil.test.tsx`

```typescript
it('deve entrar em modo de edição ao clicar em "Editar Perfil"', async () => {
  const { getByText, queryByText } = render(<PerfilScreen />);

  await waitFor(() => {
    expect(getByText('Editar Perfil')).toBeTruthy();
  });

  fireEvent.press(getByText('Editar Perfil'));

  await waitFor(() => {
    expect(getByText('Salvar Alterações')).toBeTruthy();
    expect(getByText('Cancelar')).toBeTruthy();
    expect(queryByText('Editar Perfil')).toBeNull();
  });
});
```

**O que testa**: Verifica se clicar em "Editar Perfil" muda a UI para modo de edição.

---

## Boas Práticas

### ✅ DO (Faça):

1. **Teste comportamento, não implementação**
   ```typescript
   // ✅ BOM: Testa o que o usuário vê
   expect(getByText('Bem-vindo!')).toBeTruthy();

   // ❌ RUIM: Testa detalhes de implementação
   expect(component.state.welcomeMessage).toBe('Bem-vindo!');
   ```

2. **Use queries semânticas**
   ```typescript
   // ✅ BOM: Query por texto visível
   getByText('Entrar')

   // ⚠️ OK: Query por testID quando texto é dinâmico
   getByTestId('login-button')

   // ❌ RUIM: Query por implementação interna
   container.querySelector('.button-primary')
   ```

3. **Mocks devem ser simples**
   ```typescript
   // ✅ BOM: Mock simples e claro
   jest.mock('@/lib/supabase', () => ({
     supabase: {
       auth: {
         getUser: jest.fn().mockResolvedValue({ data: { user: mockUser } })
       }
     }
   }));
   ```

4. **Um conceito por teste**
   ```typescript
   // ✅ BOM: Testa apenas renderização
   it('deve renderizar o botão', () => {
     const { getByText } = render(<Button>Click</Button>);
     expect(getByText('Click')).toBeTruthy();
   });

   // ✅ BOM: Testa apenas interação (teste separado)
   it('deve chamar onPress', () => {
     const mock = jest.fn();
     const { getByText } = render(<Button onPress={mock}>Click</Button>);
     fireEvent.press(getByText('Click'));
     expect(mock).toHaveBeenCalled();
   });
   ```

5. **Use `waitFor` para código assíncrono**
   ```typescript
   it('deve carregar dados', async () => {
     const { getByText } = render(<Profile />);

     await waitFor(() => {
       expect(getByText('João Silva')).toBeTruthy();
     });
   });
   ```

### ❌ DON'T (Não faça):

1. **Não teste bibliotecas externas**
2. **Não use `setTimeout` em testes** (use `waitFor` ou fake timers)
3. **Não compartilhe estado entre testes** (use `beforeEach` para reset)
4. **Não ignore warnings** (eles geralmente indicam problemas reais)

---

## Cobertura de Código

### Executar Relatório de Cobertura:

```bash
npm run test:coverage
```

### Interpretar o Relatório:

```
--------------------|---------|----------|---------|---------|-------------------
File                | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------------|---------|----------|---------|---------|-------------------
All files           |   78.5  |   65.2   |   82.3  |   77.8  |
 components/        |   85.7  |   75.0   |   90.0  |   84.2  |
  Button.tsx        |   95.2  |   88.9   |  100.0  |   94.7  | 45-47
  Toast.tsx         |   76.2  |   61.1   |   80.0  |   73.7  | 23,56-62
 hooks/             |   71.3  |   55.4   |   74.6  |   70.5  |
  useToast.ts       |   88.9  |   75.0   |  100.0  |   87.5  | 18
--------------------|---------|----------|---------|---------|-------------------
```

**Métricas**:
- **% Stmts** (Statements): Linhas de código executadas
- **% Branch**: Condições if/else testadas
- **% Funcs**: Funções executadas
- **% Lines**: Linhas totais executadas

**Meta Recomendada**: 80%+ de cobertura geral

### Visualizar Cobertura no Navegador:

```bash
npm run test:coverage
# Abrir: coverage/lcov-report/index.html
```

---

## Comandos Úteis

```bash
# Limpar cache do Jest
npx jest --clearCache

# Executar apenas testes modificados
npm test --onlyChanged

# Ver apenas testes falhando
npm test --onlyFailures

# Executar com debug
node --inspect-brk node_modules/.bin/jest --runInBand
```

---

## Próximos Passos

1. **Instalar dependências**: `npm install`
2. **Executar testes de exemplo**: `npm test`
3. **Ver cobertura**: `npm run test:coverage`
4. **Criar mais testes**: Use os exemplos como base
5. **Configurar CI/CD**: Adicionar `npm test` ao pipeline

---

## Recursos Adicionais

- [Jest Documentation](https://jestjs.io/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Jest Expo Documentation](https://docs.expo.dev/develop/unit-testing/)

---

**Dúvidas?** Consulte este guia ou os testes de exemplo em `__tests__/` 🚀
