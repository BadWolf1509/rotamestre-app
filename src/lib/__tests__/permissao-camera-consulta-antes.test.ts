/**
 * Guarda da CLASSE: todo pedido de câmera/galeria consulta antes de pedir.
 *
 * No Android, `request…PermissionsAsync` abre a activity de permissão do
 * sistema mesmo com a permissão já concedida — o app vai a segundo plano por
 * um instante (CLAUDE.md, "Permissão no Android: consulte antes de pedir";
 * #570). `pedirPermissao(request, get)` só pede quando falta; sem o `get`, ele
 * pede sempre. Este teste lê o código de produção e exige, em cada arquivo
 * que pede câmera ou galeria, a consulta correspondente.
 */
import fs from 'fs';
import path from 'path';

const RAIZ = path.resolve(__dirname, '..', '..', '..');

function arquivosDeProducao(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of fs.readdirSync(dir, { withFileTypes: true })) {
    const caminho = path.join(dir, nome.name);
    if (nome.isDirectory()) {
      if (nome.name === '__tests__' || nome.name === 'node_modules') continue;
      saida.push(...arquivosDeProducao(caminho));
    } else if (/\.(ts|tsx)$/.test(nome.name) && !/\.test\./.test(nome.name)) {
      saida.push(caminho);
    }
  }
  return saida;
}

const PARES = [
  ['requestCameraPermissionsAsync', 'getCameraPermissionsAsync'],
  ['requestMediaLibraryPermissionsAsync', 'getMediaLibraryPermissionsAsync'],
] as const;

const contar = (texto: string, termo: string) => texto.split(termo).length - 1;

describe('câmera e galeria: consultar antes de pedir', () => {
  const arquivos = [
    ...arquivosDeProducao(path.join(RAIZ, 'src')),
    ...arquivosDeProducao(path.join(RAIZ, 'app')),
  ];

  it('a varredura enxerga os arquivos que pedem câmera (não está cega)', () => {
    const quemPede = arquivos.filter((f) =>
      fs.readFileSync(f, 'utf8').includes('requestCameraPermissionsAsync'),
    );
    expect(quemPede.length).toBeGreaterThanOrEqual(3);
  });

  it.each(PARES)('cada %s vem acompanhado de %s', (pedido, consulta) => {
    const faltando = arquivos
      .map((f) => {
        const texto = fs.readFileSync(f, 'utf8');
        return {
          arquivo: path.relative(RAIZ, f),
          pedidos: contar(texto, pedido),
          consultas: contar(texto, consulta),
        };
      })
      .filter((r) => r.pedidos > r.consultas);
    expect(faltando).toEqual([]);
  });
});
