import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for Motorista (Driver) screens
 */
export class MotoristaPage {
  readonly page: Page;

  // Tab Bar
  readonly tabBar: Locator;
  readonly inicioTab: Locator;
  readonly paradasTab: Locator;
  readonly mapaTab: Locator;
  readonly historicoTab: Locator;
  readonly paradasList: Locator;
  readonly paradasEmpty: Locator;
  readonly mapaView: Locator;
  readonly mapaEmpty: Locator;
  readonly historicoList: Locator;
  readonly historicoEmpty: Locator;

  // Header
  readonly header: Locator;
  readonly menuButton: Locator;

  // Home screen elements
  readonly welcomeText: Locator;
  readonly activeRouteCard: Locator;
  readonly startRouteButton: Locator;
  readonly noRouteMessage: Locator;

  // FAB (Floating Action Button)
  readonly fab: Locator;

  // Drawer menu
  readonly drawerMenu: Locator;
  readonly drawerProfileName: Locator;
  readonly drawerLogoutButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Tab Bar locators
    this.tabBar = page.locator('[role="tablist"]').or(page.locator('[data-testid="tab-bar"]'));
    this.inicioTab = page.locator('[data-testid="tab-inicio"]').or(
      page.getByRole('tab', { name: /inicio/i })
    );
    this.paradasTab = page.locator('[data-testid="tab-paradas"]').or(
      page.getByRole('tab', { name: /paradas/i })
    );
    this.mapaTab = page.locator('[data-testid="tab-mapa"]').or(
      page.getByRole('tab', { name: /mapa/i })
    );
    this.historicoTab = page.locator('[data-testid="tab-historico"]').or(
      page.getByRole('tab', { name: /historico/i })
    );
    this.paradasList = page.locator('[data-testid="motorista-checkpoints-list"]');
    this.paradasEmpty = page.locator('[data-testid="motorista-checkpoints-empty"]');
    this.mapaView = page.locator('[data-testid="motorista-mapa-view"]');
    this.mapaEmpty = page.locator('[data-testid="motorista-mapa-empty"]');
    this.historicoList = page.locator('[data-testid="motorista-historico-list"]');
    this.historicoEmpty = page.locator('[data-testid="motorista-historico-empty"]');

    // Header
    this.header = page.locator('header, [data-testid="header"]');
    this.menuButton = page.locator('[data-testid="menu-button"], [aria-label*="menu"]').first();

    // Home screen
    this.welcomeText = page.getByText(/bem.?vindo|ol[áa]/i).first();
    this.activeRouteCard = page.locator('[data-testid="active-route-card"], .route-card').first();
    this.startRouteButton = page.getByRole('button', { name: /iniciar.*rota/i });
    this.noRouteMessage = page.getByText(/nenhuma.*rota|sem.*rota/i);

    // FAB
    this.fab = page.locator('[data-testid="fab"], .fab, [role="button"][aria-label*="ação"]');

    // Drawer
    this.drawerMenu = page.locator('[data-testid="drawer-menu"], .drawer-menu, [role="dialog"]');
    this.drawerProfileName = this.drawerMenu.locator('[data-testid="profile-name"], .profile-name');
    this.drawerLogoutButton = page.getByText(/sair/i);
  }

  // Note: Using 'domcontentloaded' instead of 'networkidle' because Supabase
  // subscriptions keep the network active, causing 'networkidle' to timeout.
  async goto() {
    await this.page.goto('/motorista?e2e=true', { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(1500);
  }

  async expectOnMotoristaDashboard() {
    await expect(this.page).toHaveURL(/.*motorista.*/);
    // Should see either tab bar (mobile) or sidebar content (desktop)
    await this.page.waitForTimeout(1000); // Wait for UI to settle
  }

  // Tab navigation
  async navigateToInicio() {
    await this.inicioTab.waitFor({ state: 'visible', timeout: 30000 });
    await this.inicioTab.click();
    await this.page.waitForTimeout(1000);
  }

  async navigateToParadas() {
    await this.paradasTab.waitFor({ state: 'visible', timeout: 30000 });
    await this.paradasTab.click();
    await this.page.waitForTimeout(1000);
  }

  async navigateToMapa() {
    await this.mapaTab.waitFor({ state: 'visible', timeout: 30000 });
    await this.mapaTab.click();
    await this.page.waitForTimeout(1000);
  }

  async navigateToHistorico() {
    await this.historicoTab.waitFor({ state: 'visible', timeout: 30000 });
    await this.historicoTab.click();
    await this.page.waitForTimeout(1000);
  }

  // Tab visibility checks
  async expectTabBarVisible() {
    await expect(this.tabBar).toBeVisible({ timeout: 10000 });
  }

  async expectAllTabsVisible() {
    await expect(this.inicioTab).toBeVisible();
    await expect(this.paradasTab).toBeVisible();
    await expect(this.mapaTab).toBeVisible();
    await expect(this.historicoTab).toBeVisible();
  }

  // Drawer menu
  async openDrawerMenu() {
    await this.menuButton.click();
    await expect(this.drawerMenu).toBeVisible({ timeout: 5000 });
  }

  async closeDrawerMenu() {
    // Click outside drawer or press escape
    await this.page.keyboard.press('Escape');
    await expect(this.drawerMenu).not.toBeVisible();
  }

  async logout() {
    await this.openDrawerMenu();
    await this.drawerLogoutButton.click();
    // May need to confirm logout
    const confirmButton = this.page.getByRole('button', { name: /confirmar|sair/i });
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }
    await this.page.waitForURL('**/auth/login**', { timeout: 10000 });
  }

  // Route interactions
  async hasActiveRoute(): Promise<boolean> {
    return await this.activeRouteCard.isVisible();
  }

  async startRoute() {
    await this.startRouteButton.click();
    await this.page.waitForTimeout(2000);
  }
}
