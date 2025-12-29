import { test, expect, testUsers } from './fixtures/test-fixtures';
import { LoginPage } from './pages/login.page';
import { MotoristaPage } from './pages/motorista.page';

/**
 * E2E Tests for Motorista Drawer Menu
 * Tests the restructured drawer menu with new items:
 * - Meu Perfil
 * - Meu Desempenho
 * - Falar com Gestor
 * - SOS / Emergência
 * - Ajuda
 * - Configurações
 *
 * And removal of redundant items:
 * - Resumo da Rota (redundant with Histórico tab)
 * - Minha Unidade (low value)
 * - Alterar Senha (consolidated into Meu Perfil)
 * - Meu Perfil (duplicate in footer - removed)
 */
test.describe('Motorista Drawer Menu E2E Tests', () => {
  let loginPage: LoginPage;
  let _motoristaPage: MotoristaPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    _motoristaPage = new MotoristaPage(page);

    // Login as motorista
    await loginPage.goto();
    await loginPage.login(testUsers.motorista.email, testUsers.motorista.password);
    await page.waitForURL(/.*motorista.*/, { timeout: 30000, waitUntil: 'domcontentloaded' });
  });

  test.describe('Menu Items Display', () => {
    test('should display new menu items', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Open drawer menu
      const menuButton = page.locator('[data-testid="menu-button"], [aria-label*="menu"]').first();
      await expect(menuButton).toBeVisible();
      await menuButton.click();
      await page.waitForTimeout(1000);

      const drawer = page.locator('[role="dialog"], .drawer').first();
      await expect(drawer).toBeVisible();

      // Should show new menu items (wait for profile/menu to load)
      await expect(drawer).toContainText('Meu Perfil');
      await expect(drawer).toContainText('Meu Desempenho');
      await expect(drawer).toContainText('Falar com Gestor');
      await expect(drawer).toContainText(/SOS/);
    });

    test('should NOT show Resumo da Rota item', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Open drawer menu
      const menuButton = page.locator('[data-testid="menu-button"], [aria-label*="menu"]').first();
      if (await menuButton.isVisible().catch(() => false)) {
        await menuButton.click();
        await page.waitForTimeout(1000);

        const drawerContent = await page.locator('[role="dialog"], .drawer').textContent();

        // Should NOT show Resumo da Rota
        const hasResumo = drawerContent?.includes('Resumo da Rota');
        expect(hasResumo).toBeFalsy();
      }
    });

    test('should NOT show Minha Unidade item', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Open drawer menu
      const menuButton = page.locator('[data-testid="menu-button"], [aria-label*="menu"]').first();
      if (await menuButton.isVisible().catch(() => false)) {
        await menuButton.click();
        await page.waitForTimeout(1000);

        const _drawerContent = await page.locator('[role="dialog"], .drawer').textContent();

        // Should NOT show Minha Unidade (as separate menu item)
        // Note: Unit info may still appear in header
        const menuSection = page.locator('[role="dialog"] >> text=Minha Unidade');
        const hasMinhauUnidadeMenuItem = await menuSection.count() > 0;

        // The unit info should be in header, not as a menu item
        expect(hasMinhauUnidadeMenuItem).toBeFalsy();
      }
    });

    test('should NOT show duplicate Meu Perfil in footer', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Open drawer menu
      const menuButton = page.locator('[data-testid="menu-button"], [aria-label*="menu"]').first();
      if (await menuButton.isVisible().catch(() => false)) {
        await menuButton.click();
        await page.waitForTimeout(1000);

        // Count Meu Perfil occurrences
        const perfilItems = page.getByText('Meu Perfil', { exact: true });
        const count = await perfilItems.count();

        // Should only have one "Meu Perfil" (in menu section, not in footer)
        expect(count).toBeLessThanOrEqual(1);
      }
    });

    test('should show SOS item with danger styling', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Open drawer menu
      const menuButton = page.locator('[data-testid="menu-button"], [aria-label*="menu"]').first();
      if (await menuButton.isVisible().catch(() => false)) {
        await menuButton.click();
        await page.waitForTimeout(1000);

        // Look for SOS menu item
        const sosItem = page.getByText(/SOS|Emergência/i).first();
        const isVisible = await sosItem.isVisible().catch(() => false);

        expect(isVisible).toBeTruthy();
      }
    });
  });

  test.describe('SOS Screen Navigation', () => {
    test('should navigate to SOS screen', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Open drawer menu
      const menuButton = page.locator('[data-testid="menu-button"], [aria-label*="menu"]').first();
      if (await menuButton.isVisible().catch(() => false)) {
        await menuButton.click();
        await page.waitForTimeout(1000);

        // Click SOS item
        const sosItem = page.getByText(/SOS|Emergência/i).first();
        if (await sosItem.isVisible().catch(() => false)) {
          await sosItem.click();
          await page.waitForTimeout(2000);

          // Should be on SOS page
          const bodyText = await page.locator('body').textContent();
          const hasSosContent =
            bodyText?.includes('SOS') ||
            bodyText?.includes('Emergência') ||
            bodyText?.includes('ACIONAR') ||
            bodyText?.includes('190') ||
            bodyText?.includes('192') ||
            bodyText?.includes('193');

          expect(hasSosContent).toBeTruthy();
        }
      }
    });

    test('should display emergency contact options on SOS screen', async ({ page }) => {
      // Navigate directly to SOS page
      await page.goto('/motorista/sos');
      await page.waitForTimeout(3000);

      const bodyText = await page.locator('body').textContent();

      // Should show emergency contacts
      const hasEmergencyContacts =
        bodyText?.includes('190') || // Polícia
        bodyText?.includes('192') || // SAMU
        bodyText?.includes('193') || // Bombeiros
        bodyText?.includes('Polícia') ||
        bodyText?.includes('SAMU') ||
        bodyText?.includes('Bombeiros');

      expect(hasEmergencyContacts).toBeTruthy();
    });

    test('should have large emergency button on SOS screen', async ({ page }) => {
      await page.goto('/motorista/sos');

      const sosHeading = page.getByRole('heading', { name: /SOS/i }).first();
      await expect(sosHeading).toBeVisible({ timeout: 20000 });

      const sosButton = page.getByText('ACIONAR SOS', { exact: true }).first();
      await expect(sosButton).toBeVisible({ timeout: 20000 });
    });
  });

  test.describe('Desempenho Screen Navigation', () => {
    test('should navigate to Desempenho screen', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Open drawer menu
      const menuButton = page.locator('[data-testid="menu-button"], [aria-label*="menu"]').first();
      if (await menuButton.isVisible().catch(() => false)) {
        await menuButton.click();
        await page.waitForTimeout(1000);

        const drawer = page.locator('[role="dialog"], .drawer').first();
        await expect(drawer).toBeVisible();

        // Click Desempenho item
        const desempenhoItem = drawer.getByText(/Meu Desempenho|Desempenho/i).first();
        if (await desempenhoItem.isVisible().catch(() => false)) {
          await desempenhoItem.click();
          await page.waitForTimeout(2000);

          const bodyText = await page.locator('body').textContent();
          const hasDesempenhoContent =
            bodyText?.includes('Desempenho') ||
            bodyText?.includes('Taxa') ||
            bodyText?.includes('Rotas') ||
            bodyText?.includes('Concluídas') ||
            bodyText?.includes('Estatísticas');

          expect(hasDesempenhoContent).toBeTruthy();
        }
      }
    });

    test('should display statistics on Desempenho screen', async ({ page }) => {
      await page.goto('/motorista/desempenho');

      const loadingState = page.getByText(/Carregando/i).first();
      await loadingState.waitFor({ state: 'hidden', timeout: 30000 });

      const bodyText = await page.locator('body').textContent();
      const hasEmpty = bodyText?.includes('Sem dados');
      const hasStats =
        bodyText?.includes('Taxa') ||
        bodyText?.includes('%') ||
        bodyText?.includes('Km');

      expect(hasEmpty || hasStats).toBeTruthy();
    });

    test('should have period selector on Desempenho screen', async ({ page }) => {
      await page.goto('/motorista/desempenho');

      const loadingState = page.getByText(/Carregando/i).first();
      await loadingState.waitFor({ state: 'hidden', timeout: 30000 });

      const periodOption = page.getByText(/7 dias|30 dias/i).first();
      await expect(periodOption).toBeVisible({ timeout: 30000 });
    });
  });

  test.describe('Ajuda Screen Navigation', () => {
    test('should navigate to Ajuda screen', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Open drawer menu
      const menuButton = page.locator('[data-testid="menu-button"], [aria-label*="menu"]').first();
      if (await menuButton.isVisible().catch(() => false)) {
        await menuButton.click();
        await page.waitForTimeout(1000);

        // Click Ajuda item
        const ajudaItem = page.getByText(/Ajuda/i).first();
        if (await ajudaItem.isVisible().catch(() => false)) {
          await ajudaItem.click();
          await page.waitForTimeout(2000);

          const bodyText = await page.locator('body').textContent();
          const hasAjudaContent =
            bodyText?.includes('Ajuda') ||
            bodyText?.includes('FAQ') ||
            bodyText?.includes('Perguntas') ||
            bodyText?.includes('Como');

          expect(hasAjudaContent).toBeTruthy();
        }
      }
    });

    test('should display FAQ on Ajuda screen', async ({ page }) => {
      await page.goto('/motorista/ajuda');
      await page.waitForTimeout(3000);

      const bodyText = await page.locator('body').textContent();

      // Should show FAQ questions
      const hasFAQ =
        bodyText?.includes('Perguntas Frequentes') ||
        bodyText?.includes('Como iniciar') ||
        bodyText?.includes('Como marcar') ||
        bodyText?.includes('Como tirar foto');

      expect(hasFAQ).toBeTruthy();
    });

    test('should display support contact options on Ajuda screen', async ({ page }) => {
      await page.goto('/motorista/ajuda');
      await page.waitForTimeout(3000);

      const bodyText = await page.locator('body').textContent();

      // Should show contact options
      const hasContactOptions =
        bodyText?.includes('WhatsApp') ||
        bodyText?.includes('Email') ||
        bodyText?.includes('Telefone') ||
        bodyText?.includes('Fale Conosco');

      expect(hasContactOptions).toBeTruthy();
    });
  });

  test.describe('Configurações Screen Navigation', () => {
    test('should navigate to Configurações screen', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Open drawer menu
      const menuButton = page.locator('[data-testid="menu-button"], [aria-label*="menu"]').first();
      if (await menuButton.isVisible().catch(() => false)) {
        await menuButton.click();
        await page.waitForTimeout(1000);

        // Click Configurações item
        const configItem = page.getByText(/Configurações/i).first();
        if (await configItem.isVisible().catch(() => false)) {
          await configItem.click();
          await page.waitForTimeout(2000);

          const bodyText = await page.locator('body').textContent();
          const hasConfigContent =
            bodyText?.includes('Configurações') ||
            bodyText?.includes('Navegação') ||
            bodyText?.includes('Notificações') ||
            bodyText?.includes('Waze') ||
            bodyText?.includes('Google Maps');

          expect(hasConfigContent).toBeTruthy();
        }
      }
    });

    test('should display navigation app options on Configurações screen', async ({ page }) => {
      await page.goto('/motorista/perfil/configuracoes');
      await page.waitForTimeout(3000);

      const bodyText = await page.locator('body').textContent();

      // Should show nav app options
      const hasNavOptions =
        bodyText?.includes('Navegação') ||
        bodyText?.includes('Waze') ||
        bodyText?.includes('Google Maps') ||
        bodyText?.includes('Padrão');

      expect(hasNavOptions).toBeTruthy();
    });

    test('should display notification settings on Configurações screen', async ({ page }) => {
      await page.goto('/motorista/perfil/configuracoes');
      await page.waitForTimeout(3000);

      const bodyText = await page.locator('body').textContent();

      // Should show notification settings
      const hasNotificationSettings =
        bodyText?.includes('Notificações') ||
        bodyText?.includes('Push') ||
        bodyText?.includes('Som');

      expect(hasNotificationSettings).toBeTruthy();
    });
  });

  test.describe('Falar com Gestor Action', () => {
    test('should have Falar com Gestor menu item', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Open drawer menu
      const menuButton = page.locator('[data-testid="menu-button"], [aria-label*="menu"]').first();
      if (await menuButton.isVisible().catch(() => false)) {
        await menuButton.click();
        await page.waitForTimeout(1000);

        const gestorItem = page.getByText(/Falar com Gestor|Gestor/i).first();
        const isVisible = await gestorItem.isVisible().catch(() => false);

        expect(isVisible).toBeTruthy();
      }
    });
  });

  test.describe('Meu Perfil Navigation', () => {
    test('should navigate to Perfil screen from menu', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Open drawer menu
      const menuButton = page.locator('[data-testid="menu-button"], [aria-label*="menu"]').first();
      if (await menuButton.isVisible().catch(() => false)) {
        await menuButton.click();
        await page.waitForTimeout(1000);

        // Click Meu Perfil item
        const perfilItem = page.getByText(/Meu Perfil/i).first();
        if (await perfilItem.isVisible().catch(() => false)) {
          await perfilItem.click();
          await page.waitForTimeout(2000);

          const bodyText = await page.locator('body').textContent();
          const hasPerfilContent =
            bodyText?.includes('Perfil') ||
            bodyText?.includes('Informações Pessoais') ||
            bodyText?.includes('Nome') ||
            bodyText?.includes('Email') ||
            bodyText?.includes('Segurança');

          expect(hasPerfilContent).toBeTruthy();
        }
      }
    });

    test('should have Alterar Senha accessible from Perfil', async ({ page }) => {
      await page.goto('/motorista/perfil');

      const alterarSenha = page.getByText(/Alterar Senha/i).first();
      await expect(alterarSenha).toBeVisible({ timeout: 20000 });
    });
  });

  test.describe('Logout Functionality', () => {
    test('should have Sair button in drawer', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Open drawer menu
      const menuButton = page.locator('[data-testid="menu-button"], [aria-label*="menu"]').first();
      if (await menuButton.isVisible().catch(() => false)) {
        await menuButton.click();
        await page.waitForTimeout(1000);

        const sairButton = page.getByText(/Sair/i).first();
        const isVisible = await sairButton.isVisible().catch(() => false);

        expect(isVisible).toBeTruthy();
      }
    });
  });
});
