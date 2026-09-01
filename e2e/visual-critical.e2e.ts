import { expect } from '@playwright/test';

import { garantirRotaDoMapa } from './fixtures/garantir-rota-do-mapa';
import { test, e2eUrl } from './fixtures/test-fixtures';
import { GestorPage } from './pages/gestor.page';
import { MotoristaPage } from './pages/motorista.page';

// Tests that do NOT require authentication
test.describe('Critical Flows - Public @visual @public', () => {
  test.skip(
    !process.env.VISUAL_REGRESSION,
    'Set VISUAL_REGRESSION=1 to enable visual snapshots.',
  );

  // Inject E2E flags before each page load so detectE2EEnvironment() returns true
  // even if expo-router strips the ?e2e=true URL param during internal initialization.
  // This ensures the splash screen is dismissed immediately on all routes.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.assign(window, { __PLAYWRIGHT_E2E__: true });
      try {
        localStorage.setItem('e2e_mode', 'true');
      } catch {
        // localStorage may not be available in all environments
      }
    });
  });

  test('renders auth login', async ({ page }) => {
    await page.goto(e2eUrl('/auth/login'));
    await page.waitForLoadState('networkidle');
    await page.getByText('Entrar', { exact: true }).waitFor();
    await expect(page).toHaveScreenshot('visual-auth-login.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('renders auth register', async ({ page }) => {
    await page.goto(e2eUrl('/auth/register'));
    await page.waitForLoadState('networkidle');
    // Use card body text, not "Criar Conta" which also appears in the nav header title
    // timeout: 30000 — safety margin for CI (default actionTimeout is 15s)
    await page
      .getByText(/Preencha os dados abaixo/i)
      .waitFor({ timeout: 30000 });
    await expect(page).toHaveScreenshot('visual-auth-register.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('renders auth forgot password', async ({ page }) => {
    await page.goto(e2eUrl('/auth/forgot-password'));
    await page.waitForLoadState('networkidle');
    // timeout: 30000 — safety margin; this route takes ~12s in CI (close to default 15s actionTimeout)
    await page
      .getByText(/recuperar|reset/i)
      .first()
      .waitFor({ timeout: 30000 });
    // Wait for logo to load (mobile has horizontal logo above title)
    await page
      .locator('img[src*="logo"]')
      .first()
      .waitFor({ state: 'visible', timeout: 10000 })
      .catch(() => {});
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('visual-auth-forgot-password.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('renders onboarding first password', async ({ page }) => {
    await page.goto(e2eUrl('/onboarding/first-password'));
    await page.waitForLoadState('networkidle');
    // timeout: 30000 — safety margin for CI (default actionTimeout is 15s)
    await page
      .getByText('Defina sua Senha', { exact: true })
      .first()
      .waitFor({ timeout: 30000 });
    await expect(page).toHaveScreenshot(
      'visual-onboarding-first-password.png',
      {
        fullPage: true,
        animations: 'disabled',
      },
    );
  });
});

// Tests that REQUIRE authentication (gestor/motorista login)
test.describe('Critical Flows - Authenticated @visual @auth', () => {
  test.skip(
    !process.env.VISUAL_REGRESSION,
    'Set VISUAL_REGRESSION=1 to enable visual snapshots.',
  );

  // Inject E2E flags before each page load so the splash screen dismisses immediately
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.assign(window, { __PLAYWRIGHT_E2E__: true });
      try {
        localStorage.setItem('e2e_mode', 'true');
      } catch {
        // localStorage may not be available in all environments
      }
    });
  });

  test('renders gestor dashboard', async ({ page, loginAsGestor }) => {
    const gestorPage = new GestorPage(page);
    await loginAsGestor();
    await page.waitForURL('**/gestor/inicio**');
    await page.waitForLoadState('networkidle');
    await gestorPage.dashboardReady.waitFor({
      state: 'visible',
      timeout: 30000,
    });
    const rotasTable = page.getByTestId('rotas-table');
    const statsRow = page.getByTestId('gestor-dashboard-stats');
    const mask = [];
    if ((await rotasTable.count()) > 0) {
      mask.push(rotasTable);
    }
    if ((await statsRow.count()) > 0) {
      mask.push(statsRow);
    }
    await expect(page).toHaveScreenshot('visual-gestor-dashboard.png', {
      fullPage: true,
      animations: 'disabled',
      mask,
    });
  });

  test('renders gestor gestao rotas', async ({ page, loginAsGestor }) => {
    const gestorPage = new GestorPage(page);
    await loginAsGestor();
    await gestorPage.gotoGestaoRotas();
    const rotasTable = page.getByTestId('gestao-rotas-table');
    await rotasTable.waitFor({ state: 'visible', timeout: 30000 });
    await expect(page).toHaveScreenshot('visual-gestor-gestao-rotas.png', {
      fullPage: true,
      animations: 'disabled',
      mask: [rotasTable],
    });
  });

  test('renders gestor mapa rota empty', async ({ page, loginAsGestor }) => {
    await loginAsGestor();
    await page.goto(e2eUrl('/gestor/mapa-rota'));
    await page.waitForLoadState('networkidle');
    await page
      .getByText(/nenhuma rota/i)
      .first()
      .waitFor();
    await expect(page).toHaveScreenshot('visual-gestor-mapa-rota-empty.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('renders motorista home', async ({ page, loginAsMotorista }) => {
    const motoristaPage = new MotoristaPage(page);
    await loginAsMotorista();
    await motoristaPage.expectOnMotoristaDashboard();
    const statusSection = page.getByTestId('motorista-status-section');
    await statusSection.waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(500);
    const miniMap = page.getByTestId('motorista-mini-map');
    const mainCard = page.getByTestId('motorista-main-card');
    const mask = [];
    if ((await statusSection.count()) > 0) {
      mask.push(statusSection);
    }
    if ((await mainCard.count()) > 0) {
      mask.push(mainCard);
    }
    if ((await miniMap.count()) > 0) {
      mask.push(miniMap);
    }
    await expect(page).toHaveScreenshot('visual-motorista-home.png', {
      fullPage: true,
      animations: 'disabled',
      mask,
    });
  });

  test('renders motorista mapa', async ({ page, loginAsMotorista }) => {
    // O cenário é preparado ANTES do login: sem rota que monte o mapa, o teste
    // falha na guarda mais abaixo sem ter testado nada. Ver o cabeçalho de
    // `garantir-rota-do-mapa.ts` para por que a regra de expiração criada em
    // 31/08 tornou isto necessário.
    const fixture = await garantirRotaDoMapa();
    // Registrar sempre, inclusive no caminho feliz: quando este teste falhar,
    // a primeira pergunta é em que estado o cenário estava.
    console.log(
      `[fixture] rota ${fixture.rotaId}: ${fixture.acao} ` +
        `(antes: ${fixture.statusAntes}, ${fixture.dataAntes})`,
    );

    const motoristaPage = new MotoristaPage(page);
    await loginAsMotorista();

    // Tráfego de tiles, capturado ANTES de navegar — depois já é tarde.
    //
    // Por que existe: até 31/08/2026 este teste parava no evento `load`, e o
    // `load` do maplibre dispara mesmo quando os tiles falham. O mapa podia
    // montar vazio, ou apontando para outro provedor, e o teste ficava verde.
    // Foi assim que o nativo passou meses na Carto sem ninguém ver — o web
    // rodava aqui e não olhava de onde vinha imagem nenhuma.
    const requisicoesDeTile: { url: string; status: number }[] = [];
    const HOSTS_DE_TILE =
      /(tiles\.openfreemap\.org|basemaps\.cartocdn\.com|api\.mapbox\.com|api\.maptiler\.com|tile\.openstreetmap\.org|tiles\.stadiamaps\.com)/;
    page.on('response', (res) => {
      if (HOSTS_DE_TILE.test(res.url())) {
        requisicoesDeTile.push({ url: res.url(), status: res.status() });
      }
    });

    await motoristaPage.navigateToMapa();
    await page.waitForLoadState('networkidle');

    // Asserção FUNCIONAL, não de screenshot. Este teste já foi um
    // `toHaveScreenshot` com `mask` sobre a região do mapa — ou seja, apagava o
    // mapa antes de comparar — e a baseline commitada era o mapa travado em
    // "Carregando mapa...". Passava com o mapa quebrado e falhava quando ele
    // funcionava.
    //
    // ORDEM IMPORTA. O mapa só monta quando o motorista tem rota ativa; sem rota
    // a tela mostra `motorista-mapa-empty` e não existe overlay nenhum — logo um
    // `toHaveCount(0)` sozinho é trivialmente verdadeiro e o teste passa sem
    // testar nada. Foi o que aconteceu na primeira versão: em CI o motorista
    // estava sem rota (canvases=0, mapDivs=0) e o teste ficou verde mesmo com o
    // worker do maplibre deliberadamente quebrado.
    //
    // Por isso: primeiro exigir que o mapa EXISTA, só então que ele terminou de
    // carregar. O timeout generoso também cobre a query da rota, que em CI pode
    // demorar mais que o `waitForTimeout(1000)` do `navigateToMapa()`.
    const mapView = page.getByTestId('motorista-mapa-view');
    await expect(
      mapView,
      'Mapa não montou: o motorista de teste precisa ter rota ativa, senão a tela fica no estado vazio e este teste não valida nada.',
    ).toBeVisible({ timeout: 60000 });
    await expect(mapView.locator('canvas.maplibregl-canvas')).toBeVisible({
      timeout: 60000,
    });

    // `mapa-web-carregando` só desaparece quando o evento `load` do maplibre
    // dispara — é o mesmo `mapLoaded` que controla o overlay no componente. A
    // tela tem DOIS mapas (o MiniMap do topo e o principal) e o toHaveCount
    // cobre os dois.
    await expect(page.getByTestId('mapa-web-carregando')).toHaveCount(0, {
      timeout: 60000,
    });

    // Só agora o tráfego pode ser julgado: o mapa terminou de carregar.

    // 1. Buscou tile de verdade, não só o manifesto do estilo. Sem isto, um
    //    mapa que carrega o estilo e não renderiza nada passaria.
    const tilesDeDados = requisicoesDeTile.filter(
      (r) => !r.url.includes('/styles/'),
    );
    expect(
      tilesDeDados.length,
      `Nenhum tile buscado. Requisições vistas: ${JSON.stringify(requisicoesDeTile)}`,
    ).toBeGreaterThan(0);

    // 2. Nenhuma falhou. `load` dispara mesmo com tile em 403/404.
    const falhas = requisicoesDeTile.filter((r) => r.status >= 400);
    expect(falhas, `Tiles falharam: ${JSON.stringify(falhas)}`).toHaveLength(0);

    // 3. Tudo veio do provedor esperado. Se alguém apontar o mapa para outro
    //    — inclusive um que exija chave, que é o caminho de volta ao bug —,
    //    quebra aqui em runtime, e não só no teste estático de fonte única.
    const forasteiros = requisicoesDeTile.filter(
      (r) => !r.url.includes('tiles.openfreemap.org'),
    );
    expect(
      forasteiros,
      `Tiles vieram de outro provedor: ${JSON.stringify(forasteiros)}`,
    ).toHaveLength(0);

    // O QUE ISTO NÃO PEGA: tile com marca d'água chega como 200 com PNG
    // válido. Nenhuma asserção aqui distingue isso de um tile bom — foi
    // exatamente assim que a Carto degradou. Só análise de imagem ou olho
    // humano pega, e o custo não se justifica num check de PR.
  });

  test('renders motorista paradas', async ({ page, loginAsMotorista }) => {
    const motoristaPage = new MotoristaPage(page);
    await loginAsMotorista();
    await motoristaPage.navigateToParadas();
    await page.waitForLoadState('networkidle');
    const list = page.getByTestId('motorista-checkpoints-list');
    const mask = (await list.count()) > 0 ? [list] : [];
    await expect(page).toHaveScreenshot('visual-motorista-paradas.png', {
      fullPage: true,
      animations: 'disabled',
      mask,
    });
  });

  test('renders motorista historico', async ({ page, loginAsMotorista }) => {
    await loginAsMotorista();
    await page.goto(e2eUrl('/motorista/historico'), {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    const list = page.getByTestId('motorista-historico-list');
    await list.waitFor({ state: 'visible', timeout: 30000 });
    const mask = (await list.count()) > 0 ? [list] : [];
    await expect(page).toHaveScreenshot('visual-motorista-historico.png', {
      fullPage: true,
      animations: 'disabled',
      mask,
    });
  });
});
