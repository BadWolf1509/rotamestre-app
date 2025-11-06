# Auditoria de Acessibilidade e Melhores Práticas - RotaMestre App

## 📊 Resumo Executivo

**Data da Auditoria:** 2025-11-05

### Componentes Novos Criados
- ✅ `src/components/Avatar.tsx` - Componente de avatar reutilizável
- ✅ `src/utils/phoneValidation.ts` - Utilitários de telefone

### Estat\u00edsticas
- **Total de telas auditadas:** 13
- **Telas usando `Alert.alert`:** 7 (necessitam de ConfirmModal na web)
- **Telas com `accessibilityLabel`:** 1 (7% de cobertura)
- **Telas que precisam de melhorias:** 12

---

## 🔴 Problemas Críticos Encontrados

### 1. Uso de `Alert.alert` na Web (7 arquivos)

`Alert.alert` funciona mal na web. Deve ser substituído por `ConfirmModal` + `Toast`.

#### Arquivos Afetados:

1. ✅ **app/gestor/historico.tsx**
   - Status: ✅ JÁ CORRIGIDO
   - Usa `ConfirmModal` para web e `Alert` para mobile
   - Usa `Toast` com `withToast` para feedback

2. ❌ **app/gestor/mapa-rota.tsx**
   - Uso: `Alert.alert('Erro ao carregar rota')`
   - Correção: Usar `showToast('Erro ao carregar rota', 'error')`

3. ❌ **app/gestor/motoristas.tsx**
   - Uso: `Alert.alert('Sucesso', 'Motorista atualizado')`
   - Uso: `Alert.alert('Confirmar exclusão')`
   - Correção: Implementar `ConfirmModal` + `Toast`

4. ❌ **app/gestor/nova-entrega.tsx**
   - Uso: `Alert.alert('Erro', 'Preencha todos os campos')`
   - Correção: Usar `showToast` para validações

5. ❌ **app/perfil/index.tsx**
   - Uso: `Alert.alert('Erro', 'Nome é obrigatório')`
   - Uso: `Alert.alert('Sair', 'Tem certeza?')`
   - Correção: Implementar ConfirmModal + Toast

6. ❌ **app/perfil/trocar-senha.tsx**
   - Uso: `Alert.alert('Erro', 'Preencha todos os campos')`
   - Uso: `Alert.alert('Sucesso!', 'Senha alterada')`
   - Correção: Implementar Toast pattern

7. ❌ **app/gestor/historico-old.tsx**
   - Status: Arquivo antigo (backup)
   - Ação: Pode ser excluído

---

### 2. Falta de Accessibility Labels (12 arquivos)

Apenas 1 arquivo usa `accessibilityLabel`. **Cobertura: 7%**

#### Botões sem acessibilidade:

**app/gestor/dashboard.tsx**
- Todos os botões de navegação sem labels

**app/gestor/nova-entrega.tsx**
- Botão "Adicionar Parada"
- Botão "Gerar Rota"
- Inputs de formulário

**app/gestor/motoristas.tsx**
- Botão "Adicionar Motorista"
- Botões de ação (Editar, Excluir)

**app/perfil/index.tsx**
- Botão "Editar Perfil"
- Botão "Salvar Alterações"
- Botão "Trocar Senha"
- Botão "Sair da Conta"
- Todos os inputs

**app/perfil/trocar-senha.tsx**
- Inputs de senha
- Botão "Alterar Senha"
- Botão "Cancelar"

---

## 🟡 Problemas de Média Prioridade

### 3. Validação de Formulários

#### app/perfil/index.tsx
- ❌ Telefone sem validação
- ❌ Telefone sem máscara
- **Correção:** Usar `phoneValidation.ts`

#### app/gestor/nova-entrega.tsx
- ❌ Campos sem validação em tempo real
- ❌ Telefone sem máscara
- **Correção:** Implementar validação

#### app/gestor/motoristas.tsx
- ❌ Telefone sem validação
- **Correção:** Usar `phoneValidation.ts`

---

### 4. Layout Desktop

Telas que podem se beneficiar de layout em grid:

1. **app/perfil/index.tsx**
   - Layout vertical desperdiça espaço
   - **Correção:** Implementar grid 2 colunas

2. **app/gestor/motoristas.tsx**
   - Formulário poderia ter 2 colunas

3. **app/gestor/nova-entrega.tsx**
   - Formulário muito vertical

---

## 🟢 Boas Práticas Identificadas

### ✅ Arquivos com Boas Implementações

1. **app/gestor/historico.tsx**
   - ✅ Usa `ConfirmModal` para web
   - ✅ Usa `Toast` com `withToast`
   - ✅ Pattern correto de Platform.OS
   - ✅ Separação de lógica (actions, helpers, types)

2. **app/gestor/_layout.tsx**
   - ✅ Único com `accessibilityLabel`
   - Exemplo a ser seguido

3. **src/components/DataTable.tsx**
   - ✅ Componente reutilizável bem estruturado

4. **src/components/ConfirmModal.tsx**
   - ✅ Modal customizado funcional

5. **src/hooks/useToast.ts**
   - ✅ Hook bem implementado

---

## 📋 Plano de Ação por Arquivo

### 🔴 Prioridade Crítica

#### 1. app/perfil/index.tsx
**Problemas:**
- ❌ Usa `Alert.alert` (2 ocorrências)
- ❌ Sem `accessibilityLabel` (6 botões)
- ❌ Telefone sem validação
- ❌ Sem layout grid desktop
- ❌ Sem Avatar
- ❌ `window.location.reload()` (linha 102)

**Ações:**
1. Substituir `Alert.alert` por `ConfirmModal` + `Toast`
2. Adicionar `accessibilityLabel` em todos os botões e inputs
3. Implementar validação de telefone com `phoneValidation.ts`
4. Implementar layout grid 2 colunas
5. Adicionar componente `Avatar`
6. Substituir `window.location.reload()` por `refetch()`
7. Adicionar `useMemo` e `useCallback`

**Estimativa:** 2-3 horas

---

#### 2. app/perfil/trocar-senha.tsx
**Problemas:**
- ❌ Usa `Alert.alert` (3 ocorrências)
- ❌ Sem `accessibilityLabel` (4 inputs/botões)

**Ações:**
1. Substituir `Alert.alert` por `Toast`
2. Adicionar `accessibilityLabel`
3. Usar `ConfirmModal` para confirmação de logout

**Estimativa:** 1 hora

---

#### 3. app/gestor/motoristas.tsx
**Problemas:**
- ❌ Usa `Alert.alert` (múltiplas ocorrências)
- ❌ Sem `accessibilityLabel`
- ❌ Telefone sem validação

**Ações:**
1. Implementar `ConfirmModal` para exclusão
2. Usar `Toast` para feedbacks
3. Adicionar validação de telefone
4. Adicionar `accessibilityLabel`

**Estimativa:** 2 horas

---

#### 4. app/gestor/nova-entrega.tsx
**Problemas:**
- ❌ Usa `Alert.alert`
- ❌ Sem `accessibilityLabel`
- ❌ Validações básicas

**Ações:**
1. Substituir `Alert` por `Toast`
2. Adicionar `accessibilityLabel`
3. Melhorar validações de formulário

**Estimativa:** 1-2 horas

---

#### 5. app/gestor/mapa-rota.tsx
**Problemas:**
- ❌ Usa `Alert.alert`
- ❌ Sem `accessibilityLabel`

**Ações:**
1. Substituir `Alert` por `Toast`
2. Adicionar `accessibilityLabel`

**Estimativa:** 30 min

---

### 🟢 Prioridade Baixa

#### 6. app/gestor/dashboard.tsx
**Problemas:**
- ❌ Sem `accessibilityLabel`

**Ações:**
1. Adicionar `accessibilityLabel` nos botões de navegação

**Estimativa:** 15 min

---

## 📊 Sumário de Esforço

| Arquivo | Problemas | Prioridade | Estimativa |
|---------|-----------|------------|------------|
| app/perfil/index.tsx | 6 | 🔴 Crítica | 2-3h |
| app/perfil/trocar-senha.tsx | 2 | 🔴 Crítica | 1h |
| app/gestor/motoristas.tsx | 3 | 🔴 Crítica | 2h |
| app/gestor/nova-entrega.tsx | 3 | 🔴 Crítica | 1-2h |
| app/gestor/mapa-rota.tsx | 2 | 🔴 Crítica | 30min |
| app/gestor/dashboard.tsx | 1 | 🟢 Baixa | 15min |

**Total Estimado:** 7-9 horas de desenvolvimento

---

## 🎯 Roadmap de Implementação

### Semana 1
- ✅ Criar `Avatar.tsx`
- ✅ Criar `phoneValidation.ts`
- ✅ Documentar melhorias em `MELHORES_PRATICAS_PERFIL.md`
- 🔄 Aplicar melhorias em `app/perfil/index.tsx`

### Semana 2
- Aplicar melhorias em `app/perfil/trocar-senha.tsx`
- Aplicar melhorias em `app/gestor/motoristas.tsx`
- Aplicar melhorias em `app/gestor/nova-entrega.tsx`

### Semana 3
- Aplicar melhorias em `app/gestor/mapa-rota.tsx`
- Aplicar melhorias em `app/gestor/dashboard.tsx`
- Testes de acessibilidade
- Documentação final

---

## 📚 Padrões a Seguir

### ✅ Pattern: Confirmação de Ação Destrutiva

```tsx
// Web
if (Platform.OS === 'web') {
  setShowModal(true);
} else {
  // Mobile
  Alert.alert('Título', 'Mensagem', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Confirmar', style: 'destructive', onPress: handleConfirm }
  ]);
}

<ConfirmModal
  visible={showModal}
  title="Título"
  message="Mensagem"
  confirmText="Confirmar"
  cancelText="Cancelar"
  type="danger"
  onConfirm={handleConfirm}
  onCancel={() => setShowModal(false)}
/>
```

---

### ✅ Pattern: Toast de Feedback

```tsx
const { toast, showToast, hideToast, withToast } = useToast();

// Feedback simples
showToast('Operação concluída!', 'success');

// Feedback com loading
await withToast(
  async () => {
    await supabase.from('table').insert(data);
  },
  {
    loading: 'Salvando...',
    success: 'Salvo com sucesso!',
    error: 'Erro ao salvar',
  }
);

// No render
<Toast {...toast} onDismiss={hideToast} />
```

---

### ✅ Pattern: Accessibility

```tsx
<TouchableOpacity
  onPress={handleAction}
  accessibilityLabel="Descrição clara da ação"
  accessibilityRole="button"
  accessibilityHint="O que acontece ao pressionar"
  accessibilityState={{ disabled: isLoading }}
>
  <Text>Ação</Text>
</TouchableOpacity>

<TextInput
  value={value}
  onChangeText={setValue}
  accessibilityLabel="Nome do campo"
  accessibilityHint="Instrução de preenchimento"
  placeholder="Placeholder"
/>
```

---

### ✅ Pattern: Validação de Telefone

```tsx
import { maskPhone, validatePhone, getPhoneErrorMessage } from '@/utils/phoneValidation';

const [telefone, setTelefone] = useState('');
const [phoneError, setPhoneError] = useState('');

const handlePhoneChange = useCallback((text: string) => {
  const formatted = maskPhone(text);
  setTelefone(formatted);

  if (text.length > 0) {
    const error = getPhoneErrorMessage(formatted);
    setPhoneError(error || '');
  } else {
    setPhoneError('');
  }
}, []);

// No render
<TextInput
  style={[styles.input, phoneError && styles.inputError]}
  value={telefone}
  onChangeText={handlePhoneChange}
  placeholder="(00) 00000-0000"
  keyboardType="phone-pad"
  maxLength={15}
/>
{phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
```

---

## 🔍 Ferramentas de Teste

### Acessibilidade
- **React Native Accessibility Inspector** (iOS)
- **TalkBack** (Android)
- **Screen Reader** (Web)
- **Lighthouse** (Web - Chrome DevTools)

### Testes Manuais
1. Navegação por teclado (Tab, Enter, Esc)
2. Screen reader (leitura de labels)
3. Contraste de cores (WCAG 2.1 AA)
4. Touch targets mínimos (44x44 dp)

---

## ✅ Checklist de Pull Request

Antes de abrir PR, verificar:

- [ ] Todos os `Alert.alert` substituídos por `ConfirmModal` + `Toast`
- [ ] Todos os botões têm `accessibilityLabel`
- [ ] Todos os inputs têm `accessibilityLabel` e `accessibilityHint`
- [ ] Telefones com validação e máscara
- [ ] Layout responsivo (mobile e desktop)
- [ ] Performance otimizada (`useMemo`, `useCallback`)
- [ ] Sem `window.*` ou APIs web-only
- [ ] Toast para todos os feedbacks de sucesso/erro
- [ ] ConfirmModal para ações destrutivas
- [ ] Testes manuais em web e mobile
- [ ] Testes com screen reader

---

## 📧 Contato

Dúvidas sobre implementação? Consulte:
- `docs/MELHORES_PRATICAS_PERFIL.md` - Guia detalhado
- `src/components/ConfirmModal.tsx` - Exemplo de modal
- `app/gestor/historico.tsx` - Exemplo de tela bem implementada
