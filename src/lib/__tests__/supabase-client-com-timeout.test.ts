/**
 * Guarda contra createClient() sem prazo de fetch.
 *
 * Em 05/09/2026 um PR corrigiu a ausência de timeout nas chamadas Supabase,
 * mas só tocou `src/lib/supabase.ts` (nativo). `src/lib/supabase.web.ts` —
 * resolvido pelo Metro no lugar do primeiro, servindo TODA a superfície do
 * gestor no navegador — ficou sem prazo nenhum. O PR passou por cinco checks
 * de CI verdes e 70 testes.
 *
 * POR QUE NENHUM CHECK PEGAVA, e por que isto precisa ser uma guarda estática:
 *
 * 1. `jest.config.js` exclui `src/lib/supabase.web.ts` (e `supabase.ts`) de
 *    `collectCoverageFrom` — nenhum teste unitário jamais executa este
 *    arquivo, então nenhuma asserção de runtime sobre o `fetch` do cliente
 *    web é sequer possível hoje.
 * 2. O e2e do CI exercita o web de verdade, mas com rede boa — a ausência de
 *    timeout só aparece quando uma requisição fica pendurada, o que uma rede
 *    saudável nunca produz. O teste passaria verde com ou sem o wrapper.
 *
 * O QUE ESTA GUARDA AFIRMA: todo `createClient(` do repositório (varrido em
 * `src/` E `app/`, não uma lista fixa de arquivos — ver abaixo) recebe, na
 * opção `global.fetch`, o wrapper `criarFetchComTimeout()`
 * (`./fetchComTimeout.ts`). Cada arquivo de cliente tem DOIS `createClient`:
 * o real e um placeholder usado quando faltam variáveis de ambiente (E2E/CI)
 * — o placeholder também faz requisição de rede, então precisa do mesmo
 * wrapper. `e2e/` fica DE FORA de propósito: é infraestrutura de teste que
 * roda no processo do Playwright, não no app entregue ao usuário (ver
 * `e2e/fixtures/garantir-rota-do-mapa.ts`, que cria seu próprio cliente para
 * semear dados) — a rede ruim que este wrapper existe para tolerar é a do
 * motorista em campo, não a da máquina que roda os testes.
 *
 * POR QUE A DESCOBERTA É DINÂMICA, e não uma lista de dois caminhos escrita à
 * mão: uma lista fixa protegeria só os dois clientes de hoje. Um terceiro
 * cliente criado amanhã nasceria sem timeout e o CI continuaria verde —
 * exatamente o buraco que este arquivo existe para tapar.
 *
 * O QUE ELA NÃO PEGA: o `fetch` correto poderia ainda assim não ter timeout
 * de verdade — isso é responsabilidade de `fetchComTimeout.test.ts`, que testa
 * o wrapper isoladamente. Esta guarda só confere que a chamada `createClient`
 * referencia `criarFetchComTimeout(` pelo nome; um identificador local
 * redefinido com o mesmo nome (sombreando o import) passaria batido, porque a
 * varredura é textual e não resolve import. Também assume que os parênteses
 * de cada chamada não escondem parênteses "soltos" dentro de string/comentário
 * — não há esse caso nos clientes atuais (URLs e chaves não têm parênteses).
 * Comentários (`//` e `/* *\/`) são removidos do texto ANTES de testar o
 * padrão do wrapper (ver `removerComentarios` abaixo) — sem isso, um
 * `// TODO: passar fetch: criarFetchComTimeout()` esquecido dentro do options
 * object deixaria a guarda verde sem nenhum wrapper de verdade ligado ao
 * `fetch`. A remoção também é textual: um `//` dentro de uma string (a URL do
 * placeholder, `'https://...'`) corta até o fim daquela linha, mas isso nunca
 * colide com o texto do wrapper, que está sempre em linha própria nos
 * clientes atuais — mesma categoria de limitação documentada acima.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { extname, join, relative } from 'path';

const RAIZ = join(__dirname, '..', '..', '..');
const RAIZ_SRC = join(RAIZ, 'src');
// Screens do Expo Router (`app/`) também podem, em tese, criar um cliente
// Supabase próprio — a varredura cobre os dois. `e2e/` fica de fora de
// propósito (ver o comentário no topo do arquivo).
const RAIZ_APP = join(RAIZ, 'app');
const EXTENSOES = new Set(['.ts', '.tsx']);

function listarFontes(dir: string): string[] {
  const encontrados: string[] = [];

  for (const nome of readdirSync(dir)) {
    if (
      nome === 'node_modules' ||
      nome === '__tests__' ||
      nome === '__mocks__'
    ) {
      continue;
    }

    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      encontrados.push(...listarFontes(caminho));
    } else if (EXTENSOES.has(extname(nome)) && !nome.includes('.test.')) {
      encontrados.push(caminho);
    }
  }

  return encontrados;
}

/** Abertura de uma chamada createClient(...), tolerando espaço antes do parêntese. */
const ABERTURA_CREATE_CLIENT = /createClient\s*\(/g;

/** O wrapper único deste repo para dar prazo ao fetch do Supabase. */
const WRAPPER_DE_TIMEOUT = /fetch\s*:\s*criarFetchComTimeout\(/;

/**
 * Remove comentários `/* *\/` e `//` do texto de UMA chamada createClient(...)
 * antes de testar `WRAPPER_DE_TIMEOUT` contra ele.
 *
 * SEM ISSO, `// TODO: passar fetch: criarFetchComTimeout()` dentro do options
 * object deixava a guarda verde: ela testa o TEXTO bruto, não resolve se
 * aquele texto está ativo ou comentado. Textual, não um parser — mesma
 * categoria de limitação já documentada no topo do arquivo para parênteses
 * dentro de string: um `//` dentro de uma string (a URL do placeholder,
 * `'https://...'`) também é cortado até o fim da linha, mas isso nunca
 * colide com o texto do wrapper, que está sempre em linha própria nos
 * clientes atuais.
 */
function removerComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function numeroDaLinha(fonte: string, indice: number): number {
  return fonte.slice(0, indice).split('\n').length;
}

/**
 * Extrai o texto de UMA chamada createClient(...), do '(' de abertura até o
 * ')' que fecha — balanceando parênteses para atravessar com segurança o
 * options object multi-linha, que contém outra chamada entre parênteses
 * (`criarFetchComTimeout()`).
 */
function extrairChamada(fonte: string, indiceAbertura: number): string {
  let profundidade = 0;

  for (let i = indiceAbertura; i < fonte.length; i++) {
    if (fonte[i] === '(') profundidade++;
    else if (fonte[i] === ')') {
      profundidade--;
      if (profundidade === 0) return fonte.slice(indiceAbertura, i + 1);
    }
  }

  throw new Error(
    `parêntese de createClient nunca fecha (índice ${indiceAbertura}) — arquivo truncado ou sintaxe inesperada`,
  );
}

interface ChamadaCreateClient {
  /** Caminho relativo à raiz do repo, sempre com '/'. */
  arquivo: string;
  linha: number;
  texto: string;
}

function encontrarChamadas(caminhoAbsoluto: string): ChamadaCreateClient[] {
  const fonte = readFileSync(caminhoAbsoluto, 'utf8');
  const arquivo = relative(RAIZ, caminhoAbsoluto).replace(/\\/g, '/');
  const achados: ChamadaCreateClient[] = [];

  for (const match of fonte.matchAll(ABERTURA_CREATE_CLIENT)) {
    const inicioDoMatch = match.index;
    if (inicioDoMatch === undefined) continue; // matchAll sempre preenche, guarda só pro tsc

    const indiceAbertura = inicioDoMatch + match[0].length - 1; // posição do '('
    achados.push({
      arquivo,
      linha: numeroDaLinha(fonte, inicioDoMatch),
      texto: extrairChamada(fonte, indiceAbertura),
    });
  }

  return achados;
}

describe('todo createClient( recebe fetch com timeout', () => {
  const fontes = [...listarFontes(RAIZ_SRC), ...listarFontes(RAIZ_APP)];

  it('a varredura acha arquivos de fonte em src/ e app/ (senão passaria vazia)', () => {
    expect(fontes.length).toBeGreaterThan(200);
  });

  const chamadas = fontes.flatMap(encontrarChamadas);

  it('a varredura acha as chamadas createClient( conhecidas hoje', () => {
    // Hoje: supabase.ts e supabase.web.ts, cada um com cliente real +
    // placeholder = 4. Limite inferior, não exato — o objetivo desta guarda é
    // não regredir quando um novo cliente for criado, então mais é esperado.
    expect(chamadas.length).toBeGreaterThanOrEqual(4);
  });

  it('nenhum createClient( fica sem o wrapper de timeout no fetch', () => {
    const infratores = chamadas
      .filter((c) => !WRAPPER_DE_TIMEOUT.test(removerComentarios(c.texto)))
      .map((c) => `${c.arquivo}:${c.linha}`);

    expect(infratores).toEqual([]);
  });

  it('um comentário mencionando o wrapper não engana a guarda', () => {
    // A forma exata do bug que motivou o item: alguém deixa um TODO em vez
    // do `fetch:` de verdade, e o texto bruto ainda "contém" o nome do
    // wrapper.
    const comentado = [
      'const x = createClient(url, key, {',
      '  auth: { persistSession: true },',
      '  global: {',
      '    // TODO: passar fetch: criarFetchComTimeout()',
      '  },',
      '});',
    ].join('\n');

    const chamada = extrairChamada(comentado, comentado.indexOf('('));

    // Sem `removerComentarios`, isto passaria (o nome aparece no texto bruto)
    // — é exatamente o falso-positivo que este teste existe para barrar.
    expect(WRAPPER_DE_TIMEOUT.test(chamada)).toBe(true);
    expect(WRAPPER_DE_TIMEOUT.test(removerComentarios(chamada))).toBe(false);
  });

  it('a extração + o padrão distinguem a forma quebrada da corrigida', () => {
    // Sem isto, um regex ou uma extração de parênteses quebrada deixaria o
    // teste acima verde para sempre — a rede precisa provar que prende antes
    // de afirmar que nada foi pego.
    const semWrapper = [
      'const x = createClient(url, key, {',
      '  auth: { persistSession: true },',
      '  global: {},',
      '});',
    ].join('\n');

    const comWrapper = [
      'const x = createClient(url, key, {',
      '  auth: { persistSession: true },',
      '  global: {',
      '    fetch: criarFetchComTimeout(),',
      '  },',
      '});',
    ].join('\n');

    const chamadaSemWrapper = extrairChamada(
      semWrapper,
      semWrapper.indexOf('('),
    );
    const chamadaComWrapper = extrairChamada(
      comWrapper,
      comWrapper.indexOf('('),
    );

    // A extração por si só tem que fechar no ')' de createClient, não no
    // primeiro ')' que aparecer (o de criarFetchComTimeout()).
    expect(chamadaSemWrapper.endsWith(');')).toBe(false); // extrai só até o ')' de createClient
    expect(chamadaSemWrapper.endsWith(')')).toBe(true);
    expect(chamadaComWrapper.includes('criarFetchComTimeout()')).toBe(true);

    expect(WRAPPER_DE_TIMEOUT.test(chamadaSemWrapper)).toBe(false);
    expect(WRAPPER_DE_TIMEOUT.test(chamadaComWrapper)).toBe(true);
  });
});
