#!/usr/bin/env node

/**
 * Script para criar usuários de teste no Supabase Auth
 *
 * Cria:
 * - gestor@rotamestre.com.br (senha: gestor123)
 * - motorista@rotamestre.com.br (senha: motorista123)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Carregar .env do diretório mcp-rotamestre
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', 'mcp-rotamestre', '.env');

dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERRO: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar definidos no .env');
  console.error(`   Arquivo esperado: ${envPath}`);
  process.exit(1);
}

// Criar cliente Supabase com Service Role Key (tem permissões admin)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// IDs dos usuários serão gerados automaticamente pelo Supabase Auth
// Buscaremos a unidade existente dinamicamente

async function createUser(email, password, nome, papel, unidadeId) {
  console.log(`\n🔄 Criando usuário: ${email}...`);

  try {
    // 1. Criar usuário no Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirmar email automaticamente
      user_metadata: {
        nome,
        papel
      }
    });

    if (authError) {
      // Se o usuário já existe, tentar obter o ID
      if (authError.message.includes('already registered')) {
        console.log(`   ⚠️  Usuário ${email} já existe no Auth`);

        // Buscar usuário existente
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

        if (listError) {
          throw listError;
        }

        const existingUser = users.find(u => u.email === email);

        if (!existingUser) {
          throw new Error(`Usuário ${email} existe mas não foi encontrado na listagem`);
        }

        console.log(`   ℹ️  ID do usuário existente: ${existingUser.id}`);

        // 2. Verificar se registro existe na tabela usuarios
        const { data: usuarioData, error: usuarioError } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', existingUser.id)
          .single();

        if (usuarioError && usuarioError.code !== 'PGRST116') { // PGRST116 = not found
          throw usuarioError;
        }

        if (usuarioData) {
          console.log(`   ✅ Registro na tabela usuarios já existe`);
          console.log(`   📋 Dados:`, JSON.stringify(usuarioData, null, 2));
          return existingUser.id;
        }

        // 3. Criar registro na tabela usuarios
        console.log(`   🔄 Criando registro na tabela usuarios...`);
        const { error: insertError } = await supabase
          .from('usuarios')
          .insert({
            id: existingUser.id,
            nome,
            email,
            papel,
            unidade_id: unidadeId,
            telefone: papel === 'gestor' ? '(11) 98765-4321' : '(11) 97654-3210',
            ativo: true
          });

        if (insertError) {
          throw insertError;
        }

        console.log(`   ✅ Usuário ${email} configurado com sucesso!`);
        return existingUser.id;
      }

      throw authError;
    }

    console.log(`   ✅ Usuário criado no Auth com ID: ${authData.user.id}`);

    // 2. Criar registro na tabela usuarios
    console.log(`   🔄 Criando registro na tabela usuarios...`);

    const { error: insertError } = await supabase
      .from('usuarios')
      .insert({
        id: authData.user.id,
        nome,
        email,
        papel,
        unidade_id: unidadeId,
        telefone: papel === 'gestor' ? '(11) 98765-4321' : '(11) 97654-3210',
        ativo: true
      });

    if (insertError) {
      throw insertError;
    }

    console.log(`   ✅ Usuário ${email} criado com sucesso!`);
    return authData.user.id;

  } catch (error) {
    console.error(`   ❌ Erro ao criar usuário ${email}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  Criação de Usuários de Teste - RotaMestre    ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log(`\n📡 Supabase URL: ${SUPABASE_URL}`);
  console.log(`🔑 Service Role Key: ${SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`);

  try {
    // Buscar primeira unidade ativa
    console.log(`\n🔍 Buscando unidade ativa...`);
    const { data: unidades, error: unidadeError } = await supabase
      .from('unidades')
      .select('*')
      .eq('ativa', true)
      .limit(1);

    if (unidadeError || !unidades || unidades.length === 0) {
      console.error(`❌ Nenhuma unidade ativa encontrada!`);
      console.error(`   Crie uma unidade primeiro ou execute o schema inicial`);
      process.exit(1);
    }

    const unidade = unidades[0];
    console.log(`✅ Unidade encontrada: ${unidade.nome} (ID: ${unidade.id})`);

    // Criar usuários
    const gestorId = await createUser(
      'gestor@rotamestre.tec.br',
      'gestor123',
      'João Silva - Gestor',
      'gestor',
      unidade.id
    );

    const motoristaId = await createUser(
      'motorista@rotamestre.tec.br',
      'motorista123',
      'Carlos Santos - Motorista',
      'motorista',
      unidade.id
    );

    // Resumo
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║              RESUMO DA CRIAÇÃO                 ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log('\n✅ Usuários criados com sucesso!\n');
    console.log('👤 GESTOR');
    console.log(`   Email: gestor@rotamestre.com.br`);
    console.log(`   Senha: gestor123`);
    console.log(`   ID: ${gestorId}`);
    console.log('\n👤 MOTORISTA');
    console.log(`   Email: motorista@rotamestre.com.br`);
    console.log(`   Senha: motorista123`);
    console.log(`   ID: ${motoristaId}`);
    console.log('\n📱 Acesse: https://app.rotamestre.tec.br');
    console.log('🔐 Faça login com as credenciais acima\n');

  } catch (error) {
    console.error('\n❌ Erro fatal:', error.message);
    process.exit(1);
  }
}

main();
