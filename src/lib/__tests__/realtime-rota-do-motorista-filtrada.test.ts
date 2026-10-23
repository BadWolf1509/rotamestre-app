import {
  lerFonte,
  semComentariosMantendoStrings,
} from './helpers/varreduraDeFontes';

/**
 * Guarda: o canal da rota do MOTORISTA só assina `rotas`/`paradas` com filtro
 * e nunca DELETE nem `'*'`.
 *
 * POR QUE. Até a Onda C (22/10/2026) o canal assinava DELETE de `rotas` e `'*'`
 * de `paradas` sem filtro: todo motorista recarregava a rota a cada mudança em
 * qualquer loja, e o realtime não aplica RLS a DELETE (ver a armadilha em
 * `docs/PROJECT_CONTEXT.md`). Nada no banco impede alguém de recolocar a
 * assinatura sem filtro — por isso a guarda é estática.
 *
 * Escopo: só o arquivo do motorista. O canal do gestor (`useRealtimeRoutes`)
 * tem desenho próprio e fica fora desta guarda.
 */
const ARQUIVO = 'src/hooks/route-status/useRouteRealtimeSubscription.ts';
const TABELAS = ['rotas', 'paradas'];

interface Assinatura {
  tabela: string;
  evento: string | null;
  filtro: string | null;
}

function assinaturas(fonte: string): Assinatura[] {
  const achadas: Assinatura[] = [];
  for (const bloco of fonte.split('postgres_changes').slice(1)) {
    const trecho = bloco.slice(0, 400);
    const tabela = trecho.match(/table\s*:\s*['"`]([^'"`]+)['"`]/)?.[1];
    if (!tabela || !TABELAS.includes(tabela)) continue;
    const evento =
      trecho.match(/event\s*:\s*['"`]([^'"`]+)['"`]/)?.[1]?.toUpperCase() ??
      // `event: evento` (variável de um laço sobre literais)
      (/event\s*:\s*\w+/.test(trecho) ? 'VARIAVEL' : null);
    const filtro = trecho.match(/filter\s*:\s*(`[^`]*`|'[^']*'|"[^"]*")/)?.[1];
    achadas.push({ tabela, evento, filtro: filtro ?? null });
  }
  return achadas;
}

describe('realtime da rota do motorista', () => {
  const fonte = semComentariosMantendoStrings(lerFonte(ARQUIVO));
  const todas = assinaturas(fonte);

  it('encontra as assinaturas (sem isto a guarda passa por cegueira)', () => {
    expect(todas.some((a) => a.tabela === 'rotas')).toBe(true);
    expect(todas.some((a) => a.tabela === 'paradas')).toBe(true);
  });

  it('nenhuma assinatura de DELETE ou "*"', () => {
    const infratores = todas.filter(
      (a) => a.evento === 'DELETE' || a.evento === '*',
    );
    expect(infratores).toEqual([]);
  });

  it('eventos por variável só podem vir de um laço sobre INSERT/UPDATE', () => {
    if (!todas.some((a) => a.evento === 'VARIAVEL')) return;
    expect(fonte).toMatch(/\[\s*'INSERT'\s*,\s*'UPDATE'\s*\]\s*as const/);
  });

  it('toda assinatura tem filtro: rotas por motorista, paradas por rota', () => {
    const semFiltro = todas.filter((a) => !a.filtro);
    expect(semFiltro).toEqual([]);
    for (const a of todas) {
      const esperado =
        a.tabela === 'rotas' ? 'motorista_id=eq.' : 'rota_id=eq.';
      expect(a.filtro).toContain(esperado);
    }
  });
});
