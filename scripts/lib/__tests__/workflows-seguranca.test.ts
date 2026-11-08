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
const lerAcao = (nome: string) =>
  readFileSync(
    join(pasta, '..', 'actions', nome, 'action.yml'),
    'utf8',
  ).replace(/\r\n/g, '\n');

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
  const acao = lerAcao('setup-playwright-web');
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
    // Prazo em cada um dos 4 jobs (indentação de job); passos podem ter o seu.
    expect((fonte.match(/^ {4}timeout-minutes:/gm) ?? []).length).toBe(4);
    // O worker do MapLibre sai de test.yml e mora na composite action, usada
    // pelos dois jobs de Playwright (L8-6); sem ela o mapa web trava.
    expect(
      (
        fonte.match(/uses:\s*\.\/\.github\/actions\/setup-playwright-web/g) ??
        []
      ).length,
    ).toBe(2);
    expect(acao).toContain('copy-maplibre-worker.cjs');
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
])('%s: actions fixadas por SHA', (nome) => {
  it('toda linha `uses:` usa SHA de 40 hex e comentário com a versão completa', () => {
    const linhas = ler(nome)
      .split('\n')
      .filter((l) => /^\s*(-\s+)?uses:/.test(l))
      // composite action do próprio repositório: caminho local, sem SHA
      .filter((l) => !/uses:\s*\.\/\.github\/actions\//.test(l));
    for (const linha of linhas) {
      expect(linha).toMatch(
        /uses:\s*[\w.-]+\/[\w./-]+@[0-9a-f]{40}\s+#\s*v\d+\.\d+\.\d+/,
      );
    }
  });
});

describe('composite actions: actions de terceiros fixadas por SHA', () => {
  it('setup-playwright-web só usa actions com SHA de 40 hex e versão no comentário', () => {
    const linhas = lerAcao('setup-playwright-web')
      .split('\n')
      .filter((l) => /^\s*(-\s+)?uses:/.test(l));
    expect(linhas.length).toBeGreaterThan(0);
    for (const linha of linhas) {
      expect(linha).toMatch(
        /uses:\s*[\w.-]+\/[\w./-]+@[0-9a-f]{40}\s+#\s*v\d+\.\d+\.\d+/,
      );
    }
  });

  it('todo step com run declara o shell (exigência das composite actions)', () => {
    const passos = lerAcao('setup-playwright-web')
      .split(/^ {4}- name:/m)
      .slice(1);
    expect(passos.length).toBeGreaterThan(0);
    for (const passo of passos) {
      if (/^ {6}run:/m.test(passo)) {
        expect(passo).toMatch(/^ {6}shell: bash$/m);
      }
    }
  });
});

// L8-7: o gancho prebuild:web (tsc --noEmit) fica no package.json porque
// Vercel e EAS passam por ele. No CI, quem builda a web já tem o tipo checado
// por outro job (quality.yml), então --ignore-scripts pula só o gancho: o npm
// ainda roda o corpo de build:web.
describe('build:web no CI não repete o tsc do gancho', () => {
  it('o gancho prebuild:web continua no package.json', () => {
    const pacote = JSON.parse(
      readFileSync(join(pasta, '..', '..', 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    expect(pacote.scripts['prebuild:web']).toBe('tsc --noEmit');
  });

  it.each(['test.yml', 'quality.yml'])(
    '%s: todo npm run build:web leva --ignore-scripts',
    (nome) => {
      const comandos = ler(nome)
        .split(/\r?\n/)
        .filter((l) => !l.trim().startsWith('#'))
        .filter((l) => /npm run build:web/.test(l));
      expect(comandos.length).toBeGreaterThan(0);
      for (const c of comandos) {
        expect(c).toMatch(/npm run build:web --ignore-scripts\s*$/);
      }
    },
  );

  it('o job que roda o tsc de fato continua existindo (quality.yml)', () => {
    expect(ler('quality.yml')).toContain('npm run type-check');
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

  it('os 3 jobs chamam o script, que grava a resposta em arquivo e exige success == true', () => {
    expect((executado.match(/scripts\/chamar-edge\.sh/g) ?? []).length).toBe(3);
    const script = readFileSync(
      join(pasta, '..', '..', 'scripts', 'chamar-edge.sh'),
      'utf8',
    );
    expect(script).toMatch(/-o "\$resposta"/);
    expect(script).toContain('jq -e \'.success == true\' "$resposta"');
    expect(script).not.toMatch(/cat "\$resposta"|echo "\$body"/);
  });
});

// Artefato de repositório público é baixável por qualquer conta logada: nada de
// trace, relatório HTML ou error-context (guardam senha digitada e tokens).
describe('test.yml: artefatos de falha só com captura de tela', () => {
  const fonte = ler('test.yml').replace(/\r\n/g, '\n');
  const executado = fonte
    .split('\n')
    .filter((l) => !l.trim().startsWith('#'))
    .join('\n');

  it('nenhum upload leva e2e-report, trace ou a pasta test-results inteira', () => {
    expect(executado).not.toMatch(/^\s+e2e-report\s*$/m);
    expect(executado).not.toMatch(/^\s+test-results\s*$/m);
    expect(executado).not.toMatch(/\.zip|trace/);
  });

  it('o artefato test-results não lista jest-results.json sem comando que o gere', () => {
    const lista = /^\s+jest-results\.json\s*$/m.test(executado);
    const gera = /--outputFile[= ]jest-results\.json/.test(executado);
    expect(lista && !gera).toBe(false);
  });

  it('o e2e autenticado sobe as capturas de tela quando falha', () => {
    expect(executado).toContain('name: e2e-screenshots');
    expect(executado).toContain('path: test-results/**/*.png');
  });

  it('o playwright não grava trace nem vídeo no CI', () => {
    const config = readFileSync(
      join(pasta, '..', '..', 'playwright.config.ts'),
      'utf8',
    );
    expect(config).toMatch(/trace:\s*process\.env\.CI\s*\?\s*'off'/);
    expect(config).toMatch(/video:\s*process\.env\.CI\s*\?\s*'off'/);
  });
});

describe.each(['test.yml', 'quality.yml'])(
  '%s: concurrency e cache',
  (nome) => {
    const fonte = ler(nome).replace(/\r\n/g, '\n');

    it('cancela a execução antiga só em pull_request', () => {
      expect(fonte).toMatch(/^concurrency:/m);
      expect(fonte).toMatch(
        /cancel-in-progress:\s*\$\{\{\s*github\.event_name == 'pull_request'\s*\}\}/,
      );
    });

    it('não cacheia node_modules (o npm ci o apaga); o cache é do setup-node', () => {
      expect(fonte).not.toMatch(/^\s+node_modules\s*$/m);
      expect(fonte).toContain("cache: 'npm'");
    });
  },
);

// Agendador endurecido (L8-9, 30(e)): cada job tem teto de tempo, a chamada às
// Edge Functions passa pelo script único (curl com --max-time) e só o job que
// avisa a falha escreve em issues.
describe('expire-routes.yml: agendador endurecido', () => {
  const fonte = ler('expire-routes.yml').replace(/\r\n/g, '\n');
  const bloco = (id: string) =>
    (fonte.match(
      new RegExp(
        String.raw`^ {2}${id}:\n([\s\S]*?)(?=^ {2}[\w-]+:\n|(?![\s\S]))`,
        'm',
      ),
    ) ?? [])[1] ?? '';
  const jobsDeChamada = [
    'remind-routes',
    'final-warning-routes',
    'expire-routes',
  ];

  it.each(jobsDeChamada)('%s: timeout de 5 min e chamada pelo script', (id) => {
    const corpo = bloco(id);
    expect(corpo).toMatch(/^ {4}timeout-minutes:\s*5\s*$/m);
    expect(corpo).toContain('scripts/chamar-edge.sh');
    expect(corpo).not.toMatch(/\bcurl\b/);
    expect(corpo).not.toMatch(/issues:\s*write/);
  });

  it('o script usa --max-time 60 e confere success com jq', () => {
    const script = readFileSync(
      join(pasta, '..', '..', 'scripts', 'chamar-edge.sh'),
      'utf8',
    );
    expect(script).toMatch(/--max-time 60/);
    expect(script).toContain("jq -e '.success == true'");
  });

  it('avisar-falha: roda sempre, depois dos três jobs, com issues: write só nele', () => {
    const corpo = bloco('avisar-falha');
    expect(corpo).toMatch(/^ {4}if:\s*always\(\)\s*$/m);
    expect(corpo).toMatch(/^ {4}timeout-minutes:\s*5\s*$/m);
    expect(corpo).toMatch(
      /needs:\s*\[remind-routes, final-warning-routes, expire-routes\]/,
    );
    expect(corpo).toMatch(/^ {6}issues:\s*write\s*$/m);
    expect(corpo).toContain('scripts/lib/avisar-falha-agendada.js');
    const semComentario = fonte
      .split('\n')
      .filter((l) => !l.trim().startsWith('#'))
      .join('\n');
    expect(semComentario.match(/issues:\s*write/g)).toHaveLength(1);
  });
});
