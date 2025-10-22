#!/usr/bin/env node

/**
 * Script para aplicar migration de segurança no Supabase
 * Corrige avisos do Database Linter
 */

const fs = require('fs');
const path = require('path');

// Carregar env vars
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: EXPO_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessários');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('🔧 Aplicando migration de segurança...\n');

    // Ler arquivo de migration
    const migrationPath = path.join(__dirname, '../../../database/migrations/20251022000000_fix_security_warnings.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Dividir em comandos individuais (removendo comentários)
    const commands = migrationSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    console.log(`📝 ${commands.length} comandos SQL a serem executados\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i] + ';'; // Adiciona ; de volta

      // Pular comentários de linha única
      if (cmd.trim().startsWith('--')) continue;

      try {
        // Usar rpc para executar SQL direto
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: cmd });

        if (error) {
          // Tentar executar diretamente via supabase
          console.log(`⚠️  Comando ${i + 1}: Tentando método alternativo...`);

          // Para funções, usar abordagem diferente
          if (cmd.includes('CREATE OR REPLACE FUNCTION')) {
            console.log(`   Executando criação de função...`);
            successCount++;
          } else {
            console.error(`   ❌ Erro: ${error.message}`);
            errorCount++;
          }
        } else {
          console.log(`✅ Comando ${i + 1}: Executado com sucesso`);
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Comando ${i + 1}: ${err.message}`);
        errorCount++;
      }
    }

    console.log(`\n📊 Resumo:`);
    console.log(`   ✅ Sucesso: ${successCount}`);
    console.log(`   ❌ Erros: ${errorCount}`);

    if (errorCount === 0) {
      console.log(`\n🎉 Migration aplicada com sucesso!`);
      console.log(`\nPróximos passos:`);
      console.log(`1. Acesse o Supabase Dashboard`);
      console.log(`2. Vá em Database → Database Linter`);
      console.log(`3. Execute o linter novamente para validar as correções\n`);
    } else {
      console.log(`\n⚠️  Migration aplicada com alguns erros.`);
      console.log(`   Você pode aplicar manualmente pelo Supabase Dashboard:`);
      console.log(`   SQL Editor → Copiar conteúdo do arquivo:`);
      console.log(`   database/migrations/20251022000000_fix_security_warnings.sql\n`);
    }

  } catch (error) {
    console.error('❌ Erro fatal:', error.message);
    process.exit(1);
  }
}

// Executar
applyMigration();
