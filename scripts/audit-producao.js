#!/usr/bin/env node

/**
 * Audit de dependências de produção com allowlist por advisory.
 *
 * Substitui o `npm audit --omit=dev --audit-level=high` cru no CI. O problema do
 * comando cru é que um único advisory sem correção upstream o deixa vermelho para
 * sempre — e um check cronicamente vermelho para de sinalizar qualquer coisa nova.
 * Foi o que aconteceu em 25/08/2026: os advisories do `image-size` (sem versão
 * corrigida publicada) mascaravam a capacidade do audit de avisar sobre um
 * high/critical novo.
 *
 * A allowlist é por ID de advisory, nunca por pacote: um advisory NOVO no mesmo
 * pacote continua quebrando o check. Cada entrada carrega motivo e data de
 * revisão, para não virar tapete.
 *
 * Sai com código 1 se houver high/critical fora da allowlist; 0 caso contrário.
 * Quando roda no GitHub Actions, escreve um resumo em $GITHUB_STEP_SUMMARY.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');

/**
 * Advisories high/critical aceitos conscientemente.
 * Revisar nas datas indicadas — se já houver correção, remover a entrada e subir.
 */
const ACEITOS = {
  'GHSA-w3rx-r6r6-pgpr': {
    pacote: 'image-size',
    motivo:
      'DoS por loop infinito no parser ICNS. Sem versão corrigida publicada ' +
      '(advisory diz "Patched versions: None"; a 2.0.2 é a última e está no ' +
      'range vulnerável <=2.0.2). Chega via react-native -> community-cli-plugin ' +
      '-> metro: é o bundler, ferramenta de build que não vai para o bundle do ' +
      'app. Exploração exigiria uma imagem maliciosa entrar nos assets do repo ' +
      'e alguém rodar o build — trava a build, não atinge usuário final.',
    revisarEm: '2026-11-01',
  },
  'GHSA-5p2g-fcmc-qvqq': {
    pacote: 'image-size',
    motivo:
      'DoS por loop infinito nos parsers JXL e HEIF. Mesma origem, mesma ' +
      'ausência de correção e mesmo alcance limitado a build-time do advisory ' +
      'GHSA-w3rx-r6r6-pgpr.',
    revisarEm: '2026-11-01',
  },
};

const GRAVES = new Set(['high', 'critical']);

function rodarAudit() {
  try {
    return execFileSync(
      'npm',
      ['audit', '--omit=dev', '--json'],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, shell: process.platform === 'win32' },
    );
  } catch (erro) {
    // `npm audit` sai com código != 0 quando encontra vulnerabilidades; o JSON
    // válido vem no stdout mesmo assim. Só é falha real se não houver stdout.
    if (erro.stdout) return erro.stdout;
    throw erro;
  }
}

/**
 * Resolve a cadeia `via` de uma vulnerabilidade até os advisories raiz.
 * Entradas string apontam para outro pacote; objetos são o advisory em si.
 */
function advisoriesRaiz(nome, vulnerabilidades, visitados = new Set()) {
  if (visitados.has(nome)) return [];
  visitados.add(nome);

  const vuln = vulnerabilidades[nome];
  if (!vuln) return [];

  const encontrados = [];
  for (const via of vuln.via || []) {
    if (typeof via === 'string') {
      encontrados.push(...advisoriesRaiz(via, vulnerabilidades, visitados));
    } else if (via && via.url) {
      encontrados.push({ id: via.url.split('/').pop(), titulo: via.title });
    }
  }
  return encontrados;
}

function main() {
  const relatorio = JSON.parse(rodarAudit());
  const vulnerabilidades = relatorio.vulnerabilities || {};

  const bloqueantes = [];
  const aceitos = [];

  for (const [nome, vuln] of Object.entries(vulnerabilidades)) {
    if (!GRAVES.has(vuln.severity)) continue;

    const raizes = advisoriesRaiz(nome, vulnerabilidades);
    if (raizes.length === 0) continue;

    const naoAceitos = raizes.filter((a) => !ACEITOS[a.id]);
    if (naoAceitos.length > 0) {
      bloqueantes.push({ pacote: nome, severidade: vuln.severity, advisories: naoAceitos });
    } else {
      aceitos.push({ pacote: nome, severidade: vuln.severity, advisories: raizes });
    }
  }

  const linhas = [];

  if (bloqueantes.length > 0) {
    linhas.push('### :rotating_light: Vulnerabilidades high/critical em produção');
    linhas.push('');
    for (const b of bloqueantes) {
      linhas.push(`- **${b.pacote}** (${b.severidade})`);
      for (const a of b.advisories) {
        linhas.push(`  - ${a.titulo || a.id} — https://github.com/advisories/${a.id}`);
      }
    }
    linhas.push('');
    linhas.push(
      'Se não houver correção upstream e o risco for aceitável, adicione o ID ' +
        'do advisory a `ACEITOS` em `scripts/audit-producao.js`, com motivo e data de revisão.',
    );
  } else {
    linhas.push('### :white_check_mark: Nenhuma vulnerabilidade high/critical fora da allowlist');
  }

  if (aceitos.length > 0) {
    const vencidos = [];
    linhas.push('');
    linhas.push('<details><summary>Advisories aceitos conscientemente</summary>');
    linhas.push('');
    for (const a of aceitos) {
      for (const adv of a.advisories) {
        const entrada = ACEITOS[adv.id];
        const vencido = entrada.revisarEm < new Date().toISOString().slice(0, 10);
        if (vencido) vencidos.push(adv.id);
        linhas.push(
          `- \`${a.pacote}\` — ${adv.id}${vencido ? ' **(revisão vencida)**' : ` (revisar em ${entrada.revisarEm})`}`,
        );
      }
    }
    linhas.push('');
    linhas.push('</details>');

    if (vencidos.length > 0) {
      linhas.push('');
      linhas.push(
        `> :warning: Revisão vencida para: ${vencidos.join(', ')}. Verifique se já há correção upstream.`,
      );
    }
  }

  const resumo = linhas.join('\n');
  console.log(resumo.replace(/^### /gm, '').replace(/:[a-z_]+:/g, '').trim());

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${resumo}\n`);
  }

  process.exit(bloqueantes.length > 0 ? 1 : 0);
}

main();
