#!/usr/bin/env node

/**
 * Script para corrigir search_path das funções no Supabase
 * Executa: node database/migrations/execute-fix-search-path.js
 */

const fs = require('fs');
const path = require('path');

const { Client } = require('pg');

// Carregar variáveis de ambiente
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não encontrada no .env');
  process.exit(1);
}

async function executeMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log('📦 Conectando ao banco de dados...');
    await client.connect();
    console.log('✅ Conectado com sucesso!\n');

    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, '20251220_fix_function_search_path.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Dividir por CREATE OR REPLACE FUNCTION
    const functionRegex = /CREATE OR REPLACE FUNCTION[\s\S]*?\$function\$;/g;
    const commands = sqlContent.match(functionRegex) || [];

    console.log(`🚀 Executando ${commands.length} comandos SQL...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];

      // Extrair nome da função para logging
      const match = cmd.match(/CREATE OR REPLACE FUNCTION\s+public\.(\w+)/i);
      const functionName = match ? match[1] : `Função ${i + 1}`;

      try {
        await client.query(cmd);
        console.log(`  ✅ ${functionName}`);
        successCount++;
      } catch (error) {
        console.error(`  ❌ ${functionName}: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📊 Resultado: ${successCount} sucesso, ${errorCount} erros`);

    if (errorCount === 0) {
      console.log('\n🎉 Migration concluída com sucesso!');
      console.log('\n📋 Próximos passos:');
      console.log('   1. Acesse o Supabase Dashboard');
      console.log('   2. Vá em Database > Linter');
      console.log('   3. Verifique se os warnings de function_search_path_mutable foram resolvidos');
      console.log('\n⚠️  Lembre-se também de:');
      console.log('   - Habilitar "Leaked Password Protection" em Auth > Settings > Security');
    } else {
      console.log('\n⚠️  Alguns comandos falharam. Revise os erros acima.');
    }

  } catch (error) {
    console.error('❌ Erro ao executar migration:', error.message);
    console.error('\nDetalhes:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n📦 Conexão encerrada.');
  }
}

executeMigration();
