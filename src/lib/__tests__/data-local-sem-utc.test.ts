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
