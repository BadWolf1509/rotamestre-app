/**
 * Script para verificar status do usuário no banco (usando Service Role - bypass RLS)
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xezslsyxjivunmhhyxtd.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlenNsc3l4aml2dW5taGh5eHRkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDkwOTQ1NywiZXhwIjoyMDc2NDg1NDU3fQ.HRBlXp4cGD4sio2I7F4ZLBeGakHSYcGXrJevVoZQk_c';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAllUsers() {
  try {
    console.log('\n🔍 Consultando banco de dados (modo admin - bypass RLS)...\n');

    // Primeiro, buscar o usuário específico na tabela usuarios
    const { data: specificUser, error: specificError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', 'wellington.ribeiro@fluxocerto.dev.br');

    console.log('📊 Busca por wellington.ribeiro@fluxocerto.dev.br:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (specificError) {
      console.log('❌ Erro:', specificError);
    } else if (!specificUser || specificUser.length === 0) {
      console.log('⚠️  Nenhum registro encontrado na tabela usuarios');
    } else {
      console.log('✅ Usuário encontrado:');
      console.log(JSON.stringify(specificUser[0], null, 2));
    }

    // Listar TODOS os usuários
    console.log('\n📊 Todos os usuários cadastrados:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const { data: allUsers, error: allError } = await supabase
      .from('usuarios')
      .select('id, email, nome, papel, primeira_senha, created_at');

    if (allError) {
      console.log('❌ Erro ao listar usuários:', allError);
    } else if (!allUsers || allUsers.length === 0) {
      console.log('⚠️  Tabela usuarios está VAZIA');
    } else {
      console.log(`Total: ${allUsers.length} usuários\n`);
      allUsers.forEach((user, i) => {
        console.log(`${i + 1}. ${user.nome || 'Sem nome'}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Papel: ${user.papel}`);
        console.log(`   Primeira Senha: ${user.primeira_senha}`);
        console.log(`   Criado: ${new Date(user.created_at).toLocaleString('pt-BR')}`);
        console.log('');
      });
    }

    // Verificar também na tabela auth.users do Supabase Auth
    console.log('\n📊 Verificando Supabase Auth (auth.users):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.log('❌ Erro ao listar auth users:', authError);
    } else if (!authUsers || authUsers.users.length === 0) {
      console.log('⚠️  Nenhum usuário no Supabase Auth');
    } else {
      console.log(`Total: ${authUsers.users.length} usuários no Auth\n`);
      authUsers.users.forEach((user, i) => {
        console.log(`${i + 1}. ${user.email}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Criado: ${new Date(user.created_at).toLocaleString('pt-BR')}`);
        console.log('');
      });

      // Verificar se o email wellington.ribeiro@fluxocerto.dev.br existe no Auth
      const wellingtonAuth = authUsers.users.find(u => u.email === 'wellington.ribeiro@fluxocerto.dev.br');
      if (wellingtonAuth) {
        console.log('\n✅ wellington.ribeiro@fluxocerto.dev.br EXISTE no Supabase Auth');
        console.log('   ID no Auth:', wellingtonAuth.id);
        console.log('\n⚠️  PROBLEMA DETECTADO:');
        console.log('   - Usuário existe no Supabase Auth (consegue fazer login)');
        console.log('   - MAS não existe na tabela usuarios (dados do app)');
        console.log('\n💡 SOLUÇÃO:');
        console.log('   Criar registro na tabela usuarios com o ID do Auth');
      }
    }

  } catch (err) {
    console.error('\n❌ Erro geral:', err);
  }
}

checkAllUsers();
