#!/usr/bin/env node

/**
 * Script para executar migration de Push Notifications
 * Executa: node database/migrations/execute-push-migration.js
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

const migrationFile = path.join(__dirname, '20251220_add_push_notifications.sql');
const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

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

    console.log('🚀 Executando migration: 20251220_add_push_notifications.sql\n');

    // Executar migration
    await client.query(migrationSQL);

    console.log('✅ Migration executada com sucesso!\n');

    // Verificar se coluna foi criada
    console.log('🔍 Verificando estrutura...\n');

    const checkColumn = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'usuarios' AND column_name = 'push_token';
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ Coluna push_token criada em usuarios');
    }

    const checkTable = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'push_notification_logs';
    `);

    if (checkTable.rows.length > 0) {
      console.log('✅ Tabela push_notification_logs criada');
    }

    console.log('\n🎉 Migration concluída!');
    console.log('\n📋 Próximos passos:');
    console.log('1. Deploy da Edge Function: npx supabase functions deploy send-push-notification');
    console.log('2. Configurar Database Webhook no Supabase Dashboard:');
    console.log('   - Acesse: Database > Webhooks');
    console.log('   - Crie webhook para tabela "notificacoes" evento INSERT');
    console.log('   - Aponte para a Edge Function "send-push-notification"');
    console.log('\n📱 Para testar, use um dispositivo físico com o app instalado.');

  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Alguns objetos já existiam (ignorado)');
      console.log('✅ Migration provavelmente já foi executada anteriormente');
    } else {
      console.error('❌ Erro ao executar migration:', error.message);
      console.error('\nDetalhes do erro:', error);
      process.exit(1);
    }
  } finally {
    await client.end();
    console.log('\n📦 Conexão encerrada.');
  }
}

executeMigration();
