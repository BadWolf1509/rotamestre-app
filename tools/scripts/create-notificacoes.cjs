const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.xezslsyxjivunmhhyxtd:hpjhgjh5xSE0FPLy@aws-1-sa-east-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('Connected to database\n');

    // Create notificacoes table
    console.log('1. Creating notificacoes table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.notificacoes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
        tipo VARCHAR(50) NOT NULL,
        titulo VARCHAR(255) NOT NULL,
        mensagem TEXT NOT NULL,
        rota_id UUID REFERENCES public.rotas(id) ON DELETE CASCADE,
        parada_id UUID REFERENCES public.paradas(id) ON DELETE SET NULL,
        incidente_id UUID,
        lida BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('   ✓ Table created');

    // Create indexes
    console.log('2. Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_lida ON public.notificacoes(usuario_id, lida);
      CREATE INDEX IF NOT EXISTS idx_notificacoes_created ON public.notificacoes(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notificacoes_rota ON public.notificacoes(rota_id);
      CREATE INDEX IF NOT EXISTS idx_notificacoes_tipo ON public.notificacoes(tipo);
    `);
    console.log('   ✓ Indexes created');

    // Enable RLS
    console.log('3. Enabling RLS...');
    await client.query(`
      ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
    `);
    console.log('   ✓ RLS enabled');

    // Create RLS policies
    console.log('4. Creating RLS policies...');
    await client.query(`
      DROP POLICY IF EXISTS notificacoes_select ON public.notificacoes;
      CREATE POLICY notificacoes_select ON public.notificacoes
        FOR SELECT
        USING (usuario_id = auth.uid());

      DROP POLICY IF EXISTS notificacoes_update ON public.notificacoes;
      CREATE POLICY notificacoes_update ON public.notificacoes
        FOR UPDATE
        USING (usuario_id = auth.uid());
    `);
    console.log('   ✓ Policies created');

    // Create criar_notificacao function if not exists
    console.log('5. Creating criar_notificacao function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION criar_notificacao(
        p_usuario_id UUID,
        p_tipo VARCHAR,
        p_titulo VARCHAR,
        p_mensagem TEXT,
        p_rota_id UUID DEFAULT NULL,
        p_parada_id UUID DEFAULT NULL,
        p_incidente_id UUID DEFAULT NULL
      ) RETURNS UUID AS $func$
      DECLARE
        v_notificacao_id UUID;
      BEGIN
        INSERT INTO public.notificacoes (
          usuario_id,
          tipo,
          titulo,
          mensagem,
          rota_id,
          parada_id,
          incidente_id
        ) VALUES (
          p_usuario_id,
          p_tipo,
          p_titulo,
          p_mensagem,
          p_rota_id,
          p_parada_id,
          p_incidente_id
        ) RETURNING id INTO v_notificacao_id;

        RETURN v_notificacao_id;
      EXCEPTION WHEN OTHERS THEN
        -- Fail silently if there's any issue
        RETURN NULL;
      END;
      $func$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
    console.log('   ✓ Function created');

    // Grant permissions
    console.log('6. Granting permissions...');
    await client.query(`
      GRANT SELECT, INSERT, UPDATE ON public.notificacoes TO authenticated;
      GRANT EXECUTE ON FUNCTION criar_notificacao TO authenticated;
    `);
    console.log('   ✓ Permissions granted');

    console.log('\n=== Notificacoes setup complete! ===\n');

    // Test route update now
    console.log('Testing route update...');
    const { rows: rotas } = await client.query(`
      SELECT id, status FROM public.rotas WHERE status = 'pendente' LIMIT 1
    `);

    if (rotas.length > 0) {
      console.log('Found pending route:', rotas[0].id);

      await client.query(`
        UPDATE public.rotas
        SET status = 'em_andamento', iniciada_em = NOW()
        WHERE id = $1
      `, [rotas[0].id]);
      console.log('✓ Update succeeded!');

      // Check if notification was created
      const { rows: notifs } = await client.query(`
        SELECT * FROM public.notificacoes ORDER BY created_at DESC LIMIT 1
      `);
      if (notifs.length > 0) {
        console.log('✓ Notification created:', notifs[0].titulo);
      }

      // Revert
      await client.query(`
        UPDATE public.rotas
        SET status = 'pendente', iniciada_em = NULL
        WHERE id = $1
      `, [rotas[0].id]);
      console.log('✓ Reverted to pendente');
    } else {
      console.log('No pending routes to test');
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
