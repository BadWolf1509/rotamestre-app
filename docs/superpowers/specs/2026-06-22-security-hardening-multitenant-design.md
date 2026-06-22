# Design — Hardening RLS/RPC multi-tenant (Fase 1)

**Data:** 2026-06-22
**Autor:** investigação de segurança (gestor: Wellinton)
**Status:** aprovado para implementação
**Escopo:** correções de segurança multi-tenant que são 100% SQL (uma migração). O bucket privado (C3) é follow-up em ciclo separado.

---

## 1. Contexto e motivação

O app é multi-tenant: tabelas têm `unidade_id`; usuários pertencem a unidades via `usuario_unidades` (com `papel` e `ativo`); RLS escopa leituras/escritas. Uma investigação encontrou um cluster de furos onde o escopo de tenant **não** é aplicado:

- Duas RPCs `SECURITY DEFINER` (bypassam RLS) sem nenhuma checagem de tenant.
- Funções de manutenção platform-wide executáveis por qualquer usuário autenticado.
- Uma policy de SELECT que vaza dados entre unidades.

O alvo desta fase é fechar o que é **explorável** por um usuário autenticado comum, mais hardening trivial de baixo risco — tudo via uma única migração SQL revisável.

### Modelo de autorização do projeto (fonte da verdade para as correções)

- Tabela `public.usuario_unidades(usuario_id, unidade_id, papel, ativo, ...)`.
- Helpers existentes: `user_belongs_to_unidade(uid, unidade)`, `get_user_papel_in_unidade(uid, unidade)`, `get_my_unidade_ids()` (todos `SECURITY DEFINER STABLE`).
- **Template canônico** para autorizar operações em `paradas` (de `database/migrations/20251204000001_update_rls_multi_unidade.sql`):
  - `paradas_insert` → "é **gestor** ativo da unidade da rota".
  - `paradas_update` → "é **motorista dono** da rota **ou** gestor ativo da unidade".

As correções de RPC abaixo espelham exatamente essas regras.

---

## 2. Escopo

### Em escopo (esta migração)

| ID     | Objeto                                                                                                        | Tipo            | Por quê                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------- |
| **C1** | `inserir_parada(...)`                                                                                         | Furo explorável | DEFINER sem `search_path` e sem checagem de tenant → escrita cross-tenant              |
| **C2** | `reordenar_paradas(UUID[], INTEGER[])`                                                                        | Furo explorável | idem                                                                                   |
| **C4** | `expire_old_pending_routes()`, `remind_pending_routes(TEXT)`                                                  | Furo explorável | `EXECUTE` concedido a `authenticated` → qualquer logado afeta todos os tenants         |
| **A1** | `push_notification_logs` (policy SELECT)                                                                      | Furo explorável | SELECT só por `papel='gestor'`, sem unidade → vaza `push_token` entre unidades         |
| **A3** | 4 views (`vw_rotas_resumo`, `vw_performance_motoristas`, `vw_paradas_com_vinculo`, `admin_dashboard_metrics`) | Hardening       | `GRANT ... TO anon`; tabelas-base já têm RLS, mas é superfície desnecessária           |
| **A4** | `notificacoes` (GRANT INSERT)                                                                                 | Hardening       | GRANT INSERT morto a `authenticated` (RLS já bloqueia por default-deny); remover ruído |

### Fora de escopo (decisão consciente)

- **A2 — `usuarios` INSERT policy.** É **design intencional**, não furo cross-tenant: a tenancy real vive em `usuario_unidades` (com RLS própria). O `unidade_id` em `usuarios` é legado/cache. Forçar validação de `unidade_id` no INSERT **quebraria o self-signup** (`src/lib/auth.ts` insere sem `unidade_id`) e a criação de motorista roda via Edge Function com service_role (ignora RLS). Impacto do "furo": poluição de tabela, não vazamento. **Não mexer.**
- **C3 — bucket `fotos-entrega` privado.** ~14-20h: 9 pontos de exibição, URLs completas com `/public/` persistidas em `paradas.foto_url`, `usuarios.foto_url`, `incidentes.foto_url` e `logs.detalhes`; exige migração de dados + signed URLs. Risco real menor (paths com UUIDs aleatórios não-enumeráveis). Vai para ciclo próprio.

---

## 3. Detalhes técnicos

### C1 — `inserir_parada`

Re-declarar com (a) `SET search_path = ''` + corpo schema-qualified, (b) **guard** espelhando `paradas_insert`. Variáveis mortas do original (`v_paradas_reais`, `v_parada`) removidas. Comportamento de negócio inalterado.

```sql
CREATE OR REPLACE FUNCTION public.inserir_parada(
  p_rota_id UUID,
  p_tipo TEXT,
  p_endereco TEXT,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_posicao_insercao INTEGER DEFAULT NULL,
  p_destinatario TEXT DEFAULT NULL,
  p_telefone TEXT DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chegada RECORD;
  v_new_ordem INTEGER;
  v_parada_count INTEGER;
  v_new_parada_id UUID;
BEGIN
  -- Authorization guard (mirrors paradas_insert): caller must be active gestor of the rota's unidade
  IF NOT EXISTS (
    SELECT 1
    FROM public.rotas r
    JOIN public.usuario_unidades uu ON uu.unidade_id = r.unidade_id
    WHERE r.id = p_rota_id
      AND uu.usuario_id = auth.uid()
      AND uu.papel = 'gestor'
      AND uu.ativo = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autorizado: gestor da unidade da rota requerido.');
  END IF;

  SELECT COUNT(*) INTO v_parada_count
  FROM public.paradas
  WHERE rota_id = p_rota_id AND is_checkpoint IS DISTINCT FROM false;

  SELECT id, ordem INTO v_chegada
  FROM public.paradas
  WHERE rota_id = p_rota_id AND is_checkpoint = false AND ordem > 0
  LIMIT 1;

  IF p_posicao_insercao IS NULL THEN
    v_new_ordem := v_parada_count + 1;
  ELSE
    v_new_ordem := p_posicao_insercao;
    UPDATE public.paradas
    SET ordem = ordem + 1000
    WHERE rota_id = p_rota_id
      AND is_checkpoint IS DISTINCT FROM false
      AND ordem >= p_posicao_insercao;
    UPDATE public.paradas
    SET ordem = ordem - 1000 + 1
    WHERE rota_id = p_rota_id
      AND is_checkpoint IS DISTINCT FROM false
      AND ordem >= 1000;
  END IF;

  IF v_chegada.id IS NOT NULL AND v_chegada.ordem <= v_new_ordem THEN
    UPDATE public.paradas
    SET ordem = GREATEST(v_chegada.ordem + 1, v_new_ordem + 1)
    WHERE id = v_chegada.id;
  END IF;

  INSERT INTO public.paradas (
    rota_id, tipo, endereco, latitude, longitude, ordem,
    destinatario, telefone, observacoes, status, is_checkpoint
  ) VALUES (
    p_rota_id, p_tipo, p_endereco, p_latitude, p_longitude, v_new_ordem,
    p_destinatario, p_telefone, p_observacoes, 'pendente', true
  )
  RETURNING id INTO v_new_parada_id;

  WITH ordered_paradas AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY ordem) AS new_ordem
    FROM public.paradas
    WHERE rota_id = p_rota_id AND is_checkpoint IS DISTINCT FROM false
  )
  UPDATE public.paradas p
  SET ordem = op.new_ordem
  FROM ordered_paradas op
  WHERE p.id = op.id AND p.ordem != op.new_ordem;

  IF v_chegada.id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_parada_count
    FROM public.paradas
    WHERE rota_id = p_rota_id AND is_checkpoint IS DISTINCT FROM false;
    UPDATE public.paradas
    SET ordem = v_parada_count + 1
    WHERE id = v_chegada.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'parada_id', v_new_parada_id, 'ordem', v_new_ordem);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
```

### C2 — `reordenar_paradas`

Guard espelha `paradas_update` (motorista dono **ou** gestor da unidade). O guard vem **após** obter `v_rota_id` da primeira parada; os UPDATEs já são escopados por `rota_id = v_rota_id`, então paradas de outras rotas nunca são afetadas.

```sql
CREATE OR REPLACE FUNCTION public.reordenar_paradas(
  p_parada_ids UUID[],
  p_novas_ordens INTEGER[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
  v_rota_id UUID;
  v_i INTEGER;
BEGIN
  IF array_length(p_parada_ids, 1) != array_length(p_novas_ordens, 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Arrays must have same length');
  END IF;

  v_count := array_length(p_parada_ids, 1);
  IF v_count IS NULL OR v_count = 0 THEN
    RETURN jsonb_build_object('success', true, 'updated', 0);
  END IF;

  SELECT rota_id INTO v_rota_id FROM public.paradas WHERE id = p_parada_ids[1];
  IF v_rota_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parada not found');
  END IF;

  -- Authorization guard (mirrors paradas_update): caller owns the rota OR is gestor of its unidade
  IF NOT EXISTS (
    SELECT 1
    FROM public.rotas r
    WHERE r.id = v_rota_id
      AND (
        r.motorista_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.usuario_unidades uu
          WHERE uu.usuario_id = auth.uid()
            AND uu.papel = 'gestor'
            AND uu.unidade_id = r.unidade_id
            AND uu.ativo = true
        )
      )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autorizado.');
  END IF;

  FOR v_i IN 1..v_count LOOP
    UPDATE public.paradas SET ordem = 1000 + v_i
    WHERE id = p_parada_ids[v_i] AND rota_id = v_rota_id;
  END LOOP;

  FOR v_i IN 1..v_count LOOP
    UPDATE public.paradas SET ordem = p_novas_ordens[v_i]
    WHERE id = p_parada_ids[v_i] AND rota_id = v_rota_id;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'updated', v_count);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
```

### C4 — revogar funções platform-wide de `authenticated`

O cron legítimo roda via Edge Functions (`supabase/functions/expire-routes`, `remind-routes`) com **service_role**, que mantém `EXECUTE`. Nenhum código cliente chama essas funções.

```sql
REVOKE EXECUTE ON FUNCTION public.expire_old_pending_routes()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remind_pending_routes(TEXT)      FROM PUBLIC, anon, authenticated;
```

> Nota: o `SET search_path = public` dessas duas funções **não** é alterado aqui. Endurecer para `''` exigiria reescrever o corpo (que usa nomes não-qualificados); `public` em Supabase é aceitável e fica fora desta fase para não introduzir risco. Registrado como hardening menor futuro.

### A1 — escopar SELECT de `push_notification_logs` por unidade

Espelha o padrão de `logs_select` (gestor vê registros de usuários que compartilham unidade). App não lê esta tabela; escritas vêm de service_role/triggers DEFINER → sem regressão.

```sql
DROP POLICY IF EXISTS "push_notification_logs_select_optimized" ON public.push_notification_logs;
CREATE POLICY "push_notification_logs_select_scoped" ON public.push_notification_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.usuario_unidades my_uu
    JOIN public.usuario_unidades target_uu ON target_uu.unidade_id = my_uu.unidade_id
    WHERE my_uu.usuario_id = (SELECT auth.uid())
      AND my_uu.papel = 'gestor'
      AND my_uu.ativo = true
      AND target_uu.usuario_id = push_notification_logs.usuario_id
      AND target_uu.ativo = true
  )
);
```

### A3 — revogar views de `anon` + corrigir views `SECURITY DEFINER`

A validação no vivo refinou este item: as 4 views têm grant **ALL** para `anon` (não só SELECT); **`vw_performance_motoristas` e `admin_dashboard_metrics` são `SECURITY DEFINER`** (owner `postgres` → bypassam a RLS do chamador), enquanto `vw_rotas_resumo` e `vw_paradas_com_vinculo` já têm `security_invoker=true`. `admin_dashboard_metrics` (métricas globais da plataforma) não é consumida pelo app.

```sql
-- Revogar grants de anon nas 4 views
REVOKE ALL ON public.vw_rotas_resumo, public.vw_performance_motoristas,
              public.vw_paradas_com_vinculo, public.admin_dashboard_metrics FROM anon;

-- Fazer as 2 views DEFINER respeitarem a RLS do chamador (corrige bypass de RLS)
ALTER VIEW public.vw_performance_motoristas SET (security_invoker = true);
ALTER VIEW public.admin_dashboard_metrics  SET (security_invoker = true);

-- admin_dashboard_metrics é admin-only e não é usada pelo app → tirar também de authenticated
REVOKE ALL ON public.admin_dashboard_metrics FROM authenticated;
```

Risco: com `security_invoker`, `vw_performance_motoristas` passa a respeitar a RLS de `usuarios`/`rotas` — gestor vê só motoristas das suas unidades (era o vazamento). Validar `app/gestor/motorista-perfil.tsx` pós-apply.

### A4 — remover GRANT INSERT morto em `notificacoes`

A tabela tem RLS sem policy de INSERT → inserts diretos já são bloqueados (default-deny). O app cria notificações só via RPC `criar_notificacao` (DEFINER). `SELECT`/`UPDATE` (dono marca como lida) preservados.

```sql
REVOKE INSERT ON public.notificacoes FROM authenticated, anon;
```

---

## 4. Integração com o app

**Verificado: nenhuma mudança de app necessária.** Os dois call sites das RPCs já inspecionam o campo `success` do JSON retornado:

- `src/lib/routeUtils.ts:158` — `if (data && !data.success) { return { success:false, error:data.error } }`.
- `src/components/gestor/mapa-rota/useAddStopForm.ts:192` — `if (!rpcResult?.success) { throw new Error(rpcResult?.error) }`.

Logo, uma negação de autorização (`{success:false, error:'Não autorizado'}`) é exibida como falha graciosa. O fallback `reordenarParadasFallback` só dispara em erro `42883` (função inexistente) e, por usar UPDATE direto, respeita a RLS de `paradas` — consistente com o novo guard.

---

## 5. Entrega

- **Uma migração consolidada**, criada via skill `/new-migration` (cuida do **dual-dir** `database/migrations/` + `supabase/migrations/`): `YYYYMMDDhhmmss_security_hardening_multitenant.sql`, com seções comentadas (C1, C2, C4, A1, A3, A4).
- Efeito colateral positivo: as RPCs C1/C2, hoje só em `supabase/migrations/`, passam a existir no dir canônico (`CREATE OR REPLACE`), reduzindo o drift.
- **Script de verificação** anexo (somente leitura) para rodar pós-apply.

---

## 6. Verificação

1. **`rls-policy-reviewer`** revisa o SQL **antes** de aplicar (gate obrigatório).
2. **Limitação:** esta sessão não tem acesso ao banco vivo (MCP Supabase exige OAuth interativo). Após a revisão, aplicação por um de dois caminhos, a combinar:
   - (a) o gestor aplica (`supabase db push` ou dashboard) e roda o script de verificação; ou
   - (b) o gestor autentica o MCP Supabase e o assistente aplica + valida.
3. **Script de verificação** (estado esperado pós-migração):

```sql
-- C1/C2: funções com search_path fixado e SECURITY DEFINER
SELECT proname, prosecdef, proconfig
FROM pg_proc WHERE proname IN ('inserir_parada','reordenar_paradas');

-- C4 + A4: grants revogados (não deve listar authenticated/anon)
SELECT grantee, privilege_type FROM information_schema.routine_privileges
WHERE routine_name IN ('expire_old_pending_routes','remind_pending_routes');
SELECT grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_name='notificacoes' AND privilege_type='INSERT';

-- A3: views sem grant para anon
SELECT table_name, grantee FROM information_schema.role_table_grants
WHERE table_name IN ('vw_rotas_resumo','vw_performance_motoristas','vw_paradas_com_vinculo','admin_dashboard_metrics')
  AND grantee='anon';

-- A1: nova policy escopada presente
SELECT policyname, cmd FROM pg_policies WHERE tablename='push_notification_logs';
```

4. **Validação funcional pós-apply** (com 2 unidades/usuários de teste): confirmar que (i) gestor da unidade A NÃO consegue `inserir_parada`/`reordenar_paradas` em rota da unidade B; (ii) o fluxo normal de gestor/motorista da própria unidade continua funcionando; (iii) o cron `expire/remind` (service_role) segue operando.

---

## 7. Riscos e mitigações

| Risco                                                       | Mitigação                                                                                                            |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `search_path=''` quebra resolução de nome no corpo das RPCs | Corpo inteiramente schema-qualified (`public.`, `auth.uid()`); revisado pelo rls-policy-reviewer                     |
| Guard bloqueia fluxo legítimo                               | Guards espelham 1:1 as policies `paradas_insert`/`paradas_update` já em produção; validação funcional com 2 unidades |
| REVOKE quebra o cron                                        | Confirmado: cron usa service_role (mantém EXECUTE); só `authenticated/anon` são revogados                            |
| Migração aplicada a um dir e não ao outro (drift)           | `/new-migration` grava nos dois dirs; verificação confirma estado no banco                                           |
| Sem acesso ao banco nesta sessão                            | rls-policy-reviewer (estático) + script de verificação + validação do gestor pós-apply                               |

---

## 8. Validação no banco vivo (2026-06-22) e follow-ups

**Confirmado em produção** (`xezslsyxjivunmhhyxtd`, via SELECTs read-only + security advisor):

- **C1/C2**: `inserir_parada`/`reordenar_paradas` são DEFINER, **sem `search_path`** (`proconfig=null`), **zero** referência a `usuario_unidades`/`auth.uid` (sem autorização). Grant `EXECUTE` para **PUBLIC + anon + authenticated** (mais amplo que o previsto) → além do guard, `REVOKE EXECUTE FROM PUBLIC, anon` (manter `authenticated`).
- **C4**: `expire`/`remind` DEFINER `search_path=public`, grant para **PUBLIC + anon + authenticated** (ver REVOKE atualizado).
- **A1**: `push_notification_logs` SELECT = `papel='gestor'` sem unidade. Confirmado.
- **A3**: 4 views com grant ALL para `anon`; 2 são SECURITY DEFINER (ver seção atualizada).
- **A4**: `notificacoes` só tem policy SELECT/UPDATE (INSERT default-deny) → grant INSERT é morto. Confirmado **não-furo**.
- RLS habilitado nas 7 tabelas-chave. Bucket `fotos-entrega` = **público e permite listing**.

**Follow-ups (não nesta fase):**

- **C3** — bucket privado + signed URLs + migração de URLs. **Agravado**: o advisor `public_bucket_allows_listing` confirma que dá pra **enumerar** os arquivos. Ciclo próprio.
- **Sistêmico**: o advisor aponta **41 funções `SECURITY DEFINER` executáveis por `anon`** — vale uma varredura ampla de `REVOKE EXECUTE FROM PUBLIC, anon` nas que não precisam (além das 4 desta fase).
- `auth_leaked_password_protection` desabilitado → ligar no dashboard (Supabase Auth).
- Hardening `search_path=''` nas funções `expire/remind` (requer qualificar o corpo).
- `extension_in_public` (3); `spatial_ref_sys` sem RLS (PostGIS — aceitável).
- Reconciliação do drift `database/` vs `supabase/migrations/` (`migration-drift-auditor`).
- A2 opcional (travar `papel`/`id=auth.uid()` no self-signup) — baixa prioridade.
