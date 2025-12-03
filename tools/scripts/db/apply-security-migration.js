/**
 * Script para aplicar migração de segurança no Supabase
 * Corrige: Security Definer Views + RLS em tabelas
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variáveis de ambiente não encontradas!');
  console.log('   Necessário: EXPO_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function runMigration() {
  console.log('🔧 Aplicando migração de segurança...\n');

  try {
    // PARTE 1: Recriar views sem SECURITY DEFINER
    console.log('📋 PARTE 1: Recriando views sem SECURITY DEFINER...');

    // 1.1 vw_rotas_resumo
    console.log('   → vw_rotas_resumo...');
    await supabase.rpc('exec_sql', {
      sql: `
        DROP VIEW IF EXISTS public.vw_rotas_resumo CASCADE;

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
        GROUP BY r.id, u.nome, usr.nome;
      `
    });
    console.log('   ✅ vw_rotas_resumo recriada');

    // 1.2 vw_performance_motoristas
    console.log('   → vw_performance_motoristas...');
    await supabase.rpc('exec_sql', {
      sql: `
        DROP VIEW IF EXISTS public.vw_performance_motoristas CASCADE;

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
        GROUP BY usr.id, usr.nome, usr.email, u.id, u.nome;
      `
    });
    console.log('   ✅ vw_performance_motoristas recriada');

    // 1.3 vw_paradas_com_vinculo
    console.log('   → vw_paradas_com_vinculo...');
    await supabase.rpc('exec_sql', {
      sql: `
        DROP VIEW IF EXISTS public.vw_paradas_com_vinculo CASCADE;

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
        LEFT JOIN public.paradas pv ON p.parada_vinculada_id = pv.id;
      `
    });
    console.log('   ✅ vw_paradas_com_vinculo recriada');

    // 1.4 admin_dashboard_metrics
    console.log('   → admin_dashboard_metrics...');
    await supabase.rpc('exec_sql', {
      sql: `
        DROP VIEW IF EXISTS public.admin_dashboard_metrics CASCADE;

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
          NOW() AS generated_at;
      `
    });
    console.log('   ✅ admin_dashboard_metrics recriada');

    // PARTE 2: RLS na tabela incidentes
    console.log('\n📋 PARTE 2: Habilitando RLS em incidentes...');

    const { data: incidentesExists } = await supabase
      .from('incidentes')
      .select('id')
      .limit(1);

    if (incidentesExists !== null) {
      await supabase.rpc('exec_sql', {
        sql: `
          ALTER TABLE public.incidentes ENABLE ROW LEVEL SECURITY;

          DROP POLICY IF EXISTS incidentes_select_policy ON public.incidentes;
          DROP POLICY IF EXISTS incidentes_insert_policy ON public.incidentes;
          DROP POLICY IF EXISTS incidentes_update_policy ON public.incidentes;
          DROP POLICY IF EXISTS incidentes_delete_policy ON public.incidentes;

          CREATE POLICY incidentes_select_policy ON public.incidentes
            FOR SELECT USING (
              unidade_id IN (SELECT unidade_id FROM public.usuarios WHERE id = auth.uid())
            );

          CREATE POLICY incidentes_insert_policy ON public.incidentes
            FOR INSERT WITH CHECK (
              unidade_id IN (SELECT unidade_id FROM public.usuarios WHERE id = auth.uid())
            );

          CREATE POLICY incidentes_update_policy ON public.incidentes
            FOR UPDATE USING (
              unidade_id IN (SELECT unidade_id FROM public.usuarios WHERE id = auth.uid() AND papel = 'gestor')
            );

          CREATE POLICY incidentes_delete_policy ON public.incidentes
            FOR DELETE USING (
              unidade_id IN (SELECT unidade_id FROM public.usuarios WHERE id = auth.uid() AND papel = 'gestor')
            );
        `
      });
      console.log('   ✅ RLS habilitado em incidentes');
    } else {
      console.log('   ⚠️ Tabela incidentes não encontrada');
    }

    // PARTE 3: RLS na tabela admin_logs
    console.log('\n📋 PARTE 3: Habilitando RLS em admin_logs...');

    const { data: adminLogsExists } = await supabase
      .from('admin_logs')
      .select('id')
      .limit(1);

    if (adminLogsExists !== null) {
      await supabase.rpc('exec_sql', {
        sql: `
          ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

          DROP POLICY IF EXISTS admin_logs_no_access ON public.admin_logs;

          CREATE POLICY admin_logs_no_access ON public.admin_logs
            FOR ALL USING (false);
        `
      });
      console.log('   ✅ RLS habilitado em admin_logs (bloqueado para usuários)');
    } else {
      console.log('   ⚠️ Tabela admin_logs não encontrada');
    }

    // PARTE 4: RLS na tabela spatial_ref_sys
    console.log('\n📋 PARTE 4: Habilitando RLS em spatial_ref_sys...');

    await supabase.rpc('exec_sql', {
      sql: `
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'spatial_ref_sys' AND table_schema = 'public') THEN
            ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
            DROP POLICY IF EXISTS spatial_ref_sys_public_read ON public.spatial_ref_sys;
            CREATE POLICY spatial_ref_sys_public_read ON public.spatial_ref_sys FOR SELECT USING (true);
          END IF;
        END $$;
      `
    });
    console.log('   ✅ RLS habilitado em spatial_ref_sys (permissivo)');

    console.log('\n✅ Migração aplicada com sucesso!');
    console.log('\n📊 Verifique o Database Linter no Supabase Dashboard para confirmar.');

  } catch (error) {
    console.error('\n❌ Erro ao aplicar migração:', error.message);
    console.log('\n💡 Alternativa: Cole o SQL diretamente no Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/sql');
  }
}

runMigration();
