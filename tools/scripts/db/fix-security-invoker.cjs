/**
 * Recria views com security_invoker = true
 * Isso resolve o problema do Database Linter detectando SECURITY DEFINER
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('🔧 Recriando views com security_invoker = true...\n');

  try {
    // 1. vw_rotas_resumo
    console.log('   → vw_rotas_resumo...');
    await client.query('DROP VIEW IF EXISTS public.vw_rotas_resumo CASCADE');
    await client.query(`
      CREATE VIEW public.vw_rotas_resumo
      WITH (security_invoker = true)
      AS
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
    console.log('   ✅ vw_rotas_resumo');

    // 2. vw_performance_motoristas
    console.log('   → vw_performance_motoristas...');
    await client.query('DROP VIEW IF EXISTS public.vw_performance_motoristas CASCADE');
    await client.query(`
      CREATE VIEW public.vw_performance_motoristas
      WITH (security_invoker = true)
      AS
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
    console.log('   ✅ vw_performance_motoristas');

    // 3. vw_paradas_com_vinculo
    console.log('   → vw_paradas_com_vinculo...');
    await client.query('DROP VIEW IF EXISTS public.vw_paradas_com_vinculo CASCADE');
    await client.query(`
      CREATE VIEW public.vw_paradas_com_vinculo
      WITH (security_invoker = true)
      AS
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
    console.log('   ✅ vw_paradas_com_vinculo');

    // 4. admin_dashboard_metrics
    console.log('   → admin_dashboard_metrics...');
    await client.query('DROP VIEW IF EXISTS public.admin_dashboard_metrics CASCADE');
    await client.query(`
      CREATE VIEW public.admin_dashboard_metrics
      WITH (security_invoker = true)
      AS
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
    console.log('   ✅ admin_dashboard_metrics');

    // Validação
    console.log('\n🔍 Verificando security_invoker nas views...');
    const { rows } = await client.query(`
      SELECT c.relname as view_name,
        CASE
          WHEN c.reloptions IS NOT NULL AND 'security_invoker=true' = ANY(c.reloptions) THEN 'true'
          ELSE 'false'
        END as security_invoker
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'v'
        AND c.relname IN ('vw_rotas_resumo', 'vw_performance_motoristas', 'vw_paradas_com_vinculo', 'admin_dashboard_metrics')
    `);
    rows.forEach(r => {
      const status = r.security_invoker === 'true' ? '✅' : '❌';
      console.log(`   ${status} ${r.view_name}: security_invoker = ${r.security_invoker}`);
    });

    console.log('\n✅ Views recriadas com security_invoker = true!');
    console.log('   Verifique o Database Linter no Supabase Dashboard.');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
  }

  await client.end();
}

run();
