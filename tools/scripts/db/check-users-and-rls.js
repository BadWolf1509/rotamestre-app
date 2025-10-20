// Script para verificar usuários e políticas RLS
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não configuradas!');
  console.error('   EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsersAndRLS() {
  console.log('🔍 Verificando usuários e políticas RLS...\n');

  // 1. Verificar usuários na tabela
  console.log('📊 USUÁRIOS NA TABELA usuarios:');
  console.log('═'.repeat(80));

  const { data: usuarios, error: usuariosError } = await supabase
    .from('usuarios')
    .select('id, email, nome, papel, unidade_id, ativo')
    .limit(10);

  if (usuariosError) {
    console.error('❌ Erro ao buscar usuários:', usuariosError.message);
  } else if (!usuarios || usuarios.length === 0) {
    console.log('⚠️  NENHUM USUÁRIO ENCONTRADO na tabela usuarios!');
    console.log('   Isso explica o erro 500 - não há dados para retornar.\n');
  } else {
    console.log(`✅ ${usuarios.length} usuário(s) encontrado(s):\n`);
    usuarios.forEach((u, i) => {
      console.log(`${i + 1}. ${u.nome} (${u.email})`);
      console.log(`   ID: ${u.id}`);
      console.log(`   Papel: ${u.papel}`);
      console.log(`   Unidade ID: ${u.unidade_id || 'NULL'}`);
      console.log(`   Ativo: ${u.ativo ? 'Sim' : 'Não'}`);
      console.log('');
    });
  }

  // 2. Verificar usuários em auth.users
  console.log('\n📊 USUÁRIOS EM auth.users (Supabase Auth):');
  console.log('═'.repeat(80));

  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error('❌ Erro ao buscar auth users:', authError.message);
  } else if (!authUsers || authUsers.users.length === 0) {
    console.log('⚠️  NENHUM USUÁRIO AUTENTICADO encontrado!');
  } else {
    console.log(`✅ ${authUsers.users.length} usuário(s) autenticado(s):\n`);
    authUsers.users.forEach((u, i) => {
      console.log(`${i + 1}. ${u.email}`);
      console.log(`   ID: ${u.id}`);
      console.log(`   Criado em: ${u.created_at}`);

      // Verificar se tem correspondente na tabela usuarios
      const hasUserData = usuarios?.find(usr => usr.id === u.id);
      if (!hasUserData) {
        console.log(`   ⚠️  SEM DADOS na tabela usuarios - CAUSA DO ERRO 500!`);
      } else {
        console.log(`   ✅ Tem dados na tabela usuarios`);
      }
      console.log('');
    });
  }

  // 3. Verificar políticas RLS
  console.log('\n📊 POLÍTICAS RLS na tabela usuarios:');
  console.log('═'.repeat(80));

  const { data: policies, error: policiesError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE tablename = 'usuarios'
      ORDER BY policyname;
    `
  }).catch(() => {
    // Fallback: query direta
    return supabase.from('pg_policies').select('*').eq('tablename', 'usuarios');
  });

  if (policiesError || !policies) {
    console.log('⚠️  Não foi possível buscar políticas RLS');
    console.log('   (Requer permissões de admin ou service_role key)');
  } else if (policies.length === 0) {
    console.log('⚠️  NENHUMA POLÍTICA RLS encontrada!');
    console.log('   RLS pode estar desabilitado ou sem políticas configuradas.');
  } else {
    console.log(`✅ ${policies.length} política(s) encontrada(s):\n`);
    policies.forEach((p, i) => {
      console.log(`${i + 1}. ${p.policyname}`);
      console.log(`   Comando: ${p.cmd}`);
      console.log(`   Roles: ${p.roles}`);
      console.log('');
    });
  }

  // 4. Resumo e Diagnóstico
  console.log('\n' + '═'.repeat(80));
  console.log('📋 DIAGNÓSTICO:');
  console.log('═'.repeat(80));

  const authUsersCount = authUsers?.users?.length || 0;
  const dbUsersCount = usuarios?.length || 0;

  if (authUsersCount === 0) {
    console.log('❌ PROBLEMA: Nenhum usuário autenticado (auth.users vazio)');
    console.log('   SOLUÇÃO: Crie um usuário via Supabase Dashboard ou tela de registro\n');
  } else if (dbUsersCount === 0) {
    console.log('❌ PROBLEMA: Usuários autenticados mas sem dados na tabela usuarios');
    console.log('   SOLUÇÃO: Execute o script para criar dados de usuário:');
    console.log('   node tools/scripts/db/create-test-user.js\n');
  } else if (authUsersCount > dbUsersCount) {
    console.log('⚠️  ATENÇÃO: Alguns usuários auth não têm dados na tabela usuarios');
    console.log(`   Auth users: ${authUsersCount}`);
    console.log(`   DB users: ${dbUsersCount}`);
    console.log('   SOLUÇÃO: Sincronize os dados ou crie registros faltantes\n');
  } else {
    console.log('✅ Dados consistentes entre auth.users e tabela usuarios');
    console.log(`   ${authUsersCount} usuário(s) com dados completos\n`);
  }
}

checkUsersAndRLS()
  .then(() => {
    console.log('✅ Verificação concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
