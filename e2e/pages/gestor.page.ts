import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for Gestor (Manager) screens
 * Tests route creation, team management, and route monitoring
 */
export class GestorPage {
  readonly page: Page;

  // Navigation
  readonly sidebar: Locator;
  readonly menuInicio: Locator;
  readonly menuNovaEntrega: Locator;
  readonly menuGestaoRotas: Locator;
  readonly menuMotoristas: Locator;

  // Dashboard
  readonly dashboardCards: Locator;
  readonly dashboardReady: Locator;
  readonly rotasPendentes: Locator;
  readonly rotasEmAndamento: Locator;
  readonly rotasConcluidas: Locator;

  // Nova Entrega (Route Creation) Form
  readonly tipoEntrega: Locator;
  readonly tipoRetirada: Locator;
  readonly enderecoInput: Locator;
  readonly destinatarioInput: Locator;
  readonly telefoneInput: Locator;
  readonly observacoesInput: Locator;
  readonly addParadaButton: Locator;
  readonly paradasList: Locator;
  readonly otimizarRotaButton: Locator;
  readonly selecionarMotoristaSection: Locator;
  readonly gerarRotaButton: Locator;
  readonly rotaOtimizadaBanner: Locator;

  // Motoristas Management
  readonly motoristasTable: Locator;
  readonly addMotoristaButton: Locator;
  readonly motoristaModal: Locator;
  readonly motoristaNomeInput: Locator;
  readonly motoristaEmailInput: Locator;
  readonly motoristaTelefoneInput: Locator;
  readonly motoristaSenhaInput: Locator;

  // Gestão Rotas
  readonly rotasTable: Locator;
  readonly filtroTodas: Locator;
  readonly filtroPendente: Locator;
  readonly filtroEmAndamento: Locator;
  readonly filtroConcluida: Locator;
  readonly searchInput: Locator;
  readonly exportarButton: Locator;

  // Common
  readonly loadingIndicator: Locator;
  readonly toast: Locator;
  readonly confirmModal: Locator;

  constructor(page: Page) {
    this.page = page;

    // Navigation - React Native Web renders sidebar/drawer
    this.sidebar = page.locator('[data-testid="sidebar"], .sidebar, nav');
    this.menuInicio = page.getByText(/início|dashboard/i).first();
    this.menuNovaEntrega = page.getByText(/nova.*entrega|criar.*rota/i).first();
    this.menuGestaoRotas = page.getByText(/gestão.*rotas|rotas/i).first();
    this.menuMotoristas = page.getByText(/motoristas|equipe/i).first();

    // Dashboard Cards
    this.dashboardCards = page.locator('[data-testid="dashboard-card"], .dashboard-card, .stat-card');
    this.dashboardReady = page.getByText(/total hoje/i);
    this.rotasPendentes = page.getByText(/pendente/i).first();
    this.rotasEmAndamento = page.getByText(/em.*andamento/i).first();
    this.rotasConcluidas = page.getByText(/conclu[ií]da/i).first();

    // Nova Entrega Form
    this.tipoEntrega = page.getByText('Entrega', { exact: true });
    this.tipoRetirada = page.getByText('Retirada', { exact: true });
    this.enderecoInput = page.locator(
      'input[placeholder*="endereço"], input[placeholder*="Digite o endereço"]'
    );
    this.destinatarioInput = page.locator(
      'input[placeholder*="destinatário"], input[placeholder*="Nome do destinatário"]'
    );
    this.telefoneInput = page.locator(
      'input[placeholder*="Telefone"], input[placeholder*="contato"]'
    );
    this.observacoesInput = page.locator(
      'input[placeholder*="Observações"], textarea[placeholder*="Observações"]'
    );
    this.addParadaButton = page.getByText(/adicionar.*parada/i);
    this.paradasList = page.locator('[data-testid="paradas-list"], .paradas-list');
    this.otimizarRotaButton = page.getByText(/otimizar.*rota/i);
    this.selecionarMotoristaSection = page.getByText(/selecionar.*motorista/i);
    this.gerarRotaButton = page.getByText(/gerar.*rota/i);
    this.rotaOtimizadaBanner = page.getByText(/rota.*otimizada/i);

    // Motoristas Management
    this.motoristasTable = page.locator('[data-testid="motoristas-table"], table');
    this.addMotoristaButton = page.getByText(/adicionar.*motorista|novo.*motorista/i);
    this.motoristaModal = page.locator('[data-testid="motorista-modal"], [role="dialog"]');
    this.motoristaNomeInput = this.motoristaModal.locator(
      'input[placeholder*="nome"], input[placeholder*="Nome"]'
    );
    this.motoristaEmailInput = this.motoristaModal.locator(
      'input[placeholder*="email"], input[placeholder*="Email"]'
    );
    this.motoristaTelefoneInput = this.motoristaModal.locator(
      'input[placeholder*="telefone"], input[placeholder*="Telefone"]'
    );
    this.motoristaSenhaInput = this.motoristaModal.locator(
      'input[placeholder*="senha"], input[placeholder*="Senha"]'
    );

    // Gestão Rotas
    this.rotasTable = page.locator('[data-testid="rotas-table"], table');
    this.filtroTodas = page.getByRole('button', { name: /todas/i });
    this.filtroPendente = page.getByRole('button', { name: /pendente/i });
    this.filtroEmAndamento = page.getByRole('button', { name: /em.*andamento/i });
    this.filtroConcluida = page.getByRole('button', { name: /conclu[ií]da/i });
    this.searchInput = page.locator('input[placeholder*="Buscar"], input[placeholder*="buscar"]');
    this.exportarButton = page.getByText(/exportar/i);

    // Common
    this.loadingIndicator = page.locator(
      '[data-testid="loading"], .loading, [aria-label*="loading"]'
    );
    this.toast = page.locator('[data-testid="toast"], .toast, [role="alert"]');
    this.confirmModal = page.locator('[data-testid="confirm-modal"], [role="alertdialog"]');
  }

  // Navigation methods
  // Note: Using 'domcontentloaded' instead of 'networkidle' because Supabase
  // subscriptions keep the network active, causing 'networkidle' to timeout.
  async goto() {
    await this.page.goto('/gestor?e2e=true', { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(2000);
  }

  async gotoInicio() {
    await this.page.goto('/gestor/inicio?e2e=true', { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(1500);
  }

  async gotoNovaEntrega() {
    await this.page.goto('/gestor/nova-entrega?e2e=true', { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(2000);
  }

  async gotoGestaoRotas() {
    await this.page.goto('/gestor/gestao-rotas?e2e=true', { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(1500);
  }

  async gotoMotoristas() {
    await this.page.goto('/gestor/motoristas?e2e=true', { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(1500);
  }

  // Assertions
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

  // Nova Entrega actions
  async selectTipoEntrega() {
    await this.tipoEntrega.click();
  }

  async selectTipoRetirada() {
    await this.tipoRetirada.click();
  }

  async fillParadaForm(data: {
    endereco: string;
    destinatario: string;
    telefone: string;
    observacoes?: string;
  }) {
    await this.enderecoInput.fill(data.endereco);
    await this.page.waitForTimeout(500); // Wait for autocomplete
    await this.destinatarioInput.fill(data.destinatario);
    await this.telefoneInput.fill(data.telefone);
    if (data.observacoes) {
      await this.observacoesInput.fill(data.observacoes);
    }
  }

  async addParada() {
    await this.addParadaButton.click();
    await this.page.waitForTimeout(1000);
  }

  async optimizeRoute() {
    await this.otimizarRotaButton.click();
    await this.page.waitForTimeout(3000); // Wait for API response
  }

  async selectMotorista(name: string) {
    const motoristaCard = this.page.getByText(name).first();
    await motoristaCard.click();
  }

  async generateRoute() {
    await this.gerarRotaButton.click();
    await this.page.waitForTimeout(2000);
  }

  // Motoristas actions
  async openAddMotoristaModal() {
    await this.addMotoristaButton.click();
    await expect(this.motoristaModal).toBeVisible({ timeout: 5000 });
  }

  async fillMotoristaForm(data: {
    nome: string;
    email: string;
    telefone?: string;
    senha: string;
  }) {
    await this.motoristaNomeInput.fill(data.nome);
    await this.motoristaEmailInput.fill(data.email);
    if (data.telefone) {
      await this.motoristaTelefoneInput.fill(data.telefone);
    }
    await this.motoristaSenhaInput.fill(data.senha);
  }

  async submitMotoristaForm() {
    const submitButton = this.motoristaModal.getByRole('button', { name: /adicionar|salvar/i });
    await submitButton.click();
    await this.page.waitForTimeout(2000);
  }

  // Gestão Rotas actions
  async filterByStatus(status: 'todas' | 'pendente' | 'em_andamento' | 'concluida') {
    switch (status) {
      case 'todas':
        await this.filtroTodas.click();
        break;
      case 'pendente':
        await this.filtroPendente.click();
        break;
      case 'em_andamento':
        await this.filtroEmAndamento.click();
        break;
      case 'concluida':
        await this.filtroConcluida.click();
        break;
    }
    await this.page.waitForTimeout(500);
  }

  async searchRoutes(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  async exportRoutes() {
    await this.exportarButton.click();
    await this.page.waitForTimeout(1000);
  }

  // Helper methods
  async getParadasCount(): Promise<number> {
    const countText = await this.page.getByText(/paradas.*adicionadas|(\d+)\s*parada/i).textContent();
    const match = countText?.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  async waitForLoading() {
    // Wait for loading to disappear
    await this.loadingIndicator.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  }

  async expectToastMessage(pattern: RegExp) {
    await expect(this.toast).toBeVisible({ timeout: 5000 });
    await expect(this.toast).toContainText(pattern);
  }
}
