/**
 * A conta pode entrar no app? Só entra quem tem ao menos um vínculo ativo com
 * uma loja (`usuario_unidades.ativo`) e, para motorista, `usuarios.ativo` não
 * é false. Quem está desativado em TODAS as lojas não entra e vê
 * `MENSAGEM_CONTA_DESATIVADA`. O corte por loja (pessoa desativada numa loja
 * mas ativa em outra) é do banco, não daqui.
 *
 * SÓ A RESPOSTA DO SERVIDOR BLOQUEIA. Erro, exceção ou resposta sem lista
 * significam "não deu para saber" e a conta segue como ativa: bloquear sem
 * resposta transformaria o modo offline da 1.14.4 (perfil conhecido, sem
 * rede) em "Sua conta está desativada". Por isso os portões que usam isto
 * (`signIn` e `app/index.tsx`) só o chamam com o perfil vindo do servidor,
 * nunca com o perfil conhecido guardado no aparelho.
 *
 * `usuarios.ativo=false` de GESTOR é ignorado de propósito: existem gestores
 * assim com vínculo ativo (dado antigo), e quem manda é o vínculo.
 */
import { logger } from '../logger';
import { supabase } from '../supabase';

import type { Usuario } from '../../types/usuario';

export const MENSAGEM_CONTA_DESATIVADA =
  'Sua conta está desativada. Fale com o gestor.';

export class ContaDesativada extends Error {
  constructor() {
    super(MENSAGEM_CONTA_DESATIVADA);
    this.name = 'ContaDesativada';
  }
}

export async function contaEstaAtiva(
  usuario: Pick<Usuario, 'id' | 'papel' | 'ativo'>,
): Promise<boolean> {
  if (usuario.papel === 'motorista' && usuario.ativo === false) return false;

  try {
    const { data, error } = await supabase
      .from('usuario_unidades')
      .select('ativo')
      .eq('usuario_id', usuario.id);

    if (error || !Array.isArray(data)) {
      logger.warn('[Auth] Vínculos indisponíveis; conta segue como ativa', error);
      return true;
    }
    return data.some((v: { ativo?: boolean }) => v.ativo === true);
  } catch (error) {
    logger.warn('[Auth] Falha ao conferir os vínculos; conta segue ativa', error);
    return true;
  }
}
