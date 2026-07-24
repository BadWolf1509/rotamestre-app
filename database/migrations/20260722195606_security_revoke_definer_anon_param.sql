-- Migration: security_revoke_definer_anon_param
-- Data: 2026-07-22
-- Fecha info-disclosure em funcoes SECURITY DEFINER parametrizadas.
--
-- Contexto: a migration 20260622195500_security_revoke_definer_anon deixou estas
-- funcoes de fora assumindo que "usam auth.uid(), nao vazam para anon". Auditoria
-- 2026-07-22 leu os corpos no banco vivo: elas usam o user_id RECEBIDO POR PARAMETRO
-- (nao auth.uid()) com SECURITY DEFINER -> qualquer caller com a anon key pode passar
-- um UUID arbitrario e ler papel/unidade daquele usuario, ignorando RLS.
--
-- Seguro (verificado nesta auditoria):
--   - nenhuma policy RLS referencia estas 6 funcoes (checado em pg_policies)
--   - nao sao chamadas via .rpc() no app nem no painel (grep em ambos os repos)
--   - service_role/postgres mantem EXECUTE (uso interno/admin nao afetado)
REVOKE EXECUTE ON FUNCTION
  public.get_user_role(uuid),
  public.get_user_unidade(uuid),
  public.get_user_unidades(uuid),
  public.get_user_papel_in_unidade(uuid, uuid),
  public.user_belongs_to_unidade(uuid, uuid),
  public.user_is_gestor_in_any_unidade(uuid)
FROM PUBLIC, anon, authenticated;
