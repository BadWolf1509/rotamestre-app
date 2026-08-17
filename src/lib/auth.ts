import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { logger } from './logger';
import { supabase, isSupabaseConfigured } from './supabase';
import { setMockSession } from '../hooks/useAuth';
import { Usuario, TipoUsuario, UnidadeDB } from '../types/usuario';

import type { Session } from '@supabase/supabase-js';

const FALLBACK_WEB_BASE_URL = 'https://app.rotamestre.tec.br';

/** Base pública do app web. Fonte canônica: app.config.js → extra.baseUrl */
function getWebBaseUrl(): string {
  const configured: unknown = Constants.expoConfig?.extra?.baseUrl;
  return typeof configured === 'string' && configured.length > 0
    ? configured
    : FALLBACK_WEB_BASE_URL;
}

export const authService = {
  // Login
  async signIn(email: string, password: string) {
    // Mock for E2E/CI when credentials are missing
    if (!isSupabaseConfigured) {
      logger.warn('[Auth] Mocking sign in for E2E/CI');
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate network delay

      const isGestor = email.includes('gestor');
      const mockUserId = isGestor ? 'mock-gestor-id' : 'mock-motorista-id';
      const mockUnidadeId = 'mock-unidade-id';

      const mockUser: Usuario = {
        id: mockUserId,
        email,
        nome: isGestor ? 'Gestor Teste' : 'Motorista Teste',
        papel: isGestor ? 'gestor' : 'motorista',
        ativo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        unidade_id: mockUnidadeId,
        unidades: {
          id: mockUnidadeId,
          nome: 'Unidade Teste',
          cidade: 'São Paulo',
          ativa: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } satisfies UnidadeDB,
      };

      const mockSession = {
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: mockUserId, email: mockUser.email },
      } as unknown as Session;

      // Store mock session for useAuth hook to pick up
      setMockSession(mockSession, mockSession.user);

      return {
        session: mockSession,
        usuario: mockUser,
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Buscar dados do usuário na tabela usuarios
    if (data.user) {
      const usuario = await this.getUsuario(data.user.id);
      await supabase
        .from('usuarios')
        .update({ ultimo_login: new Date().toISOString() })
        .eq('id', data.user.id);
      return { session: data.session, usuario };
    }

    return { session: data.session, usuario: null };
  },

  // Registro
  /**
   * Cria apenas a conta no Auth.
   *
   * O perfil (`usuarios`) e a unidade nascem depois, na RPC
   * `criar_unidade_para_novo_gestor`, chamada pela tela de onboarding após o
   * primeiro login. Inserir em `usuarios` aqui é o que quebrava o cadastro: a
   * policy exige que o autor já seja gestor de alguma unidade, então o insert
   * falhava DEPOIS da conta já existir — deixando conta órfã.
   *
   * `nome` viaja em `options.data` só para a tela de onboarding pré-preencher.
   * É metadata controlada pelo client, então a RPC revalida.
   */
  async signUp(email: string, password: string, nome: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome } },
    });

    if (error) throw error;

    return data;
  },

  // Logout
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      // Ignora erro "Auth session missing" pois o objetivo é deslogar
      // Se não há sessão, o usuário já está deslogado
      if (error && !error.message?.includes('Auth session missing')) {
        throw error;
      }
    } catch (err: any) {
      // Trata graciosamente erros de sessão inexistente
      if (!err.message?.includes('Auth session missing')) {
        throw err;
      }
    }
  },

  /**
   * Exclui definitivamente a conta autenticada no backend e remove os dados
   * locais somente depois da confirmação do servidor.
   */
  async deleteAccount() {
    const { data, error } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
    });

    if (error) throw error;
    if (!data?.success) {
      throw new Error(data?.error || 'Não foi possível excluir a conta.');
    }

    // A conta já não existe no servidor. Limpa a sessão local sem depender de
    // outra chamada de rede e remove caches que possam conter dados pessoais.
    await supabase.auth.signOut({ scope: 'local' });
    await AsyncStorage.clear();
    setMockSession(null, null);

    return data as {
      success: true;
      deletedAt: string;
      retainedData: string[];
    };
  },

  // Recuperar senha
  async resetPassword(email: string) {
    // Native não tem handler de deep link nem detectSessionInUrl, então o link
    // do email leva sempre à web, onde o fluxo de recovery é suportado.
    const redirectTo =
      Platform.OS === 'web'
        ? `${window.location.origin}/auth/reset-password`
        : `${getWebBaseUrl()}/auth/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw error;
  },

  /**
   * Reenvia o email de confirmação de cadastro.
   *
   * Chamado do login, quando o Supabase recusa a entrada com "Email not
   * confirmed" — é o único ponto onde sabemos o email E que a conta existe sem
   * ter confirmado, então não há enumeração a proteger aqui (diferente do
   * `resetPassword`, acessível a quem só tem um palpite de endereço).
   *
   * Sem `emailRedirectTo`, igual ao `signUp`: o destino sai do Site URL. O
   * email reenviado usa o template **Confirm signup**, que já carrega a
   * proteção anti link-scanner (`supabase/templates/confirm-signup.html`).
   */
  async resendConfirmation(email: string) {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw error;
  },

  // Atualizar senha
  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  },

  /**
   * Marca usuarios.primeira_senha = false para o usuário autenticado.
   * Nunca lança: falha aqui é não-crítica (o usuário apenas reveria o
   * onboarding de primeira senha no próximo acesso).
   */
  async marcarPrimeiraSenhaConcluida(): Promise<void> {
    if (!isSupabaseConfigured) return; // E2E/CI sem credenciais

    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        logger.warn(
          '[Auth] Sem usuário autenticado para limpar primeira_senha',
          error ?? undefined,
        );
        return;
      }

      const { error: updateError } = await supabase
        .from('usuarios')
        .update({ primeira_senha: false })
        .eq('id', data.user.id);

      if (updateError) {
        logger.warn(
          '[Auth] Falha ao limpar primeira_senha (não-crítico)',
          updateError,
        );
      }
    } catch (err) {
      logger.warn('[Auth] Erro inesperado ao limpar primeira_senha', err);
    }
  },

  // Obter sessão atual
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  // Obter dados do usuário
  async getUsuario(userId: string): Promise<Usuario | null> {
    // `.maybeSingle()`, não `.single()`: entre o cadastro e a RPC do onboarding
    // a pessoa legitimamente não tem linha em `usuarios` — é assim que o fluxo
    // self-service funciona, e `app/index.tsx` conta com o null para mandar ao
    // onboarding. O `.single()` traduzia esse estado esperado em 406 + PGRST116,
    // que virava logger.error; com o Sentry ligado na web em produção, todo
    // cadastro que DEU CERTO registrava erros. Aqui zero linhas devolve
    // data:null com error:null, e só falha de verdade cai no if abaixo.
    const { data, error } = await supabase
      .from('usuarios')
      .select('*, unidades(nome)')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      logger.error('[Auth] Erro ao buscar usuário:', error);
      return null;
    }

    return data;
  },

  // Verificar tipo de usuário
  async verificarTipoUsuario(userId: string): Promise<TipoUsuario | null> {
    const usuario = await this.getUsuario(userId);
    return usuario?.papel || null; // Alterado de 'tipo' para 'papel' (match com DB)
  },
};
