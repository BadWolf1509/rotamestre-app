/**
 * motoristaNaLoja — operações do gestor sobre o motorista na loja: alternar
 * ativo pela RPC `alternar_motorista_na_unidade`, editar nome/telefone, gravar
 * a auditoria e traduzir o erro em frase para o toast.
 *
 * Contrato de erro: as funções RELANÇAM o erro original (o objeto do
 * PostgREST com `code`), porque o bloqueio por rota aberta e o P0001 dependem
 * dele intacto. Quem mostra toast e pede confirmação é a página, nunca esta lib.
 */
import { getErrorMessage } from '@/lib/errorMapping';
import { logger } from '@/lib/logger';
import { mensagemRegraDoBanco } from '@/lib/motorista/mensagemRegraDoBanco';
import { logUserAction, updateUsuario } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

export type EscopoAlternancia = 'vinculo' | 'pessoa';

const INDICE_TELEFONE_MOTORISTA = 'usuarios_motorista_telefone_unico';

/**
 * Auditoria sem aguardar. O `logUserAction` já engole a falha, mas a lib não
 * depende disso: qualquer rejeição (ou lançamento síncrono) vira só warn, para
 * nunca virar unhandled rejection nem derrubar a operação principal.
 */
function registrarAuditoria(
  gestorId: string | null | undefined,
  evento: string,
  detalhes: Record<string, unknown>,
): void {
  if (!gestorId) return;
  try {
    Promise.resolve(logUserAction(gestorId, evento, detalhes)).catch(
      (error: unknown) => {
        logger.warn('[motoristaNaLoja] auditoria recusada: ' + evento, error);
      },
    );
  } catch (error: unknown) {
    logger.warn('[motoristaNaLoja] auditoria falhou: ' + evento, error);
  }
}

export async function alternarMotoristaNaLoja(p: {
  motoristaId: string;
  motoristaNome: string;
  unidadeId: string;
  ativo: boolean;
  gestorId?: string | null;
}): Promise<EscopoAlternancia> {
  // Quem atende outra loja é desativado só nesta (o vínculo); quem atende uma
  // só, a pessoa. A decisão é do banco.
  const { data, error } = await supabase.rpc('alternar_motorista_na_unidade', {
    p_motorista_id: p.motoristaId,
    p_unidade_id: p.unidadeId,
    p_ativo: p.ativo,
  });
  if (error) throw error;

  registrarAuditoria(
    p.gestorId,
    p.ativo ? 'motorista_ativado' : 'motorista_desativado',
    { motorista_id: p.motoristaId, motorista_nome: p.motoristaNome },
  );

  return data === 'vinculo' ? 'vinculo' : 'pessoa';
}

export async function editarDadosMotorista(p: {
  motoristaId: string;
  nome: string;
  telefone?: string | null;
  gestorId?: string | null;
}): Promise<{ nome: string; telefone: string | null }> {
  // E-mail não é editável (é o login, no Auth); a trava de outra loja só
  // aceita nome e telefone. Nunca enviar outra coluna.
  const nome = p.nome.trim();
  const telefone = p.telefone?.trim() || null;

  const result = await updateUsuario(p.motoristaId, { nome, telefone });
  if (!result.success) {
    throw result.error.originalError ?? result.error;
  }

  registrarAuditoria(p.gestorId, 'motorista_editado', {
    motorista_id: p.motoristaId,
    motorista_nome: nome,
  });

  return { nome, telefone };
}

/**
 * Frase para o toast: colisão do índice de telefone entre motoristas ativos
 * (aceita o Error relançado e o objeto do Postgres), regra do banco (P0001,
 * já em português) ou o texto padrão da tela. Nunca o texto técnico.
 */
export function mensagemErroMotorista(error: unknown, padrao: string): string {
  const texto =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : '';
  if (texto.includes(INDICE_TELEFONE_MOTORISTA)) {
    return getErrorMessage(error).message;
  }
  return mensagemRegraDoBanco(error) ?? padrao;
}
