import { SESSAO_GESTOR } from './fixtures/sessoes';
import { test, expect } from './fixtures/test-fixtures';
import { GestorPage } from './pages/gestor.page';

/**
 * Comprovação por foto — o que dá para afirmar daqui, e o que não dá.
 *
 * ESTE ARQUIVO TINHA SETE TESTES E NENHUM AFIRMAVA NADA. Todos terminavam em
 * `expect(bodyText?.length).toBeGreaterThan(100)`, verdadeiro para qualquer
 * página que renderize. Quatro deles procuravam a palavra "foto" no texto do
 * body e descartavam o resultado.
 *
 * POR QUE ELES NASCERAM ASSIM — e por que o lado do motorista foi REMOVIDO em
 * vez de convertido. A UI de foto vive atrás da conclusão de parada e do
 * "Reportar Problema". Medido em 07/09/2026 na build web servida do `dist/`:
 * clicar em "Concluir" e em "Reportar Problema" no viewport móvel NÃO abre
 * modal nenhum, e a página segue com zero `input[type="file"]`. Os controles
 * ficam num cartão de gestos ("Deslize para ações rápidas") que não responde a
 * clique simples. Ou seja: a tela de captura de foto **não é alcançável** por
 * este e2e — foi provavelmente isso que aconteceu com quem escreveu os testes
 * originais, e a saída foi fingir cobertura em vez de registrar o limite.
 *
 * E MESMO QUE FOSSE ALCANÇÁVEL, concluir uma parada GRAVA EM PRODUÇÃO: o único
 * banco é o de produção, e a rota do motorista de teste é fixture de outros
 * testes. Um e2e não pode fechar entrega de verdade para conferir se apareceu
 * um botão de câmera.
 *
 * O QUE FICA: o lado do gestor, que é alcançável e real. A leitura da foto em
 * si (bucket privado + `useSignedUrl`) continua coberta por teste de unidade —
 * ver `src/hooks/storage/__tests__`.
 */
test.describe('Gestor Photo Viewing E2E Tests', () => {
  let gestorPage: GestorPage;

  test.use({ storageState: SESSAO_GESTOR });

  test.beforeEach(async ({ page }) => {
    gestorPage = new GestorPage(page);
  });

  test.describe('View Delivery Proofs', () => {
    /**
     * "should access route details with photo proofs" saiu: era exatamente o
     * mesmo caminho de `dashboard-reports.e2e.ts` › "Ver Detalhes leva ao mapa
     * da rota", com a mesma não-asserção. Lá ele afirma.
     */
    test('os detalhes da rota abrem o mapa com o painel do trajeto', async ({
      page,
    }) => {
      await gestorPage.gotoGestaoRotas();
      await expect(page.getByTestId('gestao-rotas-table')).toBeVisible({
        timeout: 15000,
      });

      await page.getByText('Ver Detalhes').first().click();

      // É nesta tela que a foto de comprovação aparece para o gestor. Antes
      // conferia-se o comprimento da página; agora exige-se a tela montada.
      await expect(page).toHaveURL(/mapa-rota/, { timeout: 15000 });
      await expect(page.getByTestId('gestor-mapa-view')).toBeVisible({
        timeout: 20000,
      });
      await expect(page.getByText('Mapa da Rota').first()).toBeVisible();
    });
  });

  test.describe('Photo Storage Integration', () => {
    test('o filtro de concluídas tira as rotas em andamento da tabela', async ({
      page,
    }) => {
      await gestorPage.gotoGestaoRotas();

      const tabela = page.getByTestId('gestao-rotas-table');
      await expect(tabela).toBeVisible({ timeout: 15000 });

      // A conta demo tem rota em andamento junto das concluídas: é isso que
      // torna o filtro falsificável. Sem essa linha antes, filtrar não provaria
      // nada.
      await expect(tabela.getByText('Em Andamento').first()).toBeVisible();

      // Rotas concluídas são as que podem ter comprovante. O teste anterior
      // clicava no filtro e conferia o tamanho da página — passava igual se o
      // clique não filtrasse coisa nenhuma.
      await page
        .getByText(/^Conclu[ií]da/i)
        .first()
        .click();

      await expect(tabela.getByText('Em Andamento')).toHaveCount(0, {
        timeout: 15000,
      });
      await expect(tabela.getByText('Concluída').first()).toBeVisible();
    });
  });
});
