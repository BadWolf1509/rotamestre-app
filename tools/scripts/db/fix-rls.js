#!/usr/bin/env node

/**
 * Script para aplicar correção de RLS no Supabase
 * Corrige o problema de recursão infinita nas políticas
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '..', 'mcp-server', '.env');

dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERRO: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar definidos no .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyFixRLS() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║      Aplicar Correção de RLS - RotaMestre     ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  console.log(`📡 Supabase URL: ${SUPABASE_URL}\n`);

  try {
    // Ler SQL de correção
    const sqlPath = join(__dirname, '..', '..', '..', 'database', 'migrations', '20251020000000_fix_rls_recursion.sql');
    console.log(`📄 Lendo SQL de correção: ${sqlPath}`);

    const sql = readFileSync(sqlPath, 'utf8');

    console.log(`\n🔄 Aplicando correção de RLS...`);
    console.log(`   Tamanho do SQL: ${sql.length} caracteres\n`);

    // IMPORTANTE: O Supabase JS client não suporta executar SQL direto
    // Então vamos orientar o usuário a aplicar via Dashboard

    console.log('⚠️  ATENÇÃO: O SQL precisa ser aplicado manualmente no Supabase Dashboard\n');
    console.log('📋 INSTRUÇÕES:\n');
    console.log('1. Acesse: https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/sql/new');
    console.log('2. Cole o conteúdo do arquivo:');
    console.log(`   database/migrations/20251020000000_fix_rls_recursion.sql`);
    console.log('3. Clique em "Run" para executar');
    console.log('4. Aguarde confirmação de sucesso\n');

    console.log('💡 Alternativamente, use o Supabase CLI:\n');
    console.log('   supabase db push --db-url "postgresql://..."');
    console.log('   (configure a connection string do seu projeto)\n');

    console.log('📝 O que será corrigido:\n');
    console.log('   ✅ Remover políticas RLS recursivas');
    console.log('   ✅ Criar funções helper seguras (auth.get_user_papel, auth.get_user_unidade_id)');
    console.log('   ✅ Recriar políticas sem recursão');
    console.log('   ✅ Adicionar políticas simplificadas para unidades e rotas\n');

    console.log('✅ Script preparado! Siga as instruções acima.\n');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    process.exit(1);
  }
}

applyFixRLS();
