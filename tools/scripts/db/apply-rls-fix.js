// Script para aplicar fix de RLS recursion no Supabase
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Construir connection string usando pooler (publicamente acessível)
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
// Formato: postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres
const connectionString = `postgresql://postgres:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

if (!dbPassword) {
  console.error('❌ SUPABASE_DB_PASSWORD não encontrado no .env');
  process.exit(1);
}

const { Client } = pg;

async function applyRLSFix() {
  console.log('🔧 Aplicando correção de RLS recursion...\n');

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Conectar ao banco
    console.log('📡 Conectando ao Supabase...');
    await client.connect();
    console.log('✅ Conectado!\n');

    // Ler migration SQL
    const migrationPath = join(__dirname, '../../../database/migrations/20251020000000_fix_rls_recursion.sql');
    console.log('📄 Lendo migration:', migrationPath);
    const sql = readFileSync(migrationPath, 'utf-8');
    console.log(`✅ Migration carregada (${sql.length} caracteres)\n`);

    // Aplicar migration
    console.log('🚀 Aplicando migration...');
    await client.query(sql);
    console.log('✅ Migration aplicada com sucesso!\n');

    // Testar se RLS foi corrigido
    console.log('🧪 Testando RLS...');
    const testResult = await client.query('SELECT * FROM test_rls_no_recursion()');

    if (testResult.rows.length > 0) {
      console.log('✅ Testes de RLS:\n');
      testResult.rows.forEach(row => {
        const icon = row.success ? '✅' : '❌';
        console.log(`   ${icon} ${row.test_name}: ${row.message}`);
      });
    }

    console.log('\n' + '═'.repeat(80));
    console.log('✅ CORREÇÃO DE RLS APLICADA COM SUCESSO!');
    console.log('═'.repeat(80));
    console.log('\n📋 Próximos passos:');
    console.log('   1. Recarregue o app web (F5)');
    console.log('   2. Faça login novamente');
    console.log('   3. O erro 500 deve ter sido resolvido\n');

  } catch (error) {
    console.error('\n❌ Erro ao aplicar migration:');
    console.error(error.message);
    console.error('\nDetalhes completos:');
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('📡 Conexão fechada.');
  }
}

applyRLSFix()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
