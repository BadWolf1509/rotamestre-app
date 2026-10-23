/**
 * O que o "Limpar Cache" das Configurações (motorista e gestor) pode apagar.
 *
 * Cache é o que dá para buscar de novo no servidor. Ficam de fora:
 * - a sessão (chaves do Supabase/Auth);
 * - o que só existe no aparelho e ainda não subiu: a fila de concluir/pular
 *   feitos sem rede e os avisos dela (`@rotamestre:fila_*`,
 *   `src/lib/motorista/filaAcoesParada.ts`), o índice das fotos de
 *   comprovante pendentes e a fila genérica (`src/lib/offline.ts`).
 *
 * POR QUE PRESERVAR, e não recusar a limpeza com pendência: recusar deixaria
 * a pessoa sem limpar nada enquanto uma foto estivesse presa (ex.: de outra
 * conta no aparelho), e quem limpa cache quer resolver outro problema. A
 * preservação não tem esse beco e não perde comprovante.
 */
const PREFIXOS_PRESERVADOS = [
  '@rotamestre:fila_',
  '@rotamestre:offline_photos_index',
  '@rotamestre:offline_queue',
];

export function chavesParaLimparNoCache(chaves: readonly string[]): string[] {
  return chaves.filter(
    (k) =>
      !k.includes('supabase') &&
      !k.includes('auth') &&
      !PREFIXOS_PRESERVADOS.some((p) => k.startsWith(p)),
  );
}
