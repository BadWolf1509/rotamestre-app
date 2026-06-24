# zodResolver Auth — PR-A Implementation Plan

> **STATUS (2026-06-23): CONCLUÍDO E MERGEADO — PR-A #281.** (PR-B = register + reset = #282; ambos na `main`.)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, with checkpoints) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Migrate `login` and `forgot-password` to `useForm` + `zodResolver`, with inline field errors, preserving all submit flows.

**Architecture:** Add `forgotPasswordSchema` + a shared `FieldError` component, then convert each form's manual `useState` validation to `useForm`/`Controller`/`zodResolver`. Validation errors render inline; server/auth errors keep the existing `Dialog`/`useAlert`.

**Tech Stack:** react-hook-form ^7.80, @hookform/resolvers ^5.4 (`zodResolver`), zod ^4.4, `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-06-23-zodresolver-auth-forms-design.md`

## Global Constraints

- Form pattern: `useForm({ resolver: zodResolver(schema) })` + `Controller` (live example: `src/components/gestor/nova-entrega/FormularioParada.tsx`).
- `react-hook-form` imports: `import { useForm, Controller } from 'react-hook-form';` · resolver: `import { zodResolver } from '@hookform/resolvers/zod';`.
- Validation errors → inline; server/auth errors (signIn fail, rate limit, SMTP, etc.) → existing `Dialog`/`useAlert` (unchanged).
- Preserve every submit-flow detail: rate limiters, `authService.*`, routing, error mapping, non-field state (`showPassword`, `loading`, `alertConfig`/`useAlert`).
- Preserve all existing `testID`s and `accessibilityLabel`s on inputs/buttons.
- Commit messages end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Pre-commit hook runs prettier+eslint (`--max-warnings=0`) on staged files.
- Branch: `refactor/zodresolver-auth-forms` (already created).
- Scope: ONLY login + forgot-password (+ forgotPasswordSchema + FieldError). register/reset are PR-B.

## File Structure

- `src/lib/schemas/auth.ts` — **modify:** add `forgotPasswordSchema` + `ForgotPasswordInput`.
- `src/lib/schemas/index.ts` — **modify:** re-export them.
- `src/lib/schemas/__tests__/auth.test.ts` — **create or modify:** unit tests for `forgotPasswordSchema`.
- `src/components/auth/FieldError.tsx` — **create:** shared inline error text.
- `src/components/auth/__tests__/FieldError.test.tsx` — **create:** tests.
- `app/auth/login.tsx` — **modify:** migrate to useForm.
- `app/__tests__/integration/auth/login.test.tsx` — **modify:** update validation-assertion cases.
- `app/auth/forgot-password.tsx` — **modify:** migrate to useForm.
- `app/__tests__/integration/auth/forgot-password.test.tsx` — **modify:** update validation-assertion cases.

---

### Task 1: `forgotPasswordSchema`

**Files:**

- Modify: `src/lib/schemas/auth.ts`, `src/lib/schemas/index.ts`
- Test: `src/lib/schemas/__tests__/auth.test.ts`

**Interfaces:**

- Produces: `forgotPasswordSchema` (`z.object({ email: emailSchema })`), `type ForgotPasswordInput`.

- [ ] **Step 1: Check for an existing schema test file**

Run: `ls src/lib/schemas/__tests__/ 2>/dev/null`
If `auth.test.ts` exists, append to it; otherwise create it with an `import { forgotPasswordSchema } from '../auth';`.

- [ ] **Step 2: Write the failing test**

```ts
import { forgotPasswordSchema } from '../auth';

describe('forgotPasswordSchema', () => {
  it('aceita email válido (lowercased/trimmed)', () => {
    const r = forgotPasswordSchema.safeParse({ email: '  Test@Email.com ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('test@email.com');
  });
  it('rejeita email vazio', () => {
    expect(forgotPasswordSchema.safeParse({ email: '' }).success).toBe(false);
  });
  it('rejeita email malformado', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'nope' }).success).toBe(
      false,
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/lib/schemas/__tests__/auth.test.ts -t forgotPasswordSchema`
Expected: FAIL — `forgotPasswordSchema` is not exported.

- [ ] **Step 4: Implement** — append to `src/lib/schemas/auth.ts` (it already imports `emailSchema` from `./basic`):

```ts
// ============================================================================
// FORGOT PASSWORD
// ============================================================================

/**
 * Forgot-password form schema
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
```

Then in `src/lib/schemas/index.ts`, extend the auth re-export line:

```ts
export {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  type LoginInput,
  type RegisterInput,
  type ForgotPasswordInput,
} from './auth';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/lib/schemas/__tests__/auth.test.ts -t forgotPasswordSchema`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/schemas/auth.ts src/lib/schemas/index.ts src/lib/schemas/__tests__/auth.test.ts
git commit -m "$(cat <<'EOF'
feat(auth): forgotPasswordSchema (zod) + export no barrel

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `FieldError` component

**Files:**

- Create: `src/components/auth/FieldError.tsx`
- Test: `src/components/auth/__tests__/FieldError.test.tsx`

**Interfaces:**

- Produces: `FieldError({ message?: string })` — renders error text, or `null` when `message` is empty/undefined.

- [ ] **Step 1: Write the failing test** — `src/components/auth/__tests__/FieldError.test.tsx`

```tsx
import { render } from '@testing-library/react-native';
import React from 'react';

import { FieldError } from '../FieldError';

jest.mock('@/utils/styles', () => ({
  useUnistyles: () => ({
    theme: {
      colors: { error: '#ef4444' },
      typography: { fontSize: { sm: 14 }, fontSans: 'System' },
      spacing: { xs: 4 },
    },
  }),
  StyleSheet: {
    create: (fn: any) =>
      typeof fn === 'function'
        ? fn({
            colors: { error: '#ef4444' },
            typography: { fontSize: { sm: 14 }, fontSans: 'System' },
            spacing: { xs: 4 },
          })
        : fn,
  },
}));

describe('FieldError', () => {
  it('renderiza a mensagem quando presente', () => {
    const { getByText } = render(<FieldError message="E-mail inválido" />);
    expect(getByText('E-mail inválido')).toBeTruthy();
  });
  it('não renderiza nada quando vazio', () => {
    const { toJSON } = render(<FieldError message={undefined} />);
    expect(toJSON()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/auth/__tests__/FieldError.test.tsx`
Expected: FAIL — cannot find `../FieldError`.

- [ ] **Step 3: Implement** — `src/components/auth/FieldError.tsx`

```tsx
import { Text } from 'react-native';

import { StyleSheet, type Theme } from '@/utils/styles';

interface FieldErrorProps {
  message?: string;
}

/**
 * Erro de validação inline por campo (forms de auth).
 * Retorna null quando não há mensagem → sem shift de layout no estado default.
 */
export function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return <Text style={styles.fieldError}>{message}</Text>;
}

const styles = StyleSheet.create((theme: Theme) => ({
  fieldError: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSans,
    marginTop: theme.spacing.xs,
  },
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/auth/__tests__/FieldError.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/FieldError.tsx src/components/auth/__tests__/FieldError.test.tsx
git commit -m "$(cat <<'EOF'
feat(auth): componente FieldError p/ erro de validação inline

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Migrate `login.tsx`

**Files:**

- Modify: `app/auth/login.tsx`
- Modify: `app/__tests__/integration/auth/login.test.tsx`

**Interfaces:**

- Consumes: `loginSchema`, `type LoginInput` from `@/lib/schemas`; `FieldError` from `@/components/auth/FieldError`.

- [ ] **Step 1: Re-read the current form and its test** (just-in-time)

Read `app/auth/login.tsx` and `app/__tests__/integration/auth/login.test.tsx`. Note: the test asserts `getByText('Ops!')` + `'Por favor, preencha seu e-mail e senha para continuar.'` for empty submit (≈ lines 88–125) — those cases change. Happy-path (signIn called, routing), rate-limit, and server-error cases stay.

- [ ] **Step 2: Migrate the form**

Replace `const [email,setEmail]` / `[password,setPassword]` with:

```tsx
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@/lib/schemas';
import { FieldError } from '@/components/auth/FieldError';

const {
  control,
  handleSubmit,
  formState: { errors },
} = useForm<LoginInput>({
  resolver: zodResolver(loginSchema),
  defaultValues: { email: '', password: '' },
  mode: 'onSubmit',
  reValidateMode: 'onChange',
});
```

- Change `async function handleLogin()` to `async function onSubmit(data: LoginInput)`; remove the `if (!email || !password) { showAlert('Ops!'...) }` block (the schema enforces presence). Use `data.email` / `data.password` (already lowercased/trimmed) everywhere `email`/`password` were used (rate limiter, `authService.signIn`, etc.).
- In **both** the desktop and mobile blocks, wrap the email `TextInput` and password `TextInput` in `<Controller>`, e.g.:

```tsx
<Controller
  control={control}
  name="email"
  render={({ field: { onChange, onBlur, value } }) => (
    <TextInput
      style={styles.input}
      placeholder="seu@email.com"
      value={value}
      onChangeText={onChange}
      onBlur={onBlur}
      keyboardType="email-address"
      autoCapitalize="none"
      autoComplete="email"
      testID="auth-login-email"
    />
  )}
/>
<FieldError message={errors.email?.message} />
```

(password Controller analogous — keep the eye-toggle `TouchableOpacity` and `secureTextEntry={!showPassword}`; `FieldError message={errors.password?.message}` after the password container.)

- Change the submit button: `onPress={handleSubmit(onSubmit)}`.

- [ ] **Step 3: Update the test's validation cases**

In `login.test.tsx`, the empty-field cases that asserted `getByText('Ops!')` / `'Por favor, preencha…'` now assert inline errors. With `loginSchema`: empty email → `'E-mail é obrigatório'`; empty password → `'Senha é obrigatória'`. Add a malformed-email case → `'E-mail inválido'`. Keep happy-path/server-error cases; verify the happy-path `signIn` expected email matches the schema transform (lowercased/trimmed) — adjust the expected arg if the test typed a mixed-case email.

- [ ] **Step 4: Run login test**

Run: `npx jest app/__tests__/integration/auth/login.test.tsx`
Expected: PASS (all). Fix form/test until green — do not weaken assertions.

- [ ] **Step 5: tsc + lint**

Run: `npx tsc --noEmit && npx eslint app/auth/login.tsx`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/auth/login.tsx app/__tests__/integration/auth/login.test.tsx
git commit -m "$(cat <<'EOF'
refactor(auth): login usa useForm + zodResolver com erro inline

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

**→ CHECKPOINT: pause for review before forgot-password.**

---

### Task 4: Migrate `forgot-password.tsx`

**Files:**

- Modify: `app/auth/forgot-password.tsx`
- Modify: `app/__tests__/integration/auth/forgot-password.test.tsx`

**Interfaces:**

- Consumes: `forgotPasswordSchema`, `type ForgotPasswordInput` from `@/lib/schemas`; `FieldError`.

- [ ] **Step 1: Re-read the current form and its test** (just-in-time)

Read `app/auth/forgot-password.tsx` and its integration test. The current empty-email check is `if (!trimmedEmail) showWarning('Erro', 'Digite seu e-mail')`. Note which test cases assert that warning — they change to inline error.

- [ ] **Step 2: Migrate the form**

```tsx
const {
  control,
  handleSubmit,
  formState: { errors },
} = useForm<ForgotPasswordInput>({
  resolver: zodResolver(forgotPasswordSchema),
  defaultValues: { email: '' },
  mode: 'onSubmit',
  reValidateMode: 'onChange',
});
```

- Rename `handleResetPassword` → `onSubmit(data: ForgotPasswordInput)`; remove the `if (!trimmedEmail)` block; use `data.email` (already lowercased/trimmed by `emailSchema`) for the rate limiter and `authService.resetPassword`. Keep all the `429`/`not found`/`smtp`/generic handling and `passwordResetRateLimiter` exactly.
- Wrap the email `TextInput` in `<Controller name="email" ...>` in **both** desktop and mobile blocks; add `<FieldError message={errors.email?.message} />` after each.
- Submit button: `onPress={handleSubmit(onSubmit)}`.

- [ ] **Step 3: Update the test's validation case**

The empty-email case asserting `'Digite seu e-mail'` now asserts inline `'E-mail é obrigatório'`; add a malformed-email → `'E-mail inválido'`. Keep the success/429/smtp/server cases (they use valid emails). Verify the `resetPassword` expected email matches the schema transform.

- [ ] **Step 4: Run forgot test**

Run: `npx jest app/__tests__/integration/auth/forgot-password.test.tsx`
Expected: PASS (all).

- [ ] **Step 5: tsc + lint**

Run: `npx tsc --noEmit && npx eslint app/auth/forgot-password.tsx`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/auth/forgot-password.tsx app/__tests__/integration/auth/forgot-password.test.tsx
git commit -m "$(cat <<'EOF'
refactor(auth): forgot-password usa useForm + zodResolver com erro inline

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: PR-A verification + open PR

- [ ] **Step 1: No leftover manual validation in the two forms**

Run: `grep -nE "if \(!email|if \(!trimmedEmail|preencha seu e-mail" app/auth/login.tsx app/auth/forgot-password.tsx`
Expected: no matches.

- [ ] **Step 2: Typecheck + lint (project)**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Full suite**

Run: `npx jest --silent`
Expected: all green.

- [ ] **Step 4: Push + open PR**

```bash
git push -u origin refactor/zodresolver-auth-forms
gh pr create --base main --fill
```

Watch CI (Run Tests + TypeScript & Linting required; Visual Regression should stay green — `FieldError` renders null in the default state).

## Self-Review

**Spec coverage (PR-A subset):** forgotPasswordSchema → Task 1; FieldError (null-when-empty) → Task 2; login migration + inline errors + preserved flow → Task 3; forgot migration → Task 4; existing-test updates → Tasks 3–4 Step 3; success criteria (no manual validation, green suite, Visual Regression) → Task 5. `register`/`reset`/`resetPasswordSchema` deferred to PR-B (out of PR-A scope). ✓

**Placeholder scan:** Tasks 3–4 use just-in-time reads of large existing files (forms + ~500-line tests) — concrete because they name the file, the specific cases that change (`'Ops!'`/`'Digite seu e-mail'` → inline), and the new assertion strings (`'E-mail é obrigatório'`, `'E-mail inválido'`, `'Senha é obrigatória'`). Acceptable for inline execution.

**Type consistency:** `forgotPasswordSchema`/`ForgotPasswordInput`, `LoginInput`, `FieldError({message})` consistent across tasks. Inline errors via `errors.<field>?.message` (string | undefined) match `FieldError`'s prop.
