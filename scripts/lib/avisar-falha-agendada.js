#!/usr/bin/env node

/**
 * Aviso de falha do agendador (L8-9, 30(e)). O cron do GitHub Actions falha em
 * silêncio: o job fica vermelho numa aba que ninguém abre, e o lembrete ou a
 * expiração não acontece. Aqui a falha vira uma issue.
 *
 * Regra, por nome de job agendado, com o label `agendador-falhou`:
 *   - falhou e não há issue aberta  -> cria uma;
 *   - falhou e já há issue aberta   -> comenta nela (não abre outra);
 *   - passou e há issue aberta      -> comenta a recuperação e fecha;
 *   - passou e não há issue         -> nada.
 *
 * O repositório é público: o texto leva só o nome do job, o link da execução e
 * o horário. Nunca resposta da função, segredo ou cabeçalho.
 *
 * Por que `gh` e não `actions/github-script`: o repositório não usa essa
 * action (toda `uses:` é fixada por SHA e cada uma nova é superfície a mais
 * para manter), e o `gh` já vem no runner. O adaptador abaixo expõe o mesmo
 * formato do octokit (`octokit.rest.issues.*`), então a lógica é a mesma e o
 * teste a prova com um octokit falso.
 *
 * Uso (no CI): GH_TOKEN e GITHUB_REPOSITORY no ambiente;
 *   node scripts/lib/avisar-falha-agendada.js <url-da-execucao> "<job>=<resultado>" ...
 * `resultado` é o `needs.<job>.result` (success, failure, skipped, cancelled).
 */

const { execFileSync } = require('child_process');

const LABEL = 'agendador-falhou';
const PREFIXO_TITULO = 'Agendador falhou: ';

function tituloDe(workflow) {
  return `${PREFIXO_TITULO}${workflow}`;
}

function horario(agora) {
  return agora.toISOString();
}

function corpoDaFalha({ workflow, runUrl, agora }) {
  return [
    `O job agendado **${workflow}** falhou.`,
    '',
    `- Execução: ${runUrl}`,
    `- Horário: ${horario(agora)}`,
  ].join('\n');
}

async function garantirLabel({ octokit, owner, repo }) {
  try {
    await octokit.rest.issues.createLabel({
      owner,
      repo,
      name: LABEL,
      color: 'b60205',
      description: 'Job agendado do GitHub Actions falhou',
    });
  } catch (erro) {
    // 422 = o label já existe: é o caso normal depois da primeira vez.
    if (!erro || erro.status !== 422) throw erro;
  }
}

async function acharIssueAberta({ octokit, owner, repo, workflow }) {
  const { data } = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    labels: LABEL,
    state: 'open',
    per_page: 100,
  });
  return data.find((issue) => issue.title === tituloDe(workflow)) || null;
}

/**
 * @param {{ octokit: object, owner: string, repo: string, workflow: string,
 *           runUrl: string, falhou: boolean, agora?: Date }} p
 */
async function avisarFalha({ octokit, owner, repo, workflow, runUrl, falhou, agora = new Date() }) {
  const aberta = await acharIssueAberta({ octokit, owner, repo, workflow });

  if (falhou) {
    const corpo = corpoDaFalha({ workflow, runUrl, agora });
    if (aberta) {
      await octokit.rest.issues.createComment({ owner, repo, issue_number: aberta.number, body: corpo });
      return;
    }
    await garantirLabel({ octokit, owner, repo });
    await octokit.rest.issues.create({ owner, repo, title: tituloDe(workflow), body: corpo, labels: [LABEL] });
    return;
  }

  if (!aberta) return;
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: aberta.number,
    body: [
      `O job agendado **${workflow}** voltou a passar; fechando.`,
      '',
      `- Execução: ${runUrl}`,
      `- Horário: ${horario(agora)}`,
    ].join('\n'),
  });
  await octokit.rest.issues.update({ owner, repo, issue_number: aberta.number, state: 'closed' });
}

/**
 * Num disparo roda um só dos jobs agendados; os outros ficam `skipped`.
 * Falha de qualquer um vence; sem falha, vale o primeiro sucesso. Tudo
 * pulado/cancelado: não há o que avisar (devolve null).
 */
function decidirExecucao(jobs) {
  const falhou = jobs.find((j) => j.resultado === 'failure');
  if (falhou) return { workflow: falhou.nome, falhou: true };
  const passou = jobs.find((j) => j.resultado === 'success');
  if (passou) return { workflow: passou.nome, falhou: false };
  return null;
}

/** Adaptador mínimo com o formato do octokit, em cima do `gh api`. */
function criarOctokitGh() {
  const chamar = (metodo, caminho, corpo) => {
    const args = ['api', '--method', metodo, caminho];
    const opcoes = { encoding: 'utf8' };
    if (corpo !== undefined) {
      args.push('--input', '-');
      opcoes.input = JSON.stringify(corpo);
    }
    let saida;
    try {
      saida = execFileSync('gh', args, opcoes);
    } catch (erro) {
      // `gh` sai com erro em 4xx; o texto do erro traz o status, sem o corpo enviado.
      const texto = `${erro.stderr || ''}${erro.stdout || ''}`;
      const achado = /HTTP (\d{3})/.exec(texto);
      const falha = new Error(`gh api ${metodo} ${caminho} falhou`);
      falha.status = achado ? Number(achado[1]) : undefined;
      throw falha;
    }
    return { data: saida.trim() ? JSON.parse(saida) : {} };
  };
  const base = (owner, repo) => `repos/${owner}/${repo}`;
  return {
    rest: {
      issues: {
        createLabel: ({ owner, repo, ...corpo }) => chamar('POST', `${base(owner, repo)}/labels`, corpo),
        listForRepo: ({ owner, repo, labels, state, per_page }) =>
          chamar(
            'GET',
            `${base(owner, repo)}/issues?labels=${encodeURIComponent(labels)}&state=${state}&per_page=${per_page}`,
          ),
        create: ({ owner, repo, ...corpo }) => chamar('POST', `${base(owner, repo)}/issues`, corpo),
        createComment: ({ owner, repo, issue_number, body }) =>
          chamar('POST', `${base(owner, repo)}/issues/${issue_number}/comments`, { body }),
        update: ({ owner, repo, issue_number, ...corpo }) =>
          chamar('PATCH', `${base(owner, repo)}/issues/${issue_number}`, corpo),
      },
    },
  };
}

async function main() {
  const [runUrl, ...pares] = process.argv.slice(2);
  const [owner, repo] = (process.env.GITHUB_REPOSITORY || '').split('/');
  if (!runUrl || !owner || !repo || pares.length === 0) {
    console.error('Uso: avisar-falha-agendada.js <url-da-execucao> "<job>=<resultado>" ... (com GITHUB_REPOSITORY)');
    process.exit(2);
  }
  const jobs = pares.map((par) => {
    const i = par.lastIndexOf('=');
    return { nome: par.slice(0, i), resultado: par.slice(i + 1) };
  });
  const decisao = decidirExecucao(jobs);
  if (!decisao) {
    console.log('Nenhum job agendado concluiu nesta execução; nada a avisar.');
    return;
  }
  await avisarFalha({ octokit: criarOctokitGh(), owner, repo, runUrl, ...decisao });
  console.log(decisao.falhou ? 'Falha registrada na issue do agendador.' : 'Sucesso registrado; issue aberta (se havia) fechada.');
}

if (require.main === module) {
  main().catch((erro) => {
    console.error(`Aviso do agendador falhou: ${erro.message}`);
    process.exit(1);
  });
}

module.exports = { avisarFalha, decidirExecucao, LABEL, tituloDe };
