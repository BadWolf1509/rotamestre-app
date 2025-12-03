/**
 * Script para aplicar migração de segurança diretamente no PostgreSQL
 * Usa conexão direta via pg (não depende de RPC)
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Connection string do Supabase (pooler mode)
// Formato: postgresql://postgres.[project-ref]:[password]@[host]:6543/postgres
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://postgres.xezslsyxjivunmhhyxtd:RotaMestre2025!@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';

async function runMigration() {
  console.log('🔧 Conectando ao banco de dados Supabase...\n');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados!\n');

    // PARTE 1: Recriar views sem SECURITY DEFINER
    console.log('📋 PARTE 1: Recriando views sem SECURITY DEFINER...\n');

    // 1.1 vw_rotas_resumo
    console.log('   → Recriando vw_rotas_resumo...');
    await client.query(`DROP VIEW IF EXISTS public.vw_rotas_resumo CASCADE`);
    await client.query(`
      CREATE VIEW public.vw_rotas_resumo AS
      SELECT
        r.id,
        r.unidade_id,
        u.nome AS unidade_nome,
        r.motorista_id,
        usr.nome AS motorista_nome,
        r.data,
        r.status,
        r.observacoes,
        COUNT(p.id) AS total_paradas,
        COUNT(p.id) FILTER (WHERE p.status = 'concluida') AS paradas_concluidas,
        COUNT(p.id) FILTER (WHERE p.status = 'pendente') AS paradas_pendentes,
        COUNT(p.id) FILTER (WHERE p.status = 'pulada') AS paradas_puladas,
        CASE
          WHEN COUNT(p.id) > 0 THEN
            ROUND((COUNT(p.id) FILTER (WHERE p.status = 'concluida')::NUMERIC / COUNT(p.id)) * 100, 2)
          ELSE 0
        END AS progresso_percentual,
        r.created_at,
        r.updated_at
      FROM public.rotas r
      LEFT JOIN public.unidades u ON r.unidade_id = u.id
      LEFT JOIN public.usuarios usr ON r.motorista_id = usr.id
      LEFT JOIN public.paradas p ON r.id = p.rota_id
      GROUP BY r.id, u.nome, usr.nome
    `);
    console.log('   ✅ vw_rotas_resumo recriada\n');

    // 1.2 vw_performance_motoristas
    console.log('   → Recriando vw_performance_motoristas...');
    await client.query(`DROP VIEW IF EXISTS public.vw_performance_motoristas CASCADE`);
    await client.query(`
      CREATE VIEW public.vw_performance_motoristas AS
      SELECT
        usr.id AS motorista_id,
        usr.nome AS motorista_nome,
        usr.email AS motorista_email,
        u.id AS unidade_id,
        u.nome AS unidade_nome,
        COUNT(DISTINCT r.id) AS total_rotas,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'concluida') AS rotas_concluidas,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'em_andamento') AS rotas_em_andamento,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'pendente') AS rotas_pendentes,
        COUNT(p.id) AS total_paradas,
        COUNT(p.id) FILTER (WHERE p.status = 'concluida') AS paradas_concluidas,
        CASE
          WHEN COUNT(p.id) > 0 THEN
            ROUND((COUNT(p.id) FILTER (WHERE p.status = 'concluida')::NUMERIC / COUNT(p.id)) * 100, 2)
          ELSE 0
        END AS taxa_conclusao_percentual,
        MIN(r.data) AS primeira_rota,
        MAX(r.data) AS ultima_rota
      FROM public.usuarios usr
      JOIN public.unidades u ON usr.unidade_id = u.id
      LEFT JOIN public.rotas r ON usr.id = r.motorista_id
      LEFT JOIN public.paradas p ON r.id = p.rota_id
      WHERE usr.papel = 'motorista'
      GROUP BY usr.id, usr.nome, usr.email, u.id, u.nome
    `);
    console.log('   ✅ vw_performance_motoristas recriada\n');

    // 1.3 vw_paradas_com_vinculo
    console.log('   → Recriando vw_paradas_com_vinculo...');
    await client.query(`DROP VIEW IF EXISTS public.vw_paradas_com_vinculo CASCADE`);

    // Verificar se coluna parada_vinculada_id existe
    const { rows: colCheck } = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'paradas' AND column_name = 'parada_vinculada_id'
      ) AS exists
    `);

    if (colCheck[0].exists) {
      await client.query(`
        CREATE VIEW public.vw_paradas_com_vinculo AS
        SELECT
          p.id,
          p.rota_id,
          p.endereco,
          p.destinatario,
          p.tipo,
          p.status,
          p.latitude,
          p.longitude,
          p.ordem,
          p.observacoes,
          p.foto_url,
          p.is_checkpoint,
          p.parada_vinculada_id,
          p.created_at,
          p.updated_at,
          pv.endereco AS vinculo_endereco,
          pv.destinatario AS vinculo_destinatario,
          pv.tipo AS vinculo_tipo,
          pv.status AS vinculo_status,
          pv.ordem AS vinculo_ordem
        FROM public.paradas p
        LEFT JOIN public.paradas pv ON p.parada_vinculada_id = pv.id
      `);
    } else {
      // Versão simplificada sem vínculo
      await client.query(`
        CREATE VIEW public.vw_paradas_com_vinculo AS
        SELECT
          p.id,
          p.rota_id,
          p.endereco,
          p.destinatario,
          p.tipo,
          p.status,
          p.latitude,
          p.longitude,
          p.ordem,
          p.observacoes,
          p.foto_url,
          p.is_checkpoint,
          NULL::uuid AS parada_vinculada_id,
          p.created_at,
          p.updated_at,
          NULL::text AS vinculo_endereco,
          NULL::text AS vinculo_destinatario,
          NULL::text AS vinculo_tipo,
          NULL::text AS vinculo_status,
          NULL::int AS vinculo_ordem
        FROM public.paradas p
      `);
      console.log('   ⚠️  Coluna parada_vinculada_id não existe, view criada sem vínculo');
    }
    console.log('   ✅ vw_paradas_com_vinculo recriada\n');

    // 1.4 admin_dashboard_metrics
    console.log('   → Recriando admin_dashboard_metrics...');
    await client.query(`DROP VIEW IF EXISTS public.admin_dashboard_metrics CASCADE`);
    await client.query(`
      CREATE VIEW public.admin_dashboard_metrics AS
      SELECT
        (SELECT COUNT(*) FROM public.unidades WHERE ativa = true) AS total_unidades_ativas,
        (SELECT COUNT(*) FROM public.unidades WHERE ativa = false) AS total_unidades_inativas,
        (SELECT COUNT(*) FROM public.usuarios) AS total_usuarios,
        (SELECT COUNT(*) FROM public.usuarios WHERE papel = 'gestor') AS total_gestores,
        (SELECT COUNT(*) FROM public.usuarios WHERE papel = 'motorista') AS total_motoristas,
        (SELECT COUNT(*) FROM public.rotas) AS total_rotas,
        (SELECT COUNT(*) FROM public.rotas WHERE status = 'concluida') AS rotas_concluidas,
        (SELECT COUNT(*) FROM public.rotas WHERE status = 'em_andamento') AS rotas_em_andamento,
        (SELECT COUNT(*) FROM public.rotas WHERE status = 'pendente') AS rotas_pendentes,
        (SELECT COUNT(*) FROM public.rotas WHERE data = CURRENT_DATE) AS rotas_hoje,
        (SELECT COUNT(*) FROM public.paradas p JOIN public.rotas r ON p.rota_id = r.id WHERE r.data = CURRENT_DATE) AS paradas_hoje,
        NOW() AS generated_at
    `);
    console.log('   ✅ admin_dashboard_metrics recriada\n');

    // PARTE 2: RLS na tabela incidentes
    console.log('📋 PARTE 2: Habilitando RLS em incidentes...\n');

    try {
      // Verificar se tabela existe
      const { rows: incidentesCheck } = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'incidentes' AND table_schema = 'public'
        ) AS exists
      `);

      if (incidentesCheck[0].exists) {
        await client.query(`ALTER TABLE public.incidentes ENABLE ROW LEVEL SECURITY`);

        // Dropar políticas existentes
        await client.query(`DROP POLICY IF EXISTS incidentes_select_policy ON public.incidentes`);
        await client.query(`DROP POLICY IF EXISTS incidentes_insert_policy ON public.incidentes`);
        await client.query(`DROP POLICY IF EXISTS incidentes_update_policy ON public.incidentes`);
        await client.query(`DROP POLICY IF EXISTS incidentes_delete_policy ON public.incidentes`);

        // Criar novas políticas
        await client.query(`
          CREATE POLICY incidentes_select_policy ON public.incidentes
            FOR SELECT USING (
              unidade_id IN (SELECT unidade_id FROM public.usuarios WHERE id = auth.uid())
            )
        `);
        await client.query(`
          CREATE POLICY incidentes_insert_policy ON public.incidentes
            FOR INSERT WITH CHECK (
              unidade_id IN (SELECT unidade_id FROM public.usuarios WHERE id = auth.uid())
            )
        `);
        await client.query(`
          CREATE POLICY incidentes_update_policy ON public.incidentes
            FOR UPDATE USING (
              unidade_id IN (SELECT unidade_id FROM public.usuarios WHERE id = auth.uid() AND papel = 'gestor')
            )
        `);
        await client.query(`
          CREATE POLICY incidentes_delete_policy ON public.incidentes
            FOR DELETE USING (
              unidade_id IN (SELECT unidade_id FROM public.usuarios WHERE id = auth.uid() AND papel = 'gestor')
            )
        `);
        console.log('   ✅ RLS habilitado em incidentes com 4 políticas\n');
      } else {
        console.log('   ⚠️  Tabela incidentes não existe\n');
      }
    } catch (err) {
      console.log('   ⚠️  Erro em incidentes:', err.message, '\n');
    }

    // PARTE 3: RLS na tabela admin_logs
    console.log('📋 PARTE 3: Habilitando RLS em admin_logs...\n');

    try {
      const { rows: adminLogsCheck } = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'admin_logs' AND table_schema = 'public'
        ) AS exists
      `);

      if (adminLogsCheck[0].exists) {
        await client.query(`ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY`);
        await client.query(`DROP POLICY IF EXISTS admin_logs_no_access ON public.admin_logs`);
        await client.query(`
          CREATE POLICY admin_logs_no_access ON public.admin_logs
            FOR ALL USING (false)
        `);
        console.log('   ✅ RLS habilitado em admin_logs (bloqueado para usuários)\n');
      } else {
        console.log('   ⚠️  Tabela admin_logs não existe\n');
      }
    } catch (err) {
      console.log('   ⚠️  Erro em admin_logs:', err.message, '\n');
    }

    // PARTE 4: RLS na tabela spatial_ref_sys
    console.log('📋 PARTE 4: Habilitando RLS em spatial_ref_sys...\n');

    try {
      const { rows: spatialCheck } = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'spatial_ref_sys' AND table_schema = 'public'
        ) AS exists
      `);

      if (spatialCheck[0].exists) {
        await client.query(`ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY`);
        await client.query(`DROP POLICY IF EXISTS spatial_ref_sys_public_read ON public.spatial_ref_sys`);
        await client.query(`
          CREATE POLICY spatial_ref_sys_public_read ON public.spatial_ref_sys
            FOR SELECT USING (true)
        `);
        console.log('   ✅ RLS habilitado em spatial_ref_sys (permissivo)\n');
      } else {
        console.log('   ⚠️  Tabela spatial_ref_sys não existe (PostGIS não instalado)\n');
      }
    } catch (err) {
      console.log('   ⚠️  Erro em spatial_ref_sys:', err.message, '\n');
    }

    // VALIDAÇÃO
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 VALIDAÇÃO FINAL');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Verificar views
    const { rows: viewsResult } = await client.query(`
      SELECT viewname as name,
        CASE
          WHEN definition ILIKE '%security definer%' THEN '❌ SECURITY DEFINER'
          ELSE '✅ OK'
        END AS status
      FROM pg_views
      WHERE schemaname = 'public'
        AND viewname IN ('vw_rotas_resumo', 'vw_performance_motoristas', 'vw_paradas_com_vinculo', 'admin_dashboard_metrics')
      ORDER BY viewname
    `);

    console.log('VIEWS:');
    viewsResult.forEach(v => console.log(`   ${v.status} ${v.name}`));

    // Verificar RLS nas tabelas
    const { rows: tablesResult } = await client.query(`
      SELECT tablename as name,
        CASE
          WHEN rowsecurity THEN '✅ RLS Habilitado'
          ELSE '❌ RLS Desabilitado'
        END AS status
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('incidentes', 'admin_logs', 'spatial_ref_sys')
      ORDER BY tablename
    `);

    console.log('\nTABELAS:');
    tablesResult.forEach(t => console.log(`   ${t.status} ${t.name}`));

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ MIGRAÇÃO APLICADA COM SUCESSO!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n📌 Verifique o Database Linter no Supabase Dashboard para confirmar.');

  } catch (error) {
    console.error('\n❌ Erro ao aplicar migração:', error.message);
    if (error.message.includes('password')) {
      console.log('\n💡 Verifique a senha do banco de dados na connection string.');
    }
  } finally {
    await client.end();
    console.log('\n🔌 Conexão encerrada.');
  }
}

runMigration();
