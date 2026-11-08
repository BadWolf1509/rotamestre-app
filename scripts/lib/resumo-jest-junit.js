#!/usr/bin/env node

/**
 * Resumo do jest para o `$GITHUB_STEP_SUMMARY`: testes que falharam e os mais
 * lentos, lidos do `coverage/junit.xml` (jest-junit, ver jest.config.js).
 *
 * Por que os lentos, e não "os que passaram só após retentativa": o repositório
 * não configura retentativa (`retryTimes`), então esse conjunto não existe. O
 * tempo é o sinal que sobra para pegar teste que flutua (30(m)).
 *
 * Nunca falha o job: é informativo. Sem o arquivo, avisa no summary e sai 0.
 *
 * Uso: node scripts/lib/resumo-jest-junit.js [caminho-do-junit.xml]
 */

const fs = require('fs');

const ENTIDADES = { quot: '"', apos: "'", lt: '<', gt: '>', amp: '&' };

function desescapar(texto) {
  return texto.replace(/&(#\d+|#x[0-9a-f]+|quot|apos|lt|gt|amp);/gi, (_, e) => {
    if (e[0] === '#') {
      const codigo = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(codigo);
    }
    return ENTIDADES[e.toLowerCase()];
  });
}

function atributo(abertura, nome) {
  const m = new RegExp(String.raw`\s${nome}="([^"]*)"`).exec(abertura);
  return m ? desescapar(m[1]) : '';
}

/** Cada `<testcase>` do junit, com ou sem corpo; corpo com `<failure>`/`<error>` é falha. */
function lerCasos(xml) {
  const casos = [];
  const re = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const corpo = m[3] || '';
    casos.push({
      classe: atributo(m[1], 'classname'),
      nome: atributo(m[1], 'name'),
      segundos: Number(atributo(m[1], 'time')) || 0,
      falhou: /<(failure|error)\b/.test(corpo),
    });
  }
  return casos;
}

const rotulo = (c) => {
  const texto = c.classe ? `${c.classe} > ${c.nome}` : c.nome;
  // `|` quebraria a célula da tabela do markdown.
  return texto.replace(/\|/g, '\\|');
};

function tabela(casos) {
  return [
    '| Teste | Tempo (s) |',
    '| --- | ---: |',
    ...casos.map((c) => `| ${rotulo(c)} | ${c.segundos.toFixed(2)} |`),
  ];
}

function montarResumo(casos, limiteLentos = 10) {
  if (casos.length === 0) {
    return '### :warning: Resumo do jest: junit.xml sem casos (nada a listar)\n';
  }
  const falhas = casos.filter((c) => c.falhou);
  const lentos = [...casos].sort((a, b) => b.segundos - a.segundos).slice(0, limiteLentos);
  const linhas = [`### Resumo do jest (${casos.length} testes)`, ''];
  if (falhas.length === 0) {
    linhas.push('Nenhum teste falhou.');
  } else {
    linhas.push(`**Falharam (${falhas.length})**`, '', ...tabela(falhas));
  }
  linhas.push('', `**Mais lentos (${lentos.length})**`, '', ...tabela(lentos), '');
  return linhas.join('\n');
}

function main() {
  const caminho = process.argv[2] || 'coverage/junit.xml';
  let texto;
  if (!fs.existsSync(caminho)) {
    texto = `### :warning: Resumo do jest: ${caminho} não foi gerado\n`;
  } else {
    texto = montarResumo(lerCasos(fs.readFileSync(caminho, 'utf8')));
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${texto}\n`);
  } else {
    process.stdout.write(`${texto}\n`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { lerCasos, montarResumo };
