// Guardas da exclusão de conta: o que impede apagar quem ainda sustenta uma
// loja (último gestor ativo) ou uma entrega em curso (rota em andamento).
//
// O cliente é um dublê mínimo da cadeia do supabase-js (select/eq/neq/in/
// limit): devolve a resposta programada para a tabela e guarda os filtros
// pedidos — o que se testa é a decisão do módulo e o que ele pergunta.
import { verificarGuardas } from '../guardasExclusao';

type Resposta = {
  data?: unknown;
  error: { code?: string; message: string } | null;
};
type Respostas = Record<string, Resposta | Resposta[]>;

function clienteFalso(respostas: Respostas) {
  const filtros: Array<{
    tabela: string;
    op: string;
    coluna: string;
    valor: unknown;
  }> = [];
  const filas: Record<string, Resposta[]> = {};
  for (const [tabela, r] of Object.entries(respostas)) {
    filas[tabela] = Array.isArray(r) ? [...r] : [r];
  }
  const cliente = {
    from(tabela: string) {
      const proxima = (): Resposta => {
        const fila = filas[tabela] ?? [{ data: [], error: null }];
        return fila.length > 1 ? fila.shift()! : fila[0];
      };
      const cadeia = {
        eq: (coluna: string, valor: unknown) => {
          filtros.push({ tabela, op: 'eq', coluna, valor });
          return cadeia;
        },
        neq: (coluna: string, valor: unknown) => {
          filtros.push({ tabela, op: 'neq', coluna, valor });
          return cadeia;
        },
        in: (coluna: string, valor: unknown) => {
          filtros.push({ tabela, op: 'in', coluna, valor });
          return cadeia;
        },
        limit: () => cadeia,
        then: (ok: (r: Resposta) => unknown, ko?: (e: unknown) => unknown) =>
          Promise.resolve(proxima()).then(ok, ko),
      };
      return { select: () => cadeia };
    },
  };
  return { cliente, filtros };
}

const sucesso = (data: unknown): Resposta => ({ data, error: null });

describe('verificarGuardas', () => {
  it('recusa o único gestor ativo de uma loja, nomeando a loja e dizendo o que fazer', async () => {
    const { cliente, filtros } = clienteFalso({
      usuario_unidades: [
        sucesso([{ unidade_id: 'loja-1' }]), // lojas em que ele é gestor ativo
        sucesso([]), // nenhum OUTRO gestor ativo nelas
      ],
      unidades: sucesso([{ id: 'loja-1', nome: 'Loja Centro' }]),
      rotas: sucesso([]),
    });

    const recusa = await verificarGuardas(cliente, 'u1');

    expect(recusa).toMatchObject({ codigo: 'ULTIMO_GESTOR', status: 409 });
    expect(recusa?.mensagem).toContain('Loja Centro');
    expect(recusa?.mensagem).toMatch(/outro gestor ativo.*suporte/i);
    // A segunda pergunta exclui o próprio usuário e só conta gestor ATIVO.
    expect(filtros).toContainEqual({
      tabela: 'usuario_unidades',
      op: 'neq',
      coluna: 'usuario_id',
      valor: 'u1',
    });
    expect(filtros).toContainEqual({
      tabela: 'usuario_unidades',
      op: 'eq',
      coluna: 'ativo',
      valor: true,
    });
  });

  it('segue quando outro gestor ativo cobre todas as lojas', async () => {
    const { cliente } = clienteFalso({
      usuario_unidades: [
        sucesso([{ unidade_id: 'loja-1' }, { unidade_id: 'loja-2' }]),
        sucesso([
          { unidade_id: 'loja-1', usuario_id: 'g2' },
          { unidade_id: 'loja-2', usuario_id: 'g3' },
        ]),
      ],
      usuarios: sucesso([{ id: 'g2' }, { id: 'g3' }]),
      rotas: sucesso([]),
    });

    expect(await verificarGuardas(cliente, 'u1')).toBeNull();
  });

  it('recusa se UMA das lojas fica sem gestor, mesmo que a outra tenha', async () => {
    const { cliente } = clienteFalso({
      usuario_unidades: [
        sucesso([{ unidade_id: 'loja-1' }, { unidade_id: 'loja-2' }]),
        sucesso([{ unidade_id: 'loja-1', usuario_id: 'g2' }]),
      ],
      usuarios: sucesso([{ id: 'g2' }]),
      unidades: sucesso([{ id: 'loja-2', nome: 'Loja Norte' }]),
      rotas: sucesso([]),
    });

    const recusa = await verificarGuardas(cliente, 'u1');

    expect(recusa?.codigo).toBe('ULTIMO_GESTOR');
    expect(recusa?.mensagem).toContain('Loja Norte');
  });

  it('recusa quem tem rota em andamento: finalizar ou pedir a reatribuição', async () => {
    const { cliente, filtros } = clienteFalso({
      usuario_unidades: sucesso([]), // não é gestor de loja nenhuma
      rotas: sucesso([{ id: 'r1', status: 'em_andamento' }]),
    });

    const recusa = await verificarGuardas(cliente, 'u1');

    expect(recusa).toMatchObject({ codigo: 'ROTA_EM_ANDAMENTO', status: 409 });
    expect(recusa?.mensagem).toMatch(/finalize/i);
    expect(recusa?.mensagem).toMatch(/reatribu/i);
    expect(filtros).toContainEqual({
      tabela: 'rotas',
      op: 'eq',
      coluna: 'motorista_id',
      valor: 'u1',
    });
    expect(filtros).toContainEqual({
      tabela: 'rotas',
      op: 'in',
      coluna: 'status',
      valor: ['pendente', 'em_andamento'],
    });
  });

  it('caso válido: sem loja sozinha e sem rota em andamento, segue', async () => {
    const { cliente } = clienteFalso({
      usuario_unidades: sucesso([]),
      rotas: sucesso([]),
    });

    expect(await verificarGuardas(cliente, 'u1')).toBeNull();
  });

  it('sem conseguir consultar, NÃO libera: recusa com 503 em vez de apagar às cegas', async () => {
    const { cliente } = clienteFalso({
      usuario_unidades: { error: { code: '57014', message: 'timeout' } },
      rotas: sucesso([]),
    });

    const recusa = await verificarGuardas(cliente, 'u1');

    expect(recusa).toMatchObject({
      codigo: 'GUARDA_INDISPONIVEL',
      status: 503,
    });
  });

  it('falha na consulta de rotas também não libera', async () => {
    const { cliente } = clienteFalso({
      usuario_unidades: sucesso([]),
      rotas: { error: { message: 'boom' } },
    });

    expect(await verificarGuardas(cliente, 'u1')).toMatchObject({
      codigo: 'GUARDA_INDISPONIVEL',
    });
  });

  it('falha só ao buscar o nome da loja não vira liberação: recusa sem o nome', async () => {
    const { cliente } = clienteFalso({
      usuario_unidades: [sucesso([{ unidade_id: 'loja-1' }]), sucesso([])],
      unidades: { error: { message: 'boom' } },
      rotas: sucesso([]),
    });

    const recusa = await verificarGuardas(cliente, 'u1');

    expect(recusa?.codigo).toBe('ULTIMO_GESTOR');
    expect(recusa?.mensagem).toMatch(/outro gestor ativo.*suporte/i);
  });

  it('recusa quem tem rota pendente atribuída, com o código que o app 1.14.x reconhece', async () => {
    const { cliente, filtros } = clienteFalso({
      usuario_unidades: sucesso([]),
      rotas: sucesso([{ id: 'r1', status: 'pendente' }]),
    });

    const recusa = await verificarGuardas(cliente, 'u1');

    expect(recusa).toEqual({
      codigo: 'ROTA_EM_ANDAMENTO',
      status: 409,
      mensagem: expect.stringContaining('reatribua'),
    });
    expect(recusa!.mensagem).toContain('ainda não foi feita');
    expect(filtros).toContainEqual({
      tabela: 'rotas',
      op: 'in',
      coluna: 'status',
      valor: ['pendente', 'em_andamento'],
    });
  });

  it('com rota em andamento e pendente, a mensagem é a de rota em andamento', async () => {
    const { cliente } = clienteFalso({
      usuario_unidades: sucesso([]),
      rotas: sucesso([
        { id: 'r1', status: 'pendente' },
        { id: 'r2', status: 'em_andamento' },
      ]),
    });

    const recusa = await verificarGuardas(cliente, 'u1');

    expect(recusa?.codigo).toBe('ROTA_EM_ANDAMENTO');
    expect(recusa?.mensagem).toContain('Finalize a rota');
  });

  it('recusa o último gestor quando o outro gestor da loja está com o cadastro inativo', async () => {
    const { cliente, filtros } = clienteFalso({
      usuario_unidades: [
        sucesso([{ unidade_id: 'L1' }]),
        sucesso([{ unidade_id: 'L1', usuario_id: 'G2' }]),
      ],
      usuarios: sucesso([]),
      unidades: sucesso([{ id: 'L1', nome: 'Loja Centro' }]),
      rotas: sucesso([]),
    });

    const recusa = await verificarGuardas(cliente, 'u1');

    expect(recusa?.codigo).toBe('ULTIMO_GESTOR');
    expect(filtros).toContainEqual({
      tabela: 'usuarios',
      op: 'in',
      coluna: 'id',
      valor: ['G2'],
    });
    expect(filtros).toContainEqual({
      tabela: 'usuarios',
      op: 'eq',
      coluna: 'ativo',
      valor: true,
    });
  });

  it('libera o gestor quando o outro gestor da loja está ativo', async () => {
    const { cliente } = clienteFalso({
      usuario_unidades: [
        sucesso([{ unidade_id: 'L1' }]),
        sucesso([{ unidade_id: 'L1', usuario_id: 'G2' }]),
      ],
      usuarios: sucesso([{ id: 'G2' }]),
      rotas: sucesso([]),
    });

    expect(await verificarGuardas(cliente, 'u1')).toBeNull();
  });

  it('não libera quando a conferência do cadastro do outro gestor falha', async () => {
    const { cliente } = clienteFalso({
      usuario_unidades: [
        sucesso([{ unidade_id: 'L1' }]),
        sucesso([{ unidade_id: 'L1', usuario_id: 'G2' }]),
      ],
      usuarios: { error: { message: 'boom' } },
      rotas: sucesso([]),
    });

    expect(await verificarGuardas(cliente, 'u1')).toMatchObject({
      codigo: 'GUARDA_INDISPONIVEL',
      status: 503,
    });
  });

  it('sem outro vínculo de gestor, não consulta usuarios', async () => {
    const { cliente, filtros } = clienteFalso({
      usuario_unidades: [sucesso([{ unidade_id: 'L1' }]), sucesso([])],
      unidades: sucesso([{ id: 'L1', nome: 'Loja Centro' }]),
      rotas: sucesso([]),
    });

    await verificarGuardas(cliente, 'u1');

    expect(filtros.some((f) => f.tabela === 'usuarios')).toBe(false);
  });
});
