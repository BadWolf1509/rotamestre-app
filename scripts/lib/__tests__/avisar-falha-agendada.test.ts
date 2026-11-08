/**
 * Aviso de falha do agendador (L8-9, 30(e)): uma issue aberta por workflow,
 * com o label `agendador-falhou`. Falha sem issue cria; falha repetida comenta
 * na mesma; sucesso com issue aberta fecha. O octokit aqui é falso e guarda as
 * issues em memória: o que se prova é a lógica de decisão, não o GitHub real.
 */
const {
  avisarFalha,
  LABEL,
  decidirExecucao,
} = require('../avisar-falha-agendada.js');

type Issue = {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: { name: string }[];
  comentarios: string[];
};

function criarOctokitFalso() {
  const issues: Issue[] = [];
  const octokit = {
    rest: {
      issues: {
        createLabel: jest.fn(async (_: { name: string }) => ({ data: {} })),
        listForRepo: jest.fn(
          async ({ labels, state }: { labels: string; state: string }) => ({
            data: issues.filter(
              (i) =>
                i.state === state && i.labels.some((l) => l.name === labels),
            ),
          }),
        ),
        create: jest.fn(
          async ({
            title,
            body,
            labels,
          }: {
            title: string;
            body: string;
            labels: string[];
          }) => {
            const nova: Issue = {
              number: issues.length + 1,
              title,
              body,
              state: 'open',
              labels: labels.map((name) => ({ name })),
              comentarios: [],
            };
            issues.push(nova);
            return { data: { number: nova.number } };
          },
        ),
        createComment: jest.fn(
          async ({
            issue_number,
            body,
          }: {
            issue_number: number;
            body: string;
          }) => {
            issues
              .find((i) => i.number === issue_number)!
              .comentarios.push(body);
            return { data: {} };
          },
        ),
        update: jest.fn(
          async ({
            issue_number,
            state,
          }: {
            issue_number: number;
            state: 'open' | 'closed';
          }) => {
            issues.find((i) => i.number === issue_number)!.state = state;
            return { data: {} };
          },
        ),
      },
    },
  };
  return { octokit, issues };
}

const base = {
  owner: 'org',
  repo: 'app',
  workflow: 'Expire Pending Routes (22:00 BRT)',
  runUrl: 'https://github.com/org/app/actions/runs/123',
  agora: new Date('2026-11-09T01:00:00.000Z'),
};

describe('avisarFalha', () => {
  it('falha sem issue aberta: cria uma, com o label e o nome do workflow no título', async () => {
    const { octokit, issues } = criarOctokitFalso();
    await avisarFalha({ octokit, ...base, falhou: true });

    expect(issues).toHaveLength(1);
    expect(issues[0].state).toBe('open');
    expect(issues[0].title).toContain(base.workflow);
    expect(issues[0].labels.map((l) => l.name)).toEqual([LABEL]);
    expect(issues[0].body).toContain(base.runUrl);
    expect(issues[0].body).toContain('2026-11-09T01:00:00.000Z');
    expect(octokit.rest.issues.createComment).not.toHaveBeenCalled();
  });

  it('duas falhas seguidas: continua uma issue só e a segunda vira comentário', async () => {
    const { octokit, issues } = criarOctokitFalso();
    await avisarFalha({ octokit, ...base, falhou: true });
    await avisarFalha({
      octokit,
      ...base,
      runUrl: 'https://github.com/org/app/actions/runs/124',
      falhou: true,
    });

    expect(issues).toHaveLength(1);
    expect(octokit.rest.issues.create).toHaveBeenCalledTimes(1);
    expect(issues[0].comentarios).toHaveLength(1);
    expect(issues[0].comentarios[0]).toContain('runs/124');
    expect(issues[0].state).toBe('open');
  });

  it('sucesso com issue aberta: comenta a recuperação e fecha', async () => {
    const { octokit, issues } = criarOctokitFalso();
    await avisarFalha({ octokit, ...base, falhou: true });
    await avisarFalha({
      octokit,
      ...base,
      runUrl: 'https://github.com/org/app/actions/runs/125',
      falhou: false,
    });

    expect(issues[0].state).toBe('closed');
    expect(issues[0].comentarios).toHaveLength(1);
    expect(issues[0].comentarios[0]).toContain('runs/125');
  });

  it('sucesso sem issue aberta: não faz nada', async () => {
    const { octokit, issues } = criarOctokitFalso();
    await avisarFalha({ octokit, ...base, falhou: false });

    expect(issues).toHaveLength(0);
    expect(octokit.rest.issues.create).not.toHaveBeenCalled();
    expect(octokit.rest.issues.createComment).not.toHaveBeenCalled();
    expect(octokit.rest.issues.update).not.toHaveBeenCalled();
  });

  it('só olha a issue do próprio workflow: sucesso de outro não comenta nem fecha', async () => {
    const { octokit, issues } = criarOctokitFalso();
    await avisarFalha({
      octokit,
      ...base,
      workflow: 'Remind Pending Routes (16:00 BRT)',
      falhou: true,
    });
    await avisarFalha({ octokit, ...base, falhou: false });

    expect(issues).toHaveLength(1);
    expect(issues[0].state).toBe('open');
    expect(issues[0].comentarios).toHaveLength(0);
  });

  it('depois de fechada, nova falha abre outra issue', async () => {
    const { octokit, issues } = criarOctokitFalso();
    await avisarFalha({ octokit, ...base, falhou: true });
    await avisarFalha({ octokit, ...base, falhou: false });
    await avisarFalha({ octokit, ...base, falhou: true });

    expect(issues).toHaveLength(2);
    expect(issues[1].state).toBe('open');
  });

  it('label que já existe (422) não impede a criação da issue', async () => {
    const { octokit, issues } = criarOctokitFalso();
    octokit.rest.issues.createLabel.mockRejectedValueOnce(
      Object.assign(new Error('already_exists'), { status: 422 }),
    );
    await avisarFalha({ octokit, ...base, falhou: true });
    expect(issues).toHaveLength(1);
  });

  it('erro de label que não é 422 propaga', async () => {
    const { octokit } = criarOctokitFalso();
    octokit.rest.issues.createLabel.mockRejectedValueOnce(
      Object.assign(new Error('proibido'), { status: 403 }),
    );
    await expect(
      avisarFalha({ octokit, ...base, falhou: true }),
    ).rejects.toThrow('proibido');
  });

  it('o texto só carrega nome do job, link da execução e horário', async () => {
    const { octokit, issues } = criarOctokitFalso();
    await avisarFalha({ octokit, ...base, falhou: true });
    await avisarFalha({ octokit, ...base, falhou: true });
    const texto = [issues[0].title, issues[0].body, ...issues[0].comentarios]
      .join('\n')
      .replace(base.workflow, '')
      .replace(new RegExp(base.runUrl, 'g'), '')
      .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, '');
    expect(texto).not.toMatch(/secret|token|payload|x-cron|http_code/i);
  });
});

describe('decidirExecucao', () => {
  it('uma falha entre os jobs: avisa a falha do job que falhou', () => {
    expect(
      decidirExecucao([
        { nome: 'A', resultado: 'skipped' },
        { nome: 'B', resultado: 'failure' },
        { nome: 'C', resultado: 'skipped' },
      ]),
    ).toEqual({ workflow: 'B', falhou: true });
  });

  it('um sucesso e o resto pulado: reporta sucesso daquele job', () => {
    expect(
      decidirExecucao([
        { nome: 'A', resultado: 'success' },
        { nome: 'B', resultado: 'skipped' },
      ]),
    ).toEqual({ workflow: 'A', falhou: false });
  });

  it('tudo pulado ou cancelado: não há o que avisar', () => {
    expect(
      decidirExecucao([
        { nome: 'A', resultado: 'skipped' },
        { nome: 'B', resultado: 'cancelled' },
      ]),
    ).toBeNull();
  });
});
