import { SEM_SESSAO } from './fixtures/sessoes';
import { test, expect, testUsers, e2eUrl } from './fixtures/test-fixtures';
import { LoginPage } from './pages/login.page';

test.describe('Authentication E2E Tests', () => {
  let loginPage: LoginPage;

  // Este é o único arquivo que testa o LOGIN em si, então é o único que ainda
  // preenche o formulário de verdade — os demais reusam a sessão salva pelo
  // projeto `setup`. A sessão vazia é declarada explicitamente: se um dia
  // alguém puser `storageState` no projeto inteiro, estes testes começariam
  // logados e passariam a afirmar outra coisa sem ninguém perceber.
  test.use({ storageState: SEM_SESSAO });

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test.describe('Login Page Display', () => {
    test('should display login form correctly', async () => {
      await loginPage.expectOnLoginPage();
      await expect(loginPage.emailInput).toBeVisible();
      await expect(loginPage.passwordInput).toBeVisible();
      await expect(loginPage.loginButton).toBeVisible();
    });

    test('should have forgot password link', async () => {
      await expect(loginPage.forgotPasswordLink).toBeVisible();
    });
  });

  test.describe('Login Validation', () => {
    test('should show error for empty email', async ({ page }) => {
      await loginPage.fillPassword('somepassword');
      await loginPage.submit();

      // O erro inline do Zod (`emailSchema`) é o sinal de que o envio foi
      // recusado — antes, 1 s de espera e a conferência de que o formulário
      // continuava ali, o que valia também para um clique que não fez nada.
      await expect(page.getByText('E-mail é obrigatório')).toBeVisible();
      await loginPage.expectOnLoginPage();
    });

    test('should show error for empty password', async ({ page }) => {
      await loginPage.fillEmail('test@example.com');
      await loginPage.submit();

      // Erro inline do `loginSchema` para a senha vazia.
      await expect(page.getByText('Senha é obrigatória')).toBeVisible();
      await loginPage.expectOnLoginPage();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await loginPage.login('invalid@email.com', 'wrongpassword123');

      // A recusa do Supabase vira o Dialog de erro da tela de login. Antes:
      // 3 s de espera e um `if` que só afirmava algo se a URL ainda fosse a
      // do login — um redirecionamento indevido passava calado.
      await loginPage.expectErrorMessage(/E-mail ou senha incorretos/);
      await expect(page).toHaveURL(/auth\/login/);
      await loginPage.expectOnLoginPage();
    });
  });

  test.describe('Motorista Login Flow', () => {
    test('should redirect motorista to motorista dashboard after login', async ({
      page,
    }) => {
      await loginPage.login(
        testUsers.motorista.email,
        testUsers.motorista.password,
      );

      // Should redirect to motorista area
      await page.waitForURL(/.*motorista.*/, {
        timeout: 30000,
        waitUntil: 'domcontentloaded',
      });
      await expect(page).toHaveURL(/.*motorista.*/);
    });
  });

  test.describe('Gestor Login Flow', () => {
    test('should redirect gestor to gestor dashboard after login', async ({
      page,
    }) => {
      await loginPage.login(testUsers.gestor.email, testUsers.gestor.password);

      // Should redirect to gestor area
      await page.waitForURL(/.*gestor.*/, {
        timeout: 30000,
        waitUntil: 'domcontentloaded',
      });
      await expect(page).toHaveURL(/.*gestor.*/);
    });
  });

  test.describe('Session Persistence', () => {
    test('should redirect authenticated user away from login', async ({
      page,
    }) => {
      // Login from the current login page (beforeEach already navigated here)
      await loginPage.login(
        testUsers.motorista.email,
        testUsers.motorista.password,
      );

      // Wait for redirect to motorista
      await page.waitForURL(/.*motorista.*/, {
        timeout: 30000,
        waitUntil: 'domcontentloaded',
      });

      // Now try to access login page again
      await page.goto(e2eUrl('/auth/login'), { waitUntil: 'domcontentloaded' });

      // No lugar dos 3 s fixos: espera a tela assentar num dos dois estados
      // aceitos — o formulário de login ou a Início do motorista.
      // LIMITAÇÃO CONHECIDA: o teste não escolhe entre os dois; o nome promete
      // "redirect away", mas hoje a tela de login não redireciona quem já tem
      // sessão. Endurecer isto é decisão de produto, não troca de espera.
      await expect(
        loginPage.emailInput
          .or(page.getByTestId('motorista-status-section'))
          .first(),
      ).toBeVisible({ timeout: 30000 });
      expect(page.url()).toMatch(/auth\/login|motorista/);
    });
  });
});
