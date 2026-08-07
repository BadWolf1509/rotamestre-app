#!/usr/bin/env node

/**
 * Script para atualizar emails dos usuários de teste
 * De: @rotamestre.com.br
 * Para: @rotamestre.tec.br
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', 'mcp-rotamestre', '.env');

dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERRO: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar definidos no .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const OLD_GESTOR_EMAIL = 'gestor@rotamestre.com.br';
const NEW_GESTOR_EMAIL = 'gestor@rotamestre.tec.br';
const OLD_MOTORISTA_EMAIL = 'motorista@rotamestre.com.br';
const NEW_MOTORISTA_EMAIL = 'motorista@rotamestre.tec.br';

async function updateUserEmail(oldEmail, newEmail) {
  console.log(`\n🔄 Atualizando email: ${oldEmail} → ${newEmail}...`);

  try {
    // 1. Buscar usuário pelo email antigo
    const { data: usuarios, error: searchError } = await supabase
      .from('usuarios')
      .select('id, email, nome')
      .eq('email', oldEmail);

    if (searchError) throw searchError;

    if (!usuarios || usuarios.length === 0) {
      console.log(`   ⚠️  Usuário com email ${oldEmail} não encontrado na tabela usuarios`);
      return null;
    }

    const usuario = usuarios[0];
    console.log(`   ✅ Usuário encontrado: ${usuario.nome} (ID: ${usuario.id})`);

    // 2. Atualizar email no Supabase Auth
    console.log(`   🔄 Atualizando email no Auth...`);
    const { error: authError } = await supabase.auth.admin.updateUserById(
      usuario.id,
      {
        email: newEmail,
        email_confirm: true
      }
    );

    if (authError) throw authError;
    console.log(`   ✅ Email atualizado no Auth`);

    // 3. Atualizar email na tabela usuarios
    console.log(`   🔄 Atualizando email na tabela usuarios...`);
    const { error: updateError } = await supabase
      .from('usuarios')
      .update({ email: newEmail })
      .eq('id', usuario.id);

    if (updateError) throw updateError;
    console.log(`   ✅ Email atualizado na tabela usuarios`);

    return usuario.id;

  } catch (error) {
    console.error(`   ❌ Erro ao atualizar email ${oldEmail}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   Atualizar Emails dos Usuários - RotaMestre  ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log(`\n📡 Supabase URL: ${SUPABASE_URL}`);
  console.log(`🔑 Service Role Key: ${SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`);

  try {
    // Atualizar gestor
    const gestorId = await updateUserEmail(
      OLD_GESTOR_EMAIL,
      NEW_GESTOR_EMAIL
    );

    // Atualizar motorista
    const motoristaId = await updateUserEmail(
      OLD_MOTORISTA_EMAIL,
      NEW_MOTORISTA_EMAIL
    );

    // Resumo
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║          EMAILS ATUALIZADOS COM SUCESSO        ║');
    console.log('╚════════════════════════════════════════════════╝\n');

    if (gestorId) {
      console.log('👤 GESTOR');
      console.log(`   Email antigo: ${OLD_GESTOR_EMAIL}`);
      console.log(`   Email novo: ${NEW_GESTOR_EMAIL}`);
      console.log(`   Senha: não alterada`);
      console.log(`   ID: ${gestorId}\n`);
    }

    if (motoristaId) {
      console.log('👤 MOTORISTA');
      console.log(`   Email antigo: ${OLD_MOTORISTA_EMAIL}`);
      console.log(`   Email novo: ${NEW_MOTORISTA_EMAIL}`);
      console.log(`   Senha: não alterada`);
      console.log(`   ID: ${motoristaId}\n`);
    }

    console.log('📱 Acesse: https://app.rotamestre.tec.br');
    console.log('🔐 Faça login com os novos emails\n');

  } catch (error) {
    console.error('\n❌ Erro fatal:', error.message);
    process.exit(1);
  }
}

main();
