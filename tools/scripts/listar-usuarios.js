// Script para listar todos os usuários cadastrados no rotamestre-app
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERRO: Variáveis de ambiente não encontradas');
  console.error('Certifique-se que EXPO_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão definidas no .env');
  process.exit(1);
}

// Criar cliente Supabase com service role (bypassa RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function listarUsuarios() {
  console.log('\n🔍 Buscando usuários cadastrados...\n');

  try {
    // Buscar usuários da tabela usuarios
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('*, unidades(nome, cidade)')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    if (!usuarios || usuarios.length === 0) {
      console.log('⚠️  Nenhum usuário encontrado na tabela "usuarios"');
      console.log('\nVerificando tabela auth.users do Supabase Auth...\n');

      // Tentar buscar da tabela auth.users
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

      if (authError) {
        throw authError;
      }

      if (!authUsers || authUsers.users.length === 0) {
        console.log('⚠️  Nenhum usuário encontrado no Supabase Auth também');
        console.log('\n💡 Dica: As tabelas ainda não foram criadas ou não há usuários cadastrados.');
        return;
      }

      console.log(`✅ ${authUsers.users.length} usuário(s) encontrado(s) no Supabase Auth:\n`);
      authUsers.users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Criado em: ${new Date(user.created_at).toLocaleString('pt-BR')}`);
        console.log(`   Último login: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('pt-BR') : 'Nunca'}`);
        console.log('');
      });

      return;
    }

    // Exibir usuários da tabela usuarios
    console.log(`✅ ${usuarios.length} usuário(s) encontrado(s) na tabela "usuarios":\n`);

    usuarios.forEach((usuario, index) => {
      console.log(`${index + 1}. ${usuario.nome || '(sem nome)'}`);
      console.log(`   Email: ${usuario.email || '(sem email)'}`);
      console.log(`   Papel: ${usuario.papel || '(não definido)'}`);
      console.log(`   Unidade: ${usuario.unidades ? `${usuario.unidades.nome} - ${usuario.unidades.cidade}` : '(não vinculado)'}`);
      console.log(`   Ativo: ${usuario.ativo ? 'Sim' : 'Não'}`);
      console.log(`   Admin Role: ${usuario.admin_role || '(não é admin do painel)'}`);
      console.log(`   Criado em: ${new Date(usuario.created_at).toLocaleString('pt-BR')}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Erro ao buscar usuários:', error.message);

    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log('\n💡 A tabela "usuarios" ainda não foi criada no banco de dados.');
      console.log('   Execute as migrations para criar a estrutura do banco.');
    }
  }
}

listarUsuarios();
