# Melhorias Implementadas - Tela "Meu Perfil"

## ✅ Componentes Criados

### 1. Avatar Component
**Arquivo:** `src/components/Avatar.tsx`

Componente reutilizável para exibir avatar do usuário:
- ✅ Suporta foto ou iniciais
- ✅ 4 tamanhos: sm, md, lg, xl
- ✅ Cor de fundo customizável
- ✅ Fallback para iniciais (2 letras)

**Uso:**
```tsx
import { Avatar } from '@/components/Avatar';

<Avatar
  name="João Silva"
  imageUrl={profile.foto_url}
  size="xl"
/>
```

---

### 2. Utilit\u00e1rios de Telefone
**Arquivo:** `src/utils/phoneValidation.ts`

Funções para validação e formatação de telefone brasileiro:

- ✅ `formatPhone(phone)` - Formata para (00) 00000-0000
- ✅ `validatePhone(phone)` - Valida número brasileiro
- ✅ `maskPhone(phone)` - Máscara para input
- ✅ `getPhoneErrorMessage(phone)` - Retorna mensagem de erro
- ✅ `cleanPhone(phone)` - Remove formatação

**Validações:**
- DDD entre 11-99
- Celular: 11 dígitos começando com 9
- Fixo: 10 dígitos
- Não aceita números repetidos

**Uso:**
```tsx
import { maskPhone, validatePhone, getPhoneErrorMessage } from '@/utils/phoneValidation';

const handlePhoneChange = (text: string) => {
  const formatted = maskPhone(text);
  setTelefone(formatted);

  const error = getPhoneErrorMessage(formatted);
  setPhoneError(error || '');
};
```

---

## 📋 Melhorias a Implementar em `app/perfil/index.tsx`

### 1. **CRÍTICO: Substituir Alert por ConfirmModal**

**Antes:**
```tsx
import { Alert } from 'react-native';

function handleLogout() {
  Alert.alert('Sair', 'Tem certeza?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Sair', onPress: async () => {
      await supabase.auth.signOut();
      router.replace('/auth/login');
    }}
  ]);
}
```

**Depois:**
```tsx
import { ConfirmModal } from '@/components/ConfirmModal';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { Platform } from 'react-native';

const [showLogoutModal, setShowLogoutModal] = useState(false);
const { toast, showToast, hideToast, withToast } = useToast();

function handleLogout() {
  if (Platform.OS === 'web') {
    setShowLogoutModal(true);
  } else {
    Alert.alert(/* ... */);
  }
}

async function confirmLogout() {
  setShowLogoutModal(false);
  await withToast(
    async () => {
      await supabase.auth.signOut();
      router.replace('/auth/login');
    },
    {
      loading: 'Saindo...',
      success: 'Até logo!',
      error: 'Erro ao sair',
    }
  );
}

// No render
<ConfirmModal
  visible={showLogoutModal}
  title="Sair da Conta"
  message="Tem certeza que deseja sair?"
  confirmText="Sair"
  cancelText="Cancelar"
  type="danger"
  onConfirm={confirmLogout}
  onCancel={() => setShowLogoutModal(false)}
/>

<Toast {...toast} onDismiss={hideToast} />
```

---

### 2. **CRÍTICO: Adicionar Acessibilidade**

```tsx
<TouchableOpacity
  style={styles.editButton}
  onPress={() => setIsEditing(true)}
  accessibilityLabel="Editar perfil"
  accessibilityRole="button"
  accessibilityHint="Ativa o modo de edição do perfil"
>
  <Text style={styles.buttonText}>Editar Perfil</Text>
</TouchableOpacity>

<TextInput
  style={styles.input}
  value={nome}
  onChangeText={setNome}
  placeholder="Digite seu nome completo"
  accessibilityLabel="Campo de nome completo"
  accessibilityHint="Digite seu nome completo"
/>
```

---

### 3. **ALTA: Validação de Telefone com Feedback**

```tsx
import { maskPhone, getPhoneErrorMessage } from '@/utils/phoneValidation';

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

// No styles
inputError: {
  borderColor: theme.colors.error,
},
errorText: {
  fontSize: theme.typography.xs,
  color: theme.colors.error,
  marginTop: 4,
},
```

---

### 4. **ALTA: Layout Grid Desktop**

```tsx
const styles = StyleSheet.create(theme => ({
  infoGrid: {
    // Web: Grid de 2 colunas
    ...(Platform.OS === 'web' && {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: theme.spacing['3xl'],
    }),
    // Mobile: Empilhado
    ...(Platform.OS !== 'web' && {
      flexDirection: 'column',
    }),
  },

  infoColumn: {
    flex: 1,
  },
}));

// No render
<View style={styles.infoGrid}>
  <View style={styles.infoColumn}>
    {/* Nome e Email */}
  </View>
  <View style={styles.infoColumn}>
    {/* Telefone e Papel */}
  </View>
</View>
```

---

### 5. **MÉDIA: Header com Avatar**

```tsx
import { Avatar } from '@/components/Avatar';

<View style={styles.profileHeader}>
  <Avatar
    name={profile.nome}
    imageUrl={profile.foto_url}
    size="xl"
  />
  <View style={styles.profileHeaderInfo}>
    <Text style={styles.profileName}>{profile.nome}</Text>
    <Text style={styles.profileRole}>
      {profile.papel === 'gestor' ? 'Gestor' : 'Motorista'}
    </Text>
  </View>
</View>

// Styles
profileHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: theme.spacing['3xl'],
  padding: theme.spacing['2xl'],
  backgroundColor: theme.colors.primary + '08',
  borderRadius: theme.borderRadius.xl,
},

profileHeaderInfo: {
  marginLeft: theme.spacing['2xl'],
  flex: 1,
},

profileName: {
  fontSize: theme.typography['2xl'],
  fontFamily: theme.typography.fontSansSemiBold,
  color: theme.colors.gray900,
},

profileRole: {
  fontSize: theme.typography.sm,
  color: theme.colors.gray600,
  marginTop: 4,
},
```

---

### 6. **MÉDIA: Ícones nos Labels**

```tsx
<View style={styles.infoGroup}>
  <View style={styles.labelRow}>
    <Text style={styles.infoIcon}>👤</Text>
    <Text style={styles.label}>Nome Completo</Text>
  </View>
  <Text style={styles.value}>{profile.nome}</Text>
</View>

// Styles
labelRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: theme.spacing.sm,
},

infoIcon: {
  marginRight: theme.spacing.sm,
  fontSize: 16,
},
```

Ícones sugeridos:
- 👤 Nome
- 📧 Email
- 📱 Telefone
- 🏢 Unidade
- 🎭 Papel
- 🕒 Último Acesso

---

### 7. **MÉDIA: Performance com useMemo e useCallback**

```tsx
// Memoizar valores computados
const displayPhone = useMemo(() =>
  profile?.telefone ? formatPhone(profile.telefone) : 'Não informado',
  [profile?.telefone]
);

const displayLastLogin = useMemo(() =>
  profile?.ultimo_login
    ? new Date(profile.ultimo_login).toLocaleString('pt-BR')
    : null,
  [profile?.ultimo_login]
);

const roleLabel = useMemo(() =>
  profile?.papel === 'gestor' ? 'Gestor' : 'Motorista',
  [profile?.papel]
);

// Memoizar callbacks
const handleSave = useCallback(async () => {
  // ... código
}, [nome, telefone, profile, updateProfile, showToast, withToast]);

const handleCancel = useCallback(() => {
  setNome(profile?.nome || '');
  setTelefone(profile?.telefone || '');
  setPhoneError('');
  setIsEditing(false);
}, [profile]);

const handleLogout = useCallback(() => {
  // ... código
}, []);
```

---

### 8. **BAIXA: Botão de Retry Cross-Platform**

**Antes:**
```tsx
<TouchableOpacity
  style={styles.retryButton}
  onPress={() => window.location.reload()} // ❌ Web-only
>
```

**Depois:**
```tsx
const { profile, loading, refetch } = useProfile(user);

const handleRetry = useCallback(async () => {
  if (refetch) {
    await refetch();
  }
}, [refetch]);

<TouchableOpacity
  style={styles.retryButton}
  onPress={handleRetry}
  accessibilityLabel="Tentar carregar perfil novamente"
  accessibilityRole="button"
>
  <Text style={styles.retryButtonText}>Tentar novamente</Text>
</TouchableOpacity>
```

---

## 🎯 Ordem de Implementação Recomendada

1. ✅ **Criar Avatar.tsx** (Concluído)
2. ✅ **Criar phoneValidation.ts** (Concluído)
3. 🔄 **Substituir Alert por ConfirmModal + Toast** (CRÍTICO)
4. 🔄 **Adicionar accessibilityLabel em todos os botões** (CRÍTICO)
5. 🔄 **Implementar validação de telefone** (ALTA)
6. 🔄 **Layout grid para desktop** (ALTA)
7. 🔄 **Header com Avatar** (MÉDIA)
8. 🔄 **Otimizar com useMemo/useCallback** (MÉDIA)
9. 🔄 **Adicionar ícones nos labels** (BAIXA)
10. 🔄 **Fix retry button** (BAIXA)

---

## 📊 Impacto das Melhorias

| Melhoria | Impacto UX | Impacto A11y | Impacto Perf | Prioridade |
|----------|-----------|--------------|--------------|------------|
| ConfirmModal + Toast | 🔴 Alto | 🟡 Médio | 🟢 Baixo | 🔴 Crítica |
| Accessibility Labels | 🟡 Médio | 🔴 Alto | 🟢 Baixo | 🔴 Crítica |
| Validação Telefone | 🔴 Alto | 🟡 Médio | 🟢 Baixo | 🟠 Alta |
| Grid Layout Desktop | 🔴 Alto | 🟢 Baixo | 🟢 Baixo | 🟠 Alta |
| Avatar Component | 🟡 Médio | 🟢 Baixo | 🟢 Baixo | 🟡 Média |
| useMemo/useCallback | 🟢 Baixo | 🟢 Baixo | 🟡 Médio | 🟡 Média |
| Ícones nos Labels | 🟡 Médio | 🟢 Baixo | 🟢 Baixo | 🟢 Baixa |
| Fix Retry Button | 🟡 Médio | 🟢 Baixo | 🟢 Baixo | 🟢 Baixa |

---

## 🔍 Próximos Passos

1. Auditar outras telas do sistema:
   - `/gestor/dashboard`
   - `/gestor/nova-entrega`
   - `/gestor/historico`
   - `/gestor/motoristas`
   - `/gestor/mapa-rota`

2. Verificar quais telas ainda usam `Alert.alert` na web

3. Verificar quais telas precisam de accessibility labels

4. Padronizar layout desktop em todas as telas

---

## 📚 Referências

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [React Native Accessibility](https://reactnative.dev/docs/accessibility)
- [Unistyles Documentation](https://www.unistyles.org/)
- [React Performance Optimization](https://react.dev/reference/react/useMemo)
