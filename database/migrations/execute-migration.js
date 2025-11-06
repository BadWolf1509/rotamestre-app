#!/usr/bin/env node

/**
 * Script para executar migration via dotenv
 * Executa: node database/migrations/execute-migration.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não encontrada no .env');
  process.exit(1);
}

const migrationFile = path.join(__dirname, '20251105000000_add_is_checkpoint_to_paradas.sql');
const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

async function executeMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // Necessário para Supabase
    },
  });

  try {
    console.log('📦 Conectando ao banco de dados...');
    await client.connect();
    console.log('✅ Conectado com sucesso!\n');

    console.log('🚀 Executando migration: 20251105000000_add_is_checkpoint_to_paradas.sql\n');

    // Executar migration
    await client.query(migrationSQL);

    console.log('✅ Migration executada com sucesso!\n');

    // Query de verificação
    console.log('🔍 Verificando resultados...\n');
    const result = await client.query(`
      SELECT
        is_checkpoint,
        COUNT(*) as total,
        COUNT(CASE WHEN observacoes IN ('Ponto de partida', 'Ponto de chegada') THEN 1 END) as base_points
      FROM paradas
      GROUP BY is_checkpoint
      ORDER BY is_checkpoint;
    `);

    console.log('📊 Resultados da verificação:');
    console.table(result.rows);

    // Validação
    const falseRow = result.rows.find(r => r.is_checkpoint === false);
    const trueRow = result.rows.find(r => r.is_checkpoint === true);

    if (falseRow && parseInt(falseRow.total) === parseInt(falseRow.base_points)) {
      console.log('✅ Validação OK: Todas as paradas com is_checkpoint=false são pontos base');
    } else if (falseRow) {
      console.log('⚠️  AVISO: Algumas paradas com is_checkpoint=false não são pontos base');
    }

    if (trueRow && parseInt(trueRow.base_points) === 0) {
      console.log('✅ Validação OK: Nenhuma parada com is_checkpoint=true é ponto base');
    } else if (trueRow) {
      console.log('⚠️  AVISO: Algumas paradas com is_checkpoint=true são pontos base');
    }

    console.log('\n🎉 Migration concluída com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao executar migration:', error.message);
    console.error('\nDetalhes do erro:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n📦 Conexão encerrada.');
  }
}

executeMigration();
