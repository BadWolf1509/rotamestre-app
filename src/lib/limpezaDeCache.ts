/**
 * O que o "Limpar Cache" das Configurações (motorista e gestor) pode apagar.
 *
 * Cache é o que dá para buscar de novo no servidor. Ficam de fora:
 * - a sessão (chaves do Supabase/Auth);
 * - o que só existe no aparelho e ainda não subiu: a fila de concluir/pular
 *   feitos sem rede e os avisos dela (`@rotamestre:fila_*`,
 *   `src/lib/motorista/filaAcoesParada.ts`), o índice das fotos de
 *   comprovante pendentes, a fila genérica (`src/lib/offline.ts`) e a
 *   preferência de push escolhida sem rede
 *   (`src/lib/notificacoes/preferenciasPush.ts`);
 * - o estado da rota em andamento (MOT-3): o contexto do rastreamento
 *   (`tracking_context` — sem ele cada posição é descartada até o app voltar
 *   ao primeiro plano), a rota guardada, o último usuário e o perfil
 *   conhecido (leitura sem rede), a conclusão e o rascunho de incidente em
 *   voo (atravessam a câmera) e o `navigationState` da navegação.
 *   Apagar isso no meio da rota não "limpa cache": derruba o que a mensagem
 *   do diálogo promete manter.
 *
 * POR QUE PRESERVAR, e não recusar a limpeza com pendência: recusar deixaria
 * a pessoa sem limpar nada enquanto uma foto estivesse presa (ex.: de outra
 * conta no aparelho), e quem limpa cache quer resolver outro problema. A
 * preservação não tem esse beco e não perde comprovante.
 *
 * ALTERNATIVA (b), não adotada: inverter para uma lista do que É cache
 * (`@cache_*`) e apagar só isso. Seria mais segura para chave futura (chave
 * nova nasce preservada), mas mudaria o que hoje é limpo em gestor e
 * motorista sem medição do que existe no aparelho. Ficou a lista de
 * preservados; chave nova de estado da rota entra em `PREFIXOS_PRESERVADOS`.
 */
/**
 * Texto do diálogo de "Limpar Cache" (motorista e gestor): diz o que a
 * limpeza preserva de verdade — a sessão (não precisa entrar de novo) e o
 * que ainda não subiu.
 */
export const MENSAGEM_LIMPAR_CACHE =
  'Isso remove dados temporários do app. Sua sessão, as entregas e as fotos que ainda não foram enviadas são mantidas. Deseja continuar?';

const PREFIXOS_PRESERVADOS = [
  '@rotamestre:fila_',
  '@rotamestre:offline_photos_index',
  '@rotamestre:offline_queue',
  // Preferência de push escolhida sem rede, e a cópia dela (a pendência sobe
  // a partir da cópia). Ver src/lib/notificacoes/preferenciasPush.ts.
  '@rotamestre:preferencias_push',
  // Estado da rota em andamento (MOT-3). Não são cache: ver o cabeçalho.
  '@rotamestre:tracking_context',
  '@rotamestre:rota_guardada',
  '@rotamestre:ultimo_usuario',
  '@rotamestre:perfil_conhecido',
  '@rotamestre:conclusao_em_voo',
  '@rotamestre:rascunho_incidente',
  // Sem prefixo: src/services/locationTracking.ts.
  'navigationState',
];

export function chavesParaLimparNoCache(chaves: readonly string[]): string[] {
  return chaves.filter(
    (k) =>
      !k.includes('supabase') &&
      !k.includes('auth') &&
      !PREFIXOS_PRESERVADOS.some((p) => k.startsWith(p)),
  );
}
