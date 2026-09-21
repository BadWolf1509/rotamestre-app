#!/usr/bin/env node
/**
 * Verifica que os pacotes do Sentry caem no MESMO grupo do Dependabot.
 *
 * POR QUE ISTO EXISTE. `@sentry/react` fixa `@sentry/browser` em versao EXATA:
 * subir um sem o outro faz o npm aninhar uma segunda arvore inteira do Sentry e
 * o bundle web estoura (medido duas vezes: 3,37 -> 3,88 MB no #521, e
 * 3,39 -> 3,9 MB no #537, contra o limite de 3,5 MB do .size-limit.json).
 * O grupo `sentry` do .github/dependabot.yml existe para impedir isso — mas
 * entre 17/09 e 21/09/2026 ele esteve la SEM NUNCA receber uma dependencia, e
 * nada no CI apontava isso. O sintoma so aparecia semanas depois, como bundle
 * estourado num PR do Dependabot.
 *
 * A REGRA QUE PEGA TODO MUNDO. Nao e a ordem dos grupos que decide — a doc fala
 * em "the first group that it matches", mas o motor pontua ESPECIFICIDADE e
 * escolhe o maior:
 *
 *   pattern exato ............. 1000
 *   pattern sem wildcard ....... 500
 *   SEM `patterns` ............. 500   <-- um grupo generico pontua ALTO
 *   pattern com wildcard ....... 100 - 10*n + max(len-5, 0)
 *   "*" .......................... 1
 *
 * `@sentry/*` da 94 e PERDE para `production-dependencies`, que da 500 por NAO
 * ter `patterns`. Os pacotes iam para la, que so aceita `patch`; com update
 * `minor` caiam fora e viravam PRs separados — o cenario exato que duplica a
 * arvore. Por isso `production-dependencies` carrega um `exclude-patterns`.
 *
 * ESTE SCRIPT E UM MODELO DO MOTOR, NAO O MOTOR. A logica abaixo foi transcrita
 * em 21/09/2026 de dependabot/dependabot-core@main:
 *   updater/lib/dependabot/updater/pattern_specificity_calculator.rb
 *   updater/lib/dependabot/dependency_group_engine.rb
 *   common/lib/dependabot/dependency_group.rb
 * Se o upstream mudar a pontuacao, este script passa a mentir — nos dois
 * sentidos. Por isso ele NAO e bloqueante no CI: um verde aqui nao prova
 * agrupamento, e a unica prova real e o PR que o Dependabot abre de fato
 * (um PR unico do grupo `sentry`, com branch `dependabot/npm_and_yarn/sentry-<hash>`).
 * Trate uma falha aqui como "va conferir", nunca como veredito.
 */
const fs = require('fs');
const path = require('path');

const yaml = require('js-yaml');

const CONFIG = path.join(__dirname, '..', '.github', 'dependabot.yml');

// --- constantes do PatternSpecificityCalculator (valores do upstream) ---
const EXPLICIT_MEMBER_SCORE = 1000;
const EXACT_MATCH_SCORE = 1000;
const NO_WILDCARDS_SCORE = 500;
const NO_PATTERNS_SCORE = 500;
const WILDCARD_BASE_SCORE = 100;
const WILDCARD_PENALTY = 10;
const UNIVERSAL_WILDCARD_SCORE = 1;
const MINIMUM_SCORE = 1;
const LENGTH_BONUS_THRESHOLD = 5;

/** WildcardMatcher.match? — case-insensitive, `*` e curinga. */
function casaPattern(pattern, nome) {
  const corpo = pattern
    .split('*')
    .map((parte) => parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${corpo}$`, 'i').test(nome);
}

/** calculate_pattern_specificity */
function especificidadeDoPattern(pattern, nome) {
  if (pattern === nome) return EXACT_MATCH_SCORE;
  if (pattern === '*') return UNIVERSAL_WILDCARD_SCORE;
  const curingas = (pattern.match(/\*/g) || []).length;
  if (curingas === 0) return NO_WILDCARDS_SCORE;
  const base = WILDCARD_BASE_SCORE - curingas * WILDCARD_PENALTY;
  const bonus = Math.max(pattern.length - LENGTH_BONUS_THRESHOLD, 0);
  return Math.max(base + bonus, MINIMUM_SCORE);
}

const excluido = (grupo, nome) =>
  Boolean(grupo.excludePatterns && grupo.excludePatterns.some((p) => casaPattern(p, nome)));

/** calculate_group_specificity_for_dependency */
function especificidade(grupo, dep) {
  if (excluido(grupo, dep.nome)) return 0;
  if (!grupo.patterns) return NO_PATTERNS_SCORE;
  const casam = grupo.patterns.filter((p) => casaPattern(p, dep.nome));
  if (casam.length === 0) return 0;
  return Math.max(...casam.map((p) => especificidadeDoPattern(p, dep.nome)));
}

/** DependencyGroup#contains? — repare que NAO consulta update-types. */
function contem(grupo, dep) {
  if (excluido(grupo, dep.nome)) return false;
  const casaNome = !grupo.patterns || grupo.patterns.some((p) => casaPattern(p, dep.nome));
  const casaTipo =
    grupo.dependencyType === undefined ||
    grupo.dependencyType === (dep.producao ? 'production' : 'development');
  return casaNome && casaTipo;
}

/**
 * should_skip_due_to_specificity? + find_most_specific_group_name.
 * O engine NAO passa `update_type` ao calculador, entao um grupo que so aceita
 * `patch` continua competindo (e vencendo) num update `minor`.
 */
function perdeParaGrupoMaisEspecifico(grupo, dep, todos) {
  if (!grupo.patterns || grupo.patterns.length === 0) return false; // can_check_specificity? == false
  const atual = especificidade(grupo, dep);
  if (atual >= EXPLICIT_MEMBER_SCORE) return false;
  const elegiveis = grupo.updateTypes
    ? todos.filter((o) => !o.updateTypes || o.updateTypes.some((t) => grupo.updateTypes.includes(t)))
    : todos;
  return elegiveis.some((o) => o !== grupo && contem(o, dep) && especificidade(o, dep) > atual);
}

/** Destino final: nome do grupo, ou 'INDIVIDUAL'. */
function destino(dep, grupos) {
  for (const grupo of grupos) {
    if (!contem(grupo, dep) || perdeParaGrupoMaisEspecifico(grupo, dep, grupos)) continue;
    if (!grupo.updateTypes || grupo.updateTypes.includes(dep.updateType)) return grupo.name;
  }
  return 'INDIVIDUAL';
}

function lerGrupos() {
  const cfg = yaml.load(fs.readFileSync(CONFIG, 'utf8'));
  const npm = (cfg.updates || []).find((u) => u['package-ecosystem'] === 'npm');
  if (!npm || !npm.groups) return null;
  return Object.entries(npm.groups).map(([name, regras]) => ({
    name,
    patterns: regras.patterns,
    excludePatterns: regras['exclude-patterns'],
    dependencyType: regras['dependency-type'],
    updateTypes: regras['update-types'],
  }));
}

function main() {
  const grupos = lerGrupos();
  if (!grupos) {
    console.error('[grupos-dependabot] Nao achei o bloco `groups` do ecossistema npm em .github/dependabot.yml.');
    process.exit(1);
  }

  const falhas = [];
  // O invariante NAO e "caem no grupo chamado sentry" — e "caem JUNTOS, em
  // algum grupo". Se alguem renomear o grupo, isto continua valendo; se os dois
  // se separarem, ou virarem PRs individuais, a arvore duplica.
  for (const updateType of ['minor', 'patch']) {
    const browser = destino({ nome: '@sentry/browser', producao: true, updateType }, grupos);
    const react = destino({ nome: '@sentry/react', producao: true, updateType }, grupos);

    if (browser === 'INDIVIDUAL' || react === 'INDIVIDUAL') {
      falhas.push(
        `update ${updateType}: pelo menos um pacote sai em PR INDIVIDUAL ` +
          `(@sentry/browser -> ${browser}, @sentry/react -> ${react}). ` +
          'PRs separados duplicam a arvore do Sentry e estouram o bundle.',
      );
    } else if (browser !== react) {
      falhas.push(
        `update ${updateType}: os dois pacotes caem em grupos DIFERENTES ` +
          `(@sentry/browser -> ${browser}, @sentry/react -> ${react}). Precisam viajar no mesmo PR.`,
      );
    } else {
      console.log(`  ok   update ${updateType}: os dois vao para o grupo '${browser}'`);
    }
  }

  if (falhas.length > 0) {
    console.error('\n[grupos-dependabot] O agrupamento do Sentry NAO esta de pe:\n');
    for (const f of falhas) console.error(`  - ${f}`);
    console.error(
      '\n  Causa provavel: outro grupo vence a especificidade. Um grupo SEM `patterns`\n' +
        '  pontua 500; `@sentry/*` pontua 94. A saida e `exclude-patterns: ["@sentry/*"]`\n' +
        '  no grupo concorrente. Veja o cabecalho deste arquivo para a tabela completa.\n' +
        '\n  Este script e um MODELO do motor do Dependabot: confirme no proximo PR que\n' +
        '  ele abrir antes de mudar a config com base so nisto.',
    );
    process.exit(1);
  }

  console.log('\n[grupos-dependabot] Os pacotes do Sentry viajam no mesmo PR.');
  process.exit(0);
}

main();
