const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://xezslsyxjivunmhhyxtd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlenNsc3l4aml2dW5taGh5eHRkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDkwOTQ1NywiZXhwIjoyMDc2NDg1NDU3fQ.HRBlXp4cGD4sio2I7F4ZLBeGakHSYcGXrJevVoZQk_c',
  {
    db: { schema: 'public' },
    auth: { persistSession: false }
  }
);

async function main() {
  console.log('Testing current trigger state...\n');

  // Test update to see current error
  const { data: rotas, error: rotasError } = await supabase
    .from('rotas')
    .select('id, status')
    .eq('status', 'pendente')
    .limit(1);

  if (rotasError) {
    console.error('Erro ao buscar rotas:', rotasError);
    return;
  }

  if (rotas && rotas.length > 0) {
    console.log('Found pending route:', rotas[0].id);

    // Try update
    const { error: updateError } = await supabase
      .from('rotas')
      .update({ status: 'em_andamento', iniciada_em: new Date().toISOString() })
      .eq('id', rotas[0].id);

    if (updateError) {
      console.log('Update error (expected):', updateError.message);
      console.log('\n=== MIGRATION REQUIRED ===');
      console.log('\nPlease run the following SQL in Supabase Dashboard SQL Editor:\n');
      console.log('Go to: https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/sql/new');
      console.log('\nSQL to execute:');
      console.log('------------------------------------------');
      console.log(`
-- Fix notify_rota_iniciada trigger
CREATE OR REPLACE FUNCTION notify_rota_iniciada()
RETURNS TRIGGER AS $$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
BEGIN
  IF NEW.status = 'em_andamento' AND OLD.status = 'pendente' THEN
    SELECT uu.usuario_id INTO v_gestor_id
    FROM public.usuario_unidades uu
    WHERE uu.unidade_id = NEW.unidade_id
      AND uu.papel = 'gestor'
      AND uu.ativo = true
    LIMIT 1;

    SELECT nome INTO v_motorista_nome
    FROM public.usuarios
    WHERE id = NEW.motorista_id;

    IF v_gestor_id IS NOT NULL THEN
      PERFORM criar_notificacao(
        v_gestor_id,
        'rota_iniciada',
        'Rota Iniciada',
        'O motorista ' || COALESCE(v_motorista_nome, 'Nao atribuido') || ' iniciou uma rota',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix notify_rota_concluida trigger
CREATE OR REPLACE FUNCTION notify_rota_concluida()
RETURNS TRIGGER AS $$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
  v_total_paradas INT;
  v_paradas_concluidas INT;
BEGIN
  IF NEW.status = 'concluida' AND OLD.status != 'concluida' THEN
    SELECT uu.usuario_id INTO v_gestor_id
    FROM public.usuario_unidades uu
    WHERE uu.unidade_id = NEW.unidade_id
      AND uu.papel = 'gestor'
      AND uu.ativo = true
    LIMIT 1;

    SELECT nome INTO v_motorista_nome
    FROM public.usuarios
    WHERE id = NEW.motorista_id;

    SELECT
      COUNT(*) FILTER (WHERE is_checkpoint IS NULL OR is_checkpoint = TRUE),
      COUNT(*) FILTER (WHERE status = 'concluida' AND (is_checkpoint IS NULL OR is_checkpoint = TRUE))
    INTO v_total_paradas, v_paradas_concluidas
    FROM public.paradas
    WHERE rota_id = NEW.id;

    IF v_gestor_id IS NOT NULL THEN
      PERFORM criar_notificacao(
        v_gestor_id,
        'rota_concluida',
        'Rota Concluida',
        'O motorista ' || COALESCE(v_motorista_nome, 'Nao atribuido') ||
        ' finalizou a rota com ' || v_paradas_concluidas || '/' || v_total_paradas || ' paradas concluidas',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`);
      console.log('------------------------------------------');
    } else {
      console.log('Update succeeded! Reverting...');
      await supabase
        .from('rotas')
        .update({ status: 'pendente', iniciada_em: null })
        .eq('id', rotas[0].id);
      console.log('Reverted. Triggers are working correctly!');
    }
  } else {
    console.log('No pending routes found');
  }
}

main().catch(console.error);
