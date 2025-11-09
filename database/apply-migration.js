/**
 * Script para aplicar migration no banco de dados
 * Uso: node database/apply-migration.js [arquivo.sql]
 */

const fs = require('fs');
const path = require('path');

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Criar cliente admin
const supabaseAdmin = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

async function applyMigration(migrationFile) {
  try {
    console.log('🚀 Iniciando aplicação da migration...\n');

    // Ler arquivo SQL
    const migrationPath = path.join(__dirname, 'migrations', migrationFile);

    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Arquivo não encontrado: ${migrationPath}`);
      process.exit(1);
    }

    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    console.log(`📄 Arquivo: ${migrationFile}`);
    console.log(`📏 Tamanho: ${(sqlContent.length / 1024).toFixed(2)} KB`);
    console.log(`🔍 Linhas: ${sqlContent.split('\n').length}\n`);

    // Contar operações
    const operations = {
      alter: (sqlContent.match(/ALTER TABLE/gi) || []).length,
      create: (sqlContent.match(/CREATE (INDEX|FUNCTION|UNIQUE INDEX)/gi) || []).length,
      update: (sqlContent.match(/UPDATE /gi) || []).length,
      comment: (sqlContent.match(/COMMENT ON/gi) || []).length,
    };

    console.log('📊 Operações detectadas:');
    console.log(`   - ALTER TABLE: ${operations.alter}`);
    console.log(`   - CREATE INDEX/FUNCTION: ${operations.create}`);
    console.log(`   - UPDATE: ${operations.update}`);
    console.log(`   - COMMENT: ${operations.comment}\n`);

    // Confirmar execução
    console.log('⚠️  ATENÇÃO: Esta operação vai modificar o banco de dados!');
    console.log('   Pressione Ctrl+C para cancelar ou aguarde 3 segundos...\n');

    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log('⏳ Executando migration...\n');

    // Executar SQL via RPC (supabase tem limite para queries diretas)
    // Alternativa: usar @supabase/supabase-js com Service Role
    const { data, error } = await supabaseAdmin.rpc('exec_sql', {
      sql_query: sqlContent,
    });

    // Se RPC não existir, tentar executar direto (funciona com service role)
    if (error && error.message.includes('exec_sql')) {
      console.log('⚠️  Função exec_sql não encontrada, tentando executar direto...\n');

      // Dividir em statements individuais
      const statements = sqlContent
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));

      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];

        // Pular comentários e blocos DO
        if (
          statement.startsWith('/*') ||
          statement.startsWith('COMMENT') ||
          statement.includes('DO $$')
        ) {
          console.log(`⏭️  Pulando statement ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);
          continue;
        }

        try {
          console.log(`🔄 Executando ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);

          // Note: Supabase JS client não suporta SQL direto
          // Você precisará executar isso no SQL Editor do Supabase Dashboard
          console.log(`⚠️  Use o SQL Editor do Supabase Dashboard para executar esta migration`);
          break;
        } catch (err) {
          console.error(`❌ Erro no statement ${i + 1}:`, err.message);
          errorCount++;
        }
      }

      console.log(`\n✅ Statements executados: ${successCount}`);
      if (errorCount > 0) {
        console.log(`❌ Erros: ${errorCount}`);
      }
    } else if (error) {
      console.error('❌ Erro ao executar migration:', error);
      process.exit(1);
    } else {
      console.log('✅ Migration aplicada com sucesso!');
      console.log('📊 Resultado:', data);
    }

    console.log('\n🎉 Concluído!\n');
    console.log('📝 Próximos passos:');
    console.log('   1. Verifique no Supabase Dashboard se as colunas foram criadas');
    console.log('   2. Execute: SELECT * FROM usuarios LIMIT 1;');
    console.log('   3. Confirme que os campos existem: primeira_senha, is_gestor_principal\n');

    console.log('⚠️  INSTRUÇÕES MANUAIS (Recomendado):');
    console.log('   1. Acesse: https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/sql');
    console.log(`   2. Copie o conteúdo de: ${migrationPath}`);
    console.log('   3. Cole no SQL Editor e execute\n');
  } catch (error) {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  }
}

// Executar
const migrationFile = process.argv[2] || '20251104_add_profile_management.sql';
applyMigration(migrationFile);
