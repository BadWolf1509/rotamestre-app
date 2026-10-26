import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object das telas do motorista.
 *
 * `goto()` e `navigateTo*()` só resolvem com o conteúdo da aba na tela, em
 * vez de esperar um tempo fixo depois do clique.
 */
export class MotoristaPage {
  readonly page: Page;

  // Barra de abas
  readonly tabBar: Locator;
  readonly inicioTab: Locator;
  readonly paradasTab: Locator;
  readonly mapaTab: Locator;
  readonly historicoTab: Locator;

  // Conteúdo de cada aba (lista OU estado vazio)
  /**
   * Seção de status da Início (saudação + loja). Monta em todo estado da
   * tela — inclusive carregando e sem rota —, ao contrário do
   * `motorista-main-card`, que some sem conexão; e é conteúdo da aba, ao
   * contrário da barra de abas, que pinta antes e some na tela cheia.
   */
  readonly inicioConteudo: Locator;
  readonly paradasList: Locator;
  readonly paradasEmpty: Locator;
  readonly mapaView: Locator;
  readonly mapaEmpty: Locator;
  readonly historicoList: Locator;
  readonly historicoEmpty: Locator;

  // Cabeçalho
  readonly menuButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.tabBar = page
      .locator('[role="tablist"]')
      .or(page.locator('[data-testid="tab-bar"]'));
    this.inicioTab = page
      .locator('[data-testid="tab-inicio"]')
      .or(page.getByRole('tab', { name: /inicio/i }));
    this.paradasTab = page
      .locator('[data-testid="tab-paradas"]')
      .or(page.getByRole('tab', { name: /paradas/i }));
    this.mapaTab = page
      .locator('[data-testid="tab-mapa"]')
      .or(page.getByRole('tab', { name: /mapa/i }));
    this.historicoTab = page
      .locator('[data-testid="tab-historico"]')
      .or(page.getByRole('tab', { name: /historico/i }));

    this.inicioConteudo = page.getByTestId('motorista-status-section');
    this.paradasList = page.locator(
      '[data-testid="motorista-checkpoints-list"]',
    );
    this.paradasEmpty = page.locator(
      '[data-testid="motorista-checkpoints-empty"]',
    );
    this.mapaView = page.locator('[data-testid="motorista-mapa-view"]');
    this.mapaEmpty = page.locator('[data-testid="motorista-mapa-empty"]');
    this.historicoList = page.locator(
      '[data-testid="motorista-historico-list"]',
    );
    this.historicoEmpty = page.locator(
      '[data-testid="motorista-historico-empty"]',
    );

    this.menuButton = page
      .locator('[data-testid="menu-button"], [aria-label*="menu"]')
      .first();
  }

  // 'domcontentloaded' em vez de 'networkidle': as assinaturas do Supabase
  // mantêm a rede ativa e o 'networkidle' nunca chega.
  async goto() {
    await this.page.goto('/motorista?e2e=true', {
      waitUntil: 'domcontentloaded',
    });
    await expect(this.inicioConteudo).toBeVisible({ timeout: 30000 });
  }

  async expectOnMotoristaDashboard() {
    await expect(this.page).toHaveURL(/.*motorista.*/);
  }

  // Navegação pelas abas
  async navigateToInicio() {
    await this.inicioTab.waitFor({ state: 'visible', timeout: 30000 });
    await this.inicioTab.click();
    await expect(this.inicioConteudo).toBeVisible({ timeout: 30000 });
  }

  async navigateToParadas() {
    await this.paradasTab.waitFor({ state: 'visible', timeout: 30000 });
    await this.paradasTab.click();
    await expect(this.paradasList.or(this.paradasEmpty)).toBeVisible({
      timeout: 30000,
    });
  }

  async navigateToMapa() {
    await this.mapaTab.waitFor({ state: 'visible', timeout: 30000 });
    await this.mapaTab.click();
    await expect(this.mapaView.or(this.mapaEmpty)).toBeVisible({
      timeout: 30000,
    });
  }

  async navigateToHistorico() {
    await this.historicoTab.waitFor({ state: 'visible', timeout: 30000 });
    await this.historicoTab.click();
    // `.first()`: a FlatList do histórico põe a lista e o componente de vazio
    // no DOM ao mesmo tempo, e o `or` casaria com os dois (modo estrito).
    await expect(
      this.historicoList.or(this.historicoEmpty).first(),
    ).toBeVisible({
      timeout: 30000,
    });
  }
}
