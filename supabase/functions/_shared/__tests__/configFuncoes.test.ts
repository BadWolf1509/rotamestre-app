// Guarda do deploy das Edge Functions.
//
// Desde 22/10/2026 todas rodam sem `verify_jwt` (ele só entende o JWT antigo,
// desligado) e cada uma autoriza por dentro. Um `functions deploy <fn>` sem
// `--no-verify-jwt` religa o `verify_jwt` — e a função passa a recusar toda
// chamada legítima. A proteção é declarar `verify_jwt = false` no config.toml
// para CADA função: o CLI lê o arquivo e a flag deixa de ser memória de quem
// publica. Função nova sem a entrada quebra este teste.
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const pastaFuncoes = join(__dirname, '..', '..');
const config = readFileSync(join(pastaFuncoes, '..', 'config.toml'), 'utf8');

const funcoes = readdirSync(pastaFuncoes).filter(
  (nome) =>
    !nome.startsWith('_') &&
    !nome.startsWith('.') &&
    statSync(join(pastaFuncoes, nome)).isDirectory(),
);

describe('config.toml: verify_jwt explícito por função', () => {
  it('acha as funções', () => {
    expect(funcoes.length).toBeGreaterThan(0);
  });

  it.each(funcoes)('%s tem [functions.<nome>] verify_jwt = false', (nome) => {
    const bloco = new RegExp(
      `^\\[functions\\.${nome.replace(/-/g, '\\-')}\\]\\s*\\n(?:[^\\[\\n].*\\n)*?verify_jwt\\s*=\\s*false`,
      'm',
    );
    expect(config).toMatch(bloco);
  });

  it('não declara função que não existe', () => {
    const declaradas = [...config.matchAll(/^\[functions\.([\w-]+)\]/gm)].map(
      (m) => m[1],
    );
    for (const nome of declaradas) {
      expect(funcoes).toContain(nome);
    }
  });
});

describe('funções Google mortas', () => {
  // google-directions e google-distance-matrix não tinham chamador no app
  // (o roteamento é OSRM) e eram proxies abertos da chave Google.
  it.each(['google-directions', 'google-distance-matrix'])(
    '%s não existe mais no repositório',
    (nome) => {
      expect(existsSync(join(pastaFuncoes, nome))).toBe(false);
    },
  );

  it('o app não chama google-distance-matrix', () => {
    const web = readFileSync(
      join(pastaFuncoes, '..', '..', 'src', 'lib', 'google.web.ts'),
      'utf8',
    );
    expect(web).not.toContain('google-distance-matrix');
  });

  it('deploy.sh não volta (publicava criar-motorista com verify_jwt e sem --project-ref)', () => {
    // Com o config.toml declarando verify_jwt por função, o comando é um só:
    // npx supabase functions deploy <fn> --no-verify-jwt --project-ref xezslsyxjivunmhhyxtd
    expect(existsSync(join(pastaFuncoes, 'deploy.sh'))).toBe(false);
  });
});
