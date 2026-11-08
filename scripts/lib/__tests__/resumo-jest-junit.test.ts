/**
 * Resumo do jest no `$GITHUB_STEP_SUMMARY` (30(m)): os testes que falharam e os
 * 10 mais lentos, lidos do `coverage/junit.xml` que o jest-junit já grava.
 *
 * Não há retentativa configurada (`retryTimes` não existe no repositório), então
 * "passou só depois de retentar" não é um conjunto que exista; os lentos são o
 * sinal que sobra para pegar teste que flutua. Se um dia houver retentativa,
 * este resumo continua valendo: o jest-junit só grava o resultado final.
 */
const { lerCasos, montarResumo } = require('../resumo-jest-junit.js');

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="jest tests" tests="4" failures="1" time="9.5">
  <testsuite name="a" tests="3" failures="1" time="6.0">
    <testcase classname="Fila espaça" name="descarta &quot;o mais antigo&quot; &amp; segue" time="0.050"/>
    <testcase classname="Rota" name="reabre a parada" time="4.250">
      <failure>Error: esperado 1, recebido 2
        at x</failure>
    </testcase>
    <testcase classname="Data" name="formata" time="1.700"></testcase>
  </testsuite>
  <testsuite name="b" tests="1" failures="0" time="3.5">
    <testcase classname="Mapa" name="carrega" time="3.500"/>
  </testsuite>
</testsuites>`;

describe('lerCasos', () => {
  it('lê nome, tempo e falha, inclusive entidades XML e casos com corpo', () => {
    const casos = lerCasos(XML);
    expect(casos).toHaveLength(4);
    expect(casos[0]).toEqual({
      classe: 'Fila espaça',
      nome: 'descarta "o mais antigo" & segue',
      segundos: 0.05,
      falhou: false,
    });
    expect(casos[1].falhou).toBe(true);
    expect(casos[2].falhou).toBe(false);
  });

  it('XML vazio ou sem testcase devolve lista vazia', () => {
    expect(lerCasos('')).toEqual([]);
    expect(lerCasos('<testsuites/>')).toEqual([]);
  });
});

describe('montarResumo', () => {
  const casos = lerCasos(XML);

  it('lista os que falharam e os mais lentos, do maior para o menor', () => {
    const md = montarResumo(casos, 2);
    expect(md).toContain('Falharam (1)');
    expect(md).toContain('Rota > reabre a parada');
    const iLento = md.indexOf(
      'Rota > reabre a parada',
      md.indexOf('Mais lentos'),
    );
    const iSegundo = md.indexOf('Mapa > carrega');
    expect(iLento).toBeGreaterThan(-1);
    expect(iSegundo).toBeGreaterThan(iLento);
    expect(md).not.toContain('Data > formata');
  });

  it('sem falha diz isso, e sem casos avisa que o junit veio vazio', () => {
    expect(
      montarResumo(casos.filter((c: { falhou: boolean }) => !c.falhou)),
    ).toContain('Nenhum teste falhou');
    expect(montarResumo([])).toContain('sem casos');
  });

  it('não depende de nome com caractere de tabela do markdown', () => {
    const md = montarResumo([
      { classe: 'A', nome: 'x | y', segundos: 1, falhou: false },
    ]);
    expect(md).toContain('x \\| y');
  });
});
