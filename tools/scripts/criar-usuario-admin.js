// Script para criar/atualizar usuário com role de admin no painel
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERRO: Variáveis de ambiente não encontradas');
  process.exit(1);
}

// Criar cliente Supabase com service role (bypassa RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function criarUsuarioAdmin() {
  console.log('\n🔧 Configurando usuário admin para o painel...\n');

  // Email do usuário que será admin
  const EMAIL_ADMIN = 'wellington.ribeiro.eng@gmail.com';
  const ADMIN_ROLE = 'admin'; // ou 'suporte'

  try {
    // 1. Buscar usuário pelo email
    const { data: usuario, error: buscaError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', EMAIL_ADMIN)
      .single();

    if (buscaError) {
      if (buscaError.code === 'PGRST116') {
        console.error(`❌ Usuário com email "${EMAIL_ADMIN}" não encontrado.`);
        console.log('\n💡 Emails disponíveis:');

        const { data: todosUsuarios } = await supabase
          .from('usuarios')
          .select('email, nome');

        todosUsuarios?.forEach(u => console.log(`   - ${u.email} (${u.nome})`));
        process.exit(1);
      }
      throw buscaError;
    }

    console.log(`✅ Usuário encontrado: ${usuario.nome}`);
    console.log(`   Email: ${usuario.email}`);
    console.log(`   Papel atual: ${usuario.papel}`);
    console.log(`   Admin role atual: ${usuario.admin_role || '(nenhuma)'}\n`);

    // 2. Atualizar admin_role
    const { data: atualizado, error: updateError } = await supabase
      .from('usuarios')
      .update({ admin_role: ADMIN_ROLE })
      .eq('id', usuario.id)
      .select()
      .single();

    if (updateError) throw updateError;

    console.log('🎉 Usuário atualizado com sucesso!\n');
    console.log(`✅ ${atualizado.nome} agora é "${ADMIN_ROLE}" do painel`);
    console.log(`   Email: ${atualizado.email}`);
    console.log(`   Admin role: ${atualizado.admin_role}`);
    console.log(`   Papel no app: ${atualizado.papel}\n`);

    console.log('🔐 Credenciais de acesso ao painel:');
    console.log(`   URL: http://localhost:3001/login`);
    console.log(`   Email: ${atualizado.email}`);
    console.log(`   Senha: <a senha que você cadastrou no Supabase Auth>\n`);

    console.log('💡 Para testar, faça login no painel administrativo.');
    console.log('   Se precisar redefinir a senha, use o Supabase Dashboard.\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

criarUsuarioAdmin();
