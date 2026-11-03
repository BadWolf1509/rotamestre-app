/**
 * Todo `node <arquivo>` de um script do package.json tem de apontar para um
 * arquivo que existe. Script órfão só falha quando alguém o roda; aqui falha
 * no CI.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const RAIZ = join(__dirname, '..', '..', '..');

type Pacote = { scripts: Record<string, string> };

function lerScripts(): Record<string, string> {
  const pacote = JSON.parse(
    readFileSync(join(RAIZ, 'package.json'), 'utf8'),
  ) as Pacote;
  return pacote.scripts;
}

/** Cada `node <arquivo>` de uma linha, mesmo com `&&`, `||` ou `;` encadeando. */
export function arquivosNode(comando: string): string[] {
  const achados: string[] = [];
  for (const parte of comando.split(/&&|\|\||;/)) {
    const tokens = parte.trim().split(/\s+/);
    if (tokens[0] !== 'node') continue;
    for (const token of tokens.slice(1)) {
      // código inline (-e/-p) não é arquivo
      if (['-e', '-p', '--eval', '--print'].includes(token)) break;
      if (token.startsWith('-')) continue;
      achados.push(token.replace(/^["']|["']$/g, ''));
      break;
    }
  }
  return achados;
}

describe('npm run aponta para arquivo que existe', () => {
  it('acha todos os node <arquivo> de uma cadeia com &&', () => {
    const achados = arquivosNode(lerScripts()['build:web']);
    expect(achados.length).toBeGreaterThanOrEqual(4);
    expect(achados.every((c) => c.startsWith('tools/scripts/'))).toBe(true);
  });

  it('acha o arquivo em cadeia sintética, ignorando comandos que não são node', () => {
    expect(
      arquivosNode(
        'expo export && node a/b.js --x && npx foo || node c.cjs; node --no-warnings d.mjs',
      ),
    ).toEqual(['a/b.js', 'c.cjs', 'd.mjs']);
  });

  it('todo node <arquivo> de um npm run existe', () => {
    const faltando: string[] = [];
    for (const [nome, comando] of Object.entries(lerScripts())) {
      for (const caminho of arquivosNode(comando)) {
        if (!existsSync(join(RAIZ, caminho)))
          faltando.push(`${nome}: ${caminho}`);
      }
    }
    expect(faltando).toEqual([]);
  });
});
