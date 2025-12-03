/**
 * Corrige funções com search_path mutável
 * Adiciona SET search_path = '' para segurança
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('🔧 Corrigindo search_path das funções...\n');

  const functions = [
    'get_table_schema',
    'notify_rota_iniciada',
    'notify_parada_pulada',
    'notify_rota_concluida',
    'get_all_tables',
    'notify_incidente_criado',
    'criar_notificacao',
    'get_gestor_principal',
    'cleanup_old_locations'
  ];

  try {
    // Primeiro, obter a definição atual de cada função
    for (const funcName of functions) {
      console.log(`   → ${funcName}...`);

      // Obter definição da função
      const { rows } = await client.query(`
        SELECT
          pg_get_functiondef(p.oid) as definition,
          p.proname,
          n.nspname as schema
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = $1 AND n.nspname = 'public'
      `, [funcName]);

      if (rows.length === 0) {
        console.log(`   ⚠️ ${funcName} não encontrada`);
        continue;
      }

      const funcDef = rows[0].definition;

      // Verificar se já tem search_path
      if (funcDef.toLowerCase().includes('set search_path')) {
        console.log(`   ✓ ${funcName} já tem search_path`);
        continue;
      }

      // Adicionar SET search_path = '' à função
      // Usar ALTER FUNCTION para adicionar o parâmetro
      try {
        await client.query(`
          ALTER FUNCTION public.${funcName} SET search_path = ''
        `);
        console.log(`   ✅ ${funcName}`);
      } catch (alterError) {
        // Se falhar (função com múltiplas assinaturas), tentar de outra forma
        console.log(`   ⚠️ ${funcName}: ${alterError.message.substring(0, 50)}...`);
      }
    }

    // Validação final
    console.log('\n🔍 Verificando funções...');
    const { rows: checkRows } = await client.query(`
      SELECT
        p.proname as name,
        CASE
          WHEN p.proconfig IS NOT NULL AND array_to_string(p.proconfig, ',') LIKE '%search_path%'
          THEN 'true'
          ELSE 'false'
        END as has_search_path
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname IN (${functions.map((_, i) => `$${i + 1}`).join(', ')})
    `, functions);

    checkRows.forEach(r => {
      const status = r.has_search_path === 'true' ? '✅' : '❌';
      console.log(`   ${status} ${r.name}: search_path = ${r.has_search_path}`);
    });

    console.log('\n✅ Funções atualizadas!');
    console.log('   Verifique o Database Linter no Supabase Dashboard.');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
  }

  await client.end();
}

run();
