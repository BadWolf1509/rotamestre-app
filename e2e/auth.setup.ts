import { mkdirSync } from 'fs';
import { dirname } from 'path';

import { test as setup, expect } from '@playwright/test';

import { SESSAO_GESTOR, SESSAO_MOTORISTA } from './fixtures/sessoes';
import { testUsers } from './fixtures/test-fixtures';
import { LoginPage } from './pages/login.page';

/**
 * Projeto `setup`: loga uma vez por papel e guarda a sessão em disco.
 *
 * Roda como dependência dos projetos de teste (ver `playwright.config.ts`),
 * então acontece antes de qualquer teste e uma única vez por execução — as
 * sessões nunca são reaproveitadas de uma execução anterior, o que evita
 * token expirado.
 *
 * Ver `fixtures/sessoes.ts` para o porquê e para o aviso sobre os arquivos
 * gerados conterem token real.
 */
async function salvarSessao(
  page: import('@playwright/test').Page,
  email: string,
  senha: string,
  destino: string,
  urlEsperada: RegExp,
) {
  const login = new LoginPage(page);
  await login.goto();
  await login.login(email, senha);

  // Esperar a URL não basta: o token só está no localStorage depois que o
  // cliente Supabase persiste a sessão. Afirmar a chave é o que garante que o
  // arquivo salvo serve para alguma coisa — um `storageState` sem ela produz
  // uma suíte inteira deslogada, e o erro apareceria longe daqui.
  await page.waitForURL(urlEsperada, {
    timeout: 60000,
    waitUntil: 'domcontentloaded',
  });
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Object.keys(localStorage).some((k) => /^sb-.*-auth-token$/.test(k)),
        ),
      {
        timeout: 20000,
        message: 'sessão do Supabase não chegou ao localStorage',
      },
    )
    .toBe(true);

  mkdirSync(dirname(destino), { recursive: true });
  await page.context().storageState({ path: destino });
}

setup('sessão do gestor', async ({ page }) => {
  await salvarSessao(
    page,
    testUsers.gestor.email,
    testUsers.gestor.password,
    SESSAO_GESTOR,
    /.*gestor.*/,
  );
});

setup('sessão do motorista', async ({ page }) => {
  await salvarSessao(
    page,
    testUsers.motorista.email,
    testUsers.motorista.password,
    SESSAO_MOTORISTA,
    /.*motorista.*/,
  );
});
