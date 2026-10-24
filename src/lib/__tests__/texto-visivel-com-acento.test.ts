/**
 * Guarda contra texto visível ao usuário sem acento.
 *
 * Em 24/10/2026 a notificação local de modo offline saiu como "Voce esta sem
 * conexao. As acoes serao sincronizadas...". Não há como testar acento em
 * runtime sem listar cada string, então a guarda é estática e **curada**: uma
 * lista de formas sem acento que já apareceram em texto de tela/notificação,
 * varrida em `src` e `app`. Não é um corretor ortográfico — só impede a volta
 * das formas conhecidas. Palavra nova sem acento passa batido: ao achar uma,
 * acrescente a forma em `FORMAS_SEM_ACENTO`.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { extname, join, relative, sep } from 'path';

const RAIZ = join(__dirname, '..', '..', '..');
const FORMAS_SEM_ACENTO = [
  'Voce ',
  'voce ',
  'Parabens',
  'Rota Concluida!',
  'esta sem conexao',
  'acoes serao',
  'a conexao for',
  'sera redirecionado',
  'area de ${',
  'Nao foi possivel',
  'nao pode ser alterado',
  'Campo obrigatorio',
  'e obrigatorio',
  'suas estatisticas',
  'esta proxima do limite',
  'nao tem coordenadas validas',
  'uma retirada, nao a',
  'Por seguranca',
  'senhas nao coincidem',
  'senha unica',
  'senha sera usada',
];

function listarFontes(dir: string): string[] {
  const achados: string[] = [];
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome === '__tests__') continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      achados.push(...listarFontes(caminho));
    } else if (
      ['.ts', '.tsx'].includes(extname(nome)) &&
      !nome.includes('.test.')
    ) {
      achados.push(caminho);
    }
  }
  return achados;
}

describe('texto visível ao usuário leva acento', () => {
  it('nenhuma forma sem acento conhecida volta para src/ ou app/', () => {
    const violacoes: string[] = [];
    for (const dir of ['src', 'app']) {
      for (const arquivo of listarFontes(join(RAIZ, dir))) {
        readFileSync(arquivo, 'utf8')
          .split('\n')
          .forEach((linha, i) => {
            // Comentário não é texto de tela.
            if (/^\s*(\/\/|\*|\/\*)/.test(linha)) return;
            for (const forma of FORMAS_SEM_ACENTO) {
              if (linha.includes(forma)) {
                violacoes.push(
                  `${relative(RAIZ, arquivo)}:${i + 1} -> "${forma}"`,
                );
              }
            }
          });
      }
    }
    expect(violacoes).toEqual([]);
  });

  it('a varredura enxerga o arquivo de notificações (não é cega)', () => {
    const arquivos = listarFontes(join(RAIZ, 'src')).map((a) =>
      relative(RAIZ, a).split(sep).join('/'),
    );
    expect(arquivos).toContain('src/lib/notifications.ts');
  });
});
