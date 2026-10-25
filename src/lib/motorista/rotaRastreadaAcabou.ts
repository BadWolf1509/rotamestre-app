/**
 * Conferência pelo id: a rota rastreada acabou, ou não é mais deste motorista?
 *
 * POR QUE UM MÓDULO PRÓPRIO. Os dois lados que desligam o rastreamento
 * precisam da MESMA regra: a task de segundo plano
 * (`src/services/unifiedLocationTracking.ts`) e a tela
 * (`useGarantirRastreamentoDaRota`). A tela confiava no vazio da carga da
 * rota ativa e conferia a sessão só depois; na volta da rede, com o refresh
 * em cooldown, a carga sai anônima e vazia SEM erro, o token renova logo
 * depois e a sessão confirma — e a tela parava uma rota viva (Important 1 da
 * revisão final da 1.14.6). Aqui a resposta vem de uma consulta pelo id, com
 * a sessão conferida antes E depois.
 *
 * Só devolve true com certeza. Qualquer erro, falta de rede ou sessão não
 * confirmada devolve false: na dúvida, segue rastreando.
 */
import { lerSessao } from '@/lib/auth/sessao';
import { logarFalha } from '@/lib/logarFalha';
import { supabase } from '@/lib/supabase';

/** A sessão lida agora é a deste motorista. */
async function sessaoDoMotorista(motoristaId: string): Promise<boolean> {
  const { session } = await lerSessao();
  return session?.user?.id === motoristaId;
}

/**
 * true só com certeza de que a rota `rotaId` acabou (fora de `em_andamento`)
 * ou não é mais de `motoristaId`.
 */
export async function rotaRastreadaAcabou({
  rotaId,
  motoristaId,
}: {
  rotaId: string;
  motoristaId: string;
}): Promise<boolean> {
  try {
    // Lida ANTES do SELECT também: ver o caso "sem linha" abaixo.
    const sessaoAntes = await sessaoDoMotorista(motoristaId);
    const { data, error } = await supabase
      .from('rotas')
      .select('status, motorista_id')
      .eq('id', rotaId)
      .maybeSingle<{ status: string; motorista_id: string | null }>();
    if (error) {
      // Sem rede ou recusa passageira: na dúvida, segue rastreando.
      logarFalha('[Rastreamento] Falha ao conferir a rota rastreada', error);
      return false;
    }
    if (data) {
      return (
        data.status !== 'em_andamento' || data.motorista_id !== motoristaId
      );
    }
    // Sem linha: rota apagada, ou reatribuída (a RLS de `rotas` esconde a
    // de outro motorista). Mas a consulta que sai anônima (refresh do token
    // falhou) também volta vazia, sem erro — só a sessão deste motorista
    // confirmada torna o "vazio" uma resposta. Antes E depois do SELECT: só
    // depois, um token renovado logo após a consulta anônima confirmaria um
    // vazio que não era resposta sobre este motorista.
    return sessaoAntes && (await sessaoDoMotorista(motoristaId));
  } catch (err) {
    logarFalha('[Rastreamento] Falha ao conferir a rota rastreada', err);
    return false;
  }
}
