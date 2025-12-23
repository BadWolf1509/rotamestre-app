#!/usr/bin/env node

/**
 * Script para adicionar tabela notificacoes ao Supabase Realtime
 * Executa: node database/migrations/execute-notificacoes-realtime.js
 */

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

    // Verificar se já está na publicação
    console.log('🔍 Verificando se notificacoes já está na publicação...\n');

    const checkResult = await client.query(`
      SELECT tablename
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      AND tablename = 'notificacoes'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ Tabela notificacoes já está na publicação supabase_realtime');
    } else {
      console.log('🚀 Adicionando notificacoes à publicação supabase_realtime...\n');

      await client.query('ALTER PUBLICATION supabase_realtime ADD TABLE notificacoes');

      console.log('✅ Tabela notificacoes adicionada com sucesso!');
    }

    // Listar todas as tabelas na publicação
    console.log('\n📋 Tabelas na publicação supabase_realtime:');
    const tablesResult = await client.query(`
      SELECT tablename
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      ORDER BY tablename
    `);

    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.tablename}`);
    });

    console.log('\n🎉 Migration concluída!');
    console.log('\n📱 Agora o Realtime de notificações deve funcionar.');
    console.log('   Teste criando uma nova rota no painel gestor.');

  } catch (error) {
    if (error.message.includes('already member')) {
      console.log('ℹ️  Tabela notificacoes já está na publicação');
    } else {
      console.error('❌ Erro ao executar migration:', error.message);
      console.error('\nDetalhes:', error);
      process.exit(1);
    }
  } finally {
    await client.end();
    console.log('\n📦 Conexão encerrada.');
  }
}

executeMigration();
