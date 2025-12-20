#!/usr/bin/env node

/**
 * Script para criar trigger de push notification via pg_net
 * Executa: node database/migrations/execute-push-trigger.js
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

const migrationFile = path.join(__dirname, '20251220_add_push_trigger_pg_net.sql');
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

    console.log('🚀 Executando migration: 20251220_add_push_trigger_pg_net.sql\n');

    // Executar migration
    await client.query(migrationSQL);

    console.log('✅ Migration executada!\n');

    // Verificar se trigger foi criado
    console.log('🔍 Verificando trigger...\n');

    const checkTrigger = await client.query(`
      SELECT tgname, tgrelid::regclass as table_name, tgenabled
      FROM pg_trigger
      WHERE tgname = 'trigger_send_push_notification';
    `);

    if (checkTrigger.rows.length > 0) {
      console.log('✅ Trigger criado:');
      console.table(checkTrigger.rows);
    } else {
      console.log('⚠️  Trigger não encontrado');
    }

    // Verificar se pg_net está habilitado
    const checkPgNet = await client.query(`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname = 'pg_net';
    `);

    if (checkPgNet.rows.length > 0) {
      console.log('\n✅ Extensão pg_net habilitada:', checkPgNet.rows[0].extversion);
    } else {
      console.log('\n⚠️  Extensão pg_net não encontrada');
    }

    console.log('\n🎉 Push trigger configurado!');
    console.log('\n📋 Fluxo configurado:');
    console.log('   1. Trigger PostgreSQL detecta INSERT em notificacoes');
    console.log('   2. Função send_push_notification_trigger() é chamada');
    console.log('   3. pg_net faz POST para Edge Function send-push-notification');
    console.log('   4. Edge Function envia push via Expo Push Service');
    console.log('\n📱 Teste: Crie uma rota no painel gestor e veja o push no celular!');

  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Alguns objetos já existiam');
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
