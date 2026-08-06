#!/usr/bin/env node

/**
 * Script para criar usuários de teste no Supabase Auth
 *
 * Credenciais vêm de variáveis de ambiente — NUNCA hardcoded. Este arquivo é
 * versionado num repositório público: qualquer senha escrita aqui vira senha
 * pública, e o banco apontado é o de produção (não existe staging).
 *
 * Obrigatórias, além de SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY:
 * - TEST_GESTOR_EMAIL / TEST_GESTOR_PASSWORD
 * - TEST_MOTORISTA_EMAIL / TEST_MOTORISTA_PASSWORD
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

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

// Credenciais dos usuários de teste: sempre do ambiente, nunca do código.
const TEST_USERS = [
  {
    envPrefix: 'TEST_GESTOR',
    email: process.env.TEST_GESTOR_EMAIL,
    password: process.env.TEST_GESTOR_PASSWORD,
    nome: process.env.TEST_GESTOR_NOME || 'Gestor de Teste',
    papel: 'gestor',
  },
  {
    envPrefix: 'TEST_MOTORISTA',
    email: process.env.TEST_MOTORISTA_EMAIL,
    password: process.env.TEST_MOTORISTA_PASSWORD,
    nome: process.env.TEST_MOTORISTA_NOME || 'Motorista de Teste',
    papel: 'motorista',
  },
];

const faltando = TEST_USERS.flatMap((u) =>
  [
    u.email ? null : `${u.envPrefix}_EMAIL`,
    u.password ? null : `${u.envPrefix}_PASSWORD`,
  ].filter(Boolean)
);

if (faltando.length > 0) {
  console.error('❌ ERRO: variáveis de credencial ausentes:');
  faltando.forEach((v) => console.error(`   - ${v}`));
  console.error('\n   Defina-as no ambiente antes de rodar. Não escreva senhas');
  console.error('   neste arquivo: o repositório é público.');
  process.exit(1);
}

// Senha fraca aqui vira senha fraca pública assim que alguém reusar o valor.
const FRACAS = TEST_USERS.filter((u) => u.password.length < 12);
if (FRACAS.length > 0) {
  console.error('❌ ERRO: senha com menos de 12 caracteres em:');
  FRACAS.forEach((u) => console.error(`   - ${u.envPrefix}_PASSWORD`));
  console.error('\n   Estas contas ficam ativas em PRODUÇÃO. Use senha forte e única.');
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
  console.log(`🔑 Service Role Key: definida (${SUPABASE_SERVICE_ROLE_KEY.length} chars)`);

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
    const criados = [];
    for (const u of TEST_USERS) {
      const id = await createUser(u.email, u.password, u.nome, u.papel, unidade.id);
      criados.push({ ...u, id });
    }

    // Resumo — sem senha. O operador já a tem no ambiente; imprimi-la só serve
    // para vazá-la no scrollback do terminal e nos logs de CI.
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║              RESUMO DA CRIAÇÃO                 ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log('\n✅ Usuários criados com sucesso!\n');
    for (const u of criados) {
      console.log(`👤 ${u.papel.toUpperCase()}`);
      console.log(`   Email: ${u.email}`);
      console.log(`   Senha: (definida em ${u.envPrefix}_PASSWORD)`);
      console.log(`   ID: ${u.id}\n`);
    }
    console.log('📱 Acesse: https://app.rotamestre.tec.br\n');

  } catch (error) {
    console.error('\n❌ Erro fatal:', error.message);
    process.exit(1);
  }
}

main();
