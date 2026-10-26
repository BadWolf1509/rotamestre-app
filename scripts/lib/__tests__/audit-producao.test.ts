/**
 * Testes do veredito do `scripts/audit-producao.js`, com saídas simuladas do
 * `npm audit --json` (sem rede e sem relógio).
 *
 * O que se guarda: o audit é check bloqueante e NÃO pode passar por ausência de
 * resposta. "O registro não respondeu" e "nenhuma vulnerabilidade" têm o mesmo
 * silêncio no exit 0; aqui eles se separam.
 */

const {
  analisar,
  montarResumo,
  motivoDeRelatorioInvalido,
} = require('../../audit-producao.js');

const ACEITOS = {
  'GHSA-aceito': { pacote: 'lib-aceita', motivo: 'm', revisarEm: '2026-11-24' },
};

function relatorio(vulnerabilities: Record<string, unknown>) {
  return {
    auditReportVersion: 2,
    vulnerabilities,
    metadata: { vulnerabilities: {} },
  };
}

const vulnAceita = {
  'lib-aceita': {
    severity: 'high',
    via: [{ url: 'https://github.com/advisories/GHSA-aceito', title: 'x' }],
  },
};

describe('motivoDeRelatorioInvalido (falha do registro não é "limpo")', () => {
  it('recusa a resposta de erro do npm (sem vulnerabilities)', () => {
    const saida = {
      message: 'audit endpoint returned an error',
      error: { code: 'ECONNREFUSED' },
    };
    expect(motivoDeRelatorioInvalido(saida)).toMatch(/erro/);
  });

  it('recusa relatório sem vulnerabilities', () => {
    expect(motivoDeRelatorioInvalido({ metadata: {} })).toMatch(
      /vulnerabilities/,
    );
  });

  it('recusa relatório sem metadata', () => {
    expect(motivoDeRelatorioInvalido({ vulnerabilities: {} })).toMatch(
      /metadata/,
    );
  });

  it('recusa saída que não é objeto', () => {
    expect(motivoDeRelatorioInvalido(null)).not.toBeNull();
    expect(motivoDeRelatorioInvalido('texto')).not.toBeNull();
  });

  it('aceita relatório limpo e completo', () => {
    expect(motivoDeRelatorioInvalido(relatorio({}))).toBeNull();
  });
});

describe('analisar', () => {
  it('advisory high fora da allowlist bloqueia', () => {
    const r = analisar(
      relatorio({
        outra: {
          severity: 'high',
          via: [{ url: 'https://github.com/advisories/GHSA-novo', title: 'n' }],
        },
      }),
      ACEITOS,
      '2026-10-26',
    );
    expect(r.bloqueantes).toHaveLength(1);
    expect(r.vencidos).toHaveLength(0);
  });

  it('advisory aceito e dentro do prazo não bloqueia', () => {
    const r = analisar(relatorio(vulnAceita), ACEITOS, '2026-10-26');
    expect(r.bloqueantes).toHaveLength(0);
    expect(r.aceitos).toHaveLength(1);
    expect(r.vencidos).toHaveLength(0);
    expect(r.aVencer).toHaveLength(0);
  });

  it('revisão vencida passa a falhar (vencidos não vazio)', () => {
    const r = analisar(relatorio(vulnAceita), ACEITOS, '2026-11-25');
    expect(r.vencidos.map((v: { id: string }) => v.id)).toEqual([
      'GHSA-aceito',
    ]);
  });

  it('no próprio dia da revisão ainda não venceu, mas já avisa', () => {
    const r = analisar(relatorio(vulnAceita), ACEITOS, '2026-11-24');
    expect(r.vencidos).toHaveLength(0);
    expect(r.aVencer).toHaveLength(1);
  });

  it('avisa 14 dias antes, não com folga maior', () => {
    expect(
      analisar(relatorio(vulnAceita), ACEITOS, '2026-11-10').aVencer,
    ).toHaveLength(1);
    expect(
      analisar(relatorio(vulnAceita), ACEITOS, '2026-11-09').aVencer,
    ).toHaveLength(0);
  });

  it('vence mesmo se o pacote saiu da árvore, e a entrada sem par é listada', () => {
    const r = analisar(relatorio({}), ACEITOS, '2026-12-01');
    expect(r.vencidos).toHaveLength(1);
    expect(r.semCorrespondencia).toEqual(['GHSA-aceito']);
  });

  it('resumo cita a revisão vencida e não declara "limpo"', () => {
    const r = analisar(relatorio(vulnAceita), ACEITOS, '2026-11-25');
    const resumo = montarResumo(r, ACEITOS);
    expect(resumo).toMatch(/Revisão da allowlist vencida/);
    expect(resumo).not.toMatch(
      /Nenhuma vulnerabilidade high\/critical fora da allowlist/,
    );
  });
});
