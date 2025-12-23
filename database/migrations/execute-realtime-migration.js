#!/usr/bin/env node

/**
 * Script para habilitar Supabase Realtime nas tabelas rotas e paradas
 * Executa: node database/migrations/execute-realtime-migration.js
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

const migrationFile = path.join(__dirname, '20251220_enable_realtime.sql');
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

    console.log('🚀 Executando migration: 20251220_enable_realtime.sql\n');
    console.log('SQL a executar:');
    console.log(migrationSQL);
    console.log('\n');

    // Executar migration
    await client.query(migrationSQL);

    console.log('✅ Migration executada com sucesso!\n');

    // Verificar quais tabelas estão na publication
    console.log('🔍 Verificando tabelas na publication supabase_realtime...\n');
    const result = await client.query(`
      SELECT schemaname, tablename
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      ORDER BY tablename;
    `);

    console.log('📊 Tabelas com Realtime habilitado:');
    console.table(result.rows);

    // Verificar se rotas e paradas estão na lista
    const tables = result.rows.map(r => r.tablename);
    const hasRotas = tables.includes('rotas');
    const hasParadas = tables.includes('paradas');

    if (hasRotas && hasParadas) {
      console.log('\n✅ Sucesso! Realtime habilitado para rotas e paradas');
    } else {
      if (!hasRotas) console.log('⚠️  AVISO: tabela rotas NÃO está na publication');
      if (!hasParadas) console.log('⚠️  AVISO: tabela paradas NÃO está na publication');
    }

    console.log('\n🎉 Migration concluída!');

  } catch (error) {
    if (error.message.includes('already member')) {
      console.log('ℹ️  As tabelas já estavam na publication supabase_realtime');
      console.log('✅ Realtime já está habilitado!');
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
