/**
 * Guarda contra `{rota.distancia_total && (...)}` no JSX.
 *
 * `distancia_total` e `tempo_total` são números. Rota sem distância calculada
 * chega com `0`, e `0 && <View/>` avalia para `0`, que o React Native
 * renderiza como o texto "0" solto na tela (e, no nativo, fora de um <Text>,
 * derruba com "Text strings must be rendered within a <Text>"). O correto é
 * `x != null && x > 0 ? (...) : null`.
 *
 * É estática de propósito: o defeito só aparece com dado zerado, que nenhum
 * teste de tela existente montava. Olha só a forma literal
 * `{<expr>distancia_total|tempo_total &&`; copiar o valor para uma variável
 * antes passa batido.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { extname, join, relative } from 'path';

const RAIZ = join(__dirname, '..', '..', '..');
const DIRETORIOS = ['src', 'app'];

const PADRAO = /\{[^{}\n]*\b(?:distancia_total|tempo_total)\s*&&/;

function achar(codigo: string): string[] {
  return codigo.split('\n').filter((linha) => PADRAO.test(linha));
}

function listarFontes(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    if (nome === '__tests__' || nome === 'node_modules') continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...listarFontes(caminho));
    else if (extname(caminho) === '.tsx') saida.push(caminho);
  }
  return saida;
}

describe('JSX sem && sobre número', () => {
  it('a regex pega a forma errada e ignora a correta', () => {
    expect(achar('{rota.distancia_total && (')).toHaveLength(1);
    expect(achar('{rota?.tempo_total && (')).toHaveLength(1);
    expect(
      achar('{rota.distancia_total != null && rota.distancia_total > 0 ? ('),
    ).toHaveLength(0);
    expect(achar('{rota.distancia_total > 0 && (')).toHaveLength(0);
  });

  it('nenhum && renderiza distancia_total/tempo_total cru', () => {
    const ocorrencias: string[] = [];
    for (const d of DIRETORIOS) {
      for (const arquivo of listarFontes(join(RAIZ, d))) {
        achar(readFileSync(arquivo, 'utf8')).forEach((linha) =>
          ocorrencias.push(`${relative(RAIZ, arquivo)}: ${linha.trim()}`),
        );
      }
    }
    expect(ocorrencias).toEqual([]);
  });
});
