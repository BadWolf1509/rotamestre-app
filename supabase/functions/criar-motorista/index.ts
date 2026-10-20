/* global Deno */

// Edge Function para criar motorista usando Admin API
// Deploy: supabase functions deploy criar-motorista

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
  ehEmailDuplicadoNoAuth,
  escaparLike,
  normalizarEmail,
  respostaEmailJaCadastrado,
} from './emailExistente.ts';
import {
  ehViolacaoTelefoneUnico,
  MSG_TELEFONE_OUTRA_LOJA,
  CODIGO_TELEFONE_JA_CADASTRADO,
  respostaTelefoneDuplicado,
} from './telefoneDuplicado.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Criar cliente Supabase com Service Role Key (só disponível server-side)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // Criar cliente normal para validar o usuário chamador
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      },
    );

    // Validar que o usuário está autenticado e é gestor
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar dados do gestor
    const { data: gestorData, error: gestorError } = await supabaseClient
      .from('usuarios')
      .select('papel, unidade_id')
      .eq('id', user.id)
      .single();

    if (gestorError || !gestorData || gestorData.papel !== 'gestor') {
      return new Response(
        JSON.stringify({ error: 'Apenas gestores podem criar motoristas' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Obter dados do novo motorista do body
    const { nome, email, senha, telefone } = await req.json();

    if (!nome || !email || !senha) {
      return new Response(
        JSON.stringify({ error: 'Nome, email e senha são obrigatórios' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const emailNormalizado = normalizarEmail(email);

    // E-mail que já tem conta: recusa, nunca vincula (ver emailExistente.ts).
    // Sem diferenciar maiúscula: o Auth guarda minúsculas, e linhas antigas de
    // `usuarios` podem ter sido gravadas como o gestor digitou.
    const { data: contasComEmail, error: emailError } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .ilike('email', escaparLike(emailNormalizado))
      .limit(1);

    if (emailError) {
      // Sem a checagem não dá para saber se a conta já existe; não arrisca.
      return new Response(
        JSON.stringify({ error: 'Não foi possível verificar o e-mail.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (contasComEmail && contasComEmail.length > 0) {
      const recusa = respostaEmailJaCadastrado();
      return new Response(
        JSON.stringify({ error: recusa.error, codigo: recusa.codigo }),
        {
          status: recusa.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Telefone já usado por motorista ativo (nunca vincula pelo telefone: só recusa)
    if (telefone?.trim()) {
      const { data: encontrados, error: telefoneError } =
        await supabaseAdmin.rpc('motorista_ativo_por_telefone', {
          p_telefone: telefone.trim(),
        });

      if (telefoneError) {
        // Não bloqueia o cadastro por falha de checagem; o índice único é a rede
        console.error(
          'Erro ao checar telefone duplicado:',
          telefoneError.message,
        );
      } else if (encontrados && encontrados.length > 0) {
        const ids = encontrados.map((m: { id: string }) => m.id);
        const { data: vinculos, error: vinculosError } = await supabaseAdmin
          .from('usuario_unidades')
          .select('usuario_id, unidade_id')
          .in('usuario_id', ids)
          .eq('ativo', true);

        if (vinculosError) {
          // Segue sem os vínculos: a decisão cai nas unidades de `encontrados`
          console.error(
            'Erro ao buscar vínculos do motorista duplicado:',
            vinculosError.message,
          );
        }

        const unidadesVinculadas: Record<string, string[]> = {};
        for (const v of vinculos ?? []) {
          (unidadesVinculadas[v.usuario_id] ??= []).push(v.unidade_id);
        }

        const duplicado = respostaTelefoneDuplicado(
          encontrados,
          gestorData.unidade_id,
          unidadesVinculadas,
        );
        if (duplicado) {
          return new Response(
            JSON.stringify({
              error: duplicado.error,
              codigo: duplicado.codigo,
            }),
            {
              status: duplicado.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          );
        }
      }
    }

    // Conta só no Auth (sem linha em `usuarios`) é, por exemplo, um gestor no
    // meio do onboarding: o createUser abaixo recusa o e-mail e a resposta é a
    // mesma 409. Nunca apagar essa conta — apagar e recriar com a senha do
    // gestor chamador entregava o login de outra pessoa.
    const { data: authData, error: createAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email: emailNormalizado,
        password: senha.trim(),
        email_confirm: true, // Confirmar email automaticamente
        user_metadata: {
          nome: nome.trim(),
        },
      });

    if (createAuthError) {
      if (ehEmailDuplicadoNoAuth(createAuthError.message)) {
        const recusa = respostaEmailJaCadastrado();
        return new Response(
          JSON.stringify({ error: recusa.error, codigo: recusa.codigo }),
          {
            status: recusa.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      return new Response(
        JSON.stringify({
          error: `Erro ao criar usuário: ${createAuthError.message}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (!authData.user) {
      return new Response(JSON.stringify({ error: 'Usuário não foi criado' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Criar registro na tabela usuarios
    const { data: usuarioData, error: insertError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id: authData.user.id,
        nome: nome.trim(),
        email: emailNormalizado,
        telefone: telefone?.trim() || null,
        papel: 'motorista',
        unidade_id: gestorData.unidade_id,
        ativo: true,
      })
      .select()
      .single();

    if (insertError) {
      // Se falhar ao criar registro, deletar usuário do Auth
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

      if (ehViolacaoTelefoneUnico(insertError)) {
        return new Response(
          JSON.stringify({
            error: MSG_TELEFONE_OUTRA_LOJA,
            codigo: CODIGO_TELEFONE_JA_CADASTRADO,
          }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      return new Response(
        JSON.stringify({
          error: `Erro ao criar registro: ${insertError.message}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // ✅ MULTI-UNIDADE: Criar vínculo em usuario_unidades
    const { error: vinculoError } = await supabaseAdmin
      .from('usuario_unidades')
      .insert({
        usuario_id: authData.user.id,
        unidade_id: gestorData.unidade_id,
        papel: 'motorista',
        ativo: true,
      });

    if (vinculoError) {
      console.error(
        'Erro ao criar vínculo em usuario_unidades:',
        vinculoError.message,
      );
      // Não falhar - o registro principal foi criado
      // A migration já migra dados de usuarios.unidade_id
    }

    return new Response(
      JSON.stringify({
        success: true,
        motorista: usuarioData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
