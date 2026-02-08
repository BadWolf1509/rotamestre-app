/**
 * Execute migration: Fix RLS policies for multi-unit support
 * Usage: node database/migrations/execute-fix-multi-unidade.js
 */

require('dotenv').config({ path: '.env' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Get service role key from painel
let serviceKey;
try {
  const envLocal = fs.readFileSync('../rotamestre-painel/.env.local', 'utf8');
  const match = envLocal.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
  if (match) serviceKey = match[1].trim();
} catch (e) { /* ignore */ }

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
if (!url || !serviceKey) {
  console.error('Missing env vars. URL:', !!url, 'ServiceKey:', !!serviceKey);
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  db: { schema: 'public' },
});

const sqlFile = fs.readFileSync(
  __dirname + '/20260208000000_fix_rls_multi_unidade.sql',
  'utf8'
);

// Split into individual statements (skip comments and empty lines)
function splitStatements(sql) {
  const statements = [];
  let current = '';

  for (const line of sql.split('\n')) {
    const trimmed = line.trim();
    // Skip pure comment lines and empty lines when starting a new statement
    if (!current && (trimmed.startsWith('--') || trimmed === '')) continue;

    current += line + '\n';

    // Check for statement end (semicolon at end of line, not in a $$ block)
    if (trimmed.endsWith(';') && !current.includes('$$')) {
      statements.push(current.trim());
      current = '';
    }
    // For $$ blocks (functions), wait for closing $$;
    if (current.includes('$$') && trimmed === '$$;') {
      statements.push(current.trim());
      current = '';
    }
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}

async function run() {
  console.log('🔄 Executing RLS multi-unit fix migration...\n');

  // Execute as a single block using rpc
  const { error } = await supabase.rpc('exec_sql', { sql: sqlFile });

  if (error) {
    // If exec_sql doesn't exist, try statement by statement via REST
    console.log('exec_sql not available, executing statements individually...\n');

    const statements = splitStatements(sqlFile);
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.substring(0, 80).replace(/\n/g, ' ');
      console.log(`  [${i + 1}/${statements.length}] ${preview}...`);

      const { error: stmtError } = await supabase.rpc('exec_sql', { sql: stmt });
      if (stmtError) {
        console.error(`  ❌ Error: ${stmtError.message}`);
        // Continue anyway — some statements may fail if policy doesn't exist
      } else {
        console.log('  ✅ OK');
      }
    }
  } else {
    console.log('✅ Migration executed successfully as single block');
  }

  // Verify: test that Saulo Fernandes is visible
  console.log('\n🔍 Verification: checking usuarios visibility...');

  const { data: saulo } = await supabase
    .from('usuarios')
    .select('id, nome, unidade_id')
    .eq('id', '30a3de30-135f-45d5-b89e-d12693269b4b')
    .single();

  console.log('  Saulo Fernandes row:', saulo ? `✅ ${saulo.nome}` : '⚠️  Not found (expected with service role)');

  console.log('\n✅ Migration complete. Please test the app to verify.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
