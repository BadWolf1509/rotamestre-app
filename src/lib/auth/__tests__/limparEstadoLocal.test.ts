/**
 * Sair da conta apaga o que é da PESSOA (dados de rota, unidade, marcadores
 * de conclusão em voo) e preserva o que é do APARELHO (tema, onboarding visto,
 * "Navegar com", limites anti-abuso) e a fila de fotos offline — comprovante
 * de entrega que ainda não subiu não pode sumir num logout.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  limparAparelhoAoExcluirConta,
  limparEstadoLocalDoUsuario,
} from '../limparEstadoLocal';

// Ordem das chamadas que importam: invalidar as posições em voo ANTES de
// apagar o armazenamento, senão um insert que falha por rede logo depois
// regravaria a fila da conta que saiu.
const ordem: string[] = [];
jest.mock('../../motorista/filaPosicoes', () => ({
  invalidarPosicoesEmVoo: () => ordem.push('invalidar'),
}));

const DA_PESSOA = [
  '@cache_user_data_u1',
  '@cache_rotas_list_un1',
  '@cache_google_autocomplete_rua x',
  'gestao_rotas_cache_un1',
  'route_cache_abc',
  '@timeline_last_seen_r1',
  '@rotamestre/route-optimization-cache',
  '@rotamestre:unidade_ativa',
  '@rotamestre:conclusao_em_voo',
  '@rotamestre:rascunho_incidente',
  '@rotamestre:offline_data',
  '@rotamestre:ultimo_usuario',
  '@rotamestre:perfil_conhecido',
  '@rotamestre:rota_guardada',
];

const DO_APARELHO = [
  // Concluir/pular feitos sem rede e seus avisos: podem ser de OUTRA conta
  // (sobem quando ela entrar) — sair desta não pode apagá-los.
  '@rotamestre:fila_acoes_parada',
  '@rotamestre:fila_acoes_parada_descartes',
  '@rotamestre:offline_queue',
  '@rotamestre:offline_photos_index',
  '@rotamestre:theme_preference',
  '@rotamestre:density_preference',
  '@rotamestre:contrast_preference',
  '@rotamestre/onboarding_swipe_seen',
  '@rotamestre:swipe_count',
  '@rotamestre:nav_app_preference',
  '@rotamestre:nav_prefs_migration_v1',
  '@rotamestre:notification_settings',
  '@rotamestre:notification_sound_enabled',
  '@rotamestre/login_limit_x',
  '@rotamestre/ratelimit_y',
  '@rotamestre:tracking_context',
];

let disco: Map<string, string>;

beforeEach(() => {
  disco = new Map([...DA_PESSOA, ...DO_APARELHO].map((k) => [k, 'v']));
  (AsyncStorage.getAllKeys as jest.Mock).mockImplementation(async () => [
    ...disco.keys(),
  ]);
  (AsyncStorage.removeItem as jest.Mock).mockImplementation(async (k) => {
    disco.delete(k);
  });
  (AsyncStorage.multiRemove as jest.Mock).mockImplementation(async (ks) => {
    ordem.push('apagar');
    for (const k of ks) disco.delete(k);
  });
  (AsyncStorage.clear as jest.Mock).mockImplementation(async () => {
    ordem.push('apagar');
  });
  ordem.length = 0;
});

describe('limparEstadoLocalDoUsuario', () => {
  it('apaga os dados da pessoa', async () => {
    await limparEstadoLocalDoUsuario();
    for (const k of DA_PESSOA) expect(disco.has(k)).toBe(false);
  });

  it('preserva preferências do aparelho e a fila de fotos offline', async () => {
    await limparEstadoLocalDoUsuario();
    expect([...disco.keys()].sort()).toEqual([...DO_APARELHO].sort());
  });

  it('invalida as posições em voo antes de apagar as chaves da conta', async () => {
    await limparEstadoLocalDoUsuario();
    expect(ordem).toEqual(['invalidar', 'apagar']);
  });

  it('não lança se o armazenamento falhar: o logout tem de seguir', async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockRejectedValue(
      new Error('disco'),
    );
    await expect(limparEstadoLocalDoUsuario()).resolves.toBeUndefined();
  });
});

describe('limparAparelhoAoExcluirConta', () => {
  const acao = (paradaId: string, motoristaId: string) => ({
    id: `a-${paradaId}`,
    tipo: 'concluir',
    paradaId,
    rotaId: 'r1',
    motoristaId,
    em: '2026-10-23T12:00:00.000Z',
    tentativas: 0,
  });
  const foto = (paradaId: string, dono: Record<string, unknown>) => ({
    localPath: `/docs/offline_photos/${paradaId}.jpg`,
    unidadeId: 'u1',
    rotaId: 'r1',
    paradaId,
    originalUri: 'file://x',
    savedAt: '2026-10-23T12:00:00Z',
    ...dono,
  });

  beforeEach(() => {
    disco.set(
      '@rotamestre:fila_acoes_parada',
      JSON.stringify([acao('p1', 'quem-sai'), acao('p2', 'outra-conta')]),
    );
    disco.set(
      '@rotamestre:fila_acoes_parada_descartes',
      JSON.stringify([
        { acao: acao('p3', 'quem-sai'), motivo: 'rota_encerrada', em: 'x' },
        { acao: acao('p4', 'outra-conta'), motivo: 'rota_encerrada', em: 'x' },
      ]),
    );
    disco.set(
      '@rotamestre:offline_photos_index',
      JSON.stringify([
        foto('p1', { userId: 'quem-sai' }),
        foto('p2', { userId: 'outra-conta' }),
        foto('p5', { semDono: true }),
      ]),
    );
    (AsyncStorage.getItem as jest.Mock).mockImplementation(
      async (k: string) => disco.get(k) ?? null,
    );
    (AsyncStorage.setItem as jest.Mock).mockImplementation(
      async (k: string, v: string) => {
        disco.set(k, v);
      },
    );
    (AsyncStorage.clear as jest.Mock).mockImplementation(async () => {
      ordem.push('apagar');
      disco.clear();
    });
  });

  const ler = (k: string) => JSON.parse(disco.get(k) ?? '[]');

  it('invalida as posições em voo antes de apagar o aparelho', async () => {
    await limparAparelhoAoExcluirConta('quem-sai');
    expect(ordem).toEqual(['invalidar', 'apagar']);
  });

  it('apaga tudo do aparelho, mas guarda as pendências de OUTRAS contas', async () => {
    await limparAparelhoAoExcluirConta('quem-sai');

    expect(
      ler('@rotamestre:fila_acoes_parada').map(
        (a: { paradaId: string }) => a.paradaId,
      ),
    ).toEqual(['p2']);
    expect(
      ler('@rotamestre:fila_acoes_parada_descartes').map(
        (d: { acao: { paradaId: string } }) => d.acao.paradaId,
      ),
    ).toEqual(['p4']);
    // Foto sem dono conhecido pode ser de qualquer um: fica.
    expect(
      ler('@rotamestre:offline_photos_index').map(
        (f: { paradaId: string }) => f.paradaId,
      ),
    ).toEqual(['p2', 'p5']);
    for (const k of DA_PESSOA) expect(disco.has(k)).toBe(false);
    expect(disco.has('@rotamestre:theme_preference')).toBe(false);
  });

  it('sem pendência de outra conta, não regrava chave vazia', async () => {
    disco.set(
      '@rotamestre:fila_acoes_parada',
      JSON.stringify([acao('p1', 'quem-sai')]),
    );
    disco.delete('@rotamestre:fila_acoes_parada_descartes');
    disco.delete('@rotamestre:offline_photos_index');
    await limparAparelhoAoExcluirConta('quem-sai');
    expect([...disco.keys()]).toEqual([]);
  });
});
