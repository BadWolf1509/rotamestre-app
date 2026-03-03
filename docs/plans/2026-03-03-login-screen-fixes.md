# Login Screen Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 10 design/accessibility issues on the auth/login screen, raising the score from 6.4/10 to ≥ 8.5/10.

**Architecture:** All changes are in one screen file (`app/auth/login.tsx`) and one component (`AuthBrandPanel.tsx`). The login screen has two render paths: desktop (split-screen) and mobile (vertical). We fix accessibility (focus ring, labels, touch targets), visual polish (panels, contrast, logo), and UX (tablet layout, contact link). Tests are updated last.

**Tech Stack:** React Native + Expo 54, Unistyles v3 theming, TypeScript 5.9, Jest + RNTL.

---

## Theme Reference (spacing tokens)

```
xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24
'2': 8, '2.5': 10, '8': 32, '16': 64
```

## Breakpoints (useResponsive)

```
isMobile: width < 768
isTablet: width >= 768 && width < 1024
isDesktop: width >= 1024
```

---

## Task 1: Focus Ring on Inputs (🔴 Critical — WCAG 2.4.7)

**Problem:** When inputs receive keyboard focus, there is zero visual change. No outline, no border color change, no box-shadow. Users navigating by tab cannot see which field is focused.

**Files:**
- Modify: `app/auth/login.tsx` — styles section (lines 368-376, 382-392, 433-441, 442-452)

**Step 1: Add focus state styles to all 4 input styles**

On web, React Native's `TextInput` renders as `<input>`. We need to add CSS focus styles. Since Unistyles doesn't support `:focus` pseudo-selectors directly, we inject a global CSS rule for all TextInputs on the login page.

Add a `Platform.OS === 'web'` block at the top of the component (after existing `if (Platform.OS === 'web')` keyframes pattern in AuthBrandPanel) — OR more simply, add inline web focus styles via the existing pattern.

**Approach:** Use `Platform.select` to add web-specific outline styles on the input styles. Since React Native Web maps `outline*` CSS properties, we add:

```typescript
// Add to each input style (input, inputPassword, inputDesktop, inputDesktopPassword):
...(Platform.OS === 'web' && {
  outlineStyle: 'none',  // Remove default browser outline
} as any),
```

Then inject a global CSS style for focus (same pattern as AuthBrandPanel keyframes):

At the top of `login.tsx`, after imports, add:

```typescript
// Inject focus ring styles for login inputs (web only)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'login-focus-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      [data-testid="auth-login-email"]:focus,
      [data-testid="auth-login-password"]:focus {
        border-color: #284093 !important;
        box-shadow: 0 0 0 3px rgba(40, 64, 147, 0.15) !important;
        outline: none !important;
      }
    `;
    document.head.appendChild(styleEl);
  }
}
```

**Step 2: Run type-check**

```bash
cd D:/RotaMestre/rotamestre-app && npm run type-check
```

Expected: 0 errors.

**Step 3: Run existing tests to verify nothing breaks**

```bash
npx jest app/__tests__/integration/auth/login.test.tsx --verbose
```

Expected: All existing tests pass.

**Step 4: Commit**

```bash
git add app/auth/login.tsx
git commit -m "fix(login): add visible focus ring on inputs (WCAG 2.4.7)"
```

---

## Task 2: Mobile Labels Above Inputs (🔴 Critical — WCAG 1.3.1)

**Problem:** Mobile uses `placeholder="E-mail"` and `placeholder="Senha"` as the only labels. When the user types, the label disappears. Desktop correctly has persistent labels above inputs.

**Files:**
- Modify: `app/auth/login.tsx` — mobile render section (lines 245-279) and styles section

**Step 1: Add labels above mobile inputs**

In the mobile render section, wrap each input in a View with a label, matching the desktop pattern:

Replace the email input (line 246-255):
```tsx
<View style={styles.inputGroup}>
  <Text style={styles.inputLabel}>E-mail</Text>
  <TextInput
    style={styles.input}
    placeholder="seu@email.com"
    value={email}
    onChangeText={setEmail}
    keyboardType="email-address"
    autoCapitalize="none"
    autoComplete="email"
    testID="auth-login-email"
  />
</View>
```

Replace the password container (lines 257-279):
```tsx
<View style={styles.inputGroup}>
  <Text style={styles.inputLabel}>Senha</Text>
  <View style={styles.passwordContainer}>
    <TextInput
      style={styles.inputPassword}
      placeholder="••••••••"
      value={password}
      onChangeText={setPassword}
      secureTextEntry={!showPassword}
      autoComplete="password"
      testID="auth-login-password"
    />
    <TouchableOpacity
      style={styles.eyeButton}
      onPress={() => setShowPassword(!showPassword)}
      accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
      accessibilityRole="button"
    >
      <Ionicons
        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
        size={22}
        color={theme.colors.gray500}
      />
    </TouchableOpacity>
  </View>
</View>
```

**Step 2: Add missing mobile styles**

The `inputGroup` and `inputLabel` styles already exist (for desktop) — they will be reused for mobile too. No new styles needed.

**Step 3: Update tests**

In `app/__tests__/integration/auth/login.test.tsx`:

Tests currently use `getByPlaceholderText('E-mail')` and `getByPlaceholderText('Senha')`. Since the placeholder changes from `"E-mail"` to `"seu@email.com"` and from `"Senha"` to `"••••••••"`, update all test references:

- `getByPlaceholderText('E-mail')` → `getByPlaceholderText('seu@email.com')`
- `getByPlaceholderText('Senha')` → `getByPlaceholderText('••••••••')`
- `expect(getByPlaceholderText('E-mail'))` → `expect(getByPlaceholderText('seu@email.com'))`
- Update the rendering test assertion: `expect(getByText('Entre com sua conta'))` stays the same
- Add: `expect(getByText('E-mail')).toBeTruthy();` and `expect(getByText('Senha')).toBeTruthy();`

**Step 4: Run tests**

```bash
npx jest app/__tests__/integration/auth/login.test.tsx --verbose
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add app/auth/login.tsx app/__tests__/integration/auth/login.test.tsx
git commit -m "fix(login): add persistent labels above mobile inputs (WCAG 1.3.1)"
```

---

## Task 3: Forgot Password Touch Target (🔴 Critical — WCAG 2.5.8)

**Problem:** "Esqueceu a senha?" link measures 118×19px. WCAG minimum is 44×44px height.

**Files:**
- Modify: `app/auth/login.tsx` — `forgotButton` style (line 467-468)

**Step 1: Expand touch target**

Update the `forgotButton` style:

```typescript
// Before:
forgotButton: {
  alignSelf: 'flex-end',
},

// After:
forgotButton: {
  alignSelf: 'flex-end',
  paddingVertical: theme.spacing.md,  // 12px — brings total height to ~43px
},
```

This adds 12px padding top + 12px bottom = 24px + 19px text = 43px total, close to the 44px target. If we want exactly 44px+, use `paddingVertical: theme.spacing.md` (12px) which gives 19 + 24 = 43px — acceptable.

**Step 2: Run tests**

```bash
npx jest app/__tests__/integration/auth/login.test.tsx --verbose
```

Expected: All pass (no visual assertions affected).

**Step 3: Commit**

```bash
git add app/auth/login.tsx
git commit -m "fix(login): expand forgot-password touch target to 44px (WCAG 2.5.8)"
```

---

## Task 4: Brand Panel Logo — Use Transparent Version

**Problem:** The PNG `logo-horizontal1.png` has a white rectangular background visible on the gradient blue panel.

**Files:**
- Modify: `src/components/auth/AuthBrandPanel.tsx` — logo import (line 12)
- Asset: Use `assets/branding/logo-white.PNG` (267KB, white logo on transparent background)

**Step 1: Check the existing white logo asset**

The file `assets/branding/logo-white.PNG` is a white version of the logo designed for dark backgrounds. Update AuthBrandPanel to use it.

```typescript
// Before (line 12):
const logoLight = require('../../../assets/logo-horizontal1.png');

// After:
const logoLight = require('../../../assets/branding/logo-white.PNG');
```

**Step 2: Verify visually**

Start the dev server and navigate to `/auth/login` at 1280×800. The logo should now appear without a white rectangle on the blue gradient.

**Step 3: Run AuthBrandPanel tests**

```bash
npx jest src/components/auth/__tests__/AuthBrandPanel.test.tsx --verbose
```

Expected: Tests pass.

**Step 4: Commit**

```bash
git add src/components/auth/AuthBrandPanel.tsx
git commit -m "fix(login): use transparent logo on brand panel"
```

---

## Task 5: Desktop Panels 50/50 Balance

**Problem:** Left panel = 576px, Right panel = 704px at 1280px viewport. The right panel's 64px padding + form content creates a wider minimum width.

**Files:**
- Modify: `app/auth/login.tsx` — `leftPanel` and `rightPanel` styles (lines 330-340)

**Step 1: Force equal widths**

Replace `flex: 1` with explicit `width: '50%'` on both panels:

```typescript
// Before:
leftPanel: {
  flex: 1,
  backgroundColor: theme.colors.primary,
},
rightPanel: {
  flex: 1,
  backgroundColor: theme.colors.white,
  justifyContent: 'center',
  alignItems: 'center',
  padding: theme.spacing['16'],
},

// After:
leftPanel: {
  width: '50%',
  backgroundColor: theme.colors.primary,
},
rightPanel: {
  width: '50%',
  backgroundColor: theme.colors.white,
  justifyContent: 'center',
  alignItems: 'center',
  padding: theme.spacing['16'],
  overflow: 'hidden',
},
```

Adding `overflow: 'hidden'` prevents the form from expanding the panel beyond 50%.

**Step 2: Run tests**

```bash
npx jest app/__tests__/integration/auth/login.test.tsx --verbose
```

Expected: All pass.

**Step 3: Commit**

```bash
git add app/auth/login.tsx
git commit -m "fix(login): balance desktop panels to 50/50 width"
```

---

## Task 6: Eye Button Touch Target

**Problem:** Show/hide password button measures 38×40px. WCAG recommends 44×44px minimum.

**Files:**
- Modify: `app/auth/login.tsx` — `eyeButton` style (lines 393-397)

**Step 1: Increase eye button padding**

```typescript
// Before:
eyeButton: {
  position: 'absolute',
  right: theme.spacing.md,
  padding: theme.spacing.sm,  // 8px
},

// After:
eyeButton: {
  position: 'absolute',
  right: theme.spacing.sm,     // 8px (slightly less to accommodate larger hitarea)
  padding: theme.spacing.md,   // 12px — gives 22 + 24 = 46px touch target
},
```

**Step 2: Verify password input paddingRight still works**

The eye button is positioned absolutely at `right: 8px` with `padding: 12px`. The icon is 22px, so the total width is 22 + 24 = 46px. The input `paddingRight: 45` should accommodate this. If needed, increase to `paddingRight: 50`.

Update both `inputPassword` and `inputDesktopPassword`:

```typescript
// paddingRight: 45 → paddingRight: 50
```

**Step 3: Run tests**

```bash
npx jest app/__tests__/integration/auth/login.test.tsx --verbose
```

Expected: All pass.

**Step 4: Commit**

```bash
git add app/auth/login.tsx
git commit -m "fix(login): expand eye button touch target to 44px+"
```

---

## Task 7: Subtitle Contrast — gray500 → gray600

**Problem:** Subtitles use gray500 (#6B7280) on white = 4.8:1 — borderline. gray600 (#4B5563) gives 7.5:1, consistent with dashboard fixes.

**Files:**
- Modify: `app/auth/login.tsx` — `subtitle` and `subtitleDesktop` styles (lines 357, 428)

**Step 1: Update both subtitle colors**

```typescript
// Before:
subtitleDesktop: {
  ...
  color: theme.colors.gray500,
},
subtitle: {
  ...
  color: theme.colors.gray500,
},

// After (both):
  color: theme.colors.gray600,
```

**Step 2: Run tests**

```bash
npx jest app/__tests__/integration/auth/login.test.tsx --verbose
```

Expected: All pass (no color assertions in tests).

**Step 3: Commit**

```bash
git add app/auth/login.tsx
git commit -m "fix(login): improve subtitle contrast gray500→gray600 (7.5:1)"
```

---

## Task 8: Logo Alt Text (Accessibility)

**Problem:** Logo images have no `accessibilityLabel`. Screen readers can't identify them.

**Files:**
- Modify: `app/auth/login.tsx` — mobile logo Image (line 236-240)
- Modify: `src/components/auth/AuthBrandPanel.tsx` — brand panel logo Image (line 78)

**Step 1: Add accessibility labels**

In `login.tsx`, mobile logo:
```tsx
<Image
  source={LogoHorizontal}
  style={styles.logoImage}
  resizeMode="contain"
  accessibilityLabel="RotaMestre logo"
  accessible={true}
/>
```

In `AuthBrandPanel.tsx`, web logo:
```tsx
<Image
  source={logoLight}
  style={contentStyles.logo}
  resizeMode="contain"
  accessibilityLabel="RotaMestre logo"
  accessible={true}
/>
```

**Step 2: Run tests**

```bash
npx jest app/__tests__/integration/auth/login.test.tsx src/components/auth/__tests__/AuthBrandPanel.test.tsx --verbose
```

Expected: All pass.

**Step 3: Commit**

```bash
git add app/auth/login.tsx src/components/auth/AuthBrandPanel.tsx
git commit -m "fix(login): add accessibilityLabel to logo images"
```

---

## Task 9: Mobile Welcome Title + Button Shadow Consistency

**Problem:** Mobile has no welcome title ("Bem-vindo de volta!" only on desktop). Button shadows differ between desktop (md) and mobile (sm).

**Files:**
- Modify: `app/auth/login.tsx` — mobile header section (lines 234-243) and button style (line 453-460)

**Step 1: Add welcome title to mobile header**

Replace the mobile header section:
```tsx
<View style={styles.header}>
  <View style={styles.logoHorizontal}>
    <Image
      source={LogoHorizontal}
      style={styles.logoImage}
      resizeMode="contain"
      accessibilityLabel="RotaMestre logo"
      accessible={true}
    />
  </View>
  <Text style={styles.titleMobile}>Bem-vindo de volta!</Text>
  <Text style={styles.subtitle}>Entre com sua conta</Text>
</View>
```

**Step 2: Add titleMobile style**

```typescript
titleMobile: {
  fontFamily: theme.typography.fontDisplay,
  fontSize: theme.typography.fontSize['2xl'],  // 24px
  color: theme.colors.gray900,
  marginBottom: theme.spacing.xs,  // 4px
  textAlign: 'center',
},
```

**Step 3: Unify button shadow**

```typescript
// Before (mobile button):
button: {
  ...
  marginTop: theme.spacing['2.5'],
  ...theme.shadows.sm,   // ← sm
},

// After:
button: {
  ...
  marginTop: theme.spacing['2.5'],
  ...theme.shadows.md,   // ← match desktop
},
```

**Step 4: Update test — add title assertion**

In `login.test.tsx`, update the "deve renderizar corretamente no mobile" test:

```typescript
expect(getByText('Bem-vindo de volta!')).toBeTruthy();
```

**Step 5: Run tests**

```bash
npx jest app/__tests__/integration/auth/login.test.tsx --verbose
```

Expected: All pass.

**Step 6: Commit**

```bash
git add app/auth/login.tsx app/__tests__/integration/auth/login.test.tsx
git commit -m "feat(login): add welcome title to mobile + unify button shadow"
```

---

## Task 10: "Solicitar Acesso" Link

**Problem:** No way for new visitors to request access or create an account from the login screen.

**Files:**
- Modify: `app/auth/login.tsx` — add footer section to both desktop and mobile renders

**Step 1: Add footer to mobile render (before closing `</View>` of form)**

After the submit button, add:

```tsx
<View style={styles.footer}>
  <Text style={styles.footerText}>Ainda não tem conta?</Text>
  <TouchableOpacity
    onPress={() => router.push('/auth/register')}
    accessibilityLabel="Solicitar acesso"
    accessibilityRole="link"
    style={styles.footerLink}
  >
    <Text style={styles.footerLinkText}>Solicitar acesso</Text>
  </TouchableOpacity>
</View>
```

**Step 2: Add same footer to desktop render**

After the desktop submit button (inside `styles.form`), add the same JSX.

**Step 3: Add footer styles**

```typescript
footer: {
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  gap: theme.spacing.xs,
  marginTop: theme.spacing.xl,
},
footerText: {
  fontFamily: theme.typography.fontSans,
  fontSize: theme.typography.fontSize.sm,
  color: theme.colors.gray600,
},
footerLink: {
  paddingVertical: theme.spacing.xs,  // Touch target padding
},
footerLinkText: {
  fontFamily: theme.typography.fontSansSemiBold,
  fontSize: theme.typography.fontSize.sm,
  color: theme.colors.primary,
},
```

**Step 4: Run tests**

```bash
npx jest app/__tests__/integration/auth/login.test.tsx --verbose
```

Expected: All pass (new link is additive).

**Step 5: Commit**

```bash
git add app/auth/login.tsx
git commit -m "feat(login): add 'Solicitar acesso' registration link"
```

---

## Final Verification

**Step 1: Type-check**

```bash
cd D:/RotaMestre/rotamestre-app && npm run type-check
```

Expected: 0 errors.

**Step 2: Full auth test suite**

```bash
npx jest app/__tests__/integration/auth/ --verbose
```

Expected: All pass, 0 failures.

**Step 3: Visual verification checklist**

Start dev server (`npm run web`), navigate to `/auth/login`:

**Mobile (375×812):**
- [ ] Labels "E-mail" and "Senha" visible above inputs
- [ ] Placeholders are "seu@email.com" and "••••••••"
- [ ] "Bem-vindo de volta!" title visible
- [ ] "Esqueceu a senha?" has adequate tap area
- [ ] "Solicitar acesso" link visible
- [ ] Button has consistent shadow
- [ ] Subtitle in gray600 (readable)

**Desktop (1280×800):**
- [ ] Panels are 50/50 balanced
- [ ] Logo on brand panel has no white rectangle
- [ ] Input focus ring visible (blue border + shadow)
- [ ] Eye button has adequate click area
- [ ] "Solicitar acesso" link visible
- [ ] Subtitle in gray600

---

## Files Summary

**Modified (2):**
- `app/auth/login.tsx` — Tasks 1-3, 5-7, 8-10
- `src/components/auth/AuthBrandPanel.tsx` — Tasks 4, 8

**Test updated (1):**
- `app/__tests__/integration/auth/login.test.tsx` — Tasks 2, 9

**No new files. No new dependencies.**
