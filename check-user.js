/**
 * Script para verificar status do usuário no banco
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xezslsyxjivunmhhyxtd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlenNsc3l4aml2dW5taGh5eHRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5MDk0NTcsImV4cCI6MjA3NjQ4NTQ1N30.xKJmkwgG28OSjrhRNKwAhjTy-VK7I8piyS3t_wr6N5w';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkUser() {
  try {
    // Buscar sem .single() primeiro
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, email, nome, papel, primeira_senha, created_at')
      .eq('email', 'wellington.ribeiro@fluxocerto.dev.br');

    if (error) {
      console.error('❌ Erro ao consultar usuário:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('\n⚠️  Nenhum usuário encontrado com este email.');
      console.log('Buscando todos os usuários motoristas...\n');

      const { data: allUsers, error: allError } = await supabase
        .from('usuarios')
        .select('id, email, nome, papel, primeira_senha')
        .eq('papel', 'motorista');

      if (allError) {
        console.error('❌ Erro ao listar usuários:', allError);
        return;
      }

      console.log('\n📊 Motoristas cadastrados:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      allUsers?.forEach((user, i) => {
        console.log(`\n${i + 1}. ${user.nome}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Primeira Senha: ${user.primeira_senha}`);
      });
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return;
    }

    const user = data[0];
    console.log('\n📊 Status do usuário:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Nome:', user.nome);
    console.log('Papel:', user.papel);
    console.log('Primeira Senha:', user.primeira_senha);
    console.log('Criado em:', new Date(user.created_at).toLocaleString('pt-BR'));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (user.primeira_senha === true) {
      console.log('⚠️  PROBLEMA DETECTADO: primeira_senha ainda está TRUE\n');
      console.log('Este usuário deveria ter primeira_senha = FALSE após definir a senha.\n');
    } else {
      console.log('✅ Campo primeira_senha está correto (FALSE)\n');
    }
  } catch (err) {
    console.error('❌ Erro:', err);
  }
}

checkUser();
