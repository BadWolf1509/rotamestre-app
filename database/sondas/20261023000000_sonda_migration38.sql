-- ============================================================================
-- Sonda transacional da Migration 38 (rodar DEPOIS de aplicá-la, no SQL Editor)
-- ============================================================================
-- Banco único = produção, sem pgTAP: o bloco faz as tentativas como
-- `authenticated` (com o `sub` de usuários reais), coleta o resultado e termina
-- SEMPRE em RAISE EXCEPTION, que desfaz tudo (inclusive o DELETE do 4e e as
-- notificações que os gatilhos criarem). Leia o resultado na mensagem de erro
-- "SONDA M38 ...". Esperado: todas as linhas com "OK" (SKIP = faltou dado).
--
--   1. gestor NÃO insere em usuarios; 1b: zero policy de INSERT (DROP POLICY)
--   2. foto de perfil: atacante que grava no próprio perfil o path da foto de
--      outra pessoa NÃO a lê (2); controles: o atacante lê a própria (2c) e um
--      gestor da loja do dono lê a foto dele (2d)
--   3. foto de incidente: o mesmo com incidente próprio (3); controle: gestor
--      da loja do dono lê a foto do incidente dele (3c)
--   4. incidentes: rota alheia (4a) e parada de outra rota (4b) recusadas PELO
--      GATILHO (mensagem conferida); controles: rota+parada próprias passam
--      (4c), gestor da loja muda o status (4d), e apagar a rota com incidente
--      ligado não é bloqueado e zera rota_id e parada_id (4e)
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_gestor uuid;          -- um gestor ativo qualquer
  v_mot uuid;             -- motorista com rota
  v_gestor_mot uuid;      -- gestor ativo da loja do v_mot
  v_rota uuid;            -- rota do v_mot
  v_parada uuid;          -- parada da v_rota
  v_rota_alheia uuid;     -- rota de outro motorista
  v_parada_alheia uuid;   -- parada da v_rota_alheia
  v_inc uuid;             -- incidente criado no 4c
  v_vitima uuid;          -- dono de uma foto de perfil
  v_vitima_path text;
  v_atacante uuid;        -- usuário sem loja em comum com a vítima
  v_atacante_path text;   -- foto do próprio atacante (se tiver)
  v_gestor_vitima uuid;   -- gestor ativo da loja da vítima
  v_inc_path text;        -- foto de incidente de outro motorista
  v_inc_dono uuid;
  v_gestor_inc uuid;      -- gestor ativo da loja do dono do incidente
  v_n int;
  v_rota_depois uuid;
  v_parada_depois uuid;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Personagens (como postgres, antes de trocar de papel)
  -- ---------------------------------------------------------------------------
  SELECT uu.usuario_id INTO v_gestor FROM public.usuario_unidades uu
   WHERE uu.papel = 'gestor' AND uu.ativo LIMIT 1;

  SELECT r1.motorista_id, r1.id INTO v_mot, v_rota FROM public.rotas r1
   WHERE r1.motorista_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.paradas p WHERE p.rota_id = r1.id)
   ORDER BY r1.created_at DESC LIMIT 1;
  SELECT p.id INTO v_parada FROM public.paradas p WHERE p.rota_id = v_rota LIMIT 1;
  SELECT g.usuario_id INTO v_gestor_mot
    FROM public.usuario_unidades g JOIN public.usuario_unidades m
      ON m.unidade_id = g.unidade_id AND m.usuario_id = v_mot AND m.ativo
   WHERE g.papel = 'gestor' AND g.ativo LIMIT 1;

  SELECT r2.id INTO v_rota_alheia FROM public.rotas r2
   WHERE r2.motorista_id IS NOT NULL AND r2.motorista_id <> v_mot
     AND EXISTS (SELECT 1 FROM public.paradas p WHERE p.rota_id = r2.id)
   LIMIT 1;
  SELECT p.id INTO v_parada_alheia FROM public.paradas p WHERE p.rota_id = v_rota_alheia LIMIT 1;

  -- Vítima de foto de perfil + atacante sem loja em comum (de preferência um
  -- que também tenha foto, para o controle 2c)
  SELECT vit.id, o.name, x.id INTO v_vitima, v_vitima_path, v_atacante
    FROM public.usuarios vit
    JOIN storage.objects o ON o.bucket_id = 'fotos-entrega'
     AND o.name = regexp_replace(split_part(vit.foto_url, '?', 1), '^.*/fotos-entrega/', '')
    JOIN public.usuarios x ON x.id <> vit.id
   WHERE coalesce(vit.foto_url, '') <> ''
     AND NOT EXISTS (
       SELECT 1 FROM public.usuario_unidades a JOIN public.usuario_unidades b
         ON b.unidade_id = a.unidade_id
        WHERE a.usuario_id = x.id AND b.usuario_id = vit.id)
     AND (o.owner IS DISTINCT FROM x.id AND o.owner_id IS DISTINCT FROM x.id::text)
   ORDER BY (coalesce(x.foto_url, '') <> '') DESC
   LIMIT 1;
  SELECT o.name INTO v_atacante_path
    FROM public.usuarios x JOIN storage.objects o ON o.bucket_id = 'fotos-entrega'
     AND o.name = regexp_replace(split_part(x.foto_url, '?', 1), '^.*/fotos-entrega/', '')
   WHERE x.id = v_atacante AND coalesce(x.foto_url, '') <> '';
  SELECT g.usuario_id INTO v_gestor_vitima
    FROM public.usuario_unidades g JOIN public.usuario_unidades m
      ON m.unidade_id = g.unidade_id AND m.usuario_id = v_vitima AND m.ativo
   WHERE g.papel = 'gestor' AND g.ativo AND g.usuario_id <> v_vitima LIMIT 1;

  -- Foto de incidente de outro motorista (que não o v_mot), sem loja em comum
  SELECT o.name, i.motorista_id INTO v_inc_path, v_inc_dono
    FROM public.incidentes i
    JOIN storage.objects o ON o.bucket_id = 'fotos-entrega'
     AND o.name = regexp_replace(split_part(i.foto_url, '?', 1), '^.*/fotos-entrega/', '')
   WHERE coalesce(i.foto_url, '') <> '' AND i.motorista_id <> v_mot
     AND NOT EXISTS (
       SELECT 1 FROM public.usuario_unidades a JOIN public.usuario_unidades b
         ON b.unidade_id = a.unidade_id
        WHERE a.usuario_id = v_mot AND b.usuario_id = i.motorista_id)
   LIMIT 1;
  SELECT g.usuario_id INTO v_gestor_inc
    FROM public.usuario_unidades g JOIN public.usuario_unidades m
      ON m.unidade_id = g.unidade_id AND m.usuario_id = v_inc_dono AND m.ativo
   WHERE g.papel = 'gestor' AND g.ativo LIMIT 1;

  -- ---------------------------------------------------------------------------
  -- 1. usuarios: sem INSERT do cliente
  -- ---------------------------------------------------------------------------
  IF v_gestor IS NULL THEN
    r := r || ' | 1 SKIP: nenhum gestor ativo';
  ELSE
    BEGIN
      SET LOCAL ROLE authenticated;
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_gestor, 'role', 'authenticated')::text, true);
      INSERT INTO public.usuarios (id, nome, email, papel)
        VALUES (gen_random_uuid(), 'sonda', 'sonda-m38@example.invalid', 'gestor');
      r := r || ' | 1 FALHA: gestor inseriu em usuarios';
    EXCEPTION WHEN insufficient_privilege THEN
      r := r || ' | 1 OK: INSERT em usuarios recusado (' || SQLERRM || ')';
    WHEN OTHERS THEN
      r := r || ' | 1 ERRO: ' || SQLERRM;
    END;
    RESET ROLE;
  END IF;

  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'usuarios' AND cmd = 'INSERT';
  r := r || CASE WHEN v_n = 0
    THEN ' | 1b OK: nenhuma policy de INSERT em usuarios'
    ELSE ' | 1b FALHA: ' || v_n || ' policy(s) de INSERT em usuarios' END;

  -- ---------------------------------------------------------------------------
  -- 2. foto de perfil
  -- ---------------------------------------------------------------------------
  IF v_vitima_path IS NULL THEN
    r := r || ' | 2 SKIP: sem vítima de foto de perfil fora da loja de alguém';
  ELSE
    BEGIN
      SET LOCAL ROLE authenticated;
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_atacante, 'role', 'authenticated')::text, true);

      -- 2c (controle): a própria foto continua legível
      IF v_atacante_path IS NULL THEN
        r := r || ' | 2c SKIP: atacante sem foto própria';
      ELSE
        SELECT count(*) INTO v_n FROM storage.objects
         WHERE bucket_id = 'fotos-entrega' AND name = v_atacante_path;
        r := r || CASE WHEN v_n = 1
          THEN ' | 2c OK: atacante lê a própria foto (1)'
          ELSE ' | 2c FALHA: atacante não lê a própria foto (' || v_n || ')' END;
      END IF;

      -- 2: grava o path alheio no próprio perfil e tenta ler
      UPDATE public.usuarios SET foto_url = v_vitima_path WHERE id = v_atacante;
      SELECT count(*) INTO v_n FROM storage.objects
       WHERE bucket_id = 'fotos-entrega' AND name = v_vitima_path;
      r := r || CASE WHEN v_n = 0
        THEN ' | 2 OK: foto de perfil alheia invisível (0)'
        ELSE ' | 2 FALHA: atacante lê a foto de perfil alheia (' || v_n || ')' END;

      -- 2d (controle): gestor da loja da vítima lê a foto dela
      IF v_gestor_vitima IS NULL THEN
        r := r || ' | 2d SKIP: vítima sem gestor ativo na loja';
      ELSE
        PERFORM set_config('request.jwt.claims',
          json_build_object('sub', v_gestor_vitima, 'role', 'authenticated')::text, true);
        SELECT count(*) INTO v_n FROM storage.objects
         WHERE bucket_id = 'fotos-entrega' AND name = v_vitima_path;
        r := r || CASE WHEN v_n = 1
          THEN ' | 2d OK: gestor da loja lê a foto de perfil (1)'
          ELSE ' | 2d FALHA: gestor da loja não lê a foto de perfil (' || v_n || ')' END;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      r := r || ' | 2 ERRO: ' || SQLERRM;
    END;
    RESET ROLE;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3. foto de incidente
  -- ---------------------------------------------------------------------------
  IF v_inc_path IS NULL OR v_mot IS NULL THEN
    r := r || ' | 3 SKIP: sem foto de incidente de outra empresa';
  ELSE
    BEGIN
      SET LOCAL ROLE authenticated;
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_mot, 'role', 'authenticated')::text, true);
      INSERT INTO public.incidentes (motorista_id, categoria, descricao, endereco, status, foto_url)
        VALUES (v_mot, 'other', 'sonda m38', 'sonda', 'aberto', v_inc_path);
      SELECT count(*) INTO v_n FROM storage.objects
       WHERE bucket_id = 'fotos-entrega' AND name = v_inc_path;
      r := r || CASE WHEN v_n = 0
        THEN ' | 3 OK: foto de incidente alheio invisível (0)'
        ELSE ' | 3 FALHA: motorista lê foto de incidente alheio (' || v_n || ')' END;

      -- 3c (controle): gestor da loja do dono lê a foto do incidente
      IF v_gestor_inc IS NULL THEN
        r := r || ' | 3c SKIP: dono do incidente sem gestor ativo na loja';
      ELSE
        PERFORM set_config('request.jwt.claims',
          json_build_object('sub', v_gestor_inc, 'role', 'authenticated')::text, true);
        SELECT count(*) INTO v_n FROM storage.objects
         WHERE bucket_id = 'fotos-entrega' AND name = v_inc_path;
        r := r || CASE WHEN v_n = 1
          THEN ' | 3c OK: gestor da loja lê a foto do incidente (1)'
          ELSE ' | 3c FALHA: gestor da loja não lê a foto do incidente (' || v_n || ')' END;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      r := r || ' | 3 ERRO: ' || SQLERRM;
    END;
    RESET ROLE;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 4. incidentes: rota/parada
  -- ---------------------------------------------------------------------------
  IF v_mot IS NULL OR v_rota_alheia IS NULL THEN
    r := r || ' | 4 SKIP: faltam rotas de dois motoristas';
  ELSE
    -- 4a. rota de outro motorista: recusada pelo GATILHO
    BEGIN
      SET LOCAL ROLE authenticated;
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_mot, 'role', 'authenticated')::text, true);
      INSERT INTO public.incidentes (motorista_id, rota_id, categoria, descricao, endereco, status)
        VALUES (v_mot, v_rota_alheia, 'other', 'sonda m38', 'sonda', 'aberto');
      r := r || ' | 4a FALHA: incidente com rota alheia aceito';
    EXCEPTION WHEN OTHERS THEN
      r := r || CASE WHEN SQLERRM LIKE '%não é deste motorista%'
        THEN ' | 4a OK: rota alheia recusada pelo gatilho (' || SQLERRM || ')'
        ELSE ' | 4a FALHA: recusada por outro motivo (' || SQLERRM || ')' END;
    END;
    RESET ROLE;

    -- 4b. rota própria com parada de outra rota: recusada pelo GATILHO
    BEGIN
      SET LOCAL ROLE authenticated;
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_mot, 'role', 'authenticated')::text, true);
      INSERT INTO public.incidentes (motorista_id, rota_id, parada_id, categoria, descricao, endereco, status)
        VALUES (v_mot, v_rota, v_parada_alheia, 'other', 'sonda m38', 'sonda', 'aberto');
      r := r || ' | 4b FALHA: parada de outra rota aceita';
    EXCEPTION WHEN OTHERS THEN
      r := r || CASE WHEN SQLERRM LIKE '%não pertence à rota%'
        THEN ' | 4b OK: parada de outra rota recusada pelo gatilho (' || SQLERRM || ')'
        ELSE ' | 4b FALHA: recusada por outro motivo (' || SQLERRM || ')' END;
    END;
    RESET ROLE;

    -- 4c. controle: rota e parada próprias passam
    BEGIN
      SET LOCAL ROLE authenticated;
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_mot, 'role', 'authenticated')::text, true);
      INSERT INTO public.incidentes (motorista_id, rota_id, parada_id, categoria, descricao, endereco, status)
        VALUES (v_mot, v_rota, v_parada, 'other', 'sonda m38', 'sonda', 'aberto')
        RETURNING id INTO v_inc;
      r := r || ' | 4c OK: incidente com rota e parada próprias aceito';
    EXCEPTION WHEN OTHERS THEN
      r := r || ' | 4c FALHA: incidente legítimo recusado (' || SQLERRM || ')';
    END;
    RESET ROLE;

    -- 4d. controle: gestor da loja muda o status (não bloqueado)
    IF v_inc IS NULL OR v_gestor_mot IS NULL THEN
      r := r || ' | 4d SKIP: sem incidente do 4c ou sem gestor da loja do motorista';
    ELSE
      BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claims',
          json_build_object('sub', v_gestor_mot, 'role', 'authenticated')::text, true);
        UPDATE public.incidentes SET status = 'em_analise' WHERE id = v_inc;
        GET DIAGNOSTICS v_n = ROW_COUNT;
        r := r || CASE WHEN v_n = 1
          THEN ' | 4d OK: gestor atualizou o status (1)'
          ELSE ' | 4d FALHA: UPDATE do gestor alcançou ' || v_n || ' linha(s)' END;
      EXCEPTION WHEN OTHERS THEN
        r := r || ' | 4d FALHA: UPDATE do gestor recusado (' || SQLERRM || ')';
      END;
      RESET ROLE;
    END IF;

    -- 4e. controle: apagar a rota com incidente ligado (rota_id + parada_id)
    --     não é bloqueado, e o incidente fica com os dois NULL (ON DELETE SET
    --     NULL das FKs + cascata das paradas). Como postgres: o que se prova é
    --     o gatilho, não a RLS de rotas.
    IF v_inc IS NULL THEN
      r := r || ' | 4e SKIP: sem incidente do 4c';
    ELSE
      BEGIN
        DELETE FROM public.rotas WHERE id = v_rota;
        SELECT i.rota_id, i.parada_id INTO v_rota_depois, v_parada_depois
          FROM public.incidentes i WHERE i.id = v_inc;
        r := r || CASE WHEN v_rota_depois IS NULL AND v_parada_depois IS NULL
          THEN ' | 4e OK: rota apagada, incidente com rota_id e parada_id NULL'
          ELSE ' | 4e FALHA: incidente ficou com rota ' || coalesce(v_rota_depois::text, 'NULL')
               || ' / parada ' || coalesce(v_parada_depois::text, 'NULL') END;
      EXCEPTION WHEN OTHERS THEN
        r := r || ' | 4e FALHA: DELETE da rota bloqueado (' || SQLERRM || ')';
      END;
    END IF;
  END IF;

  RAISE EXCEPTION 'SONDA M38 (desfeita):%', r;
END
$$;
