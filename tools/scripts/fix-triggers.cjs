const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.xezslsyxjivunmhhyxtd:hpjhgjh5xSE0FPLy@aws-1-sa-east-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

const fixNotifyRotaIniciada = `
CREATE OR REPLACE FUNCTION notify_rota_iniciada()
RETURNS TRIGGER AS $func$
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
$func$ LANGUAGE plpgsql SECURITY DEFINER;
`;

const fixNotifyRotaConcluida = `
CREATE OR REPLACE FUNCTION notify_rota_concluida()
RETURNS TRIGGER AS $func$
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
$func$ LANGUAGE plpgsql SECURITY DEFINER;
`;

const fixNotifyParadaPulada = `
CREATE OR REPLACE FUNCTION notify_parada_pulada()
RETURNS TRIGGER AS $func$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
  v_unidade_id UUID;
BEGIN
  IF NEW.status = 'pulada' AND OLD.status != 'pulada' THEN
    SELECT r.unidade_id, u.nome
    INTO v_unidade_id, v_motorista_nome
    FROM public.rotas r
    LEFT JOIN public.usuarios u ON u.id = r.motorista_id
    WHERE r.id = NEW.rota_id;

    SELECT uu.usuario_id INTO v_gestor_id
    FROM public.usuario_unidades uu
    WHERE uu.unidade_id = v_unidade_id
      AND uu.papel = 'gestor'
      AND uu.ativo = true
    LIMIT 1;

    IF v_gestor_id IS NOT NULL THEN
      PERFORM criar_notificacao(
        v_gestor_id,
        'parada_pulada',
        'Parada Pulada',
        'O motorista ' || COALESCE(v_motorista_nome, 'Nao atribuido') ||
        ' pulou uma parada: ' || NEW.endereco,
        NEW.rota_id,
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;
`;

const fixNotifyIncidenteCriado = `
CREATE OR REPLACE FUNCTION notify_incidente_criado()
RETURNS TRIGGER AS $func$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
  v_categoria_label VARCHAR(100);
  v_unidade_id UUID;
BEGIN
  SELECT u.nome, uu.unidade_id
  INTO v_motorista_nome, v_unidade_id
  FROM public.usuarios u
  LEFT JOIN public.usuario_unidades uu ON uu.usuario_id = u.id AND uu.ativo = true AND uu.is_principal = true
  WHERE u.id = NEW.motorista_id
  LIMIT 1;

  IF v_unidade_id IS NULL THEN
    SELECT uu.unidade_id
    INTO v_unidade_id
    FROM public.usuario_unidades uu
    WHERE uu.usuario_id = NEW.motorista_id AND uu.ativo = true
    LIMIT 1;
  END IF;

  SELECT uu.usuario_id INTO v_gestor_id
  FROM public.usuario_unidades uu
  WHERE uu.unidade_id = v_unidade_id
    AND uu.papel = 'gestor'
    AND uu.ativo = true
  LIMIT 1;

  v_categoria_label := CASE NEW.categoria
    WHEN 'accident' THEN 'Acidente/Incidente'
    WHEN 'absent' THEN 'Cliente ausente'
    WHEN 'wrong_address' THEN 'Endereco incorreto'
    WHEN 'blocked' THEN 'Acesso bloqueado'
    WHEN 'vehicle' THEN 'Problema no veiculo'
    ELSE 'Outros'
  END;

  IF v_gestor_id IS NOT NULL THEN
    PERFORM criar_notificacao(
      v_gestor_id,
      'incidente_reportado',
      'Incidente Reportado',
      'O motorista ' || COALESCE(v_motorista_nome, 'Nao atribuido') ||
      ' reportou: ' || v_categoria_label || ' - ' || SUBSTRING(NEW.descricao, 1, 100),
      NEW.rota_id,
      NULL,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;
`;

async function main() {
  const client = await pool.connect();
  try {
    console.log('Connected to database\n');

    console.log('1. Fixing notify_rota_iniciada...');
    await client.query(fixNotifyRotaIniciada);
    console.log('   ✓ Done');

    console.log('2. Fixing notify_rota_concluida...');
    await client.query(fixNotifyRotaConcluida);
    console.log('   ✓ Done');

    console.log('3. Fixing notify_parada_pulada...');
    await client.query(fixNotifyParadaPulada);
    console.log('   ✓ Done');

    console.log('4. Fixing notify_incidente_criado...');
    await client.query(fixNotifyIncidenteCriado);
    console.log('   ✓ Done');

    console.log('\n=== All triggers fixed! ===\n');

    // Test the update now
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
  console.error(err.stack);
  process.exit(1);
});
