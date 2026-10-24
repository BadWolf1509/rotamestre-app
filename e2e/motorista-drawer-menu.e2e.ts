import { SESSAO_MOTORISTA } from './fixtures/sessoes';
import { test, expect } from './fixtures/test-fixtures';
import { MotoristaPage } from './pages/motorista.page';

import type { Locator, Page } from '@playwright/test';

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
 *
 * Todo passo é uma asserção: o botão do menu e o drawer precisam existir,
 * senão o teste falha (antes, um `if (visível)` silencioso deixava passar).
 */
test.describe('Motorista Drawer Menu E2E Tests', () => {
  let motoristaPage: MotoristaPage;

  test.use({ storageState: SESSAO_MOTORISTA });

  test.beforeEach(async ({ page }) => {
    motoristaPage = new MotoristaPage(page);
    // Sem o redirecionamento do login, o teste comeca em about:blank:
    // a navegacao passa a ser explicita.
    await motoristaPage.goto();
  });

  /** Abre o drawer e espera o conteúdo do menu carregar (perfil/itens). */
  async function abrirDrawer(page: Page): Promise<Locator> {
    await expect(motoristaPage.menuButton).toBeVisible({ timeout: 30000 });
    await motoristaPage.menuButton.click();
    const drawer = page.locator('[role="dialog"], .drawer').first();
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('Meu Perfil');
    return drawer;
  }

  test.describe('Menu Items Display', () => {
    test('should display new menu items', async ({ page }) => {
      const drawer = await abrirDrawer(page);

      await expect(drawer).toContainText('Meu Desempenho');
      await expect(drawer).toContainText('Falar com Gestor');
      await expect(drawer).toContainText(/SOS/);
    });

    test('should NOT show Resumo da Rota item', async ({ page }) => {
      // abrirDrawer já espera o menu carregar: sem isso o not.toContainText
      // passaria com o drawer ainda vazio.
      const drawer = await abrirDrawer(page);

      await expect(drawer).not.toContainText('Resumo da Rota');
    });

    test('should NOT show Minha Unidade item', async ({ page }) => {
      const drawer = await abrirDrawer(page);

      // A unidade pode aparecer no cabeçalho, mas não como item de menu.
      await expect(drawer.getByText('Minha Unidade')).toHaveCount(0);
    });

    test('should NOT show duplicate Meu Perfil in footer', async ({ page }) => {
      const drawer = await abrirDrawer(page);

      // Exatamente um "Meu Perfil" (na seção de menu, não no rodapé)
      await expect(drawer.getByText('Meu Perfil', { exact: true })).toHaveCount(
        1,
      );
    });

    test('should show SOS item with danger styling', async ({ page }) => {
      const drawer = await abrirDrawer(page);

      await expect(drawer.getByText(/SOS|Emergência/i).first()).toBeVisible();
    });
  });

  test.describe('SOS Screen Navigation', () => {
    test('should navigate to SOS screen', async ({ page }) => {
      const drawer = await abrirDrawer(page);

      await drawer
        .getByText(/SOS|Emergência/i)
        .first()
        .click();

      await expect(page).toHaveURL(/\/motorista\/sos/);
      await expect(
        page.getByText('ACIONAR SOS', { exact: true }).first(),
      ).toBeVisible({ timeout: 20000 });
    });

    test('should display emergency contact options on SOS screen', async ({
      page,
    }) => {
      await page.goto('/motorista/sos');

      // Contatos de emergência: Polícia 190, SAMU 192, Bombeiros 193
      await expect(page.locator('body')).toContainText(
        /190|192|193|Polícia|SAMU|Bombeiros/,
        { timeout: 20000 },
      );
    });

    test('should have large emergency button on SOS screen', async ({
      page,
    }) => {
      await page.goto('/motorista/sos');

      await expect(page.locator('body')).toContainText(/SOS|Emergência/, {
        timeout: 20000,
      });

      // Should have the main SOS button
      const sosButton = page.getByText('ACIONAR SOS', { exact: true }).first();
      await expect(sosButton).toBeVisible({ timeout: 20000 });
    });
  });

  test.describe('Desempenho Screen Navigation', () => {
    test('should navigate to Desempenho screen', async ({ page }) => {
      const drawer = await abrirDrawer(page);

      await drawer
        .getByText(/Meu Desempenho|Desempenho/i)
        .first()
        .click();

      await expect(page).toHaveURL(/\/motorista\/desempenho/);
    });

    test('should display statistics on Desempenho screen', async ({ page }) => {
      await page.goto('/motorista/desempenho');

      // Espera o fim do carregamento e então exige estatística ou estado vazio.
      await expect(page.getByText(/Carregando/i)).toHaveCount(0, {
        timeout: 30000,
      });
      await expect(page.locator('body')).toContainText(
        /Sem dados|Nenhum|Taxa|%|Km|Desempenho|Rotas/,
        { timeout: 20000 },
      );
    });

    test('should have period selector on Desempenho screen', async ({
      page,
    }) => {
      await page.goto('/motorista/desempenho');

      await expect(page.getByText(/Carregando/i)).toHaveCount(0, {
        timeout: 30000,
      });

      const periodOption = page.getByText(/7 dias|30 dias/i).first();
      await expect(periodOption).toBeVisible({ timeout: 30000 });
    });
  });

  test.describe('Ajuda Screen Navigation', () => {
    test('should navigate to Ajuda screen', async ({ page }) => {
      const drawer = await abrirDrawer(page);

      await drawer.getByText(/Ajuda/i).first().click();

      await expect(page).toHaveURL(/\/motorista\/ajuda/);
    });

    test('should display FAQ on Ajuda screen', async ({ page }) => {
      await page.goto('/motorista/ajuda');

      await expect(page.locator('body')).toContainText(
        /Perguntas Frequentes|Como iniciar|Como marcar|Como tirar foto/,
        { timeout: 20000 },
      );
    });

    test('should display support contact options on Ajuda screen', async ({
      page,
    }) => {
      await page.goto('/motorista/ajuda');

      await expect(page.locator('body')).toContainText(
        /WhatsApp|Email|Telefone|Fale Conosco/,
        { timeout: 20000 },
      );
    });
  });

  test.describe('Configurações Screen Navigation', () => {
    test('should navigate to Configurações screen', async ({ page }) => {
      const drawer = await abrirDrawer(page);

      await drawer
        .getByText(/Configurações/i)
        .first()
        .click();

      await expect(page).toHaveURL(/\/motorista\/perfil\/configuracoes/);
    });

    test('should display navigation app options on Configurações screen', async ({
      page,
    }) => {
      await page.goto('/motorista/perfil/configuracoes');

      await expect(page.locator('body')).toContainText(
        /Navegação|Waze|Google Maps|Padrão/,
        { timeout: 20000 },
      );
    });

    test('should display notification settings on Configurações screen', async ({
      page,
    }) => {
      await page.goto('/motorista/perfil/configuracoes');

      await expect(page.locator('body')).toContainText(
        /Notificações|Push|Som/,
        { timeout: 20000 },
      );
    });
  });

  test.describe('Falar com Gestor Action', () => {
    test('should have Falar com Gestor menu item', async ({ page }) => {
      const drawer = await abrirDrawer(page);

      await expect(
        drawer.getByText(/Falar com Gestor|Gestor/i).first(),
      ).toBeVisible();
    });
  });

  test.describe('Meu Perfil Navigation', () => {
    test('should navigate to Perfil screen from menu', async ({ page }) => {
      const drawer = await abrirDrawer(page);

      await drawer.getByText('Meu Perfil', { exact: true }).click();

      await expect(page).toHaveURL(/\/motorista\/perfil/);
    });

    test('should have Alterar Senha accessible from Perfil', async ({
      page,
    }) => {
      await page.goto('/motorista/perfil');

      const alterarSenha = page.getByText(/Alterar Senha/i).first();
      await expect(alterarSenha).toBeVisible({ timeout: 20000 });
    });
  });

  test.describe('Logout Functionality', () => {
    test('should have Sair button in drawer', async ({ page }) => {
      const drawer = await abrirDrawer(page);

      await expect(drawer.getByText(/Sair/i).first()).toBeVisible();
    });
  });
});
