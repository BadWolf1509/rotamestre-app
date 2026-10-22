/**
 * Guarda: toda tarefa em segundo plano tem de estar definida na partida sem tela.
 *
 * Em 22/10/2026, no moto g15 (1.14.1), o logcat mostrou
 * `Execution of "rotamestre-background-location" was requested but looks like
 * it is not defined`, e logo depois o expo-task-manager **desregistrou** a
 * tarefa: o gestor perdia a posição do motorista até ele reabrir o app.
 *
 * A causa: quando o Android acorda o processo sem tela (headless), só o arquivo
 * de entrada roda antes de a tarefa disparar. O `defineTask` morava num módulo
 * que ninguém carregava na partida — e o `inlineRequires` do `metro.config.js`
 * adia todo import **com nome** até o primeiro uso, então nem o import que o
 * `locationTracking.ts` faz do `unifiedLocationTracking.ts` bastava. Só o
 * import de efeito (`import './x'`) roda na hora. A documentação do Expo exige
 * `defineTask` em escopo global, carregado pelo entry.
 *
 * O QUE ELA NÃO PEGA: só reconhece o nome da tarefa como literal ou como
 * `const` do próprio arquivo. Um nome montado em runtime ou importado de outro
 * módulo derruba o teste de resolução abaixo, em vez de passar calado.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { dirname, extname, join, relative, resolve } from 'path';

const RAIZ = join(__dirname, '..', '..', '..');
const ENTRY = join(RAIZ, 'index.ts');
const EXTENSOES = new Set(['.ts', '.tsx']);

/** APIs que mandam o sistema operacional disparar uma tarefa do TaskManager. */
const QUEM_DISPARA =
  /\b(?:startLocationUpdatesAsync|startGeofencingAsync)\(\s*([A-Za-z0-9_'"-]+)/g;
const QUEM_DEFINE = /\bdefineTask\(\s*([A-Za-z0-9_'"-]+)/g;

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

/** Resolve `'nome'` ou uma `const NOME = 'nome'` do mesmo arquivo. */
function resolverNome(argumento: string, conteudo: string): string | null {
  const literal = /^['"]([^'"]+)['"]$/.exec(argumento);
  if (literal) return literal[1];
  const constante = new RegExp(
    `const\\s+${argumento}\\s*=\\s*['"]([^'"]+)['"]`,
  ).exec(conteudo);
  return constante ? constante[1] : null;
}

function coletar(padrao: RegExp, fontes: string[]) {
  return fontes.flatMap((arquivo) => {
    const conteudo = readFileSync(arquivo, 'utf8');
    return [...conteudo.matchAll(padrao)].map((m) => ({
      arquivo,
      argumento: m[1],
      nome: resolverNome(m[1], conteudo),
    }));
  });
}

/** Arquivos que o entry carrega por import de efeito (o único que não é adiado). */
function importsDeEfeitoDoEntry(): Set<string> {
  const conteudo = readFileSync(ENTRY, 'utf8');
  const caminhos = [
    ...conteudo.matchAll(/^import\s+['"](\.[^'"]+)['"];?\s*$/gm),
  ].map((m) => resolve(dirname(ENTRY), m[1]));
  return new Set(caminhos.flatMap((c) => [...EXTENSOES].map((ext) => c + ext)));
}

describe('tarefas em segundo plano definidas pelo arquivo de entrada', () => {
  const fontes = ['src', 'app'].flatMap((d) => listarFontes(join(RAIZ, d)));
  const disparos = coletar(QUEM_DISPARA, fontes);
  const definicoes = coletar(QUEM_DEFINE, fontes);

  it('acha quem dispara e quem define (senão a varredura passaria vazia)', () => {
    expect(disparos.length).toBeGreaterThan(0);
    expect(definicoes.length).toBeGreaterThan(0);
  });

  it('resolve o nome de toda tarefa', () => {
    const semNome = [...disparos, ...definicoes]
      .filter((t) => t.nome === null)
      .map((t) => `${relative(RAIZ, t.arquivo)}: ${t.argumento}`);
    expect(semNome).toEqual([]);
  });

  it('o entry importa, por efeito, quem define cada tarefa disparada', () => {
    const doEntry = importsDeEfeitoDoEntry();
    const faltando = disparos
      .filter((d) => {
        const quemDefine = definicoes.filter((def) => def.nome === d.nome);
        return (
          quemDefine.length === 0 ||
          !quemDefine.some((def) => doEntry.has(def.arquivo))
        );
      })
      .map((d) => `${d.nome} (disparada em ${relative(RAIZ, d.arquivo)})`);
    expect(faltando).toEqual([]);
  });
});
