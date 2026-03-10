import { expect } from "@playwright/test";

import { test, e2eUrl } from "./fixtures/test-fixtures";
import { GestorPage } from "./pages/gestor.page";
import { MotoristaPage } from "./pages/motorista.page";

// Tests that do NOT require authentication
test.describe("Critical Flows - Public @visual @public", () => {
  test.skip(
    !process.env.VISUAL_REGRESSION,
    "Set VISUAL_REGRESSION=1 to enable visual snapshots.",
  );

  // Inject E2E flags before each page load so detectE2EEnvironment() returns true
  // even if expo-router strips the ?e2e=true URL param during internal initialization.
  // This ensures the splash screen is dismissed immediately on all routes.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.assign(window, { __PLAYWRIGHT_E2E__: true });
      try {
        localStorage.setItem("e2e_mode", "true");
      } catch {
        // localStorage may not be available in all environments
      }
    });
  });

  test("renders auth login", async ({ page }) => {
    await page.goto(e2eUrl("/auth/login"));
    await page.waitForLoadState("networkidle");
    await page.getByText("Entrar", { exact: true }).waitFor();
    await expect(page).toHaveScreenshot("visual-auth-login.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("renders auth register", async ({ page }) => {
    await page.goto(e2eUrl("/auth/register"));
    await page.waitForLoadState("networkidle");
    // Use card body text, not "Criar Conta" which also appears in the nav header title
    // timeout: 30000 — safety margin for CI (default actionTimeout is 15s)
    await page
      .getByText(/Preencha os dados abaixo/i)
      .waitFor({ timeout: 30000 });
    await expect(page).toHaveScreenshot("visual-auth-register.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("renders auth forgot password", async ({ page }) => {
    await page.goto(e2eUrl("/auth/forgot-password"));
    await page.waitForLoadState("networkidle");
    // timeout: 30000 — safety margin; this route takes ~12s in CI (close to default 15s actionTimeout)
    await page
      .getByText(/recuperar|reset/i)
      .first()
      .waitFor({ timeout: 30000 });
    // Wait for logo to load (mobile has horizontal logo above title)
    await page
      .locator('img[src*="logo"]')
      .first()
      .waitFor({ state: "visible", timeout: 10000 })
      .catch(() => {});
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot("visual-auth-forgot-password.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("renders onboarding first password", async ({ page }) => {
    await page.goto(e2eUrl("/onboarding/first-password"));
    await page.waitForLoadState("networkidle");
    // timeout: 30000 — safety margin for CI (default actionTimeout is 15s)
    await page
      .getByText("Defina sua Senha", { exact: true })
      .first()
      .waitFor({ timeout: 30000 });
    await expect(page).toHaveScreenshot(
      "visual-onboarding-first-password.png",
      {
        fullPage: true,
        animations: "disabled",
      },
    );
  });
});

// Tests that REQUIRE authentication (gestor/motorista login)
test.describe("Critical Flows - Authenticated @visual @auth", () => {
  test.skip(
    !process.env.VISUAL_REGRESSION,
    "Set VISUAL_REGRESSION=1 to enable visual snapshots.",
  );

  // Inject E2E flags before each page load so the splash screen dismisses immediately
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.assign(window, { __PLAYWRIGHT_E2E__: true });
      try {
        localStorage.setItem("e2e_mode", "true");
      } catch {
        // localStorage may not be available in all environments
      }
    });
  });

  test("renders gestor dashboard", async ({ page, loginAsGestor }) => {
    const gestorPage = new GestorPage(page);
    await loginAsGestor();
    await page.waitForURL("**/gestor/inicio**");
    await page.waitForLoadState("networkidle");
    await gestorPage.dashboardReady.waitFor({
      state: "visible",
      timeout: 30000,
    });
    const rotasTable = page.getByTestId("rotas-table");
    const statsRow = page.getByTestId("gestor-dashboard-stats");
    const mask = [];
    if ((await rotasTable.count()) > 0) {
      mask.push(rotasTable);
    }
    if ((await statsRow.count()) > 0) {
      mask.push(statsRow);
    }
    await expect(page).toHaveScreenshot("visual-gestor-dashboard.png", {
      fullPage: true,
      animations: "disabled",
      mask,
    });
  });

  test("renders gestor gestao rotas", async ({ page, loginAsGestor }) => {
    const gestorPage = new GestorPage(page);
    await loginAsGestor();
    await gestorPage.gotoGestaoRotas();
    const rotasTable = page.getByTestId("gestao-rotas-table");
    await rotasTable.waitFor({ state: "visible", timeout: 30000 });
    await expect(page).toHaveScreenshot("visual-gestor-gestao-rotas.png", {
      fullPage: true,
      animations: "disabled",
      mask: [rotasTable],
    });
  });

  test("renders gestor mapa rota empty", async ({ page, loginAsGestor }) => {
    await loginAsGestor();
    await page.goto(e2eUrl("/gestor/mapa-rota"));
    await page.waitForLoadState("networkidle");
    await page
      .getByText(/nenhuma rota/i)
      .first()
      .waitFor();
    await expect(page).toHaveScreenshot("visual-gestor-mapa-rota-empty.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("renders motorista home", async ({ page, loginAsMotorista }) => {
    const motoristaPage = new MotoristaPage(page);
    await loginAsMotorista();
    await motoristaPage.expectOnMotoristaDashboard();
    const statusSection = page.getByTestId("motorista-status-section");
    await statusSection.waitFor({ state: "visible", timeout: 30000 });
    await page.waitForTimeout(500);
    const miniMap = page.getByTestId("motorista-mini-map");
    const mainCard = page.getByTestId("motorista-main-card");
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
    await expect(page).toHaveScreenshot("visual-motorista-home.png", {
      fullPage: true,
      animations: "disabled",
      mask,
    });
  });

  test("renders motorista mapa", async ({ page, loginAsMotorista }) => {
    const motoristaPage = new MotoristaPage(page);
    await loginAsMotorista();
    await motoristaPage.navigateToMapa();
    await page.waitForLoadState("networkidle");
    const mapView = page.getByTestId("motorista-mapa-view");
    const mask = (await mapView.count()) > 0 ? [mapView] : [];
    await expect(page).toHaveScreenshot("visual-motorista-mapa.png", {
      fullPage: true,
      animations: "disabled",
      mask,
    });
  });

  test("renders motorista paradas", async ({ page, loginAsMotorista }) => {
    const motoristaPage = new MotoristaPage(page);
    await loginAsMotorista();
    await motoristaPage.navigateToParadas();
    await page.waitForLoadState("networkidle");
    const list = page.getByTestId("motorista-checkpoints-list");
    const mask = (await list.count()) > 0 ? [list] : [];
    await expect(page).toHaveScreenshot("visual-motorista-paradas.png", {
      fullPage: true,
      animations: "disabled",
      mask,
    });
  });

  test("renders motorista historico", async ({ page, loginAsMotorista }) => {
    await loginAsMotorista();
    await page.goto(e2eUrl("/motorista/historico"), {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    const list = page.getByTestId("motorista-historico-list");
    await list.waitFor({ state: "visible", timeout: 30000 });
    const mask = (await list.count()) > 0 ? [list] : [];
    await expect(page).toHaveScreenshot("visual-motorista-historico.png", {
      fullPage: true,
      animations: "disabled",
      mask,
    });
  });
});
