/**
 * "Limpar Cache" (Configurações do motorista e do gestor) apagava tudo menos
 * a sessão — inclusive a fila de concluir/pular feitos sem rede, os avisos de
 * descarte e o índice das fotos de comprovante que ainda não subiram. Cache
 * é o que dá para buscar de novo; aquilo é dado que só existe no aparelho.
 */
import fs from 'fs';
import path from 'path';

import { chavesParaLimparNoCache } from '../limpezaDeCache';

const PRESERVADAS = [
  'sb-xezslsyxjivunmhhyxtd-auth-token',
  'supabase.auth.token',
  '@rotamestre:fila_acoes_parada',
  '@rotamestre:fila_acoes_parada_descartes',
  '@rotamestre:offline_photos_index',
  '@rotamestre:offline_queue',
  // preferência de push escolhida sem rede (só existe no aparelho) e a cópia
  // que a acompanha (src/lib/notificacoes/preferenciasPush.ts)
  '@rotamestre:preferencias_push_pendente:u1',
  '@rotamestre:preferencias_push:u1',
];
const DESCARTAVEIS = [
  '@cache_rotas_u1',
  'route_cache_abc',
  'gestao_rotas_cache_x',
  '@rotamestre:offline_data',
];

describe('chavesParaLimparNoCache', () => {
  it('apaga o cache e preserva sessão, fila de ações e fotos pendentes', () => {
    const apagar = chavesParaLimparNoCache([...PRESERVADAS, ...DESCARTAVEIS]);
    expect(apagar.sort()).toEqual([...DESCARTAVEIS].sort());
  });

  it('a limpeza do logout (#629) também não apaga a fila de ações nem os avisos', () => {
    const { CHAVES_DA_CONTA, PREFIXOS_DA_CONTA } = jest.requireActual(
      '../auth/limparEstadoLocal',
    );
    for (const chave of [
      '@rotamestre:fila_acoes_parada',
      '@rotamestre:fila_acoes_parada_descartes',
      '@rotamestre:offline_photos_index',
    ]) {
      expect(CHAVES_DA_CONTA).not.toContain(chave);
      expect(
        (PREFIXOS_DA_CONTA as readonly string[]).some((p) =>
          chave.startsWith(p),
        ),
      ).toBe(false);
    }
  });

  it.each([
    'app/motorista/perfil/configuracoes.tsx',
    'app/gestor/configuracoes.tsx',
  ])('%s usa a lista compartilhada (não filtra à mão)', (arquivo) => {
    const texto = fs.readFileSync(
      path.resolve(__dirname, '..', '..', '..', arquivo),
      'utf8',
    );
    expect(texto).toContain('chavesParaLimparNoCache');
  });
});
