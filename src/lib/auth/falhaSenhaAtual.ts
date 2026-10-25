/**
 * Falha ao conferir a senha atual numa TROCA de senha, classificada.
 *
 * A conferência é um `signIn`. Antes, a tela do gestor transformava QUALQUER
 * falha dele em "Senha atual incorreta" — com a rede fora ou o servidor
 * instável a pessoa passava a duvidar da senha certa. Quatro leituras:
 *
 * - `FalhaAoCarregarPerfil`: a senha foi ACEITA (a sessão foi criada); só o
 *   perfil não carregou e a troca não depende dele → `null`, siga com a troca.
 * - sem rede: não deu para conferir.
 * - credencial recusada: aí sim, "Senha atual incorreta". Só `invalid_credentials`
 *   (ou a mensagem equivalente de respostas antigas) conta como isso.
 * - o resto (5xx, limite de requisições, erro desconhecido): o servidor não
 *   respondeu direito — tampouco prova que a senha está errada.
 *
 * Fica num módulo só para as duas telas (gestor e motorista) dizerem o mesmo.
 */
import { isAuthRetryableFetchError } from '@supabase/supabase-js';

import { ContaDesativada, MENSAGEM_CONTA_DESATIVADA } from './contaAtiva';
import { FalhaAoCarregarPerfil } from './falhaPerfil';
import { isNetworkError } from '../errorMapping';

export interface FalhaSenhaAtual {
  tipo: 'incorreta' | 'sem_rede' | 'indisponivel' | 'conta_desativada';
  titulo: string;
  mensagem: string;
}

function recusouACredencial(erro: unknown): boolean {
  if (typeof erro !== 'object' || erro === null) return false;
  const { code, message } = erro as { code?: unknown; message?: unknown };
  return (
    code === 'invalid_credentials' ||
    (typeof message === 'string' && /invalid.*login.*credentials/i.test(message))
  );
}

/** `null` = a senha foi aceita; siga com a troca. */
export function classificarFalhaSenhaAtual(
  erro: unknown,
): FalhaSenhaAtual | null {
  if (erro instanceof FalhaAoCarregarPerfil) return null;

  if (erro instanceof ContaDesativada) {
    return {
      tipo: 'conta_desativada',
      titulo: 'Conta desativada',
      mensagem: MENSAGEM_CONTA_DESATIVADA,
    };
  }

  if (
    isAuthRetryableFetchError(erro) ||
    erro instanceof TypeError ||
    isNetworkError(erro)
  ) {
    return {
      tipo: 'sem_rede',
      titulo: 'Sem conexão',
      mensagem:
        'Não foi possível conferir sua senha atual. Verifique a conexão e tente de novo.',
    };
  }

  if (recusouACredencial(erro)) {
    return {
      tipo: 'incorreta',
      titulo: 'Senha atual incorreta',
      mensagem: 'Confira a senha atual e tente de novo.',
    };
  }

  return {
    tipo: 'indisponivel',
    titulo: 'Serviço indisponível',
    mensagem:
      'Não foi possível conferir sua senha atual agora. Tente de novo em instantes.',
  };
}
