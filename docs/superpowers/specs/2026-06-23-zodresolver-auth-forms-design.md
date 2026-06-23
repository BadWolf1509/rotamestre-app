# zodResolver nos forms de auth — Design

**Date:** 2026-06-23
**Branch:** `refactor/zodresolver-auth-forms`
**Roadmap item:** `improvements-roadmap-2026-06` — "zodResolver nos forms de auth/perfil/SOS (hoje usam helpers soltos; os schemas Zod já existem)."

## Problema

Os 4 forms de auth (`app/auth/login.tsx`, `register.tsx`, `forgot-password.tsx`, `reset-password.tsx`) validam manualmente com `useState` + checagens soltas (`!email`, `isValidEmail`, `validatePassword`, `password !== confirmPassword`) e mostram erros num `Dialog`/`useAlert` único — divergindo do padrão obrigatório do CLAUDE.md (`useForm({ resolver: zodResolver(schema) })`, exemplo vivo em `FormularioParada.tsx`). Os schemas de `login`/`register` já existem; `forgot`/`reset` não têm schema.

## Escopo

**Somente os 4 forms de auth.** Perfil e SOS ficam como follow-up (sub-projetos próprios — precisam de vários schemas novos e tocam áreas diferentes).

Não-objetivos: migrar perfil/SOS; unificar os mecanismos de alerta (login usa `Dialog`+`alertConfig`; os outros usam `useAlert()`); deduplicar o JSX desktop/mobile; mudar o fluxo de submit (rate limit, `authService`, roteamento, recuperação de sessão).

## Decisões (já validadas com o gestor)

- **Escopo:** 4 forms de auth (não só login+register; não os ~9).
- **Exibição de erros:** erros de **validação** inline por campo; erros de **servidor/auth** (credencial inválida, rate limit, SMTP, link expirado) continuam no `Dialog`/`useAlert`.

## Os 4 forms (heterogêneos)

| Form              | Inputs                                         | Render                     | UI extra                                                                   | Schema             | Alerta                 |
| ----------------- | ---------------------------------------------- | -------------------------- | -------------------------------------------------------------------------- | ------------------ | ---------------------- |
| `login`           | raw `TextInput` (email, senha)                 | desktop+mobile             | —                                                                          | `loginSchema` ✓    | `Dialog`+`alertConfig` |
| `register`        | DS `Input` (nome, email, senha, confirm, tipo) | render único               | —                                                                          | `registerSchema` ✓ | `useAlert()`           |
| `forgot-password` | raw `TextInput` (email)                        | desktop+mobile             | —                                                                          | **novo**           | `useAlert()`           |
| `reset-password`  | raw `TextInput` (senha, confirm)               | desktop+mobile + 3 estados | `PasswordStrengthIndicator` + requisitos + mismatch + `useSessionRecovery` | **novo**           | `useAlert()`           |

## Schemas (`src/lib/schemas/auth.ts`)

Reusa `loginSchema`/`registerSchema`. Adiciona, exportando no barrel `src/lib/schemas/index.ts`:

```ts
export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirme sua senha'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
```

## Componente compartilhado: `FieldError`

`src/components/auth/FieldError.tsx` — renderiza o texto de erro com o mesmo estilo de erro do DS `Input` (cor `theme.colors.error`, fontSize sm). **Retorna `null` quando `message` é vazio** → nenhum container no estado default → sem shift de layout → baseline de Visual Regression estável.

```tsx
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text style={styles.fieldError}>{message}</Text>;
}
```

Usado por `login`/`forgot`/`reset` (raw `TextInput`). `register` usa o `error` prop do DS `Input` (`src/components/Input.tsx:22` já suporta).

## Padrão de migração (por form)

```ts
const {
  control,
  handleSubmit,
  formState: { errors },
} = useForm<Input>({
  resolver: zodResolver(schema),
  defaultValues: {
    /* '' por campo */
  },
  mode: 'onSubmit',
  reValidateMode: 'onChange', // erro limpa conforme o usuário corrige
});
```

- Cada input vira `<Controller name="x" control={control} render={({ field }) => (...) } />`, preservando props visuais (placeholder, secureTextEntry, eye-toggle, keyboardType, testID, estilos). Nos forms com split, fazer nos **dois** blocos (desktop + mobile).
- Erro inline: `<FieldError message={errors.x?.message} />` (raw) ou `error={errors.x?.message}` (DS `Input`).
- Submit: `onPress={handleSubmit(onSubmit)}`. O `onSubmit(data)` contém **o fluxo de submit atual inalterado** (rate limiter, `authService.*`, roteamento, alerts de servidor). Os valores vêm de `data` (já parseados/trimados pelo schema) em vez do `useState`.
- Estado não-de-campo permanece: `showPassword`/`showConfirmPassword`, `loading`, `alertConfig`/`useAlert`, `useSessionRecovery` (`checkingSession`/`linkExpired`), refs de foco.

### Especificidades

- **login**: remove `useState(email/password)` e o `if (!email || !password)`; `loginSchema` valida (inclui formato de email — comportamento novo desejado). `Dialog` continua p/ "usuário não encontrado"/erro/rate-limit.
- **register**: `Controller` com DS `Input error={...}`; `tipo` (gestor/motorista) via `Controller` ligado aos botões; remove as 5 checagens manuais (`validatePassword`/`isValidEmail`/mismatch) — agora no `registerSchema`. `useAlert` continua p/ erro de signup.
- **forgot**: 1 campo; `forgotPasswordSchema` valida email; todo o tratamento de resposta (`429`/`not found`/`smtp`/genérico) e o `passwordResetRateLimiter` ficam no `onSubmit`.
- **reset**: `resetPasswordSchema` substitui `validateForm()`; o `refine` substitui o `mismatchContent` manual. **Mantém** `PasswordStrengthIndicator` (feedback live de força), caixa de requisitos, eye-toggles, os 3 estados de render e o fluxo de `useSessionRecovery`/retry. `FieldError` mostra o erro do schema (senha fraca / não coincide).

## Regra de erros

- **Validação** (email inválido, senha fraca, senhas não coincidem, campo vazio) → inline (`FieldError` / `Input.error`).
- **Servidor/auth** (signIn falho, signup falho, rate limit, SMTP, link expirado) → `Dialog`/`useAlert` (inalterado).

## Testes

`@testing-library/react-native` por form (`app/auth/__tests__/<form>.test.tsx` ou junto dos existentes):

1. **Validação bloqueia submit**: input inválido (ex.: email malformado, senha fraca, confirm divergente) → erro inline aparece **e** `authService.*` **não** é chamado.
2. **Happy path**: input válido → `authService.<signIn|signUp|resetPassword|updatePassword>` chamado com os valores corretos (email lowercased/trimmed pelo schema).
3. **Erro de servidor**: `authService` rejeita → caminho de alerta (Dialog/useAlert) é acionado; rate limiter registra falha quando aplicável.

- unit tests dos 2 schemas novos (`forgotPasswordSchema`, `resetPasswordSchema`) em `src/lib/schemas/__tests__/`.

Mocks: `@/lib/auth` (authService), `@/lib/rateLimiter`, `@/hooks/useAlert`, `@/hooks/auth/useSessionRecovery` (reset), `expo-router`. Seguir os mocks já usados em `app/auth/__tests__/` se existirem.

## Estrutura de entrega

1 PR, commits granulares: (1) schemas + FieldError, (2) login, (3) forgot, (4) register, (5) reset — cada um com seus testes. Alternativa: 2 PRs (login+forgot / register+reset). Decisão no finishing.

## Critérios de sucesso

- Os 4 forms usam `useForm` + `zodResolver`; sem checagem manual de validação remanescente.
- Erros de validação inline; erros de servidor/auth via Dialog/useAlert (inalterado).
- Fluxos de submit (rate limit, authService, roteamento, session recovery) preservados — verificados por teste.
- `tsc` + lint limpos; suíte completa verde; **Visual Regression verde** (FieldError null-quando-vazio evita mudança de baseline no estado default).
