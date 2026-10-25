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
  'suas informacoes',
  // Com maiúscula inicial: a lista é sensível a caixa, e 'Suas informacoes'
  // (minor adiado da 1.14.5) passava por 'suas informacoes'.
  'Suas informacoes',
  'Ja tem uma conta',
  'Faca login',
  // Troca de senha do gestor (AN11).
  'Senha media',
  'Senha valida',
  'Minimo de',
  'Letra maiuscula',
  'Letra minuscula',
  'Requisitos de Seguranca',
  '- Minimo de',
  'letra maiuscula',
  'letra minuscula',
  'Pelo menos 1 numero',
  'podem ter vinculos',
  'esta vinculada',
  'Dependencia circular',
  'para uma rota e ${',
  'e ${parada.tipo}',
];

/**
 * Palavras curtas que também são pedaço de identificador (`numeroParada`):
 * só valem como a linha inteira de um texto JSX ou como string literal.
 */
const FORMAS_EM_REGEX: Array<[string, RegExp]> = [
  ['Numero (texto de tela)', /^\s*Numero\s*$|['"`]Numero['"`]/],
];

/** O que, numa linha de código, é texto sem acento conhecido. */
export function formasSemAcentoNaLinha(linha: string): string[] {
  // Comentário não é texto de tela.
  if (/^\s*(\/\/|\*|\/\*)/.test(linha)) return [];
  return [
    ...FORMAS_SEM_ACENTO.filter((forma) => linha.includes(forma)),
    ...FORMAS_EM_REGEX.filter(([, re]) => re.test(linha)).map(([n]) => n),
  ];
}

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
            for (const forma of formasSemAcentoNaLinha(linha)) {
              violacoes.push(
                `${relative(RAIZ, arquivo)}:${i + 1} -> "${forma}"`,
              );
            }
          });
      }
    }
    expect(violacoes).toEqual([]);
  });

  it('a guarda reconhece as formas sem acento da troca de senha e do "Suas informacoes"', () => {
    const exemplos = [
      '<Text>Senha media</Text>',
      "message: 'Senha valida'",
      "{ texto: 'Minimo de 8 caracteres' }",
      '  Letra maiuscula',
      '  Letra minuscula',
      '                Numero',
      "texto: 'Numero'",
      '<Text>Suas informacoes foram salvas</Text>',
      'Ja tem uma conta? Faca login',
    ];
    for (const linha of exemplos) {
      expect({ linha, achou: formasSemAcentoNaLinha(linha).length > 0 }).toEqual(
        { linha, achou: true },
      );
    }
    // Identificador e forma com acento passam.
    for (const linha of [
      'const numeroParada = 3;',
      '<Text>Senha média</Text>',
      '<Text>Suas informações foram salvas</Text>',
    ]) {
      expect(formasSemAcentoNaLinha(linha)).toEqual([]);
    }
  });

  it('a varredura enxerga a troca de senha do gestor (não é cega)', () => {
    const arquivos = listarFontes(join(RAIZ, 'app')).map((a) =>
      relative(RAIZ, a).split(sep).join('/'),
    );
    expect(arquivos).toContain('app/perfil/trocar-senha.tsx');
  });

  it('a varredura enxerga o arquivo de notificações (não é cega)', () => {
    const arquivos = listarFontes(join(RAIZ, 'src')).map((a) =>
      relative(RAIZ, a).split(sep).join('/'),
    );
    expect(arquivos).toContain('src/lib/notifications.ts');
  });
});
