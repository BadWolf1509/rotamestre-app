#!/usr/bin/env node

const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('📦 Conectado ao banco...\n');

  const commands = [
    {
      name: 'get_my_unidade_id()',
      sql: `CREATE OR REPLACE FUNCTION public.get_my_unidade_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT unidade_id FROM public.usuarios WHERE id = auth.uid()
$$`
    },
    {
      name: 'DROP usuarios_select_optimized',
      sql: 'DROP POLICY IF EXISTS "usuarios_select_optimized" ON public.usuarios'
    },
    {
      name: 'CREATE usuarios_select_optimized',
      sql: `CREATE POLICY "usuarios_select_optimized" ON public.usuarios
FOR SELECT USING (
  id = (select auth.uid())
  OR
  unidade_id = (select public.get_my_unidade_id())
)`
    },
    {
      name: 'DROP motorista_locations_select_optimized',
      sql: 'DROP POLICY IF EXISTS "motorista_locations_select_optimized" ON public.motorista_locations'
    },
    {
      name: 'CREATE motorista_locations_select_optimized',
      sql: `CREATE POLICY "motorista_locations_select_optimized" ON public.motorista_locations
FOR SELECT USING (
  motorista_id = (select auth.uid())
  OR
  motorista_id IN (
    SELECT u.id FROM public.usuarios u
    WHERE u.unidade_id = (select public.get_my_unidade_id())
  )
)`
    }
  ];

  let success = 0;
  let errors = 0;

  for (const cmd of commands) {
    try {
      await client.query(cmd.sql);
      console.log('  ✅', cmd.name);
      success++;
    } catch (e) {
      console.error('  ❌', cmd.name + ':', e.message);
      errors++;
    }
  }

  await client.end();

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Resultado: ${success} sucesso, ${errors} erros`);

  if (errors === 0) {
    console.log('\n🎉 Correção aplicada! Teste o login novamente.');
  }
}

main().catch(console.error);
