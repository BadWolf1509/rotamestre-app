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

// Pulo visível do e2e autenticado (Review Focus 1 da branch chore/ci-testes-deps).
// Dependabot e PR de fork nunca recebem secrets. Se o step saísse com `exit 0`,
// o check `Visual Regression (22.x)` apareceria ✓ sem o mapa ter sido aberto.
// O `if:` tem de ficar no JOB, para o check aparecer "Skipped" na lista do PR.
describe('test.yml: e2e autenticado pulado de forma visível', () => {
  const fonte = ler('test.yml').replace(/\r\n/g, '\n');
  // Corpo do job `e2e-auth` (até o próximo job de topo, indentação de 2 espaços).
  const bloco =
    (fonte.match(/^ {2}e2e-auth:\n([\s\S]*?)(?=^ {2}[\w-]+:\n|(?![\s\S]))/m) ??
      [])[1] ?? '';
  const ifDoJob = (bloco.match(/^ {4}if:\s*(.+)$/m) ?? [])[1] ?? '';

  it('existe um job e2e-auth com mapa e suíte completa', () => {
    expect(bloco).toContain('Testes de mapa (autenticados)');
    expect(bloco).toContain('npx playwright test --project=chromium');
  });

  it('o `if:` do job pula Dependabot e fork, sem usar secrets', () => {
    expect(ifDoJob).toContain("github.actor != 'dependabot[bot]'");
    expect(ifDoJob).toContain(
      'github.event.pull_request.head.repo.full_name == github.repository',
    );
    expect(ifDoJob).toContain("github.event.inputs.update_snapshots != 'true'");
    expect(ifDoJob).not.toMatch(/secrets\./);
  });

  it('nenhum step do job sai com exit 0 por falta de secret', () => {
    const codigo = bloco
      .split(String.fromCharCode(10))
      .filter((l) => !l.trim().startsWith('#'))
      .join(String.fromCharCode(10));
    expect(codigo).not.toMatch(/exit 0/);
    expect(codigo).not.toContain('::warning');
    expect(codigo).toContain('exit 1');
  });

  it('o check obrigatório Visual Regression depende do job e falha se ele falhar', () => {
    const visual =
      (fonte.match(/^ {2}visual-regression:\n([\s\S]*)/m) ?? [])[1] ?? '';
    expect(visual).toMatch(/^ {4}needs:\s*e2e-auth\s*$/m);
    expect(visual).toMatch(/^ {4}if:\s*\$\{\{\s*!cancelled\(\)\s*\}\}\s*$/m);
    expect(visual).toContain('needs.e2e-auth.result');
    // o e2e não pode voltar a morar dentro do job obrigatório
    expect(visual).not.toContain('Testes de mapa (autenticados)');
    expect(visual).not.toContain('Suite e2e completa');
  });

  it('preserva o que a branch garantiu: sem `|| true`, timeout, worker e envs do update', () => {
    const semComentarios = fonte
      .split('\n')
      .filter((l) => !l.trim().startsWith('#'))
      .join('\n');
    expect(semComentarios).not.toMatch(/\|\|\s*true/);
    expect((fonte.match(/timeout-minutes:/g) ?? []).length).toBe(4);
    expect(
      (fonte.match(/copy-maplibre-worker\.cjs/g) ?? []).length,
    ).toBeGreaterThanOrEqual(2);
    const update =
      fonte.split('name: Update visual regression snapshots')[1] ?? '';
    expect(update).toContain("VISUAL_REGRESSION: '1'");
    expect(update).toContain('E2E_GESTOR_PASSWORD');
  });
});

// Actions fixadas por SHA de commit (repositório público). Tag móvel (`@v7`)
// deixa quem controla a tag trocar o código que roda com os secrets do job.
// O comentário `# vX.Y.Z` mantém a versão legível e deixa o Dependabot
// atualizar SHA e comentário juntos.
describe.each([
  'test.yml',
  'quality.yml',
  'expire-routes.yml',
  'eas-build-android.yml',
  'update-snapshots.yml',
])('%s: actions fixadas por SHA', (nome) => {
  it('toda linha `uses:` usa SHA de 40 hex e comentário com a versão completa', () => {
    const linhas = ler(nome)
      .split('\n')
      .filter((l) => /^\s*(-\s+)?uses:/.test(l));
    for (const linha of linhas) {
      expect(linha).toMatch(
        /uses:\s*[\w.-]+\/[\w./-]+@[0-9a-f]{40}\s+#\s*v\d+\.\d+\.\d+/,
      );
    }
  });
});

// O corpo da resposta das Edge Functions não vai ao log: o repositório é
// público e o log de Actions é legível por qualquer pessoa. Só contadores.
describe('expire-routes.yml: cron sem corpo de resposta no log público', () => {
  const fonte = ler('expire-routes.yml').replace(/\r\n/g, '\n');
  const executado = fonte
    .split('\n')
    .filter((l) => !l.trim().startsWith('#'))
    .join('\n');

  it('não imprime o corpo da resposta', () => {
    expect(executado).not.toContain('echo "Response: $body"');
    expect(executado).not.toContain('echo "$body"');
  });

  it('cada um dos 3 jobs grava a resposta em arquivo e exige success == true', () => {
    expect((executado.match(/-o resposta\.json/g) ?? []).length).toBe(3);
    expect(
      (executado.match(/jq -e '\.success == true' resposta\.json/g) ?? [])
        .length,
    ).toBe(3);
  });
});
