/**
 * Exclusão de rota pelo gestor — a ÚNICA porta, usada pelo dashboard desktop
 * e pela Gestão de Rotas.
 *
 * Antes havia duas: a Gestão de Rotas bloqueava `em_andamento` pelo status
 * que a TELA tinha (podia estar velho), e o dashboard desktop nem olhava —
 * apagava rota com motorista na rua. E o log `rota_excluida` nunca foi
 * gravado: era inserido DEPOIS do DELETE com o `rota_id` da rota apagada, a
 * FK `logs_rota_id_fkey` recusava e o erro não era lido (0 exclusões em
 * 8.125 logs, medido em 22/10/2026).
 *
 * Ordem aqui:
 * 1. Reconsulta o status NO SERVIDOR (`maybeSingle`: a rota pode ter sumido).
 *    `em_andamento` → recusa.
 * 2. Grava o log ANTES do DELETE, com `rota_id` da rota (ainda existe, a FK
 *    aceita). A FK é `ON DELETE SET NULL`: o DELETE zera o `rota_id` depois,
 *    e o id fica em `detalhes.rota_id`. Por que não `rota_id: null` já no
 *    INSERT: o trigger `prevent_duplicate_log` descarta, sem erro, o log com
 *    mesmo rota_id + evento + usuário nos últimos 5 s — com rota_id nulo, a
 *    2ª de duas exclusões seguidas do mesmo gestor sumiria do histórico.
 * 3. DELETE condicionado a `status <> 'em_andamento'` (fecha a janela entre
 *    a consulta e o DELETE, caso o motorista inicie a rota nesse meio tempo)
 *    com `.select('id')`: zero linhas é falha (RLS, rota iniciada), não
 *    sucesso. Nesse caso grava `rota_exclusao_falhou` para o log do passo 2
 *    não ficar mentindo sozinho.
 */
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export const MENSAGEM_ROTA_EM_ANDAMENTO =
  'Não é possível excluir uma rota em andamento. Aguarde a conclusão ou cancele a rota primeiro.';

export type MotivoFalhaExclusao =
  'em_andamento' | 'nao_encontrada' | 'nao_excluida';

const MENSAGENS: Record<MotivoFalhaExclusao, string> = {
  em_andamento: MENSAGEM_ROTA_EM_ANDAMENTO,
  nao_encontrada:
    'A rota não foi encontrada. Ela pode já ter sido excluída — atualize a lista.',
  nao_excluida:
    'A rota não foi excluída. Ela pode ter sido iniciada agora ou você não tem permissão. Atualize a lista e tente de novo.',
};

export class ExclusaoRotaError extends Error {
  readonly motivo: MotivoFalhaExclusao;

  constructor(motivo: MotivoFalhaExclusao) {
    super(MENSAGENS[motivo]);
    this.name = 'ExclusaoRotaError';
    this.motivo = motivo;
  }
}

export interface ExcluirRotaParams {
  rotaId: string;
  usuarioId: string;
  /** Só para o log: o nome some junto com a rota. */
  motoristaNome?: string | null;
  paradasCount?: number;
}

export async function excluirRota({
  rotaId,
  usuarioId,
  motoristaNome,
  paradasCount,
}: ExcluirRotaParams): Promise<void> {
  const { data: rota, error: erroConsulta } = await supabase
    .from('rotas')
    .select('id, status, data, motorista_id')
    .eq('id', rotaId)
    .maybeSingle();

  if (erroConsulta) throw erroConsulta;
  if (!rota) throw new ExclusaoRotaError('nao_encontrada');
  if (rota.status === 'em_andamento') {
    throw new ExclusaoRotaError('em_andamento');
  }

  const detalhes = {
    motivo: 'Excluída pelo gestor',
    rota_id: rota.id,
    data: rota.data,
    motorista_id: rota.motorista_id,
    motorista_nome: motoristaNome ?? null,
    paradas_count: paradasCount ?? null,
    status_anterior: rota.status,
  };

  const { error: erroLog } = await supabase.from('logs').insert({
    usuario_id: usuarioId,
    rota_id: rota.id,
    evento: 'rota_excluida',
    detalhes,
  });
  // Sem rastro, sem exclusão: apagar uma rota (e os comprovantes em cascata)
  // sem auditoria é pior do que pedir para tentar de novo.
  if (erroLog) throw erroLog;

  const { data: apagadas, error: erroDelete } = await supabase
    .from('rotas')
    .delete()
    .eq('id', rotaId)
    .neq('status', 'em_andamento')
    .select('id');

  if (erroDelete || (apagadas?.length ?? 0) === 0) {
    const { error: erroCompensacao } = await supabase.from('logs').insert({
      usuario_id: usuarioId,
      rota_id: rota.id,
      evento: 'rota_exclusao_falhou',
      detalhes: { ...detalhes, erro: erroDelete?.message ?? '0 linhas' },
    });
    if (erroCompensacao) {
      logger.warn(
        '[excluirRota] log rota_excluida ficou sem a compensação',
        erroCompensacao,
      );
    }
    if (erroDelete) throw erroDelete;
    throw new ExclusaoRotaError('nao_excluida');
  }
}

/**
 * Texto da confirmação. Rota concluída apaga, em cascata, as paradas e os
 * comprovantes de entrega (fotos, assinaturas): a confirmação diz isso com
 * todas as letras em vez de bloquear.
 */
export function textoConfirmacaoExclusao(rota: {
  status?: string | null;
  motoristaNome?: string | null;
  paradasCount?: number | null;
  statusLabel?: string | null;
}): { titulo: string; mensagem: string } {
  const resumo = [
    rota.motoristaNome !== undefined
      ? `Motorista: ${rota.motoristaNome || 'Sem motorista'}`
      : null,
    rota.paradasCount != null ? `Paradas: ${rota.paradasCount}` : null,
    rota.statusLabel ? `Status: ${rota.statusLabel}` : null,
  ]
    .filter(Boolean)
    .join('\n');
  const corpoResumo = resumo ? `\n\n${resumo}` : '';

  if (rota.status === 'concluida') {
    return {
      titulo: 'Excluir rota concluída?',
      mensagem: `Esta rota já foi concluída. Excluí-la apaga também todas as paradas e os comprovantes de entrega (fotos e registros) — eles não poderão ser recuperados.${corpoResumo}\n\nEsta ação não pode ser desfeita.`,
    };
  }

  return {
    titulo: 'Excluir Rota',
    mensagem: `Tem certeza que deseja excluir esta rota?${corpoResumo}\n\nEsta ação não pode ser desfeita.`,
  };
}
