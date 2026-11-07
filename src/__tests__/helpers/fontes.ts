/**
 * Percurso de arquivos-fonte para as guardas estáticas (testes que leem o
 * código em vez de executá-lo).
 *
 * Existia uma cópia disso em cada guarda, com pequenas diferenças (extensões,
 * pastas ignoradas), e é aí que nasce o defeito "a guarda varre menos do que
 * acha": uma cópia que esquece uma extensão ou uma pasta passa verde. Aqui há
 * um lugar só, e dois freios contra a varredura vazia:
 *
 * - pasta pedida que não existe LANÇA (em vez de listar nada em silêncio);
 * - `exigirVolume` falha quando a lista vem menor que o piso esperado.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { extname, join, relative } from 'path';

/** Raiz do repositório (este arquivo está em `src/__tests__/helpers`). */
export const RAIZ_REPOSITORIO = join(__dirname, '..', '..', '..');

export interface OpcoesFontes {
  /** Pastas a varrer, relativas à raiz do repositório (ex.: `['src', 'app']`). */
  pastas: string[];
  /** Extensões aceitas, com ponto. Padrão: `.ts` e `.tsx`. */
  extensoes?: string[];
  /** Nomes de diretório que não se percorrem. Padrão: `node_modules`, `__tests__`. */
  ignorarDiretorios?: string[];
  /** Inclui `*.test.*` e `*.d.ts`. Padrão: falso (só código de produção). */
  incluirTestesEDts?: boolean;
  /** Raiz a usar no lugar da do repositório (os testes do helper usam uma pasta temporária). */
  raiz?: string;
}

const EXTENSOES_PADRAO = ['.ts', '.tsx'];
const IGNORAR_PADRAO = ['node_modules', '__tests__'];

function percorrer(dir: string, aceitas: Set<string>, ignorar: Set<string>, incluirTestes: boolean): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      return ignorar.has(nome) ? [] : percorrer(caminho, aceitas, ignorar, incluirTestes);
    }
    if (!aceitas.has(extname(nome))) return [];
    if (!incluirTestes && (nome.includes('.test.') || nome.endsWith('.d.ts'))) return [];
    return [caminho];
  });
}

/** Caminhos ABSOLUTOS dos arquivos, em ordem estável. Lança se uma pasta não existe. */
export function listarFontes(opcoes: OpcoesFontes): string[] {
  const raiz = opcoes.raiz ?? RAIZ_REPOSITORIO;
  const aceitas = new Set(opcoes.extensoes ?? EXTENSOES_PADRAO);
  const ignorar = new Set(opcoes.ignorarDiretorios ?? IGNORAR_PADRAO);
  return opcoes.pastas.flatMap((pasta) => {
    const abs = join(raiz, pasta);
    let existe = false;
    try {
      existe = statSync(abs).isDirectory();
    } catch {
      existe = false;
    }
    if (!existe) {
      throw new Error(`listarFontes: a pasta "${pasta}" não existe em ${raiz}; a guarda varreria menos do que deveria`);
    }
    return percorrer(abs, aceitas, ignorar, opcoes.incluirTestesEDts ?? false).sort();
  });
}

/** Caminho relativo à raiz do repositório, com barras normais. */
export function caminhoRelativo(arquivo: string, raiz: string = RAIZ_REPOSITORIO): string {
  return relative(raiz, arquivo).replace(/\\/g, '/');
}

/** Lê cada arquivo listado: `[{ arquivo (relativo), fonte }]`. */
export function lerFontes(opcoes: OpcoesFontes): { arquivo: string; fonte: string }[] {
  const raiz = opcoes.raiz ?? RAIZ_REPOSITORIO;
  return listarFontes(opcoes).map((abs) => ({
    arquivo: caminhoRelativo(abs, raiz),
    fonte: readFileSync(abs, 'utf8'),
  }));
}

/**
 * Freio contra glob vazio: uma guarda do tipo "nenhum arquivo contém X" passa
 * verde numa lista vazia. Chame com o piso (bem abaixo do tamanho real) antes
 * de afirmar a ausência.
 */
export function exigirVolume(lista: readonly unknown[], minimo: number): void {
  if (lista.length < minimo) {
    throw new Error(
      `A varredura achou ${lista.length} arquivo(s), menos que o piso de ${minimo}: a guarda estaria cega, não limpa`,
    );
  }
}
