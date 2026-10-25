/**
 * Guarda da CLASSE "confirmação não destrutiva com lixeira".
 *
 * `type: 'danger'` sem `icon` próprio desenha a lixeira (`ICON_MAP.danger`,
 * ver `getIconName.test.ts`) — certo para excluir, errado para tudo o mais.
 * O SOS do motorista saiu com a lixeira (teste no aparelho, 25/10/2026), e
 * sair da conta, cancelar rota e restaurar padrões tinham o mesmo defeito.
 *
 * Regra: toda confirmação `danger` (variante `confirm`) ou passa `icon`, ou
 * é de fato remoção — o botão diz Excluir/Remover/Limpar. A vitrine do design
 * system (`app/design-system.tsx`) mostra os padrões de propósito e fica fora.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const RAIZ = join(__dirname, '..', '..', '..', '..');
const PASTAS = ['app', 'src'];
const FORA = new Set(['app/design-system.tsx']);
const REMOCAO = /confirmText[=:]\s*\{?\s*['"](Excluir|Remover|Sim, remover|Limpar)/;

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      return nome === '__tests__' || nome === 'node_modules'
        ? []
        : arquivos(caminho);
    }
    return /\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

/** Bloco que contém a posição: o `<Dialog ... />` ou o `showConfirm({ ... })`. */
function blocoDe(fonte: string, pos: number): string | null {
  const inicioJsx = fonte.lastIndexOf('<Dialog', pos);
  const inicioObj = fonte.lastIndexOf('showConfirm(', pos);
  const inicio = Math.max(inicioJsx, inicioObj);
  if (inicio < 0) return null;
  const fim =
    inicio === inicioJsx ? fonte.indexOf('/>', pos) : fonte.indexOf('})', pos);
  if (fim < 0) return null;
  const bloco = fonte.slice(inicio, fim);
  // Outro bloco entre o início achado e o `danger` = não é deste.
  if (inicio === inicioJsx && bloco.slice(0, pos - inicio).includes('/>')) {
    return null;
  }
  return bloco;
}

function confirmacoesDangerSemIcone(): string[] {
  const achados: string[] = [];
  for (const pasta of PASTAS) {
    for (const arquivo of arquivos(join(RAIZ, pasta))) {
      const rel = relative(RAIZ, arquivo).replace(/\\/g, '/');
      if (FORA.has(rel)) continue;
      const fonte = readFileSync(arquivo, 'utf8');
      const padrao = /type(=|:\s*)["']danger["']/g;
      let m: RegExpExecArray | null;
      while ((m = padrao.exec(fonte)) !== null) {
        const bloco = blocoDe(fonte, m.index);
        if (!bloco) continue;
        const ehJsx = bloco.startsWith('<Dialog');
        if (ehJsx && !/variant="confirm"/.test(bloco)) continue;
        if (/\bicon[=:]/.test(bloco)) continue;
        if (REMOCAO.test(bloco)) continue;
        const linha = fonte.slice(0, m.index).split('\n').length;
        achados.push(`${rel}:${linha}`);
      }
    }
  }
  return achados;
}

describe('confirmação danger não destrutiva', () => {
  it('passa um ícone próprio em vez de herdar a lixeira', () => {
    expect(confirmacoesDangerSemIcone()).toEqual([]);
  });
});
