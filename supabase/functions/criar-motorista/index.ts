/* global Deno */

// Edge Function para criar motorista usando Admin API
// Deploy: supabase functions deploy criar-motorista

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Criar cliente Supabase com Service Role Key (só disponível server-side)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Criar cliente normal para validar o usuário chamador
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Validar que o usuário está autenticado e é gestor
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar dados do gestor
    const { data: gestorData, error: gestorError } = await supabaseClient
      .from('usuarios')
      .select('papel, unidade_id')
      .eq('id', user.id)
      .single()

    if (gestorError || !gestorData || gestorData.papel !== 'gestor') {
      return new Response(
        JSON.stringify({ error: 'Apenas gestores podem criar motoristas' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obter dados do novo motorista do body
    const { nome, email, senha, telefone } = await req.json()

    if (!nome || !email || !senha) {
      return new Response(
        JSON.stringify({ error: 'Nome, email e senha são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar se email já existe na tabela usuarios
    const { data: existingUser } = await supabaseAdmin
      .from('usuarios')
      .select('id, email, nome, telefone, papel')
      .eq('email', email.trim())
      .single()

    if (existingUser) {
      // ✅ MULTI-UNIDADE: Usuário existe, verificar se já está vinculado a esta unidade
      const { data: existingVinculo } = await supabaseAdmin
        .from('usuario_unidades')
        .select('id')
        .eq('usuario_id', existingUser.id)
        .eq('unidade_id', gestorData.unidade_id)
        .single()

      if (existingVinculo) {
        // Já tem vínculo com esta unidade
        return new Response(
          JSON.stringify({ error: 'Este motorista já está vinculado a esta unidade.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Criar apenas o vínculo (usuário já existe em outra unidade)
      const { error: vinculoError } = await supabaseAdmin
        .from('usuario_unidades')
        .insert({
          usuario_id: existingUser.id,
          unidade_id: gestorData.unidade_id,
          papel: 'motorista',
          ativo: true,
        })

      if (vinculoError) {
        return new Response(
          JSON.stringify({ error: `Erro ao vincular motorista: ${vinculoError.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Retornar sucesso com flag indicando que foi vinculação (não criação)
      return new Response(
        JSON.stringify({
          success: true,
          motorista: existingUser,
          vinculado: true, // Flag para o frontend saber que foi vinculação
          message: 'Motorista vinculado com sucesso a esta unidade.'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verificar se o email existe no Auth mas não na tabela usuarios (possível inconsistência)
    const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers()
    const existingAuthUser = authUsers?.find(u => u.email === email.trim())

    if (existingAuthUser) {
      // Email existe no Auth mas não na tabela usuarios - limpar inconsistência
      console.log(`Limpando usuário órfão do Auth: ${email.trim()}`)
      await supabaseAdmin.auth.admin.deleteUser(existingAuthUser.id)
    }

    // Criar usuário no Auth usando Admin API
    const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: senha.trim(),
      email_confirm: true, // Confirmar email automaticamente
      user_metadata: {
        nome: nome.trim(),
      }
    })

    if (createAuthError) {
      // Verificar se é erro de email duplicado
      const errorMsg = createAuthError.message.toLowerCase();
      const isDuplicateEmail = errorMsg.includes('already been registered') ||
                               errorMsg.includes('already registered') ||
                               errorMsg.includes('duplicate') ||
                               errorMsg.includes('unique constraint');

      const errorMessage = isDuplicateEmail
        ? 'Este email já está cadastrado no sistema. Use outro email.'
        : `Erro ao criar usuário: ${createAuthError.message}`;

      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não foi criado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Criar registro na tabela usuarios
    const { data: usuarioData, error: insertError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id: authData.user.id,
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone?.trim() || null,
        papel: 'motorista',
        unidade_id: gestorData.unidade_id,
        ativo: true,
      })
      .select()
      .single()

    if (insertError) {
      // Se falhar ao criar registro, deletar usuário do Auth
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)

      return new Response(
        JSON.stringify({ error: `Erro ao criar registro: ${insertError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ✅ MULTI-UNIDADE: Criar vínculo em usuario_unidades
    const { error: vinculoError } = await supabaseAdmin
      .from('usuario_unidades')
      .insert({
        usuario_id: authData.user.id,
        unidade_id: gestorData.unidade_id,
        papel: 'motorista',
        ativo: true,
      })

    if (vinculoError) {
      console.error('Erro ao criar vínculo em usuario_unidades:', vinculoError.message)
      // Não falhar - o registro principal foi criado
      // A migration já migra dados de usuarios.unidade_id
    }

    return new Response(
      JSON.stringify({
        success: true,
        motorista: usuarioData
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
