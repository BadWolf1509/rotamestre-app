/**
 * Sair da conta apaga o que é da PESSOA (dados de rota, unidade, marcadores
 * de conclusão em voo) e preserva o que é do APARELHO (tema, onboarding visto,
 * "Navegar com", limites anti-abuso) e a fila de fotos offline — comprovante
 * de entrega que ainda não subiu não pode sumir num logout.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { limparEstadoLocalDoUsuario } from '../limparEstadoLocal';

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
];

const DO_APARELHO = [
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
    for (const k of ks) disco.delete(k);
  });
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

  it('não lança se o armazenamento falhar: o logout tem de seguir', async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockRejectedValue(
      new Error('disco'),
    );
    await expect(limparEstadoLocalDoUsuario()).resolves.toBeUndefined();
  });
});
