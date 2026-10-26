import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object das telas do gestor.
 *
 * Cada `goto*` só resolve com a TELA PRONTA: espera um sinal que pertence ao
 * conteúdo da página, e não ao menu lateral. O título da página
 * (`gestorPageMeta`) não serve de sinal: "Motoristas" e "Gestão de Rotas" são
 * também os rótulos do menu, que pinta antes do conteúdo, e o texto casaria na
 * hora. Os sinais escolhidos existem nos dois layouts (desktop e mobile) e só
 * aparecem depois do carregamento da tela.
 */
export class GestorPage {
  readonly page: Page;

  /** Usado pelo `visual-critical.e2e.ts` (cartão "Total hoje" do painel). */
  readonly dashboardReady: Locator;

  // Sinais de tela pronta
  /** Bloco de métricas do painel — `DashboardDesktop` e `DashboardMobile`. */
  readonly inicioPronto: Locator;
  /** Rádio do tipo da parada — formulário compartilhado pelos dois layouts. */
  readonly novaEntregaPronta: Locator;
  /** Tabela de rotas — o mesmo testID no desktop e no mobile. */
  readonly gestaoRotasPronta: Locator;
  /**
   * Botão de adicionar motorista: "Adicionar motorista" no desktop,
   * "Adicionar novo motorista" no mobile. Só monta com a carga terminada:
   * - `loading` nasce `true` em `useMotoristasOperations` e só vira `false` no
   *   `finally` da RPC `listar_motoristas_unidade`;
   * - desktop: o botão está nas `actions` do `DesktopCard`, FILHO do
   *   `DesktopPageLayout`, que com `loading` devolve só o spinner — o card nem
   *   monta;
   * - mobile: o `if (loading) return` da tela vem antes do ramo com o botão.
   * Medido em 25/10/2026 segurando a RPC por 4 s: botão ausente em 27 de 27
   * amostras durante a carga (1280 e 375 px), visível ~0,5 s depois de ela
   * ser liberada. Ressalva: com a RPC em ERRO a carga também termina, e o botão
   * aparece com a lista vazia (e o toast de erro) — o sinal é "fim da carga",
   * não "dados ok". `motoristas-tabela`/`motoristas-vazio` existem só no
   * desktop e têm a mesma ressalva.
   */
  readonly motoristasPronta: Locator;

  constructor(page: Page) {
    this.page = page;

    this.dashboardReady = page.getByText(/total hoje/i);

    this.inicioPronto = page.getByTestId('gestor-dashboard-stats');
    this.novaEntregaPronta = page.getByLabel('Selecionar tipo entrega');
    this.gestaoRotasPronta = page.getByTestId('gestao-rotas-table');
    this.motoristasPronta = page.getByRole('button', {
      name: /^Adicionar (novo )?motorista$/i,
    });
  }

  // Navegação
  // 'domcontentloaded' em vez de 'networkidle': as assinaturas do Supabase
  // mantêm a rede ativa e o 'networkidle' nunca chega.
  async gotoInicio() {
    await this.page.goto('/gestor/inicio?e2e=true', {
      waitUntil: 'domcontentloaded',
    });
    await expect(this.inicioPronto).toBeVisible({ timeout: 30000 });
  }

  async gotoNovaEntrega() {
    await this.page.goto('/gestor/nova-entrega?e2e=true', {
      waitUntil: 'domcontentloaded',
    });
    await expect(this.novaEntregaPronta).toBeVisible({ timeout: 30000 });
  }

  async gotoGestaoRotas() {
    await this.page.goto('/gestor/gestao-rotas?e2e=true', {
      waitUntil: 'domcontentloaded',
    });
    await expect(this.gestaoRotasPronta).toBeVisible({ timeout: 30000 });
  }

  async gotoMotoristas() {
    await this.page.goto('/gestor/motoristas?e2e=true', {
      waitUntil: 'domcontentloaded',
    });
    await expect(this.motoristasPronta).toBeVisible({ timeout: 30000 });
  }

  // Asserções de URL
  async expectOnGestorDashboard() {
    await expect(this.page).toHaveURL(/.*gestor.*/);
  }

  async expectOnNovaEntrega() {
    await expect(this.page).toHaveURL(/.*nova-entrega.*/);
  }

  async expectOnGestaoRotas() {
    await expect(this.page).toHaveURL(/.*gestao-rotas.*/);
  }

  async expectOnMotoristas() {
    await expect(this.page).toHaveURL(/.*motoristas.*/);
  }
}
