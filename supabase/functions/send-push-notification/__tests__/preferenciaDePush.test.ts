// Decisão "envia ou não" pela preferência de push da conta (Migration 47).
//
// Regras (task 7 da 1.14.6):
// - SOS sempre envia, qualquer que seja a preferência;
// - sem linha de preferência, vale tudo ligado;
// - consulta que falha (inclusive a tabela ainda não existir) ENVIA: o aviso
//   importa mais que a preferência;
// - o "push geral" desligado cala todas as categorias, menos o SOS.
//
// O cliente é um dublê mínimo da cadeia do supabase-js, no padrão de
// tokensDaConta.test.ts.
import {
  categoriaDoTipo,
  decidirEnvio,
  lerPreferenciaDePush,
  type PreferenciaDePush,
} from '../preferenciaDePush';

const TUDO_LIGADO: PreferenciaDePush = {
  push_ativo: true,
  incidentes: true,
  rotas: true,
  resumo_diario: true,
};

type Resposta = {
  data?: unknown;
  error: { code?: string; message: string } | null;
};

function clienteFalso(resposta: Resposta | (() => never)) {
  const chamadas: Array<{
    tabela: string;
    colunas: string;
    eq: Array<[string, unknown]>;
  }> = [];
  const cliente = {
    from(tabela: string) {
      return {
        select(colunas: string) {
          const registro = {
            tabela,
            colunas,
            eq: [] as Array<[string, unknown]>,
          };
          chamadas.push(registro);
          const builder = {
            eq(col: string, val: unknown) {
              registro.eq.push([col, val]);
              return builder;
            },
            then(resolve: (v: Resposta) => unknown) {
              if (typeof resposta === 'function') resposta();
              return resolve(resposta as Resposta);
            },
          };
          return builder;
        },
      };
    },
  };
  return { cliente, chamadas };
}

describe('categoriaDoTipo', () => {
  it('SOS é categoria própria (nunca filtrada)', () => {
    expect(categoriaDoTipo('sos_acionado')).toBe('sos');
  });

  it('incidente reportado é "incidente"', () => {
    expect(categoriaDoTipo('incidente_reportado')).toBe('incidente');
  });

  it.each([
    'nova_rota_atribuida',
    'lembrete_rota_pendente',
    'lembrete_rota_urgente',
    'rota_iniciada',
    'rota_concluida',
    'rota_atrasada',
    'rota_nao_executada',
    'parada_pulada',
    'parada_reaberta',
    'rota_parada_adicionada',
    'rota_parada_removida',
    'rota_parada_editada',
    'rota_reordenada',
  ])('%s é "rota"', (tipo) => {
    expect(categoriaDoTipo(tipo)).toBe('rota');
  });

  it('tipo de resumo (resumo_*) é "resumo"', () => {
    expect(categoriaDoTipo('resumo_diario')).toBe('resumo');
  });

  it('envio direto (sem tipo do banco) é "geral"', () => {
    expect(categoriaDoTipo('direct')).toBe('geral');
  });
});

describe('decidirEnvio', () => {
  it('sem linha de preferência: envia (default tudo ligado)', () => {
    expect(
      decidirEnvio({ tipo: 'rota_concluida', preferencia: null, erro: null }),
    ).toEqual({ envia: true, motivo: 'sem_preferencia' });
  });

  it('consulta falhou: envia (falha aberta)', () => {
    expect(
      decidirEnvio({
        tipo: 'rota_concluida',
        preferencia: null,
        erro: 'timeout',
      }),
    ).toEqual({ envia: true, motivo: 'falha_na_consulta' });
  });

  it('SOS envia mesmo com tudo desligado', () => {
    expect(
      decidirEnvio({
        tipo: 'sos_acionado',
        preferencia: {
          push_ativo: false,
          incidentes: false,
          rotas: false,
          resumo_diario: false,
        },
        erro: null,
      }),
    ).toEqual({ envia: true, motivo: 'sos' });
  });

  it('push geral desligado cala rota, incidente, resumo e envio direto', () => {
    const preferencia = { ...TUDO_LIGADO, push_ativo: false };
    for (const tipo of [
      'rota_concluida',
      'incidente_reportado',
      'resumo_diario',
      'direct',
    ]) {
      expect(decidirEnvio({ tipo, preferencia, erro: null })).toEqual({
        envia: false,
        motivo: 'push_desligado',
      });
    }
  });

  it('categoria desligada cala só a própria categoria', () => {
    const semIncidente = { ...TUDO_LIGADO, incidentes: false };
    expect(
      decidirEnvio({
        tipo: 'incidente_reportado',
        preferencia: semIncidente,
        erro: null,
      }),
    ).toEqual({ envia: false, motivo: 'categoria_desligada' });
    expect(
      decidirEnvio({
        tipo: 'rota_concluida',
        preferencia: semIncidente,
        erro: null,
      }).envia,
    ).toBe(true);

    const semRota = { ...TUDO_LIGADO, rotas: false };
    expect(
      decidirEnvio({ tipo: 'parada_pulada', preferencia: semRota, erro: null }),
    ).toEqual({ envia: false, motivo: 'categoria_desligada' });

    const semResumo = { ...TUDO_LIGADO, resumo_diario: false };
    expect(
      decidirEnvio({
        tipo: 'resumo_diario',
        preferencia: semResumo,
        erro: null,
      }),
    ).toEqual({ envia: false, motivo: 'categoria_desligada' });
  });

  it('envio direto só obedece ao push geral', () => {
    expect(
      decidirEnvio({
        tipo: 'direct',
        preferencia: {
          push_ativo: true,
          incidentes: false,
          rotas: false,
          resumo_diario: false,
        },
        erro: null,
      }),
    ).toEqual({ envia: true, motivo: 'permitido' });
  });

  it('tudo ligado: envia', () => {
    expect(
      decidirEnvio({
        tipo: 'nova_rota_atribuida',
        preferencia: TUDO_LIGADO,
        erro: null,
      }),
    ).toEqual({ envia: true, motivo: 'permitido' });
  });
});

describe('lerPreferenciaDePush', () => {
  it('lê a linha da conta em preferencias_notificacao', async () => {
    const { cliente, chamadas } = clienteFalso({
      data: [{ ...TUDO_LIGADO, rotas: false }],
      error: null,
    });

    const r = await lerPreferenciaDePush(cliente, 'u1');

    expect(r).toEqual({
      preferencia: { ...TUDO_LIGADO, rotas: false },
      erro: null,
    });
    expect(chamadas).toEqual([
      {
        tabela: 'preferencias_notificacao',
        colunas: 'push_ativo, incidentes, rotas, resumo_diario',
        eq: [['usuario_id', 'u1']],
      },
    ]);
  });

  it('sem linha: preferência null, sem erro', async () => {
    const { cliente } = clienteFalso({ data: [], error: null });
    await expect(lerPreferenciaDePush(cliente, 'u1')).resolves.toEqual({
      preferencia: null,
      erro: null,
    });
  });

  it('tabela ainda inexistente (migration não aplicada): devolve o erro', async () => {
    const { cliente } = clienteFalso({
      error: {
        code: 'PGRST205',
        message: "Could not find the table 'public.preferencias_notificacao'",
      },
    });
    const r = await lerPreferenciaDePush(cliente, 'u1');
    expect(r.preferencia).toBeNull();
    expect(r.erro).toMatch(/preferencias_notificacao/);
  });

  it('exceção do cliente (rede): devolve erro, não lança', async () => {
    const { cliente } = clienteFalso(() => {
      throw new Error('fetch failed');
    });
    await expect(lerPreferenciaDePush(cliente, 'u1')).resolves.toEqual({
      preferencia: null,
      erro: 'fetch failed',
    });
  });

  it('coluna nula ou ausente vale ligada (não cala por dado torto)', async () => {
    const { cliente } = clienteFalso({
      data: [{ push_ativo: true, incidentes: null }],
      error: null,
    });
    const r = await lerPreferenciaDePush(cliente, 'u1');
    expect(r.preferencia).toEqual(TUDO_LIGADO);
  });
});
