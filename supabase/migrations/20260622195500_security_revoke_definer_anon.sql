-- Migration: security_revoke_definer_anon
-- Reduz a superficie de funcoes SECURITY DEFINER executaveis por anon
-- (advisor: anon_security_definer_function_executable).
--
-- Auditoria 2026-06-22 (banco vivo): 37 funcoes DEFINER executaveis por anon,
-- classificadas por tipo. Esta migracao trata as de baixo risco / alto valor.
--
-- NAO inclui (decisao consciente):
--  - Helpers de autorizacao usados em policies (get_my_unidade_id/ids,
--    current_user_is_gestor_of_unidade) e os get_user_*/user_* (usam auth.uid(),
--    retornam null para anon -> nao vazam dados). Revogar arriscaria a RLS.
--  - PostGIS st_estimatedextent (funcoes de sistema).
--  - inserir_parada/reordenar_paradas/expire/remind (ja tratadas na Fase 1).

-- ============================================================
-- Bloco 1a: TRIGGERS — grant EXECUTE e vestigial (triggers disparam pelo
-- mecanismo do Postgres, independente de EXECUTE; chamar via RPC nem funciona).
-- ============================================================
REVOKE EXECUTE ON FUNCTION
  public.log_parada_conclusao(),
  public.log_rota_status_change(),
  public.notify_incidente_criado(),
  public.notify_motorista_nova_rota(),
  public.notify_motorista_nova_rota_insert(),
  public.notify_parada_pulada(),
  public.notify_parada_reaberta(),
  public.notify_push_on_insert(),
  public.notify_rota_concluida(),
  public.notify_rota_iniciada(),
  public.notify_sos_acionado(),
  public.prevent_duplicate_log(),
  public.send_push_notification_trigger(),
  public.sync_usuario_unidade_ativa(),
  public.update_usuario_unidades_updated_at(),
  public.validar_vinculo_parada()
FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Bloco 1b: Introspeccao de schema + query-funcs DEFINER sem guard de tenant
-- (nao chamadas pelo app cliente; uso admin via service_role, que mantem EXECUTE).
-- Revogar de todos fecha introspeccao publica + leitura cross-tenant.
-- ============================================================
REVOKE EXECUTE ON FUNCTION
  public.get_all_tables(),
  public.get_table_schema(text),
  public.estatisticas_rota(uuid),
  public.obter_paradas_ordenadas(uuid),
  public.rotas_ativas_motorista(uuid)
FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Bloco 2: Funcoes chamadas pelo app via RPC por usuario LOGADO
-- (criar_notificacao -> routeUtils.ts; get_gestor_contato -> useDrawerContact.ts).
-- Revogar so de PUBLIC/anon; manter authenticated.
-- ============================================================
REVOKE EXECUTE ON FUNCTION
  public.criar_notificacao(uuid, character varying, character varying, text, uuid, uuid, uuid),
  public.get_gestor_contato()
FROM PUBLIC, anon;
