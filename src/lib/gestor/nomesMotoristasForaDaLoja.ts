/**
 * Nome do motorista que saiu da loja, nas rotas que ele fez.
 *
 * A policy de `usuarios` só deixa o gestor ler quem tem vínculo ATIVO numa
 * loja dele: quando o vínculo fica inativo, o embed `usuarios` do select de
 * `rotas` volta vazio, mas a rota segue com `motorista_id`. A RPC
 * `nomes_motoristas_das_rotas` (Migration 72) devolve só o nome desses
 * motoristas, para o gestor ativo da loja da rota e só se a pessoa tem ou
 * teve vínculo com ela.
 *
 * Só as rotas com `motorista_id` e sem nome visível vão à RPC — na maioria
 * das telas, nenhuma (3 rotas no banco em 26/10/2026), e então não há chamada.
 *
 * Erro não interrompe a tela: o nome é complemento, e a rota continua com o
 * rótulo de hoje (`ROTULO_MOTORISTA_OCULTO`). Por isso o erro vira
 * `logger.warn` e Map vazio, em vez de ser lançado.
 */
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

/** Teto da RPC (acima disso ela recusa com 22023 LISTA_GRANDE). */
export const TETO_IDS_POR_CHAMADA = 1000;

export interface RotaParaNome {
  id: string;
  motorista_id?: string | null;
  nomeVisivel?: string | null;
}

interface LinhaNome {
  rota_id: string;
  nome: string;
}

function ehLinhaNome(linha: unknown): linha is LinhaNome {
  if (typeof linha !== 'object' || linha === null) return false;
  const { rota_id, nome } = linha as Record<string, unknown>;
  return typeof rota_id === 'string' && typeof nome === 'string' && !!nome;
}

/**
 * Map rotaId → nome, só para rotas com motorista_id e sem nome visível.
 * Sem nenhuma: não chama a RPC. Erro: logger.warn e Map vazio.
 */
export async function buscarNomesForaDaLoja(
  rotas: RotaParaNome[],
): Promise<Map<string, string>> {
  const ids = [
    ...new Set(
      rotas.filter((r) => r.motorista_id && !r.nomeVisivel).map((r) => r.id),
    ),
  ];
  const nomes = new Map<string, string>();
  if (ids.length === 0) return nomes;

  try {
    // Lotes em sequência: passar de 1000 rotas ocultas numa tela é hipotético
    // (a exportação vai a 10.000 rotas); paralelizar não compensaria.
    for (let i = 0; i < ids.length; i += TETO_IDS_POR_CHAMADA) {
      const { data, error } = await supabase.rpc('nomes_motoristas_das_rotas', {
        p_rota_ids: ids.slice(i, i + TETO_IDS_POR_CHAMADA),
      });
      if (error) throw error;
      // Sem tipos gerados do banco: a linha é conferida em runtime.
      for (const linha of Array.isArray(data) ? data : []) {
        if (ehLinhaNome(linha)) nomes.set(linha.rota_id, linha.nome);
      }
    }
    return nomes;
  } catch (error) {
    logger.warn('[nomesMotoristasForaDaLoja] nomes não carregados', error);
    return new Map();
  }
}
