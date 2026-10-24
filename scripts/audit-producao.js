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
  'GHSA-86w9-cpqp-85rv': {
    pacote: 'node-forge',
    motivo:
      'Verificação de assinatura RSA PKCS#1 v1.5 aceita DigestAlgorithm aninhado ' +
      'extra. Sem versão corrigida publicada (advisory diz "Patched versions: ' +
      'None"; a 1.4.0 é a última e está no range vulnerável <=1.4.0; reconferido em 24/10/2026, ' +
      'após o expo 57.0.31). Chega via ' +
      'expo -> @expo/cli e expo-updates -> @expo/code-signing-certificates, e só ' +
      'é carregado pelos comandos de CLI de code signing do expo-updates ' +
      '(`expo-updates/cli/build/{configure,generate}CodeSigningAsync.js`): é ' +
      'ferramenta de build/dev, não entra no bundle do app. Além disso o ' +
      '`app.config.js` não configura `codeSigningCertificate`, então o app não ' +
      'verifica assinatura de update com essa biblioteca em lugar nenhum.',
    revisarEm: '2026-11-24',
  },
  'GHSA-mrhx-c7xc-m3w5': {
    pacote: 'zod',
    motivo:
      'Consumo de memória ao validar coleção restrita muito grande. Corrigido ' +
      'só no zod 4.6.6; a linha 3 não tem correção. O zod do app já é o 4.6.7. ' +
      'O 3.25.76 vulnerável chega só via expo -> @expo/cli (até a 58.1.9, a ' +
      'mais nova, ainda pede ^3.25.76; reconferido em 24/10/2026), que valida a configuração do próprio ' +
      'projeto no build e no servidor de desenvolvimento: não entra no bundle ' +
      'do app nem recebe entrada de usuário. Forçar o zod 4 por overrides ' +
      'arriscaria quebrar o build (APIs da 3 e da 4 diferem).',
    revisarEm: '2026-11-24',
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
