// Script para verificar e criar usuário no Supabase Auth
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

// Criar cliente Supabase com service role (acesso admin)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function verificarECriarUsuario() {
  console.log('\n🔍 Verificando usuário no Supabase Auth...\n');

  const EMAIL = 'wellington.ribeiro.eng@gmail.com';
  const SENHA_PADRAO = 'admin123456'; // Senha padrão temporária

  try {
    // 1. Listar todos os usuários do Auth
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) throw listError;

    console.log(`📋 Total de usuários no Supabase Auth: ${users.length}\n`);

    // 2. Verificar se o usuário existe
    const usuarioExiste = users.find(u => u.email === EMAIL);

    if (usuarioExiste) {
      console.log('✅ Usuário encontrado no Supabase Auth!');
      console.log(`   Email: ${usuarioExiste.email}`);
      console.log(`   ID: ${usuarioExiste.id}`);
      console.log(`   Criado em: ${new Date(usuarioExiste.created_at).toLocaleString('pt-BR')}`);
      console.log(`   Último login: ${usuarioExiste.last_sign_in_at ? new Date(usuarioExiste.last_sign_in_at).toLocaleString('pt-BR') : 'Nunca'}\n`);

      // Resetar senha
      console.log('🔄 Resetando senha para facilitar o acesso...\n');

      const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
        usuarioExiste.id,
        { password: SENHA_PADRAO }
      );

      if (updateError) throw updateError;

      console.log('✅ Senha resetada com sucesso!\n');
      console.log('🔐 CREDENCIAIS DE ACESSO:');
      console.log(`   URL: http://localhost:3001/login`);
      console.log(`   Email: ${EMAIL}`);
      console.log(`   Senha: ${SENHA_PADRAO}\n`);
      console.log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!\n');

    } else {
      console.log('⚠️  Usuário NÃO encontrado no Supabase Auth.');
      console.log('   Criando novo usuário...\n');

      // Criar usuário no Auth
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: EMAIL,
        password: SENHA_PADRAO,
        email_confirm: true, // Confirmar email automaticamente
      });

      if (createError) throw createError;

      console.log('✅ Usuário criado com sucesso no Supabase Auth!');
      console.log(`   ID: ${newUser.user.id}`);
      console.log(`   Email: ${newUser.user.email}\n`);

      // Agora precisamos criar/atualizar o registro na tabela usuarios
      console.log('🔄 Verificando registro na tabela usuarios...\n');

      const { data: usuarioApp, error: usuarioError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', EMAIL)
        .single();

      if (usuarioError && usuarioError.code === 'PGRST116') {
        // Não existe, vamos criar
        console.log('⚠️  Usuário não existe na tabela usuarios. Criando...\n');

        const { data: novoUsuario, error: insertError } = await supabase
          .from('usuarios')
          .insert({
            id: newUser.user.id, // Usar o mesmo ID do auth.users
            email: EMAIL,
            nome: 'Wellington Ribeiro',
            papel: 'gestor',
            admin_role: 'admin',
            ativo: true,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        console.log('✅ Usuário criado na tabela usuarios!');
        console.log(`   Nome: ${novoUsuario.nome}`);
        console.log(`   Papel: ${novoUsuario.papel}`);
        console.log(`   Admin role: ${novoUsuario.admin_role}\n`);

      } else if (!usuarioError) {
        // Existe, vamos atualizar o ID e admin_role
        console.log('✅ Registro encontrado na tabela usuarios. Atualizando...\n');

        const { error: updateError } = await supabase
          .from('usuarios')
          .update({
            id: newUser.user.id, // Sincronizar ID
            admin_role: 'admin',
          })
          .eq('email', EMAIL);

        if (updateError) throw updateError;

        console.log('✅ Registro atualizado com admin_role!\n');
      }

      console.log('🔐 CREDENCIAIS DE ACESSO:');
      console.log(`   URL: http://localhost:3001/login`);
      console.log(`   Email: ${EMAIL}`);
      console.log(`   Senha: ${SENHA_PADRAO}\n`);
      console.log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!\n');
    }

    // Verificar sincronização
    console.log('🔍 Verificando sincronização entre auth.users e usuarios...\n');

    const { data: usuarioFinal } = await supabase
      .from('usuarios')
      .select('id, email, nome, admin_role')
      .eq('email', EMAIL)
      .single();

    const usuarioAuth = users.find(u => u.email === EMAIL) ||
      (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === EMAIL);

    if (usuarioFinal && usuarioAuth) {
      const sincronizado = usuarioFinal.id === usuarioAuth.id;
      console.log(`${sincronizado ? '✅' : '⚠️'}  IDs ${sincronizado ? 'sincronizados' : 'DIFERENTES'}:`);
      console.log(`   Auth ID: ${usuarioAuth.id}`);
      console.log(`   Usuarios ID: ${usuarioFinal.id}`);
      console.log(`   Admin role: ${usuarioFinal.admin_role}\n`);

      if (!sincronizado) {
        console.log('⚠️  ATENÇÃO: Os IDs estão diferentes!');
        console.log('   Atualizando para sincronizar...\n');

        await supabase
          .from('usuarios')
          .update({ id: usuarioAuth.id })
          .eq('email', EMAIL);

        console.log('✅ IDs sincronizados!\n');
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

verificarECriarUsuario();
