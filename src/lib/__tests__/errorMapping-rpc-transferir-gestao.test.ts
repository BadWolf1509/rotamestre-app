/**
 * Guarda contra a mensagem da RPC divergir do `errorMapping.ts` em silêncio.
 *
 * `errorMapping.ts` casa TRÊS frases em português inteiras — copiadas à mão do
 * `RAISE EXCEPTION` de `transferir_gestao_principal()`
 * (`database/migrations/20260906120000_rls_endurecimento_papel_e_view_admin.sql`)
 * — para produzir título e mensagem amigáveis na tela de transferência
 * (`app/unidade/transferir.tsx`). Nada liga as duas pontas: reescrever a frase
 * no `.sql` (revisão de texto, correção de acento, o que for) degrada as três
 * para o erro genérico ("Algo deu errado") COM O CI VERDE — porque
 * `errorMapping.test.ts` testa a string que ele mesmo hardcodou, não a que
 * está no arquivo da migration.
 *
 * Esta guarda lê o `.sql`, extrai as mensagens de `RAISE EXCEPTION` do corpo
 * da função por regex, e confirma que cada uma (exceto a 4ª — ver abaixo)
 * ainda casa com algum `pattern` de `ERROR_PATTERNS`. `ERROR_PATTERNS` não é
 * exportado, então a checagem passa por `getErrorMessage()`: `code !==
 * 'UNKNOWN_ERROR'` só é possível se algum pattern casou, porque
 * `UNKNOWN_ERROR` é o code exclusivo do `DEFAULT_ERROR` de fallback.
 *
 * A 4ª exceção (`'Não autenticado'`, ERRCODE 28000) fica DE FORA da exigência
 * de mapeamento — decisão, não esquecimento. Só `authenticated` tem EXECUTE
 * nesta função (`GRANT EXECUTE ... TO authenticated` / `REVOKE ALL ... FROM
 * PUBLIC, anon`), então `auth.uid()` só é NULL num JWT que já passou pelo
 * PostgREST como `authenticated` mas não carrega `sub` — não é um caminho que
 * a tela de transferência alcança. Hoje ela cai no genérico, e o teste abaixo
 * documenta isso como comportamento atual, não como meta.
 *
 * O QUE ELA NÃO PEGA: o `ERRCODE` de cada exceção (`22023`, `42501`) não é
 * conferido — só o texto, que é o que `errorMapping.ts` de fato lê. Também não
 * pega uma reescrita que preserve a palavra-gatilho do regex, nem uma que por
 * acidente passe a casar com um pattern MAIS GENÉRICO (ex.: um texto novo que
 * contenha "permission" cairia em `PERMISSION_DENIED` sem ser a sentinela
 * certa) — ela só confirma que ALGUM pattern casa, não que é o pattern certo
 * para aquela mensagem.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { getErrorMessage } from '../errorMapping';

const RAIZ = join(__dirname, '..', '..', '..');
const ARQUIVO_MIGRATION =
  'database/migrations/20260906120000_rls_endurecimento_papel_e_view_admin.sql';
const NOME_FUNCAO = 'transferir_gestao_principal';

/** A única mensagem que não precisa de mapeamento amigável — ver cabeçalho. */
const MENSAGEM_SEM_MAPEAMENTO_ESPERADO = 'Não autenticado';

/**
 * Isola o corpo da função pelo nome e pelo fechamento `$$;` do dollar-quote,
 * e extrai o texto de cada `RAISE EXCEPTION '...'` dentro dela. Assume que
 * nenhuma mensagem contém aspas simples escapadas — verdade hoje para as 4.
 */
function extrairMensagensDeExcecao(sql: string): string[] {
  const inicio = sql.indexOf(`FUNCTION public.${NOME_FUNCAO}`);
  const fim = sql.indexOf('\n$$;', inicio);

  if (inicio === -1 || fim === -1) {
    throw new Error(
      `Não achei o corpo de ${NOME_FUNCAO}() em ${ARQUIVO_MIGRATION} — a extração por índice de string quebrou (a função foi renomeada ou reescrita?).`,
    );
  }

  const corpo = sql.slice(inicio, fim);
  return [...corpo.matchAll(/RAISE EXCEPTION '([^']+)'/g)].map((m) => m[1]);
}

describe('mensagens de transferir_gestao_principal() casam com errorMapping', () => {
  const sql = readFileSync(join(RAIZ, ARQUIVO_MIGRATION), 'utf8');
  const mensagens = extrairMensagensDeExcecao(sql);

  it('extrai 4 mensagens de RAISE EXCEPTION da função (senão a guarda passaria vazia)', () => {
    // Contagem, não o texto: o texto é o que os testes abaixo verificam de
    // verdade. Hardcodar as 4 frases aqui reintroduziria a mesma duplicação
    // manual que este arquivo existe para eliminar.
    expect(mensagens.length).toBe(4);
  });

  it('a mensagem sem mapeamento esperado realmente está entre as extraídas', () => {
    // Sanity check da constante acima: se a frase "Não autenticado" mudar no
    // SQL sem que este arquivo seja atualizado, o filtro abaixo para de
    // excluí-la — e ela cai no it.each seguinte, que vai falhar por não casar
    // com nenhum pattern. Vermelho correto, mas por aqui fica explícito onde
    // olhar primeiro.
    expect(mensagens).toContain(MENSAGEM_SEM_MAPEAMENTO_ESPERADO);
  });

  const mensagensComMapeamentoEsperado = mensagens.filter(
    (mensagem) => mensagem !== MENSAGEM_SEM_MAPEAMENTO_ESPERADO,
  );

  it.each(mensagensComMapeamentoEsperado)(
    '"%s" casa com algum pattern de ERROR_PATTERNS, não cai no genérico',
    (mensagem) => {
      const resultado = getErrorMessage({ message: mensagem });
      expect(resultado.code).not.toBe('UNKNOWN_ERROR');
    },
  );

  it('"Não autenticado" cai no genérico hoje — decisão, não esquecimento (ver cabeçalho)', () => {
    // Documenta o comportamento atual em vez de exigir mapeamento: o ramo é
    // inalcançável pela tela (só `authenticated` tem EXECUTE na função), então
    // não vale adicionar uma sentinela em errorMapping.ts só para este teste
    // passar de outro jeito.
    const resultado = getErrorMessage({
      message: MENSAGEM_SEM_MAPEAMENTO_ESPERADO,
    });
    expect(resultado.code).toBe('UNKNOWN_ERROR');
  });
});
