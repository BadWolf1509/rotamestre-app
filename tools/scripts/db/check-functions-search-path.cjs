#!/usr/bin/env node
/**
 * Script para verificar se as funções têm search_path definido
 * Investiga por que o Database Linter ainda mostra avisos
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: EXPO_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessários');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkFunctions() {
  try {
    console.log('🔍 Verificando funções no banco de dados...\n');

    // Query para buscar as funções e suas configurações
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT
          p.proname AS function_name,
          p.prosecdef AS is_security_definer,
          p.proconfig AS search_path_config,
          CASE
            WHEN p.proconfig IS NOT NULL THEN 'SIM ✅'
            ELSE 'NÃO ❌'
          END AS has_search_path
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname IN ('get_user_unidade', 'get_user_role', 'calcular_distancia')
        ORDER BY p.proname;
      `
    });

    if (error) {
      console.error('❌ Erro ao consultar funções:', error.message);
      console.log('\n💡 Tentando método alternativo...\n');

      // Método alternativo: buscar diretamente da pg_proc
      const query = `
        SELECT
          p.proname::text AS function_name,
          CASE WHEN p.prosecdef THEN 'true' ELSE 'false' END AS is_security_definer,
          CASE
            WHEN p.proconfig IS NOT NULL THEN array_to_string(p.proconfig, ', ')
            ELSE NULL
          END AS search_path_config,
          CASE
            WHEN p.proconfig IS NOT NULL THEN 'SIM ✅'
            ELSE 'NÃO ❌'
          END AS has_search_path
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname IN ('get_user_unidade', 'get_user_role', 'calcular_distancia')
        ORDER BY p.proname;
      `;

      const { data: altData, error: altError } = await supabase
        .from('pg_proc')
        .select('*')
        .in('proname', ['get_user_unidade', 'get_user_role', 'calcular_distancia']);

      if (altError) {
        console.error('❌ Método alternativo também falhou:', altError.message);
        console.log('\n📋 Por favor, execute este SQL manualmente no Supabase Dashboard:\n');
        console.log(query);
        return;
      }

      console.log('Resultado do método alternativo:', altData);
      return;
    }

    console.log('📊 Resultado:\n');
    console.table(data);

    // Análise dos resultados
    console.log('\n🔍 Análise:\n');

    let allFixed = true;
    data.forEach(func => {
      if (func.search_path_config === null) {
        console.log(`❌ ${func.function_name}: search_path NÃO está definido`);
        allFixed = false;
      } else {
        console.log(`✅ ${func.function_name}: search_path = ${func.search_path_config}`);
      }
    });

    if (allFixed) {
      console.log('\n✅ Todas as funções têm search_path definido!');
      console.log('\n💡 Se o Linter ainda mostra avisos, tente:');
      console.log('   1. Aguardar alguns minutos (cache do linter)');
      console.log('   2. Executar o linter novamente');
      console.log('   3. Verificar se há outras funções com o mesmo nome em schemas diferentes');
    } else {
      console.log('\n⚠️  Algumas funções ainda não têm search_path definido.');
      console.log('\n📋 Solução: Execute novamente a migration:');
      console.log('   database/migrations/20251022000000_fix_security_warnings.sql');
    }

  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

// Executar
checkFunctions();
