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

/**
 * SEM SECRETS, PULA — não falha.
 *
 * O passo "Run visual regression tests (public only - no auth required)" do CI
 * roda de propósito SEM os `E2E_*`, para que os cenários públicos continuem
 * cobertos em contexto sem acesso a secret. Como ele invoca o Playwright, o
 * projeto `setup` entra junto por ser dependência — e, na primeira versão desta
 * mudança, derrubou justamente o passo que não precisa de login: `requireEnv`
 * lançava em 195 ms e levava o job inteiro.
 *
 * Pular é correto aqui porque nenhum teste `@public` usa `storageState`. Quem
 * usa e não encontrar o arquivo falha citando o caminho — e os passos
 * autenticados do CI têm os secrets.
 */
const OBRIGATORIAS = [
  'E2E_GESTOR_EMAIL',
  'E2E_GESTOR_PASSWORD',
  'E2E_MOTORISTA_EMAIL',
  'E2E_MOTORISTA_PASSWORD',
];
const FALTANDO = OBRIGATORIAS.filter((nome) => !process.env[nome]);

setup.skip(
  FALTANDO.length > 0,
  `Sem credenciais de E2E (${FALTANDO.join(', ')}) — só os cenários públicos rodam.`,
);
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
