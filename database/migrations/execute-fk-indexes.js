#!/usr/bin/env node

/**
 * Script para adicionar índices de FK no Supabase
 * Executa: node database/migrations/execute-fk-indexes.js
 */

const path = require('path');
const fs = require('fs');
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
    const sqlPath = path.join(__dirname, '20251220_add_fk_indexes.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Extrair apenas comandos CREATE INDEX
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.toUpperCase().includes('CREATE INDEX'));

    console.log(`🚀 Executando ${commands.length} comandos SQL...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];

      // Extrair nome do índice para logging
      const match = cmd.match(/CREATE INDEX IF NOT EXISTS\s+(\w+)/i);
      const indexName = match ? match[1] : `Comando ${i + 1}`;

      try {
        await client.query(cmd);
        console.log(`  ✅ ${indexName}`);
        successCount++;
      } catch (error) {
        // Ignorar erros de índice já existente
        if (error.message.includes('already exists')) {
          console.log(`  ⏭️  ${indexName} (já existe, pulando)`);
          successCount++;
        } else {
          console.error(`  ❌ ${indexName}: ${error.message}`);
          errorCount++;
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📊 Resultado: ${successCount} sucesso, ${errorCount} erros`);

    if (errorCount === 0) {
      console.log('\n🎉 Migration concluída com sucesso!');
      console.log('\n📋 Próximos passos:');
      console.log('   1. Acesse o Supabase Dashboard');
      console.log('   2. Vá em Database > Linter');
      console.log('   3. Verifique se os warnings de unindexed_foreign_keys foram resolvidos');
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
