/**
 * Guarda contra o dia que anda para trás em coluna `date`.
 *
 * Em 05/09/2026 o modal de incidente mostrava "Rota de 04/09/2026" para uma
 * rota de 05/09. A causa: `rotas.data` é uma coluna `date`, serializada como
 * `'2026-09-05'`, e `new Date('2026-09-05')` é **meia-noite UTC** — em UTC-3 o
 * `toLocaleDateString('pt-BR')` volta um dia. Timestamps (`created_at`,
 * `iniciada_em`, `concluida_em`) não têm esse problema: carregam o fuso.
 *
 * POR QUE ESTA GUARDA É ESTÁTICA, e não um teste de renderização. O bug só
 * aparece em fuso negativo, e os runners do CI rodam em UTC — onde o código
 * quebrado acerta a data. Um teste de runtime passaria vazio exatamente no
 * lugar onde a regressão entraria despercebida. Tentei pinar
 * `process.env.TZ = 'America/Sao_Paulo'` num `beforeAll`: funciona no Node 24
 * local e **não** funciona no Node 22 do CI (o ICU já cacheou o fuso padrão),
 * então a asserção de guarda daquele teste falhou no CI — que é o resultado
 * certo para uma rede que não pega nada, mas não serve como guarda.
 *
 * O QUE ELA NÃO PEGA: só olha a forma `new Date(<algo>.data)` /
 * `new Date(<algo>rota_data)`. Quem copiar o valor para uma variável antes
 * (`const d = rota.data; new Date(d)`) passa batido. Protege contra a
 * reintrodução literal, que foi como o bug entrou.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { extname, join, relative } from 'path';

const RAIZ = join(__dirname, '..', '..', '..');
const DIRETORIOS = ['src', 'app'];
const EXTENSOES = new Set(['.ts', '.tsx']);

/**
 * Colunas `date` (sem hora) deste schema. Montado em pedaços para o próprio
 * arquivo de teste não casar com a própria regra.
 */
const COLUNAS_DATE_ONLY = ['rota' + '_data', '\\.' + 'data'];
const PADRAO_PROIBIDO = new RegExp(
  `new Date\\(\\s*[A-Za-z0-9_.?\\[\\]'"]*\\b(?:${COLUNAS_DATE_ONLY.join('|')})\\b`,
);

function listarFontes(dir: string): string[] {
  const encontrados: string[] = [];

  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome === '__tests__') continue;

    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      encontrados.push(...listarFontes(caminho));
    } else if (EXTENSOES.has(extname(nome)) && !nome.includes('.test.')) {
      encontrados.push(caminho);
    }
  }

  return encontrados;
}

describe('coluna date-only nunca passa por new Date()', () => {
  const fontes = DIRETORIOS.flatMap((d) => listarFontes(join(RAIZ, d)));

  it('acha os arquivos de fonte (senão a varredura passaria vazia)', () => {
    expect(fontes.length).toBeGreaterThan(100);
  });

  it('nenhum arquivo formata `data`/`rota_data` com new Date', () => {
    const infratores = fontes
      .filter((caminho) => PADRAO_PROIBIDO.test(readFileSync(caminho, 'utf8')))
      .map((caminho) => relative(RAIZ, caminho).replace(/\\/g, '/'));

    expect(infratores).toEqual([]);
  });

  it('o padrão realmente casa com a forma que causou o bug', () => {
    // Sem isto, um regex quebrado deixaria os dois testes acima verdes para
    // sempre. Confirma que a rede prende antes de afirmar que nada foi pego.
    const trechoQuebrado =
      "`Rota de ${new Date(incidente.rota_data).toLocaleDateString('pt-BR')}`";
    const trechoCorrigido = '`Rota de ${formatDateBR(incidente.rota_data)}`';

    expect(PADRAO_PROIBIDO.test(trechoQuebrado)).toBe(true);
    expect(PADRAO_PROIBIDO.test(trechoCorrigido)).toBe(false);
  });
});

/**
 * A outra metade da mesma classe, descoberta em 05/09/2026 varrendo o app com o
 * dev build: recortar o dia de um `toISOString()` devolve a data em **UTC**. Em
 * UTC-3, a partir das 21:00 isso já é o dia seguinte.
 *
 * Foi o que matava o `ExpirationWarning`: ele comparava data em UTC com hora
 * local (`getHours()`), então o aviso de "rota expira às 22:00" sumia das 21:00
 * às 22:00 — a única hora em que ele serve para alguma coisa. O mesmo padrão
 * estava em 11 lugares, 7 arquivos.
 *
 * O certo é montar a data com componentes locais: `getTodayISO()` /
 * `toLocalISODate()` em `src/lib/dateUtils.ts`.
 */
/** Montado em pedaços para o próprio arquivo não casar com a regra. */
const RECORTES_DE_DIA = ["split('T')[0]", 'slice(0,10)'];
const CHAMADA_ISO = 'toISO' + 'String()';

/** Ignora espaços para não depender da formatação do prettier. */
function derivaDiaEmUtc(fonte: string): boolean {
  const compacto = fonte.replace(/\s+/g, '');
  return RECORTES_DE_DIA.some((recorte) =>
    compacto.includes(CHAMADA_ISO + '.' + recorte.replace(/\s+/g, '')),
  );
}

/**
 * O módulo que DEFINE a alternativa precisa nomear o padrão errado no
 * comentário — é onde a explicação pertence. A varredura não separa comentário
 * de código, então este arquivo é isento, como `maplibre.ts` é na guarda de
 * tiles.
 */
const ARQUIVO_QUE_DEFINE_A_ALTERNATIVA = 'src/lib/dateUtils.ts';

describe('dia do calendário nunca sai de toISOString()', () => {
  const fontes = DIRETORIOS.flatMap((d) => listarFontes(join(RAIZ, d)));

  it('nenhum arquivo deriva dia do calendário em UTC', () => {
    const infratores = fontes
      .filter((caminho) => derivaDiaEmUtc(readFileSync(caminho, 'utf8')))
      .map((caminho) => relative(RAIZ, caminho).replace(/\\/g, '/'))
      .filter((caminho) => caminho !== ARQUIVO_QUE_DEFINE_A_ALTERNATIVA);

    expect(infratores).toEqual([]);
  });

  it('a checagem casa com a forma quebrada e poupa a legítima', () => {
    expect(
      derivaDiaEmUtc("const hoje = now.toISOString().split('T')[0];"),
    ).toBe(true);
    expect(derivaDiaEmUtc('const d = date.toISOString().slice(0, 10);')).toBe(
      true,
    );
    // Timestamp completo continua legítimo — o problema é recortar o dia dele.
    expect(derivaDiaEmUtc('payload.quando = date.toISOString();')).toBe(false);
    expect(derivaDiaEmUtc('const hoje = getTodayISO();')).toBe(false);
  });
});
