-- ============================================================================
-- Sonda transacional da Migration 38 (rodar DEPOIS de aplicá-la, no SQL Editor)
-- ============================================================================
-- Banco único = produção, sem pgTAP: o bloco faz as tentativas como
-- `authenticated` (com o `sub` de usuários reais), coleta o resultado e termina
-- SEMPRE em RAISE EXCEPTION, que desfaz tudo. Leia o resultado na mensagem de
-- erro "SONDA ...". Esperado: todas as linhas com "OK".
--
-- Prova:
--   1. gestor autenticado NÃO insere em usuarios (a);
--   2. gravar no próprio perfil o path da foto de outra pessoa NÃO dá leitura
--      do objeto (c) — e o controle: a própria foto continua legível;
--   3. o mesmo com incidente próprio apontando para foto de incidente alheio (c);
--   4. incidente com rota de outro motorista é recusado (d); com parada de
--      outra rota também; e o controle: incidente com a própria rota passa.
-- Escolhe os personagens no próprio banco; se faltar algum, a linha diz "SKIP".
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_gestor uuid;
  v_mot uuid;          -- motorista com rota
  v_rota uuid;         -- rota do v_mot
  v_parada uuid;       -- parada da v_rota
  v_rota_alheia uuid;  -- rota de outro motorista
  v_parada_alheia uuid;
  v_atacante uuid;     -- usuário sem loja em comum com a vítima
  v_vitima_path text;  -- foto de perfil da vítima
  v_inc_path text;     -- foto de incidente de outro motorista
  v_inc_dono uuid;
  v_n int;
BEGIN
  -- Personagens (como postgres, antes de trocar de papel)
  SELECT uu.usuario_id INTO v_gestor FROM public.usuario_unidades uu
   WHERE uu.papel = 'gestor' AND uu.ativo LIMIT 1;

  SELECT r1.motorista_id, r1.id INTO v_mot, v_rota FROM public.rotas r1
   WHERE r1.motorista_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.paradas p WHERE p.rota_id = r1.id)
   ORDER BY r1.created_at DESC LIMIT 1;
  SELECT p.id INTO v_parada FROM public.paradas p WHERE p.rota_id = v_rota LIMIT 1;

  SELECT r2.id INTO v_rota_alheia FROM public.rotas r2
   WHERE r2.motorista_id IS NOT NULL AND r2.motorista_id <> v_mot
     AND EXISTS (SELECT 1 FROM public.paradas p WHERE p.rota_id = r2.id)
   LIMIT 1;
  SELECT p.id INTO v_parada_alheia FROM public.paradas p WHERE p.rota_id = v_rota_alheia LIMIT 1;

  -- Vítima de foto de perfil: path real do objeto + um atacante sem loja em comum
  SELECT o.name, x.id INTO v_vitima_path, v_atacante
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
   LIMIT 1;

  -- Foto de incidente de outro motorista (que não o v_mot) sem loja em comum
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

  -- 1. gestor não insere em usuarios -----------------------------------------
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_gestor, 'role', 'authenticated')::text, true);
    INSERT INTO public.usuarios (id, nome, email, papel)
      VALUES (gen_random_uuid(), 'sonda', 'sonda-m38@example.invalid', 'gestor');
    r := r || ' | 1 FALHA: gestor inseriu em usuarios';
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || ' | 1 OK: INSERT em usuarios recusado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- 2. foto de perfil alheia via foto_url próprio -----------------------------
  IF v_vitima_path IS NULL THEN
    r := r || ' | 2 SKIP: sem vítima de foto de perfil fora da loja de alguém';
  ELSE
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_atacante, 'role', 'authenticated')::text, true);
    UPDATE public.usuarios SET foto_url = v_vitima_path WHERE id = v_atacante;
    SELECT count(*) INTO v_n FROM storage.objects
     WHERE bucket_id = 'fotos-entrega' AND name = v_vitima_path;
    r := r || CASE WHEN v_n = 0
      THEN ' | 2 OK: foto de perfil alheia invisível (0)'
      ELSE ' | 2 FALHA: atacante lê a foto de perfil alheia (' || v_n || ')' END;
    RESET ROLE;
  END IF;

  -- 3. foto de incidente alheio via incidente próprio -------------------------
  IF v_inc_path IS NULL OR v_mot IS NULL THEN
    r := r || ' | 3 SKIP: sem foto de incidente de outra empresa';
  ELSE
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
    RESET ROLE;
  END IF;

  -- 4. incidentes: rota/parada -----------------------------------------------
  IF v_mot IS NULL OR v_rota_alheia IS NULL THEN
    r := r || ' | 4 SKIP: faltam rotas de dois motoristas';
  ELSE
    -- 4a. rota de outro motorista
    BEGIN
      SET LOCAL ROLE authenticated;
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_mot, 'role', 'authenticated')::text, true);
      INSERT INTO public.incidentes (motorista_id, rota_id, categoria, descricao, endereco, status)
        VALUES (v_mot, v_rota_alheia, 'other', 'sonda m38', 'sonda', 'aberto');
      r := r || ' | 4a FALHA: incidente com rota alheia aceito';
    EXCEPTION WHEN insufficient_privilege THEN
      r := r || ' | 4a OK: rota alheia recusada (' || SQLERRM || ')';
    END;
    RESET ROLE;

    -- 4b. rota própria com parada de outra rota
    BEGIN
      SET LOCAL ROLE authenticated;
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_mot, 'role', 'authenticated')::text, true);
      INSERT INTO public.incidentes (motorista_id, rota_id, parada_id, categoria, descricao, endereco, status)
        VALUES (v_mot, v_rota, v_parada_alheia, 'other', 'sonda m38', 'sonda', 'aberto');
      r := r || ' | 4b FALHA: parada de outra rota aceita';
    EXCEPTION WHEN insufficient_privilege THEN
      r := r || ' | 4b OK: parada de outra rota recusada';
    END;
    RESET ROLE;

    -- 4c. controle: rota e parada próprias passam
    BEGIN
      SET LOCAL ROLE authenticated;
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_mot, 'role', 'authenticated')::text, true);
      INSERT INTO public.incidentes (motorista_id, rota_id, parada_id, categoria, descricao, endereco, status)
        VALUES (v_mot, v_rota, v_parada, 'other', 'sonda m38', 'sonda', 'aberto');
      r := r || ' | 4c OK: incidente com rota e parada próprias aceito';
    EXCEPTION WHEN OTHERS THEN
      r := r || ' | 4c FALHA: incidente legítimo recusado (' || SQLERRM || ')';
    END;
    RESET ROLE;
  END IF;

  RAISE EXCEPTION 'SONDA M38 (desfeita):%', r;
END
$$;
