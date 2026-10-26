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
 * Sai com código 1 se houver high/critical fora da allowlist OU revisão vencida;
 * com 2 se o npm audit não devolver um relatório válido (registro fora do ar:
 * sem relatório não há veredito); 0 caso contrário.
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

/** Dias de antecedência com que o resumo avisa que uma revisão vai vencer. */
const DIAS_DE_AVISO = 14;

const ESPERA_ENTRE_TENTATIVAS_MS = 5000;
const TENTATIVAS = 2;

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
 * Confere se a saída do `npm audit --json` é um RELATÓRIO. Quando o registro
 * falha (instabilidade, rate limit, DNS), o npm devolve só `{message, error}`,
 * sem `vulnerabilities`: tratar isso como "nenhuma vulnerabilidade" deixaria um
 * advisory novo passar no dia em que o registro estivesse ruim.
 *
 * Devolve `null` quando o relatório é válido, ou o motivo da recusa.
 */
function motivoDeRelatorioInvalido(relatorio) {
  if (!relatorio || typeof relatorio !== 'object') {
    return 'a saída do npm audit não é um objeto JSON';
  }
  if (relatorio.error) {
    const detalhe = relatorio.error.summary || relatorio.error.code || relatorio.message || '';
    return `o npm audit devolveu erro${detalhe ? `: ${detalhe}` : ''}`;
  }
  if (!relatorio.vulnerabilities || typeof relatorio.vulnerabilities !== 'object') {
    return 'o relatório não traz `vulnerabilities`';
  }
  if (!relatorio.metadata || typeof relatorio.metadata !== 'object') {
    return 'o relatório não traz `metadata`';
  }
  return null;
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

/** Diferença em dias inteiros entre duas datas ISO `AAAA-MM-DD` (b - a). */
function diasEntre(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/**
 * Classifica o relatório. Pura: recebe o relatório, a allowlist e o "hoje"
 * (ISO) para ser testável sem rede e sem relógio.
 */
function analisar(relatorio, aceitosPermitidos, hoje) {
  const vulnerabilidades = relatorio.vulnerabilities;
  const bloqueantes = [];
  const aceitos = [];
  const idsVistos = new Set();

  for (const [nome, vuln] of Object.entries(vulnerabilidades)) {
    // Para a limpeza da allowlist, conta qualquer advisory que ainda case,
    // da gravidade que for.
    for (const a of advisoriesRaiz(nome, vulnerabilidades)) idsVistos.add(a.id);

    if (!GRAVES.has(vuln.severity)) continue;

    const raizes = advisoriesRaiz(nome, vulnerabilidades);
    if (raizes.length === 0) continue;

    const naoAceitos = raizes.filter((a) => !aceitosPermitidos[a.id]);
    if (naoAceitos.length > 0) {
      bloqueantes.push({ pacote: nome, severidade: vuln.severity, advisories: naoAceitos });
    } else {
      aceitos.push({ pacote: nome, severidade: vuln.severity, advisories: raizes });
    }
  }

  // Revisão vencida falha: a data existe "para não virar tapete", e um aviso
  // que só vive no resumo de um job verde ninguém lê. Vale para toda entrada
  // da allowlist, esteja o pacote ainda na árvore ou não.
  const vencidos = [];
  const aVencer = [];
  for (const [id, entrada] of Object.entries(aceitosPermitidos)) {
    const dias = diasEntre(hoje, entrada.revisarEm);
    if (dias < 0) vencidos.push({ id, pacote: entrada.pacote, revisarEm: entrada.revisarEm });
    else if (dias <= DIAS_DE_AVISO) {
      aVencer.push({ id, pacote: entrada.pacote, revisarEm: entrada.revisarEm, dias });
    }
  }

  const semCorrespondencia = Object.keys(aceitosPermitidos).filter((id) => !idsVistos.has(id));

  return { bloqueantes, aceitos, vencidos, aVencer, semCorrespondencia };
}

function montarResumo(resultado, aceitosPermitidos) {
  const { bloqueantes, aceitos, vencidos, aVencer, semCorrespondencia } = resultado;
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
  } else if (vencidos.length === 0) {
    linhas.push('### :white_check_mark: Nenhuma vulnerabilidade high/critical fora da allowlist');
  }

  if (vencidos.length > 0) {
    linhas.push('');
    linhas.push('### :rotating_light: Revisão da allowlist vencida');
    linhas.push('');
    for (const v of vencidos) {
      linhas.push(`- \`${v.pacote}\` — ${v.id} (venceu em ${v.revisarEm})`);
    }
    linhas.push('');
    linhas.push(
      'Reconfirme se já há correção upstream (se houver, remova a entrada e suba o ' +
        'pacote); se o advisory segue sem correção, renove `revisarEm` em ' +
        '`scripts/audit-producao.js` com a data da reconferência no motivo.',
    );
  }

  if (aVencer.length > 0) {
    linhas.push('');
    for (const v of aVencer) {
      linhas.push(
        `> :warning: Revisão de \`${v.pacote}\` (${v.id}) vence em ${v.dias} dia(s), em ${v.revisarEm}.`,
      );
    }
  }

  if (aceitos.length > 0) {
    linhas.push('');
    linhas.push('<details><summary>Advisories aceitos conscientemente</summary>');
    linhas.push('');
    for (const a of aceitos) {
      for (const adv of a.advisories) {
        linhas.push(`- \`${a.pacote}\` — ${adv.id} (revisar em ${aceitosPermitidos[adv.id].revisarEm})`);
      }
    }
    linhas.push('');
    linhas.push('</details>');
  }

  if (semCorrespondencia.length > 0) {
    linhas.push('');
    linhas.push(
      `> :broom: Entradas de \`ACEITOS\` que não casam com nada na árvore (advisory resolvido?): ` +
        `${semCorrespondencia.join(', ')}. Remova-as.`,
    );
  }

  return linhas.join('\n');
}

function esperar(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Roda o audit e devolve um relatório VÁLIDO, com uma nova tentativa para a
 * instabilidade passageira do registro. Falha (lança) se nenhuma serve.
 */
function obterRelatorio() {
  let ultimoMotivo = '';
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    let motivo;
    try {
      const relatorio = JSON.parse(rodarAudit());
      motivo = motivoDeRelatorioInvalido(relatorio);
      if (!motivo) return relatorio;
    } catch (erro) {
      motivo = `não foi possível executar/ler o npm audit (${erro.message})`;
    }
    ultimoMotivo = motivo;
    if (tentativa < TENTATIVAS) {
      console.error(`Audit sem relatório válido (${motivo}); nova tentativa em ${ESPERA_ENTRE_TENTATIVAS_MS / 1000}s.`);
      esperar(ESPERA_ENTRE_TENTATIVAS_MS);
    }
  }
  throw new Error(ultimoMotivo);
}

function main() {
  let relatorio;
  try {
    relatorio = obterRelatorio();
  } catch (erro) {
    // Sem relatório não há veredito: "não consegui consultar" não é "limpo".
    console.error(`FALHA: o audit não pôde ser concluído — ${erro.message}.`);
    console.error('O check fica vermelho de propósito; rode de novo quando o registro do npm responder.');
    if (process.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `### :x: Audit não concluído\n\n${erro.message}. Nenhum veredito foi emitido.\n`,
      );
    }
    process.exit(2);
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const resultado = analisar(relatorio, ACEITOS, hoje);
  const resumo = montarResumo(resultado, ACEITOS);

  console.log(resumo.replace(/^### /gm, '').replace(/:[a-z_]+:/g, '').trim());

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${resumo}\n`);
  }

  process.exit(resultado.bloqueantes.length > 0 || resultado.vencidos.length > 0 ? 1 : 0);
}

if (require.main === module) {
  main();
}

module.exports = { ACEITOS, analisar, montarResumo, motivoDeRelatorioInvalido };
