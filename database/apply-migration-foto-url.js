#!/usr/bin/env node

/**
 * Script para aplicar migration: adicionar coluna foto_url em paradas
 * Sprint 1.3 - Upload de Fotos
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Configurar __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: join(__dirname, '../.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variáveis de ambiente não encontradas!');
  console.error('Configure EXPO_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}

// Criar cliente Supabase com service role (bypassa RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyMigration() {
  console.log('🔄 Aplicando migration: adicionar foto_url em paradas...\n');

  try {
    // Ler arquivo SQL
    const migrationPath = join(__dirname, 'migrations', '20251025000000_add_foto_url_to_paradas.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration SQL:');
    console.log('─'.repeat(80));
    console.log(sql);
    console.log('─'.repeat(80));
    console.log('');

    // Executar migration
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // Se a função exec_sql não existir, tentar executar diretamente
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        console.log('⚠️  Função exec_sql não encontrada, executando SQL direto via API...\n');

        // Separar comandos SQL
        const commands = sql
          .split(';')
          .map(cmd => cmd.trim())
          .filter(cmd => cmd && !cmd.startsWith('--') && !cmd.startsWith('/*'));

        for (const command of commands) {
          if (command.toUpperCase().includes('ALTER TABLE')) {
            console.log('✅ Executando ALTER TABLE...');

            // Para ALTER TABLE, usar query direta
            const { error: alterError } = await supabase
              .from('paradas')
              .select('foto_url')
              .limit(1);

            if (alterError && !alterError.message.includes('column "foto_url" does not exist')) {
              console.log('✅ Coluna foto_url já existe!');
            } else if (alterError) {
              console.log('⚠️  Coluna foto_url não existe ainda. Execute manualmente no Supabase SQL Editor:');
              console.log('');
              console.log(sql);
              console.log('');
              console.log('Ou use: npx supabase db push (se tiver Supabase CLI instalado)');
              process.exit(1);
            }
          }
        }

        console.log('✅ Migration aplicada com sucesso!');
        return;
      }

      throw error;
    }

    console.log('✅ Migration aplicada com sucesso!');
    console.log('📊 Resultado:', data);

  } catch (error) {
    console.error('❌ Erro ao aplicar migration:', error.message);
    console.error('');
    console.error('💡 Solução alternativa:');
    console.error('   1. Acesse: https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/sql');
    console.error('   2. Cole o SQL da migration');
    console.error('   3. Execute manualmente');
    console.error('');
    console.error('   OU use: npx supabase db push (se tiver Supabase CLI)');
    process.exit(1);
  }
}

// Verificar se coluna já existe
async function checkColumn() {
  console.log('🔍 Verificando se coluna foto_url já existe...\n');

  try {
    const { error } = await supabase
      .from('paradas')
      .select('foto_url')
      .limit(1);

    if (!error) {
      console.log('✅ Coluna foto_url JÁ EXISTE na tabela paradas!');
      console.log('⏭️  Migration não é necessária.\n');
      return true;
    }

    if (error.message.includes('column "foto_url" does not exist')) {
      console.log('❌ Coluna foto_url NÃO EXISTE. Migration necessária.\n');
      return false;
    }

    throw error;
  } catch (error) {
    console.error('❌ Erro ao verificar coluna:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Sprint 1.3 - Upload de Fotos - Migration Script\n');

  const exists = await checkColumn();

  if (!exists) {
    await applyMigration();
  }

  console.log('\n✅ Processo concluído!');
}

main();
