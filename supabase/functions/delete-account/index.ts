/* global Deno */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { caminhoDoAvatarDaConta } from './avatarDaConta.ts';
import { verificarGuardas } from './guardasExclusao.ts';
import { chaveSecreta } from '../_shared/chaves.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405);
  }

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Não autorizado' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = chaveSecreta();
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const token = authorization.slice('Bearer '.length);
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: 'Sessão inválida ou expirada' }, 401);
    }

    // Antes de qualquer coisa irreversível (avatar, usuário): o último gestor
    // de uma loja e quem está com rota em andamento não são apagados.
    const recusa = await verificarGuardas(supabaseAdmin, user.id);
    if (recusa) {
      return jsonResponse(
        { error: recusa.mensagem, code: recusa.codigo },
        recusa.status,
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('usuarios')
      .select('foto_url')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.warn('[delete-account] Perfil não pôde ser consultado', {
        userId: user.id,
        code: profileError.code,
      });
    }

    const avatarPath = caminhoDoAvatarDaConta(profile?.foto_url, user.id);
    if (avatarPath) {
      const { error: avatarError } = await supabaseAdmin.storage
        .from('fotos-entrega')
        .remove([avatarPath]);

      if (avatarError) {
        // A exclusão da conta não deve ficar bloqueada por um arquivo já
        // ausente. O erro é registrado sem expor dados pessoais.
        console.warn('[delete-account] Avatar não pôde ser removido', {
          userId: user.id,
          code: avatarError.name,
        });
      }
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      user.id,
    );

    if (deleteError) {
      console.error('[delete-account] Falha ao excluir usuário', {
        userId: user.id,
        code: deleteError.name,
      });
      return jsonResponse(
        { error: 'Não foi possível concluir a exclusão da conta.' },
        500,
      );
    }

    return jsonResponse(
      {
        success: true,
        deletedAt: new Date().toISOString(),
        retainedData: [
          'registros empresariais anonimizados',
          'registros exigidos por obrigações legais',
        ],
      },
      200,
    );
  } catch (error) {
    console.error('[delete-account] Erro inesperado', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return jsonResponse(
      { error: 'Não foi possível concluir a exclusão da conta.' },
      500,
    );
  }
});
