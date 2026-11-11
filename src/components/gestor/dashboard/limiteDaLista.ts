/**
 * Teto de linhas da lista do Início sem início ("Todo o período"), da data
 * mais nova para a mais antiga. Sem ele, o teto de 1.000 linhas do PostgREST
 * cortaria a lista calado; com ele, a tela avisa (`listaCortada`).
 *
 * Módulo sem dependências: o hook (que consulta) e os textos da tela leem o
 * mesmo número, sem que os textos puxem o cliente do Supabase.
 */
export const LIMITE_ROTAS_SEM_INICIO = 500;
