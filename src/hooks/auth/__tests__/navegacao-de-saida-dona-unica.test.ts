/**
 * Guarda estática do R-NUC-1: nas áreas que exigem sessão e nos componentes e
 * hooks compartilhados, ninguém navega para o login além da dona
 * (`useNavegacaoDeSaida`, montada no layout raiz). Um `replace` a mais por
 * saída é o que a pendência 33 somava: até 4 no mesmo instante.
 *
 * Fora daqui ficam as telas públicas (`app/auth`, `app/onboarding`,
 * `app/index.tsx`, exclusão de conta), que não estão sob a dona.
 */
import fs from 'fs';
import path from 'path';

const RAIZ = path.resolve(__dirname, '../../../..');

const PASTAS = [
  'src/components',
  'src/hooks',
  'src/context',
  'app/gestor',
  'app/motorista',
  'app/perfil',
  'app/unidade',
];

/** Quem pode, e por quê. */
const PERMITIDOS: Record<string, string> = {
  'src/hooks/auth/useNavegacaoDeSaida.ts': 'a dona',
  // Páginas públicas (sem sessão): "voltar" sem histórico cai no login.
  'src/components/legal/LegalPage.tsx': 'página pública',
  'src/components/testar/TesterRecruitmentScreen.tsx': 'página pública',
};

const NAVEGA_AO_LOGIN = /\.(replace|push|navigate)\(\s*['"`]\/auth\/login/;

function arquivos(dir: string): string[] {
  const abs = path.join(RAIZ, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : arquivos(rel);
    return /\.(ts|tsx)$/.test(e.name) ? [rel] : [];
  });
}

describe('navegação de saída com uma só dona (R-NUC-1)', () => {
  it('a varredura enxerga arquivos (não passa por cegueira)', () => {
    expect(arquivos('src/hooks').length).toBeGreaterThan(50);
    expect(arquivos('src/hooks')).toContain(
      'src/hooks/auth/useNavegacaoDeSaida.ts',
    );
  });

  it('a dona navega ao login (o padrão casa com o código dela)', () => {
    const fonte = fs.readFileSync(
      path.join(RAIZ, 'src/hooks/auth/useNavegacaoDeSaida.ts'),
      'utf8',
    );
    expect(fonte).toMatch(NAVEGA_AO_LOGIN);
  });

  it('nenhum outro ponto das áreas com sessão navega ao login', () => {
    // Linha de comentário que cita o replace (como a de useGeracaoDaConta)
    // não navega.
    const navega = (rel: string) =>
      fs
        .readFileSync(path.join(RAIZ, rel), 'utf8')
        .split(/\r?\n/)
        .some(
          (linha) =>
            !/^\s*(\/\/|\*|\/\*)/.test(linha) && NAVEGA_AO_LOGIN.test(linha),
        );
    const fora = PASTAS.flatMap(arquivos).filter(
      (rel) => !(rel in PERMITIDOS) && navega(rel),
    );
    expect(fora).toEqual([]);
  });
});
