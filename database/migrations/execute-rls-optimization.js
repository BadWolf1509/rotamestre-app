#!/usr/bin/env node

/**
 * Script para otimizar políticas RLS no Supabase
 * Executa: node database/migrations/execute-rls-optimization.js
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
    const sqlPath = path.join(__dirname, '20251220_optimize_rls_policies.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Dividir em comandos individuais (por segurança, executar um por vez)
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    console.log(`🚀 Executando ${commands.length} comandos SQL...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];

      // Extrair nome da política ou tabela do comando para logging
      const match = cmd.match(/(?:DROP POLICY|CREATE POLICY)\s+(?:IF EXISTS\s+)?"?([^"]+)"?\s+ON/i);
      const policyName = match ? match[1] : `Comando ${i + 1}`;

      try {
        await client.query(cmd);
        console.log(`  ✅ ${policyName}`);
        successCount++;
      } catch (error) {
        // Ignorar erros de "policy does not exist" em DROP
        if (error.message.includes('does not exist')) {
          console.log(`  ⏭️  ${policyName} (não existia, pulando)`);
          successCount++;
        } else {
          console.error(`  ❌ ${policyName}: ${error.message}`);
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
      console.log('   3. Verifique se os warnings foram resolvidos');
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
