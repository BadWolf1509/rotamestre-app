/**
 * Ferramentas compartilhadas pelas guardas estáticas — as que varrem o código
 * de produção procurando uma forma proibida.
 *
 * POR QUE É COMPARTILHADO. `comStringsNeutralizadas` custou três rodadas de
 * correção para ficar de pé: primeiro um `//` dentro de uma URL apagava o
 * resto da linha física, depois a versão que consertava isso deixou o ramo de
 * crase sem excluir `\n` e uma crase órfã passou a engolir dezenas de linhas —
 * incluindo, comprovadamente, o miolo de `src/lib/schemas/basic.ts`. Uma
 * segunda cópia disso seria uma segunda chance de a próxima correção chegar só
 * num dos lados.
 *
 * Este arquivo mora sob `__tests__` de propósito: `arquivosDeProducao()` filtra
 * esse segmento, então a ferramenta não aparece na própria varredura.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { sync as glob } from 'glob';

export const RAIZ = join(__dirname, '..', '..', '..', '..');

export function arquivosDeProducao(): string[] {
  return (
    glob('{src,app}/**/*.{ts,tsx}', { cwd: RAIZ })
      // No Windows o `glob` devolve `\` como separador. As constantes das
      // guardas (e suas listas de exceção) são escritas com `/` — sem
      // normalizar aqui, a comparação de string falha e os PRÓPRIOS arquivos
      // donos da regra aparecem como infratores. Descoberto rodando a guarda
      // de verdade neste repo, num Windows, não deduzido.
      .map((caminho) => caminho.split('\\').join('/'))
      .filter((caminho) => !caminho.includes('__tests__'))
      .filter((caminho) => !caminho.endsWith('.test.ts'))
      .filter((caminho) => !caminho.endsWith('.test.tsx'))
  );
}

/**
 * Substitui o CONTEÚDO de strings e template literals por `#`, preservando as
 * aspas e as quebras de linha, para que `semComentarios` não confunda o `//`
 * de uma URL com o início de um comentário.
 *
 * Os três ramos excluem `\n` de propósito: um literal que cruza linhas
 * mascararia código real entre a abertura e o fechamento — foi exatamente esse
 * o defeito que uma crase solta dentro de uma classe de caractere de regex
 * causou aqui. Sub-mascarar deixa fragmentos expostos, o que no máximo gera
 * ruído; cruzar linhas esconde violação, que é silencioso.
 *
 * Heurística por regex, não um parser: não resolve `${...}` aninhado nem
 * literal de regex com `/`. Suficiente para o que este repo escreve.
 */
export function comStringsNeutralizadas(fonte: string): string {
  return fonte.replace(
    /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\\n]|\\.)*`/g,
    (literal) =>
      literal[0] +
      literal.slice(1, -1).replace(/[^\n]/g, '#') +
      literal[literal.length - 1],
  );
}

export function semComentarios(fonte: string): string {
  return comStringsNeutralizadas(fonte)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

/**
 * Remove comentários SEM apagar o conteúdo das strings.
 *
 * `semComentarios` do helper não serve aqui: ele neutraliza os literais antes
 * de cortar os comentários, então `'motorista_locations'` chega como `'####'` e
 * uma varredura por nome de tabela não acha nada — verde por cegueira, que foi
 * o que o segundo teste de `realtime-motorista-locations-somente-insert`
 * pegou na primeira tentativa.
 *
 * A saída é usar a versão neutralizada só como MÁSCARA: ela tem o mesmo
 * comprimento do original, então os intervalos de comentário encontrados nela
 * valem como índices no texto original.
 */
export function semComentariosMantendoStrings(fonte: string): string {
  const mascara = comStringsNeutralizadas(fonte);
  const intervalos: [number, number][] = [];
  const regex = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;

  let achado: RegExpExecArray | null;
  while ((achado = regex.exec(mascara)) !== null) {
    intervalos.push([achado.index, achado.index + achado[0].length]);
  }

  let saida = fonte;
  for (const [inicio, fim] of intervalos.reverse()) {
    saida =
      saida.slice(0, inicio) + ' '.repeat(fim - inicio) + saida.slice(fim);
  }
  return saida;
}

/** Lê um arquivo de produção pelo caminho relativo à raiz do repo. */
export function lerFonte(caminho: string): string {
  return readFileSync(join(RAIZ, caminho), 'utf8');
}
