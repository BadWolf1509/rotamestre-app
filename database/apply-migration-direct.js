#!/usr/bin/env node

/**
 * Script para aplicar migration direto no PostgreSQL via pg library
 * Sprint 1.3 - Upload de Fotos
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const { Client } = pg;

// Configurar __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não encontrada no .env');
  process.exit(1);
}

async function applyMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Supabase requer SSL
    }
  });

  try {
    console.log('🔌 Conectando ao PostgreSQL...\n');
    await client.connect();
    console.log('✅ Conectado!\n');

    // Ler arquivo SQL
    const migrationFile = process.argv[2] || '20251104_add_profile_management.sql';
    const migrationPath = join(__dirname, 'migrations', migrationFile);
    const sql = readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration SQL:');
    console.log('─'.repeat(80));
    console.log(sql);
    console.log('─'.repeat(80));
    console.log('');

    console.log('🔄 Executando migration...\n');

    // Executar SQL
    await client.query(sql);

    console.log('✅ Migration aplicada com sucesso!\n');

    // Verificar se colunas foram criadas
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'usuarios'
      AND column_name IN ('primeira_senha', 'is_gestor_principal', 'foto_url', 'ultimo_login')
      ORDER BY column_name
    `);

    if (result.rows.length > 0) {
      console.log('✅ Verificação: Colunas criadas com sucesso!');
      console.log('📊 Detalhes:');
      result.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });

      // Verificar gestores principais
      const gestores = await client.query(`
        SELECT COUNT(*) as total
        FROM usuarios
        WHERE is_gestor_principal = true
      `);
      console.log(`\n✅ Gestores principais marcados: ${gestores.rows[0].total}`);
    } else {
      console.log('⚠️  Colunas não encontradas após migration!');
    }

  } catch (error) {
    console.error('❌ Erro ao aplicar migration:', error.message);

    // Verificar se erro é porque coluna já existe
    if (error.message.includes('already exists')) {
      console.log('\n✅ Coluna foto_url já existe! Migration não necessária.');

      // Verificar detalhes
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'paradas'
        AND column_name = 'foto_url'
      `);

      if (result.rows.length > 0) {
        console.log('📊 Detalhes:');
        console.log(`   - Nome: ${result.rows[0].column_name}`);
        console.log(`   - Tipo: ${result.rows[0].data_type}`);
        console.log(`   - Nullable: ${result.rows[0].is_nullable}`);
      }
    } else {
      process.exit(1);
    }
  } finally {
    await client.end();
    console.log('\n🔌 Desconectado do banco.');
  }
}

async function main() {
  console.log('🚀 Gestão de Perfil - Migration via PostgreSQL\n');
  await applyMigration();
  console.log('\n✅ Processo concluído!');
}

main();
