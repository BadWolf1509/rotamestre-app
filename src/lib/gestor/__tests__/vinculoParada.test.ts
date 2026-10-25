/**
 * Vínculo retirada -> entrega (`vinculo_parada_id`): a entrega depende de uma
 * retirada e não pode ficar antes dela na ordem.
 */
import {
  avisoPerdaDeVinculoAoEditarTipo,
  avisoPerdaDeVinculoAoRemover,
  entregasQueDependemDe,
  mensagemConfirmarRemocaoParada,
  primeiraViolacaoNova,
  violacoesDeVinculo,
} from '../vinculoParada';

type P = {
  id: string;
  tipo: 'entrega' | 'retirada';
  endereco?: string;
  status?: string;
  vinculo_parada_id?: string | null;
};

const ret = (id: string, extra: Partial<P> = {}): P => ({
  id,
  tipo: 'retirada',
  endereco: `Retirada ${id}`,
  ...extra,
});
const ent = (id: string, vinculo?: string, extra: Partial<P> = {}): P => ({
  id,
  tipo: 'entrega',
  endereco: `Entrega ${id}`,
  vinculo_parada_id: vinculo ?? null,
  ...extra,
});

describe('violacoesDeVinculo', () => {
  it('ordem boa: nenhuma violação', () => {
    expect(violacoesDeVinculo([ret('r1'), ent('e1', 'r1')])).toEqual([]);
  });

  it('entrega antes da sua retirada: uma violação, com as duas paradas', () => {
    const e1 = ent('e1', 'r1');
    const r1 = ret('r1');
    expect(violacoesDeVinculo([e1, r1])).toEqual([
      { entrega: e1, retirada: r1 },
    ]);
  });

  it('entrega sem vínculo, ou vinculada a parada fora da lista, não viola', () => {
    expect(violacoesDeVinculo([ent('e1'), ent('e2', 'sumiu')])).toEqual([]);
  });
});

describe('primeiraViolacaoNova', () => {
  it('só acusa violação que a ordem nova criou', () => {
    const r1 = ret('r1');
    const e1 = ent('e1', 'r1');
    expect(primeiraViolacaoNova([r1, e1], [e1, r1])?.entrega.id).toBe('e1');
  });

  it('violação que já existia antes não trava mexer em outras paradas', () => {
    const r1 = ret('r1');
    const e1 = ent('e1', 'r1');
    const e2 = ent('e2');
    expect(primeiraViolacaoNova([e1, r1, e2], [e1, e2, r1])).toBeNull();
  });
});

describe('entregasQueDependemDe', () => {
  it('lista só as entregas vinculadas àquela retirada', () => {
    const lista = [ret('r1'), ent('e1', 'r1'), ent('e2', 'r2'), ent('e3')];
    expect(entregasQueDependemDe(lista, 'r1').map((p) => p.id)).toEqual(['e1']);
  });

  it('ignora entrega já concluída ou pulada: o vínculo dela não pesa mais', () => {
    const lista = [
      ret('r1'),
      ent('e1', 'r1', { status: 'concluida' }),
      ent('e2', 'r1', { status: 'pulada' }),
      ent('e3', 'r1', { status: 'pendente' }),
    ];
    expect(entregasQueDependemDe(lista, 'r1').map((p) => p.id)).toEqual(['e3']);
  });
});

describe('avisos de perda de vínculo', () => {
  it('remover: sem dependentes, sem aviso', () => {
    expect(avisoPerdaDeVinculoAoRemover([ret('r1')], ret('r1'))).toBeNull();
  });

  it('remover retirada com entrega vinculada: nomeia a entrega', () => {
    const r1 = ret('r1');
    const aviso = avisoPerdaDeVinculoAoRemover([r1, ent('e1', 'r1')], r1);
    expect(aviso).toContain('Entrega e1');
    expect(aviso).toMatch(/vínculo/i);
  });

  it('remover entrega não avisa nada', () => {
    const e1 = ent('e1', 'r1');
    expect(avisoPerdaDeVinculoAoRemover([ret('r1'), e1], e1)).toBeNull();
  });

  it('mudar retirada para entrega com dependentes: avisa', () => {
    const r1 = ret('r1');
    const aviso = avisoPerdaDeVinculoAoEditarTipo(
      [r1, ent('e1', 'r1')],
      r1,
      'entrega',
    );
    expect(aviso).toContain('Entrega e1');
  });

  it('mudar entrega vinculada para retirada: avisa que perde o vínculo', () => {
    const e1 = ent('e1', 'r1');
    const aviso = avisoPerdaDeVinculoAoEditarTipo(
      [ret('r1'), e1],
      e1,
      'retirada',
    );
    expect(aviso).toContain('Retirada r1');
  });

  it('tipo igual ou sem vínculo: sem aviso', () => {
    const r1 = ret('r1');
    expect(
      avisoPerdaDeVinculoAoEditarTipo([r1, ent('e1', 'r1')], r1, 'retirada'),
    ).toBeNull();
    const e2 = ent('e2');
    expect(avisoPerdaDeVinculoAoEditarTipo([e2], e2, 'retirada')).toBeNull();
  });
});

describe('mensagemConfirmarRemocaoParada', () => {
  it('sem vínculo: a mensagem de sempre, com o endereço', () => {
    const e1 = ent('e1', undefined, { endereco: 'Rua das Flores, 10' });
    expect(mensagemConfirmarRemocaoParada([e1], e1)).toBe(
      'Tem certeza que deseja remover esta parada?\n\nRua das Flores, 10\n\nA rota será recalculada automaticamente.',
    );
  });

  it('retirada com entrega vinculada: o aviso do vínculo entra antes do fecho', () => {
    const r1 = ret('r1', { endereco: 'Rua da Coleta, 1' });
    const msg = mensagemConfirmarRemocaoParada([r1, ent('e1', 'r1')], r1);
    expect(msg).toContain('Rua da Coleta, 1');
    expect(msg).toContain('Entrega e1');
    expect(msg).toMatch(/perde o vínculo/);
    expect(msg.endsWith('A rota será recalculada automaticamente.')).toBe(true);
  });
});
