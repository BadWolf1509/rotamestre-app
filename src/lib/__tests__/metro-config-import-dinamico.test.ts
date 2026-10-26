/**
 * Guarda: no web, o `import()` dinâmico depende do módulo async-require do
 * Metro. Se o metro.config.js o resolver como módulo vazio, o build passa, o
 * chunk sai separado e o size-limit fica verde — mas, em produção, todo
 * `import()` falha com "require(...) is not a function" (a exportação de PDF e
 * XLSX caiu assim). Esta guarda pergunta ao resolver do próprio config.
 */
import path from 'path';

type Resolucao = { type: string; filePath?: string };
type Resolver = (
  contexto: { resolveRequest: (...args: unknown[]) => Resolucao },
  nome: string,
  plataforma: string | null,
) => Resolucao;

const RESOLVIDO: Resolucao = {
  type: 'sourceFile',
  filePath: '/x/async-require.js',
};

// O config de verdade do Expo é ESM e não carrega no Jest; o que se testa aqui
// é só o que o metro.config.js deste repo acrescenta por cima dele.
jest.mock('expo/metro-config', () => ({
  getDefaultConfig: () => ({ resolver: { assetExts: [] }, transformer: {} }),
}));

function resolverDoConfig(): Resolver | undefined {
  const config = require(path.join(__dirname, '../../../metro.config.js'));
  return config.resolver?.resolveRequest;
}

describe('metro.config.js e o import() dinâmico no web', () => {
  it.each([
    '@expo/metro-runtime/async-require',
    'expo/src/async-require/index',
    './async-require',
  ])('não troca %s por módulo vazio no web', (nome) => {
    const resolver = resolverDoConfig();
    if (!resolver) return; // sem resolver próprio, vale o padrão do Metro
    const contexto = { resolveRequest: jest.fn(() => RESOLVIDO) };
    const resultado = resolver(contexto, nome, 'web');
    expect(resultado.type).not.toBe('empty');
  });
});
