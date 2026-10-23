// Guarda dos workflows do GitHub Actions (repositório público).
//
// - `permissions: contents: read` no topo: sem isso o GITHUB_TOKEN de cada job
//   herda o padrão do repositório, que pode ser escrita. Nenhum job destes
//   precisa de mais que leitura (codecov usa CODECOV_TOKEN, não OIDC; os
//   artefatos não pedem permissão).
// - `eas-cli` com versão exata: `@latest` executa, com o EXPO_TOKEN no
//   ambiente, a versão que for publicada no npm no dia do build.
// - `concurrency` no cron da expiração: dois disparos simultâneos (agendado +
//   manual) não podem expirar/avisar em dobro.
import { readFileSync } from 'fs';
import { join } from 'path';

const pasta = join(__dirname, '..', '..', '..', '.github', 'workflows');
const ler = (nome: string) => readFileSync(join(pasta, nome), 'utf8');

describe.each(['test.yml', 'quality.yml', 'expire-routes.yml'])(
  '%s',
  (nome) => {
    it('declara permissions: contents: read no topo', () => {
      expect(ler(nome)).toMatch(/^permissions:\s*\n\s+contents:\s*read\s*$/m);
    });
  },
);

describe('eas-build-android.yml', () => {
  it('executa o eas-cli com versão exata, nunca @latest', () => {
    const linhasExecutadas = ler('eas-build-android.yml')
      .split('\n')
      .filter((l) => /eas-cli@/.test(l) && !l.trim().startsWith('#'));
    expect(linhasExecutadas.length).toBeGreaterThan(0);
    for (const linha of linhasExecutadas) {
      expect(linha).toMatch(/eas-cli@\d+\.\d+\.\d+\b/);
    }
  });
});

describe('expire-routes.yml', () => {
  it('tem concurrency sem cancelar a execução em andamento', () => {
    const fonte = ler('expire-routes.yml');
    expect(fonte).toMatch(/^concurrency:/m);
    expect(fonte).toMatch(/cancel-in-progress:\s*false/);
  });
});
