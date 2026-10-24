# 🗄️ Database Migrations - Rota Mestre

> Histórico consolidado de todas as migrations SQL do projeto

---

## 📋 Processo atual

1. Antes de criar SQL, confira o projeto vinculado e o histórico remoto:

   ```bash
   npx supabase migration list
   ```

2. Crie a migration com timestamp `YYYYMMDDhhmmss` em
   `database/migrations/`.
3. Para alterações novas de schema, mantenha uma cópia byte-idêntica em
   `supabase/migrations/`.
4. Revise RLS, `SECURITY DEFINER`, grants, `search_path`, índices de FKs,
   idempotência e rollback.
5. Aplique pelo fluxo versionado do Supabase e valide o efeito no banco vivo.
6. Acrescente os campos novos ao tipo curado à mão correspondente em
   `src/types/` (ex.: `rota.ts`). **Não existe `src/types/database.ts`** — este
   projeto não usa tipos gerados do Supabase.
7. Atualize este histórico e o estado em `docs/PROJECT_CONTEXT.md`.

Não cole novamente no Dashboard uma migration que já aparece no remoto.
Migrations antigas aplicadas manualmente não devem ser marcadas como pendentes
apenas por não aparecerem em `supabase_migrations.schema_migrations`.

---

> ⚠️ **Legado dual-path:** a maior parte do histórico foi aplicada pelo
> Dashboard, scripts locais ou MCP e não está integralmente registrada na tabela
> de migrations do CLI. `database/migrations/` é o histórico canônico;
> `supabase/migrations/` é o conjunto operacional do Supabase CLI. Novas
> migrations devem existir nos dois diretórios. Exceções retroativas precisam
> declarar que já foram aplicadas para evitar dupla execução.

### Auditoria de drift em 05/08/2026

Auditoria completa (arquivos × `supabase_migrations.schema_migrations` × schema
vivo) com um resultado tranquilizador: **nenhuma migration documentada como
aplicada está faltando no banco.** Todo efeito verificado (colunas, funções,
policies, buckets) existe em produção. **O drift é de contabilidade, não de
schema.**

**O mecanismo** — importa mais que a lista, porque explica todos os casos:

| Como foi aplicada     | Efeito em `schema_migrations`                                             |
| --------------------- | ------------------------------------------------------------------------- |
| MCP `apply_migration` | cria versão própria = timestamp da chamada → **versão ≠ nome do arquivo** |
| MCP `execute_sql`     | **nenhuma linha** registrada                                              |
| `db push` / CLI       | versão = timestamp do arquivo ✅                                          |

**Pares confirmados por comparação de conteúdo** (não por nome): a versão remota
`20260703042401` é o arquivo `20260703120000_c3_fase2_storage_rls_por_unidade`,
e `20260805032012` é o arquivo `20260804235500_auditoria_otimizacao_rotas`. Nos
dois casos o SQL armazenado bate com o arquivo e com o schema vivo. **Não
reaplique nenhum dos dois** — eles não estão pendentes, só estão registrados sob
outro timestamp.

**Os dois timestamps remotos sem arquivo aqui** — `20260723065918`
(`plan_prices_and_mrr_history`) e `20260723135901` (`analytics_rpcs`) — criam
tabela de preços e RPCs de analytics, **todas com `REVOKE` de `anon`/
`authenticated` e `GRANT` apenas para `service_role`**. Pelo `CLAUDE.md`, isso é
o **projeto do painel admin**, que compartilha este Postgres. Não há arquivo a
recuperar; não trate como mistério nem como schema faltando.

### ⚠️ `supabase db push` não é seguro aqui sem reparo prévio

Sem reparar o histórico, o push tenta rodar 4 arquivos que já estão aplicados.
O primeiro deles (`20260207000000_add_motivo_skip`) **abortava o push inteiro**
por não ter `IF NOT EXISTS` — corrigido em 05/08/2026, mas o reparo do histórico
continua pendente.

Caminho seguro, **somente metadado, sem DDL**:

```bash
npx supabase migration repair --status applied 20260207000000
npx supabase migration repair --status applied 20260624033812
npx supabase migration repair --status applied 20260703120000
npx supabase migration repair --status applied 20260804235500
```

Rode `npx supabase migration list` antes e depois para conferir. Enquanto o
reparo não for feito, **prefira aplicar migrations pelo MCP `apply_migration`**
(ciente de que ele registra sob timestamp próprio) em vez de `db push`.

---

## 📊 Migrations Aplicadas

### ✅ Migration 1: Coluna `foto_url` em `paradas`

**Data:** 25/10/2025
**Objetivo:** Adicionar suporte para upload de fotos de comprovante de entrega

**SQL:**

```sql
-- Adicionar coluna foto_url para armazenar URL da foto
ALTER TABLE paradas
ADD COLUMN IF NOT EXISTS foto_url TEXT;

COMMENT ON COLUMN paradas.foto_url IS 'URL da foto de comprovante de entrega (Supabase Storage)';
```

**Status:** ✅ Aplicado em produção

---

### ✅ Migration 2: Correção de Security Warnings (Funções)

**Data:** 22/10/2025
**Objetivo:** Corrigir avisos `function_search_path_mutable` do Supabase Database Linter

**Funções corrigidas:**

- `get_user_unidade()`
- `get_user_role()`
- `log_parada_conclusao()`
- `rotas_ativas_motorista()`
- `update_updated_at_column()`
- `estatisticas_rota()`
- `log_rota_status_change()`
- `calcular_distancia()`

**SQL:**

```sql
-- Exemplo de correção (get_user_unidade)
CREATE OR REPLACE FUNCTION get_user_unidade()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- ← FIX: Define search_path explicitamente
AS $$
BEGIN
  RETURN (
    SELECT unidade_id
    FROM profiles
    WHERE id = auth.uid()
  );
END;
$$;
```

**Status:** ✅ Aplicado em produção

---

### ✅ Migration 3: Views com SECURITY DEFINER

**Data:** 22/10/2025
**Objetivo:** Corrigir views `vw_rotas_resumo` e `vw_performance_motoristas`

**Problema:** Views com `SECURITY DEFINER` executam com permissões do criador, não do usuário

**Solução:** Remover `SECURITY DEFINER` e confiar no RLS das tabelas base

**SQL:**

```sql
-- Recriar view sem SECURITY DEFINER
CREATE OR REPLACE VIEW vw_rotas_resumo AS
SELECT
  r.id,
  r.data,
  r.status,
  r.motorista_id,
  m.nome as motorista_nome,
  r.distancia_total,
  COUNT(p.id) as total_paradas,
  COUNT(CASE WHEN p.status = 'concluida' THEN 1 END) as paradas_concluidas
FROM rotas r
LEFT JOIN profiles m ON m.id = r.motorista_id
LEFT JOIN paradas p ON p.rota_id = r.id
GROUP BY r.id, r.data, r.status, r.motorista_id, m.nome, r.distancia_total;
```

**Status:** ✅ Aplicado em produção

---

### ✅ Migration 4: Otimização RLS (InitPlan)

**Data:** 22/10/2025, consolidada em 20/12/2025
**Objetivo:** Resolver avisos `auth_rls_initplan` - melhorar performance

**Problema:** `auth.uid()` está sendo chamado para cada linha retornada (lento em queries grandes)

**Solução:** Usar CTEs (Common Table Expressions) para calcular `auth.uid()` uma única vez

**Exemplo:**

```sql
-- ❌ ATUAL (LENTO)
CREATE POLICY "rotas_select" ON rotas
FOR SELECT USING (motorista_id = auth.uid());

-- ✅ OTIMIZADO (RÁPIDO)
CREATE POLICY "rotas_select" ON rotas
FOR SELECT USING (
  motorista_id IN (
    WITH user_id AS (SELECT auth.uid() AS id)
    SELECT id FROM user_id
  )
);
```

**Tabelas afetadas:**

- `rotas` (10 políticas)
- `paradas` (via `rotas`)
- `profiles`

**Status:** ✅ Aplicada e posteriormente consolidada por
`20251220_optimize_rls_policies.sql`. As policies atuais foram alteradas por
migrations multi-unidade posteriores; qualquer nova otimização deve partir do
schema vivo.

> **Correção (05/08/2026):** este trecho afirmava que o timestamp `20251220`
> registrado no remoto correspondia a `optimize_rls_policies.sql`. É **falso** —
> a linha remota `20251220` tem `name = enable_realtime`. Oito arquivos
> compartilham o prefixo `20251220` sem `hhmmss` (`add_fk_indexes`,
> `add_notificacoes_realtime`, `add_push_notifications`,
> `add_push_trigger_pg_net`, `enable_realtime`, `fix_function_search_path`,
> `fix_rls_recursion`, `optimize_rls_policies`) e **apenas `enable_realtime`
> ocupa aquele slot**. O conteúdo dos outros sete provavelmente está vivo
> (aplicados manualmente na época), só não por essa linha. Consequência prática:
> se algum dos outros sete for espelhado para `supabase/migrations/`, colide no
> mesmo version string.

---

### ℹ️ Migration 5: PostGIS RLS

**Data:** Opcional
**Objetivo:** Adicionar RLS na tabela `spatial_ref_sys` do PostGIS

**Nota (corrigida em 23/10/2026):** a premissa "somente leitura" estava errada —
`anon` e `authenticated` têm INSERT/UPDATE/DELETE/TRUNCATE na tabela, sem RLS. Ver
Migration 38: o `REVOKE` feito por `postgres` provavelmente não tem efeito (tabela
de `supabase_admin`), e o PostGIS não é usado — desligá-lo no painel resolve.

**SQL:**

```sql
-- Adicionar comentário explicativo
COMMENT ON TABLE spatial_ref_sys IS
'PostGIS system table - RLS not required (read-only metadata)';
```

**Status:** ℹ️ Opcional (ignorável)

---

## 🎯 Status Geral

| Tipo             | Quantidade | Status       |
| ---------------- | ---------- | ------------ |
| **Críticas**     | 3          | ✅ Aplicadas |
| **Performance**  | 1          | ✅ Aplicada  |
| **Opcionais**    | 1          | ℹ️ Ignorável |
| **Notificações** | 2          | ✅ Aplicadas |

**Total deste bloco histórico:** 6/7 (a sétima é opcional/ignorável)
**Avisos Resolvidos:** 13 avisos críticos ✅

---

## 🔍 Troubleshooting

### Funções Duplicadas

Se após aplicar migration ainda aparecem avisos, pode haver funções duplicadas:

```sql
-- Verificar duplicatas
SELECT proname, oid
FROM pg_proc
WHERE proname IN ('get_user_unidade', 'get_user_role', 'calcular_distancia')
ORDER BY proname;

-- Deletar versão antiga (substituir OID)
DROP FUNCTION IF EXISTS get_user_unidade() CASCADE; -- OID antigo
```

### RLS Bloqueando Query

```sql
-- Testar como usuário autenticado
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "user-id-aqui"}';
SELECT * FROM rotas;

-- Ver políticas ativas
SELECT * FROM pg_policies WHERE tablename = 'rotas';
```

### Performance Lenta

Use `EXPLAIN ANALYZE` para ver plano de execução:

```sql
EXPLAIN ANALYZE
SELECT * FROM rotas WHERE motorista_id = auth.uid();
```

---

## 📚 Referências

- [Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [PostGIS Documentation](https://postgis.net/documentation/)

---

---

### ✅ Migration 6: Notificação "Nova Rota Atribuída"

**Data:** 19/12/2025
**Arquivo:** `20251219000000_add_nova_rota_notification.sql`
**Objetivo:** Notificar motorista automaticamente quando gestor atribui rota

**Funções criadas:**

- `notify_motorista_nova_rota()` - Trigger para UPDATE (rota atribuída depois)
- `notify_motorista_nova_rota_insert()` - Trigger para INSERT (rota criada com motorista)

**Triggers:**

- `trigger_nova_rota_atribuida` - Dispara no UPDATE de rotas
- `trigger_nova_rota_atribuida_insert` - Dispara no INSERT de rotas

**Tipo de notificação:** `nova_rota_atribuida`

**Status:** ✅ Aplicado em produção

---

### ✅ Migration 7: Expirar Rotas Pendentes de Dias Anteriores

**Data:** 19/12/2025
**Arquivo:** `20251219000001_expire_old_pending_routes.sql`
**Objetivo:** Marcar rotas pendentes de ontem como `nao_executada` e notificar gestor

**Função criada:**

- `expire_old_pending_routes()` - Retorna `expired_count` e `notifications_sent`

**Edge Function:** `supabase/functions/expire-routes/index.ts`
**Cron Job:** GitHub Actions `.github/workflows/expire-routes.yml` (07:00 Brasília)

**Tipo de notificação:** `rota_nao_executada`

**Status:** ✅ Aplicado em produção

---

### 🔧 Migration 8: Corrigir Triggers Duplicados de Log

**Data:** 27/12/2025
**Arquivo:** `20251227000000_fix_duplicate_log_triggers.sql`
**Objetivo:** Remover triggers duplicados que criam logs duplicados de `motorista_iniciou_rota`

**Problema identificado:**
Múltiplos triggers estavam criando logs quando a rota mudava de status, causando duplicidade na timeline.

**Ações:**

1. Remove todos os triggers potencialmente duplicados (`trigger_log_rota_status`, `log_rota_status_change`, etc.)
2. Recria a função `log_rota_status_change()` com a versão correta
3. Cria trigger único `log_rota_status`
4. Adiciona comentários de documentação para evitar duplicidade futura

**Verificação:**
A migration inclui diagnóstico que lista triggers antes e depois da limpeza.

**Status:** ✅ Aplicado em produção (27/12/2025)

---

**Marco histórico deste bloco:** 27/12/2025

### 🔧 Migration 9: Prevenir Logs Duplicados

**Data:** 27/12/2025
**Arquivo:** `20251227000001_prevent_duplicate_logs.sql`
**Objetivo:** Adicionar proteção no nível do banco para prevenir inserção de logs duplicados

**Problema identificado:**
Apesar da Migration 8 ter limpado os triggers, logs duplicados de `motorista_iniciou_rota` continuavam aparecendo. A fonte do segundo log (com `motorista_nome` e `unidade_nome`) não foi identificada no código.

**Solução implementada:**

1. Criar trigger `prevent_duplicate_log_trigger` (BEFORE INSERT) na tabela `logs`
2. Bloquear inserção se já existe log similar nos últimos 5 segundos
3. Log similar = mesmo `rota_id` + mesmo `evento` + mesmo `usuario_id`
4. Limpar logs duplicados existentes

**Verificação:**
Logs de `motorista_iniciou_rota` agora aparecem apenas uma vez por início de rota.

**Status:** ✅ Aplicado em produção (27/12/2025)

---

### ✅ Migration 10: Hardening RLS/RPC Multi-tenant (Segurança)

**Data:** 22/06/2026
**Arquivos:** `20260622183805_security_hardening_multitenant.sql` (database/ + supabase/)
**Objetivo:** Fechar furos multi-tenant exploráveis (validados no banco vivo).

- **C1/C2:** guard de autorização (espelha `paradas_insert`/`paradas_update`) + `SET search_path=''` nas RPCs `inserir_parada`/`reordenar_paradas`; revoga EXECUTE de PUBLIC/anon (mantém authenticated)
- **C4:** revoga EXECUTE de `expire_old_pending_routes`/`remind_pending_routes` de PUBLIC/anon/authenticated (cron usa service_role)
- **A1:** escopa `push_notification_logs` SELECT por unidade
- **A3:** revoga 4 views de anon + `security_invoker` nas 2 views DEFINER (`vw_performance_motoristas`, `admin_dashboard_metrics`)
- **A4:** remove grant INSERT morto de `notificacoes`

**Validação:** security advisor sem `security_definer_view`; teste funcional cross-tenant **negado**, próprio-tenant **OK**.
**Status:** ✅ Aplicado em produção (PR #271)

---

### ✅ Migration 11: Revogar EXECUTE de Funções DEFINER não-públicas (Segurança)

**Data:** 22/06/2026
**Arquivos:** `20260622195500_security_revoke_definer_anon.sql` (database/ + supabase/)
**Objetivo:** Reduzir superfície de funções SECURITY DEFINER executáveis por `anon` (37 → 14).

- 16 trigger functions + 2 de introspecção (`get_all_tables`, `get_table_schema`) + 3 query-funcs legadas (`estatisticas_rota`, `obter_paradas_ordenadas`, `rotas_ativas_motorista`) → revoga de PUBLIC/anon/authenticated
- `criar_notificacao`, `get_gestor_contato` → revoga só PUBLIC/anon (app chama por usuário logado)
- **Mantidos (consciente):** helpers de autorização (usam `auth.uid()`, retornam null p/ anon) e PostGIS

**Status:** ✅ Aplicado em produção (PR #272)

---

### ✅ Migration 12: Bucket `fotos-entrega` privado (C3 Fase 1, Segurança)

**Data:** 24/06/2026
**Arquivos:** `20260624033812_c3_bucket_fotos_entrega_privado.sql` (database/ + supabase/)
**Objetivo:** Fechar exposição pública de PII — torna o bucket privado; fotos servidas via signed URLs on-read (`useSignedUrl`).

```sql
update storage.buckets set public = false where id = 'fotos-entrega';
```

- Policies de `storage.objects` **mantidas** (necessárias p/ usuário autenticado gerar signed URL).
- Aplicada via MCP **após** o deploy web (ordem de rollout). Advisor `public_bucket_allows_listing` **resolvido**; URL pública antiga → **HTTP 400**.
- ~~**Fase 2 pendente:** isolamento por unidade em `storage.objects`~~ → **concluída na Migration 14** (03/07/2026).

**Status:** ✅ Aplicado em produção (PR #285)

---

### ✅ Migration 13: Índice composto em `notificacoes` (retroativa, harmonização)

**Data:** 26/12/2025 (aplicada) · 03/07/2026 (documentada/harmonizada)
**Arquivos:** `20251226170000_optimize_notificacoes_index.sql` (database/ + supabase/)
**Objetivo:** Índice `idx_notificacoes_usuario_created (usuario_id, created_at DESC)` — queries de listagem de notificações caíram de ~1300ms.

- Aplicada manualmente em 26/12/2025 com `CREATE INDEX CONCURRENTLY`; documentada retroativamente.
- **Harmonização 07/2026 (drift HIGH do auditor de migrations):** as cópias divergiam (database/ com CONCURRENTLY + ANALYZE e filename sem `hhmmss`; supabase/ sem ANALYZE). Agora são **byte-idênticas** na forma transacional (sem CONCURRENTLY — `supabase db push` roda migrations em transação) e com o mesmo filename `20251226170000_`.

**Status:** ✅ Aplicado em produção (índice confirmado no banco vivo em 03/07/2026)

---

### ✅ Migration 14: Isolamento por unidade em `storage.objects` (C3 Fase 2, Segurança)

**Data:** 03/07/2026
**Arquivos:** `20260703120000_c3_fase2_storage_rls_por_unidade.sql` (database/ + supabase/)
**Objetivo:** Fechar o furo cross-tenant da Fase 1 — a policy SELECT do bucket `fotos-entrega` era só `authenticated` (qualquer usuário gerava signed URL de foto de qualquer unidade).

- **SELECT** por unidade com 4 ramos: (a) owner do objeto (`owner`/`owner_id`); (b) fotos de entrega — 1º segmento do path ∈ unidades ativas via `get_my_unidade_ids()` (comparação TEXT, sem cast p/ uuid); (c) `perfis/` e (d) `incidentes/` — objeto referenciado por linha de `usuarios`/`incidentes` **visível ao caller sob o RLS da própria tabela** (guards de prefixo impedem exfiltração via `foto_url` plantado).
- **INSERT** endurecido: owner + 1º segmento ∈ minhas unidades OU ∈ (`perfis`,`incidentes`). **DELETE** owner-only (+ `owner_id`).
- Remove 3 policies órfãs do bucket `incidentes` (nunca existiu).
- Revisado pelo agente `rls-policy-reviewer` (**APPROVE**, 0 findings críticos). Rollback verbatim comentado no arquivo. **Invariante:** afrouxar RLS de `usuarios`/`incidentes` afrouxa a leitura das fotos correspondentes.

**Status:** ✅ Aplicado em produção (via MCP `apply_migration`; teste negativo cross-tenant validado em 03/07/2026)

---

### ✅ Migration 15: Fix `inserir_parada` — conflito de UNIQUE com a chegada (bug: inserir parada no meio da rota)

**Data:** 13/07/2026
**Arquivos:** `20260713190000_fix_inserir_parada_chegada_conflict.sql` (database/ apenas)
**Objetivo:** Inserir parada **no meio** da rota falhava com `duplicate key value violates unique constraint "paradas_rota_id_ordem_key"` — só funcionava inserir no final (bug reportado pelo gestor em 13/07).

- **Causa raiz:** o shift `+1000 / -1000+1` das paradas reais empurrava a última parada real para cima da `ordem` da **chegada** (`is_checkpoint=false`, excluída do shift), que só era movida _depois_ — e apenas no caso "inserir no final" (`v_chegada.ordem <= v_new_ordem`).
- **Fix:** chegada é **estacionada em ordem alta temporária (+2000) antes** de qualquer shift/INSERT; o bloco final (já existente) a reposiciona para `count+1`. Bloco tardio removido. Clamp defensivo `GREATEST(p_posicao_insercao, 1)` (ordem 0 = partida). Diff mínimo sobre a versão hardened da Migration de 22/06 (`20260622183805`): guard de tenant e `SET search_path = ''` preservados; `CREATE OR REPLACE` mantém ACLs (authenticated com EXECUTE; anon/PUBLIC revogados).
- Reproduzido e validado no banco vivo com rota sintética + rollback (impersonação de gestor via `request.jwt.claims`): antes → `success:false` (unique violation); depois → inserção no meio, na posição 1 e no final todas OK com layout correto (chegada sempre última).
- Revisado pelo agente `rls-policy-reviewer` (**APPROVE**). Rollback: re-executar o bloco C1 da `20260622183805`.

**Status:** ✅ Aplicado em produção (via MCP `execute_sql`, 13/07/2026; validado com repro antes/depois)

---

### ✅ Migration 16: Revogar funções DEFINER parametrizadas

**Data:** 22/07/2026

**Arquivos:** `20260722195606_security_revoke_definer_anon_param.sql`
(`database/` + `supabase/`)

**Objetivo:** fechar divulgação de papel/unidade por seis funções
`SECURITY DEFINER` que aceitavam um `user_id` arbitrário.

- Revoga `EXECUTE` de `PUBLIC`, `anon` e `authenticated`.
- Mantém execução interna por `service_role`/`postgres`.
- Auditoria confirmou que nenhuma policy e nenhum cliente dependiam dessas
  funções.
- O SQL já havia sido aplicado; o commit posterior apenas incorporou a
  migration preexistente ao histórico versionado.

**Status:** ✅ Aplicado em produção e registrado no histórico remoto

---

### ✅ Migration 17: Rascunhos e criação atômica da Nova Entrega

**Data:** 23/07/2026

**Arquivos:** `20260723223000_nova_entrega_drafts_atomic_route.sql`
(`database/` + `supabase/`)

**Objetivo:** preservar o trabalho do gestor após refresh e impedir rotas
parciais ou duplicadas em retries.

- Adiciona `rotas.client_request_id` e índice único parcial para idempotência.
- Cria `rascunhos_rota` com payload JSON, expiração em sete dias e unicidade por
  gestor/unidade.
- Habilita RLS de rascunhos para o próprio gestor ativo na unidade.
- Cria a RPC `criar_rota_com_paradas`, que valida motorista, data, checkpoints,
  limites, coordenadas, telefones e dependências retirada/entrega.
- Insere rota, paradas, vínculos e log na mesma transação.
- Serializa requests iguais com advisory lock, reutiliza uma rota já criada com
  a mesma chave e remove o rascunho após sucesso.
- Revoga execução de `PUBLIC`/`anon` e concede apenas a `authenticated`.

**Status:** ✅ Aplicado em produção e registrado no histórico remoto

---

### ✅ Migration 18: Auditoria de uso do otimizador de rotas

**Data:** 04/08/2026

**Arquivos:** `20260804235500_auditoria_otimizacao_rotas.sql`
(`database/` + `supabase/`)

**Objetivo:** registrar em cada rota se ela foi otimizada pelo otimizador,
montada manualmente, ou otimizada e depois alterada manualmente — base de
dados para a auditoria de uso do otimizador (o app grava nessas colunas em
tasks seguintes).

- Adiciona `rotas.otimizacao_estado` (`otimizada` | `manual` |
  `otimizada_alterada`; `NULL` = sem registro, rota anterior a esta feature —
  **nunca** tratar como `'manual'`), `otimizacao_distancia_antes`,
  `otimizacao_distancia_depois`, `otimizada_em` e `otimizada_por` (FK
  `usuarios`, `ON DELETE SET NULL`), mais índices `(unidade_id,
otimizacao_estado)` e `(otimizada_por)`.
- **Estende `criar_rota_com_paradas` de 8 para 11 parâmetros** (os 3 novos
  `DEFAULT NULL`) via **DROP da assinatura de 8 parâmetros antes do
  `CREATE OR REPLACE`**: no Postgres a identidade de uma função é (nome +
  tipos dos parâmetros), então acrescentar parâmetros — mesmo com DEFAULT —
  cria um overload novo em vez de substituir o antigo; uma chamada com 8
  parâmetros nomeados (como o app fazia) passaria a casar com as duas
  assinaturas e o Postgres devolveria `function ... is not unique`, quebrando
  a criação de rota em produção. Corpo idêntico ao original + as 3 colunas
  novas no INSERT + log opcional `rota_otimizada` + checagem de
  não-negatividade para as duas distâncias novas.
- Autoria (`otimizada_por`) vem de `auth.uid()`, nunca de parâmetro do
  cliente — a primeira versão da migration aceitava um `p_otimizada_por uuid`
  livre e, por ser `SECURITY DEFINER`, qualquer gestor autenticado podia
  forjar o autor da otimização; corrigido antes de aplicar.
- Reaplica os grants (REVOKE `PUBLIC`/`anon` + GRANT `authenticated`/
  `service_role`) na assinatura nova — `CREATE FUNCTION` não herda
  privilégios da função removida pelo `DROP`, então sem isso a função
  recriada ficaria com o grant default do schema `public`, reabrindo a
  classe de furo (SECURITY DEFINER executável por anon/PUBLIC) já fechada em
  `20260622195500_security_revoke_definer_anon.sql` e
  `20260722195606_security_revoke_definer_anon_param.sql`.

**Rollback não é só remover a função nova** — a migration faz DROP do
overload de 8 parâmetros, então: (1) reverta primeiro o **código do app**
para a versão que chama `criar_rota_com_paradas` com 8 parâmetros (revertido
o banco antes disso, toda criação de rota quebra, porque o app em produção
já chama com 11 parâmetros nomeados); só depois (2) recrie a assinatura de 8
parâmetros a partir de `20260723223000_nova_entrega_drafts_atomic_route.sql`
(CREATE OR REPLACE FUNCTION + REVOKE/GRANT). Bloco comentado no fim do
próprio arquivo da migration.

**Status:** ✅ Aplicado em produção em 05/08/2026 via MCP `apply_migration`
(não `supabase db push` — há drift conhecido entre `database/migrations/`,
`supabase/migrations/` e o banco vivo neste projeto; `db push` não é seguro
aqui, ver "Legado dual-path" no topo deste arquivo).

---

### ✅ Migration 19: Coluna `motivo_skip` em `paradas` (retroativa)

**Data:** 07/02/2026 (documentada retroativamente em 05/08/2026)

**Arquivos:** `20260207000000_add_motivo_skip.sql` (`database/` + `supabase/`)

**Objetivo:** guardar o motivo estruturado quando uma parada é pulada, em vez de
só marcar o status `pulada`.

- Adiciona `paradas.motivo_skip VARCHAR(30)`. Valores em
  `src/constants/skipReasons.ts` (`cliente_ausente`, `recusa`,
  `endereco_incorreto`, `acesso_bloqueado`, `renovacao_contrato`, `outro`).
- Ganhou `IF NOT EXISTS` em 05/08/2026: sem a guarda, era o primeiro arquivo
  pendente de um `supabase db push` e abortava o push inteiro com "column
  already exists".

**Status:** ✅ Coluna confirmada viva em produção, **sem linha em
`schema_migrations`** — pendente de `migration repair --status applied`.

---

### ✅ Migration 20: `get_my_unidade_ids()` e RLS multi-unidade (retroativa)

**Data:** 08/02/2026 (documentada retroativamente em 05/08/2026)

**Arquivos:** `20260208000000_fix_rls_multi_unidade.sql` (**apenas
`database/`** — não espelhada em `supabase/`)

**Objetivo:** dar às policies um helper multi-unidade, substituindo o
`get_user_unidade()` de unidade única.

- Cria `get_my_unidade_ids()` (SETOF uuid, `SECURITY DEFINER`,
  `search_path=''`, EXECUTE para `anon` + `authenticated`), que resolve as
  unidades ativas do `auth.uid()` via `usuario_unidades`.
- Recria as policies `usuarios_select_optimized`, `usuarios_update_optimized`,
  `usuarios_insert_optimized` e `motorista_locations_select_optimized`.

**Importa mais do que o silêncio sugeria:** é esta migration que define o
`get_my_unidade_ids()` que o `CLAUDE.md` documenta como helper preferido para
código novo, e do qual a Migration 14 (isolamento de `storage.objects` por
unidade) **depende** — afrouxar esta afrouxa a leitura das fotos.

**Status:** ✅ Função e policies confirmadas vivas em produção, **sem linha em
`schema_migrations`** e não espelhada em `supabase/migrations/`.

---

### ✅ Migration 21: Onboarding self-service (testador cria a própria unidade)

**Data:** 06/08/2026

**Arquivos:** `20260806175617_onboarding_self_service.sql` (`database/` +
`supabase/`, cópia byte-idêntica)

**Objetivo:** até esta data, nenhum usuário novo conseguia concluir o cadastro
público — `signUp` criava a conta no Auth e depois tentava inserir em
`usuarios`, insert que a policy `usuarios_insert_optimized` bloqueia por
exigir que o autor já seja gestor de alguma unidade. Como o erro aparecia
DEPOIS da conta criada, sobrava conta órfã (5 pessoas reais nesse estado).

- `unidades.cnpj` deixa de ser `NOT NULL` (o `UNIQUE` permanece — múltiplos
  `NULL` não colidem em Postgres).
- Cria a RPC `criar_unidade_para_novo_gestor(text, text, text, text, text,
numeric, numeric, text) RETURNS uuid`, `SECURITY DEFINER` com
  `search_path = ''`.
- Guardas: rejeita se `auth.uid()` já tem linha em `usuarios`
  (`PERFIL_JA_EXISTE`, torna duplo submit inofensivo), exige nome/unidade/
  cidade não vazios, exige coordenadas da sede (sem elas a unidade nasce
  incapaz de gerar rota) e valida a faixa (`-90..90` / `-180..180`). E-mail
  vem de `auth.users` pelo `auth.uid()`, nunca de parâmetro — impede cadastrar
  perfil com e-mail alheio.
- Grava, na mesma transação: `unidades` (`origem='self_service'`,
  `status='trial'`), `usuarios` (`papel='gestor'`, `primeira_senha=false`,
  `is_gestor_principal=true`, `unidade_id` preenchido) e `usuario_unidades`
  (`papel='gestor'`, `is_principal=true`).
- Revoga `EXECUTE` de `PUBLIC`/`anon`; concede apenas a `authenticated`.
- Rollback comentado no próprio arquivo: `DROP FUNCTION` + reverter o
  `NOT NULL` de `cnpj` (só é seguro se nenhuma unidade tiver `cnpj` nulo — o
  próprio arquivo traz a query de checagem).

**Status:** ✅ Aplicado em produção em 06/08/2026 via MCP `apply_migration`; branch `feat/onboarding-self-service` mergeada em main (commit 61cd738).

**Ordem de deploy (obrigatória):** esta migration foi aplicada **antes** do código da branch chegar em produção — a ordem correta foi mantida. Na ordem inversa, todo cadastro novo (via `/onboarding/criar-unidade`, e também via `/auth/login` para quem já tem sessão sem perfil) receberia `PGRST202` (`criar_unidade_para_novo_gestor` ainda não existe no schema cache do PostgREST) e ficaria preso na tela — sem voltar (`headerBackVisible: false`, `gestureEnabled: false` no `app/onboarding/_layout.tsx`) até o botão "Sair" existir no `criar-unidade.tsx`. A ordem correta (migration primeiro) é segura nos dois sentidos: `cnpj` deixar de ser `NOT NULL` é inócuo para todo código antigo (só fica menos restritivo, não quebra nenhum insert existente), e a RPC só é alcançável por um usuário autenticado sem linha em `usuarios` — o código aplicado em produção agora chama `criar_unidade_para_novo_gestor`, confirmando a execução posterior do código sem efeito colateral.

---

### ✅ Migration 22: RPC `atualizar_unidade` (sem policy de UPDATE)

**Data:** 07/08/2026

**Arquivos:** `20260807151639_atualizar_unidade.sql` (`database/` + `supabase/`,
cópia byte-idêntica)

**Objetivo:** a tela "Minha unidade" chamava `.update()` direto em `unidades`,
que a RLS deixa passar sem erro e sem efeito — a tabela só tem a policy
`unidades_select` (somente leitura), então o `.update()` afetava 0 linhas, o
código só checava `error` (sempre `null`) e a tela exibia "Dados atualizados
com sucesso!" recarregando os valores antigos.

- Cria `atualizar_unidade(uuid, text, text, text, text, text, text, text,
numeric, numeric)` — `SECURITY DEFINER`, `search_path = ''`, 10 parâmetros
  explícitos (nome, telefone, endereço, cidade, UF, CEP e os três campos de
  sede, estes últimos com `DEFAULT NULL`).
- Guarda de autorização roda antes de qualquer validação de campo: exige
  gestor **ativo** da unidade via `usuario_unidades` (`papel = 'gestor' AND
ativo = true`, sem exigir "principal" — hoje 0 dos 9 gestores têm
  `is_gestor_principal = true`; exigir isso travaria todos). Falha com
  `SEM_PERMISSAO` (`42501`).
- Valida nome/cidade não vazios (`CAMPOS_OBRIGATORIOS`), UF de 2 caracteres
  (`UF_INVALIDA`) e a faixa de coordenadas da sede (`COORDENADAS_INVALIDAS`);
  trata tab/newline/CR como whitespace (`btrim` de 1 argumento só remove
  espaço — corrigido para regex `!~ '\S'` / `btrim` de 2 argumentos com
  `E' \t\n\r'`).
- Sede só é sobrescrita quando endereço + latitude + longitude vierem juntos;
  omitir os três preserva os valores atuais — apagar a sede por omissão
  deixaria a unidade incapaz de gerar rota.
- **Deliberadamente não cria policy de UPDATE em `unidades`.** A tabela tem 17
  colunas fora das que a RPC edita, várias comerciais (`plano`, `status`,
  `desconto_percentual`, `asaas_customer_id`, `observacoes_admin`) — como
  `anon`/`authenticated` já têm grant de tabela cheio (default do Supabase) e
  RLS não restringe coluna, qualquer policy de UPDATE abriria as 17 de uma
  vez. A RPC é a única porta de escrita. Detalhe em "Armadilhas que já
  custaram caro" em `docs/PROJECT_CONTEXT.md`.
- Revoga `EXECUTE` de `PUBLIC`/`anon`; concede apenas a `authenticated`.
- Revisada pelo agente `rls-policy-reviewer` (**APPROVE**); uma fix wave
  posterior corrigiu o tratamento de whitespace acima e removeu um
  `updated_at = now()` redundante (o trigger `update_unidades_updated_at` já
  cobre incondicionalmente). Rollback comentado no próprio arquivo, com aviso
  explícito contra "compensar" a remoção com uma policy.

**Status:** ✅ Aplicada em 07/08/2026, na ordem correta (migration antes do
merge do PR #355). `unidades` segue com uma única policy (`unidades_select`,
somente leitura); nenhuma policy de UPDATE foi criada — é o desenho, não uma
lacuna.

**Validada em 08/08/2026** pela tela, não só por consulta: a Unidade Demo foi
editada de São Paulo para João Pessoa e a linha mudou no banco
(`cidade`, `uf`, `cep`, `sede_endereco`, `sede_latitude = -7.12008880`,
`sede_longitude = -34.85964640`, `updated_at` do momento). O teste
automatizado que prova o outro lado — payload da RPC sem `p_plano`,
`p_status`, `p_asaas_customer_id`, `p_desconto_percentual` nem
`p_observacoes_admin` — está em `app/unidade/__tests__/index.test.tsx`.

**Atenção para quem for mexer nesta tela:** aplicar a migration não bastou para
a tela funcionar. O autocomplete da sede estava morto por um motivo de React
sem relação com o banco — o formulário era um componente declarado dentro do
render, e remontava a cada tecla. Corrigido no PR #357. Detalhe em "Armadilhas
que já custaram caro" em `docs/PROJECT_CONTEXT.md`.

### ✅ Migration 23: `admin_logs` sobrevive à exclusão da conta

**Data:** 15/08/2026

**Arquivos:** `20260815200000_admin_logs_sobrevive_a_conta.sql` (`database/` +
`supabase/`, cópia byte-idêntica)

**Objetivo:** `admin_logs.admin_id` é `NOT NULL` e referenciava `auth.users(id)`
com `NO ACTION`. A combinação tornava **impossível excluir uma conta que já
tivesse agido**: a FK bloqueava o `DELETE` e a coluna não aceitava `NULL`.
Sobravam duas saídas ruins — apagar o log (destruir justamente o que se quer
auditar) ou deixar a conta órfã viva em `auth.users`. A segunda não é inofensiva:
conta órfã continua autenticando e, sem perfil em `usuarios`, cai no portão
`/onboarding/criar-unidade` e pode criar unidade, virando gestora.

- Remove a constraint `admin_logs_admin_id_fkey`. `admin_id` **continua
  `NOT NULL`**: todo registro segue exigindo autor; o que muda é que o autor não
  precisa mais existir em `auth.users`.
- Garante `idx_admin_logs_admin_id` (já existia; o `IF NOT EXISTS` é rede de
  segurança — índice de FK no Postgres não é criado nem removido junto com a
  constraint).
- `COMMENT ON COLUMN` explica a ausência da FK e pede explicitamente que **não
  seja recriada**, para nenhuma migration futura "consertar" o que é desenho.
- **Não altera RLS nem grants.** A tabela tem uma única policy,
  `admin_logs_no_access` (`FOR ALL USING (false)`), e nem `anon` nem
  `authenticated` têm `rolbypassrls` — a escrita só acontece pelo `service_role`
  do projeto do painel. Soltar a FK não muda quem escreve, só para de validar
  que o UUID existe.
- Revisada pelo agente `rls-policy-reviewer` (**APPROVE**). Ele confirmou que
  `admin_email` nunca foi checado contra `admin_id` (sem trigger, sem CHECK),
  então a confiabilidade do registro histórico não mudou — era e segue sendo a
  do código do painel. Também varreu o schema: nenhuma outra tabela tem o par
  `NOT NULL` + FK `NO ACTION` para `auth.users`. `usuarios.id` referencia
  `auth.users` com `CASCADE`, que é risco de forma diferente (apaga o perfil em
  silêncio), não o mesmo impasse.

**Status:** ✅ Aplicada em 15/08/2026 via `mcp__supabase__apply_migration`.
Verificado depois: `admin_logs` com **0 FKs**, os **7 registros preservados**,
índice presente e comentário gravado.

**Drift esperado, não é erro:** o MCP registra sob **timestamp próprio**, então
`npx supabase migration list` mostra `20260815200000` como `local` (o arquivo) e
`20260815214635` como `remote` (o registro). É o mesmo par que 21 e 22 já
produziram — a auditoria de drift deve tratar como aplicada, não como pendente.

**Validada pelo caso que a motivou**, no mesmo dia: a conta de teste de motorista
cujo perfil havia sido excluído foi finalmente removida de `auth.users` — e os 7
registros de auditoria dela continuam na tabela, identificáveis por
`admin_email`. Contas órfãs voltaram a **zero** (16 `auth.users` / 16 `usuarios`).

**Follow-up não bloqueante** levantado na revisão: `admin_logs` ainda tem grants
de tabela cheios para `anon`/`authenticated`, hoje neutralizados pela policy
`USING (false)`. É inconsistente com o padrão `REVOKE` usado em outras tabelas
exclusivas do painel (`plan_prices`) — vale um `REVOKE` por defesa em
profundidade. Não tem relação com esta migration.

---

### ✅ Migration 24: Expiração de rotas — data em BRT e guarda de horário

**Arquivo:** `20260827190000_expiracao_rota_fuso_e_guarda_horario.sql`

**Motivada por incidente em produção (27/08/2026).** O job de expiração,
agendado para 22:00 BRT (`0 1 * * 2-6`, 01:00 UTC), foi entregue pelo GitHub
Actions às **10:43 UTC — 9h43min atrasado**, ou seja 07:43 BRT. Como
`expire_old_pending_routes` filtrava por `ro.data <= CURRENT_DATE` sem olhar as
horas, ela matou duas rotas criadas naquela mesma manhã: José Inácio (5 paradas,
criada 07:22, ~2h56min parado) e Lucas Cosme (6 paradas, criada 07:37, ~1h44min
parado), mais 4 notificações falsas. Ambas foram reativadas e concluídas; nada
foi perdido além do tempo.

**Duas falhas independentes, corrigidas juntas:**

1. **`CURRENT_DATE` é UTC.** Às 22:00 BRT já é 01:00 UTC do dia seguinte, então
   `data <= CURRENT_DATE` também alcançava rotas **pré-criadas para amanhã** —
   bug latente que só não mordeu porque ninguém adianta rota na véspera hoje.
   Simulado: num run pontual de 31/08 22:00 BRT, `CURRENT_DATE` = `2026-09-01` e
   uma rota de 01/09 seria apagada. Passa a usar
   `(now() AT TIME ZONE 'America/Sao_Paulo')::date`.
2. **A função não tinha noção de horário.** O filtro passa a ter dois ramos:
   `data < hoje` expira a qualquer hora; `data = hoje` só a partir das 22:00 BRT.

**Por que o filtro NÃO virou uma guarda global de "só rode após as 22h"** (era a
proposta inicial, e estava errada): dos 19 eventos `rota_expirada` desde
29/12/2025, **17 rodaram entre 00:22 e 02:07 BRT** limpando o dia anterior — o
agendador quase sempre chega depois da meia-noite. Uma guarda global teria
bloqueado todos eles e as rotas nunca expirariam.

**Também:** `remind_pending_routes` recebeu a mesma correção de fuso (usava
`ro.data = CURRENT_DATE`), e ganhou-se `p_dry_run` em
`expire_old_pending_routes` — o projeto não tem pgTAP, então é a única forma
honesta de conferir a função em produção sem mutar dados.

**Cuidado preservado no DROP/CREATE:** a assinatura mudou (`p_dry_run`), então
foi preciso `DROP` + `CREATE`. `CREATE FUNCTION` concede `EXECUTE` a `PUBLIC`
por padrão — sem os `REVOKE` explícitos, a função `SECURITY DEFINER` que expira
rotas de **todas** as unidades teria ficado aberta a `anon`/`authenticated`.
Verificado após aplicar: `public_pode = false`, apenas `service_role`.

**Status:** ✅ Aplicada em 27/08/2026 via `mcp__supabase__apply_migration`.

**Verificação funcional** (sonda transacional desfeita por `RAISE EXCEPTION`,
sem deixar resíduo — confirmado: 0 rotas, 0 logs, 0 notificações criadas):

```
hora_brt=16:50:10 | rota_de_HOJE_expira=0 (esperado 0)
                  | rota_de_ONTEM_expira=1 (esperado 1)
```

Fronteira conferida: `17:00 → não`, `21:59 → não`, `22:00 → sim`, `23:30 → sim`.

**Drift esperado, não é erro:** arquivo `20260827190000`, registro remoto
`20260827194804`.

**Fora do escopo desta migration, mas na mesma linha de tiro:** o aviso "expira
em 2 horas" pode chegar de madrugada se o run das 20:00 BRT atrasar (aconteceu
em 27/08, entregue 01:08 BRT). É mensagem confusa, não perda de trabalho —
resolver com uma janela de sanidade em `remind_pending_routes`.

---

### ⏳ Migration 25: Expiração alcança rotas em andamento (carência de 7 dias)

**Arquivo:** `20260831230000_expirar_rotas_em_andamento.sql`

`expire_old_pending_routes` filtrava `status = 'pendente'` e mais nada. Rota que
o motorista **inicia e abandona** ficava imortal: nunca expirava, nunca gerava
aviso ao gestor, e o `remind_pending_routes` também não a alcançava (mesmo
filtro). Descoberto em 31/08/2026 pela rota demo
`aaaa0000-0000-4000-8000-000000000020`, aberta em `em_andamento` desde 08/08 —
23 dias, 3 de 5 paradas pendentes.

Confirmado que a lacuna era total: em todo o schema `public`, só duas funções
mencionam `nao_executada` — esta e o trigger `log_rota_status_change`. Nenhuma
expirava `em_andamento`.

**A lacuna era latente, não ativa.** Das 641 rotas: 620 `concluida`, 17
`nao_executada`, 3 `cancelada` e **exatamente 1** `em_andamento` — a demo,
semeada nesse estado (`created_at` = `updated_at`, linha nunca atualizada).
Nenhuma rota real ficou presa; o buraco é para frente.

**Por que 7 dias e não "junto com as pendentes".** A leitura literal foi testada
por replay contra o histórico real de `motorista_iniciou_rota` /
`motorista_concluiu_rota` e **reprovada**: 67 das 604 rotas concluídas (11%)
foram fechadas **depois das 22:00 da própria data**. Teriam sido marcadas
`nao_executada` com o motorista ainda entregando — o incidente da Migration 24
em escala 33×. Rota em andamento não é rota esquecida: das 67 tardias, só 1
fechou antes da meia-noite e 47 fecharam no dia seguinte; mediana 10,1h após as
22:00, p90 58,8h.

Falsos positivos por carência, sobre as 604 concluídas com log:

| carência    | falsos |     | carência   | falsos            |
| ----------- | ------ | --- | ---------- | ----------------- |
| 0 (literal) | 67     |     | 3 dias     | 4                 |
| 1 dia       | 19     |     | **7 dias** | **2** ← escolhido |
| 2 dias      | 19     |     | 14 dias    | 0                 |

**`CREATE OR REPLACE`, não `DROP`/`CREATE`:** a assinatura não muda, então o
REPLACE preserva os GRANTs (`postgres`, `service_role`) e evita reconceder
`EXECUTE` a `PUBLIC` — a armadilha documentada na Migration 24.

**Mensagem própria para o ramo novo.** "não foi executada" é falso para rota com
paradas concluídas. O texto das pendentes fica byte a byte igual; o `tipo`
continua `rota_nao_executada` de propósito, para não quebrar consumidores que
filtram por ele.

**Verificação da fronteira** (lógica pura, sem tocar no banco), nos dois ramos e
em dois horários:

```
pendente  amanha  21:00 nao | 22:00 nao   (proteção da Migration 24 intacta)
pendente  hoje    21:00 nao | 22:00 SIM   (guarda de hora intacta)
pendente  ontem   21:00 SIM | 22:00 SIM
andamento hoje    21:00 nao | 22:00 nao
andamento 6 dias  21:00 nao | 22:00 nao
andamento 7 dias  21:00 SIM | 22:00 SIM   <- fronteira
andamento 23 dias 21:00 SIM | 22:00 SIM   <- rota demo
```

**Raio de alcance na base real:** o predicado novo casa com **1 rota** — a demo.

**Status:** ✅ Aplicada em 31/08/2026 via `mcp__supabase__apply_migration`.

**Verificação funcional pós-aplicação**, com `p_dry_run => true`:

```
expire_old_pending_routes(p_dry_run => true)
  -> expired_count = 1, notifications_sent = 2   (1 gestor + 1 motorista)
```

Confirmado que o dry-run não deixou resíduo: `notificacoes` em 2194 antes e
depois, rota demo ainda `em_andamento`, 0 linhas em `logs` para ela.

Permissões preservadas pelo `CREATE OR REPLACE`, como planejado:
`EXECUTE` apenas para `postgres, service_role` — nada de `PUBLIC`, `anon` ou
`authenticated`. `prosecdef = true`, `search_path = public`.

**Drift esperado, não é erro:** arquivo `20260831230000`, registro remoto
`20260831222717`.

**Fora do escopo, mas descoberto junto:** (1) `StatusRota` em `src/types/rota.ts`
não inclui `nao_executada`, embora o banco já tenha 17 linhas assim; os
componentes contornam tipando `status?: string`. (2) `remind_pending_routes`
também filtra só `pendente` — com esta migration, uma rota em andamento passa a
expirar sem nunca ter recebido aviso. Ambos merecem tratamento próprio.

---

### ✅ Migration 26: Lembrete alcança rota em andamento prestes a expirar

**Arquivo:** `20260831234500_lembrete_rota_em_andamento.sql`

Consequência direta da Migration 25. `remind_pending_routes` continuou filtrando
só `status = 'pendente'`, então a rota abandonada passava a expirar **sem nunca
ter recebido aviso** — nem o lembrete das 16:00 nem o final das 20:00. Encerrar
trabalho de alguém sem avisar é pior que não encerrar.

**Quando avisar.** O ramo novo usa **o mesmo predicado da expiração**
(`em_andamento AND data <= hoje - 7`), então os dois lembretes caem no dia em que
a rota de fato expira: 16:00 dá 6h de antecedência, 20:00 dá 2h — o mesmo desenho
que já existe para as pendentes.

Descartado avisar no dia 6 ("expira amanhã"): o agendador só roda em dias úteis,
então "amanhã" seria falso toda sexta, e a Migration 24 documenta que o cron
atrasa horas. Ancorar no mesmo predicado é o que impede lembrete e expiração de
divergirem quando o agendador escorrega.

**Texto próprio, porque o atual seria mentira.** O aviso final diz "expira às
22:00! **Inicie agora** ou ela será marcada como não executada" — "inicie agora"
está errado para rota já iniciada, e "não executada" é falso quando há paradas
concluídas.

**Bug de contagem que só aparece no ramo novo.** `remind_pending_routes` conta
**todas** as paradas (`is_checkpoint`), sem filtrar status. Para rota `pendente`
é inofensivo (nenhuma concluída); para `em_andamento` seria errado — a rota demo
diria "3 parada(s)" onde a tela do motorista mostra **2 restantes**. O ramo novo
conta só as pendentes, como `expire_old_pending_routes`. O ramo antigo fica
intocado: corrigi-lo mudaria mensagem que hoje está correta.

**Status:** ✅ Aplicada em 31/08/2026 via `mcp__supabase__apply_migration`.

**Verificação por sonda transacional** (desfeita por `RAISE EXCEPTION`, porque
esta função **não tem `p_dry_run`** e uma chamada real notificaria o motorista):

```
FINAL  (20:00) found=1 sent=1
  [🚨 URGENTE: Rota será encerrada em 2 horas!]
  Sua rota de 08/08 está aberta há 23 dias e será encerrada às 22:00.
  Conclua as 2 parada(s) restantes agora.

NORMAL (16:00) found=1 sent=1
  [⏰ Lembrete: Rota em aberto!]
  Sua rota de 08/08 está aberta há 23 dias e será encerrada hoje às 22:00
  se não for concluída. Faltam 2 parada(s).
```

As duas dizem "2 parada(s)", batendo com o "2 restantes" da tela.

> **Armadilha da sonda, registrada porque custou uma rodada:** a primeira versão
> capturava a notificação com `ORDER BY created_at DESC LIMIT 1`. Dentro de uma
> transação o `now()` é **fixo**, então as duas inserções compartilham o mesmo
> `created_at` e a ordenação não as distingue — o bloco "normal" exibiu o texto
> do "final", e o ramo das 16:00 ficou **sem verificação nenhuma** parecendo
> verificado. A v2 identifica por `id` (`array_agg` antes de cada chamada,
> `NOT (id = ANY(...))` depois). Em sonda transacional, nunca ordene por tempo.

Sem resíduo: `notificacoes` em 2194 antes e depois. Textos do ramo antigo
conferidos **byte a byte** no `prosrc` implantado. `EXECUTE` apenas para
`postgres, service_role`; `prosecdef = true`; `search_path = public`.

**Drift esperado, não é erro:** arquivo `20260831234500`, registro remoto
`20260831223705`.

---

**Última atualização:** 31/08/2026

---

### ✅ Migration 27: Endurecimento de RLS — papel, view admin, notificações

**Arquivo:** `20260906120000_rls_endurecimento_papel_e_view_admin.sql`

Quatro buracos que a varredura de 06/09/2026 confirmou no banco vivo. Os dois
primeiros eram exploráveis com uma chamada comum do cliente Supabase.

**`admin_dashboard_metrics` era legível sem login.** A view pertence a
`postgres` (`rolbypassrls`) e estava sem `security_invoker`, então rodava
ignorando RLS — e `anon` tinha SELECT. Como a ANON_KEY vai no bundle web,
qualquer visitante do site lia MRR, churn, taxa de conversão e contagens de
todos os tenants. É **reaplicação**: a Migration de 22/06 já trazia estas duas
instruções, e as linhas irmãs do mesmo bloco pegaram (`vw_rotas_resumo` e
`vw_performance_motoristas` estão corretas). Só estas não. Causa não
determinada, por isso a migration é idempotente.

**Motorista podia se promover a gestor.** `usuarios_update_optimized` tem um
ramo `id = auth.uid()` no `USING` que não depende de outra coluna; sem
`WITH CHECK`, o Postgres reusa o `USING` contra a linha nova e esse ramo aprova
qualquer valor. Não havia grant de coluna barrando `papel`, `admin_role`,
`unidade_id`, `ativo` nem `is_gestor_principal`.

**Por que REVOKE de coluna e não só `WITH CHECK`.** `WITH CHECK` enxerga apenas
a linha NOVA — "esta coluna não pode mudar de valor" não é expressável nele. É o
mesmo raciocínio já registrado para `unidades` no `PROJECT_CONTEXT` ("RLS não
restringe coluna"), onde a saída foi não ter policy de UPDATE; aqui a saída é o
grant. `papel` e `admin_role` não são escritos por nenhum caminho do app
(conferido em `src/`, `app/`, `supabase/functions/`, `scripts/`), então revogar
é cirúrgico. `unidade_id` **é** escrita (`useUnidadeAtiva.ts:197`), então
continua gravável, mas o `WITH CHECK` novo a prende às unidades da própria
pessoa **só no ramo de auto-edição** — isso é expressável porque é propriedade
do valor novo. O ramo gestor→motorista é cópia literal do `USING` e não
restringe `unidade_id`: um gestor pode gravar qualquer valor na linha de um
motorista da sua unidade, inclusive de outro tenant. Não é regressão — sem
`WITH CHECK` nenhum, já era possível antes —, mas os dois ramos não têm a
mesma proteção.

**Efeito colateral que ninguém previu.** `WITH CHECK` é avaliado contra a
linha NOVA INTEIRA em **todo** `UPDATE`, inclusive os que não tocam
`unidade_id`. Um `UPDATE usuarios SET ultimo_login = now()` passa a exigir que
o `unidade_id` **já armazenado** esteja em `get_my_unidade_ids()`. Uma pessoa
cujo `usuarios.unidade_id` legado não esteja entre os vínculos **ativos** em
`usuario_unidades` perde a capacidade de escrever qualquer coisa no próprio
perfil — login (`src/lib/auth.ts:80`, que descarta o erro e portanto falha em
silêncio), push token, `primeira_senha`, foto, edição de perfil. Medido em
06/09/2026: zero usuários nesse estado — mas
`supabase/functions/criar-motorista/index.ts` grava `unidade_id` e, se o
vínculo em `usuario_unidades` falhar logo depois, só loga o erro e prossegue,
produzindo exatamente essa linha órfã. Alcançável por operação normal, não só
por corrupção de dado.

**Notificações.** Mesma forma: `USING (usuario_id = auth.uid())` sem
`WITH CHECK`, e o dono reescrevia `titulo`/`mensagem`/`tipo`. O app escreve
exatamente um campo (`lida`), então o grant foi reduzido a ele — o que também
protege colunas futuras por padrão.

**`incidentes_delete_optimized`.** Era a única policy de `incidentes` ainda
apoiada em `usuarios.papel` + `usuarios.unidade_id`. Isolada, negava gestor
multi-unidade legítimo; combinada com o furo acima, virava o gadget para DELETE
cross-tenant. A tradução para `usuario_unidades` é fiel de propósito — mantém a
base "gestor da unidade **da rota**" e só troca a fonte da verdade.

**Follow-up registrado, não resolvido aqui:** `incidentes_update` decide pela
unidade **do autor**, não da rota. A divergência é anterior a esta migration.

**Aplicada em 06/09/2026 — e a aplicação ensinou uma armadilha nova.**

`REVOKE UPDATE (coluna)` **não tem efeito quando o papel já tem `UPDATE` em
nível de TABELA**: no Postgres o grant de tabela subsume o de coluna, o REVOKE
vira no-op silencioso e `has_column_privilege` continua devolvendo `true`. O
`apply_migration` devolveu `success: true` e **quatro** dos itens não mudaram
nada — `usuarios.papel`, `usuarios.admin_role`, `usuarios.is_gestor_principal`
e `rotas.unidade_id` seguiam graváveis.

Só apareceu porque a verificação consulta o **efeito**, não o retorno do apply.
O item de notificações funcionou de primeira por acidente feliz: ele já revogava
a tabela e reconcedia só `lida`, que é o padrão certo.

O padrão correto, portanto, é **revogar a tabela e reconceder as colunas**,
nunca `REVOKE` de coluna isolado. As colunas reconcedidas são todas as
existentes menos as bloqueadas — sem aproveitar para apertar `id`/`created_at`,
porque quebrar uma escrita legítima em silêncio é pior que a folga.

**Também fechou a pendência 2** (`GHSA-vw63-jxg2-28vx`), parada desde dezembro
com a nota "o fix óbvio quebra o motorista". A nota estava certa sobre o fix
óbvio — um `WITH CHECK` no ramo do motorista tiraria dele a capacidade de
iniciar e concluir a própria rota. Mas o app **nunca escreve** `rotas.unidade_id`;
a unidade nasce em `criar_rota_com_paradas`, que é `SECURITY DEFINER`. Revogar a
coluna fecha o furo sem o motorista sentir.

**Verificação:** 28 checagens, 0 divergências — 4 colunas bloqueadas, `anon` sem
escrita, `service_role` intacto. A migration reconcede **31** colunas (12 em
`usuarios`, 18 em `rotas`, 1 em `notificacoes`) — vinte foram conferidas uma a
uma, as demais por reconciliação da lista do `GRANT` contra as colunas da
tabela, não individualmente. A RPC foi sondada por chamada real: sem auth
devolve `28000 Não autenticado` (linha 6) e com um `uid` falso devolve `42501`
na **linha 26**, o que prova que a consulta em `public.usuario_unidades`
executa sob `search_path = ''` — referência mal qualificada teria dado `42P01
relation does not exist`.

**Pendente, e é decisão de produto:** nenhuma das 9 unidades tem gestor
principal (0 de 16 usuários com o flag), porque nenhuma passou pelo fluxo
self-service, o único que o liga. Depois desta migration não há caminho de
`authenticated` para estabelecer o **primeiro** principal — vai exigir
`service_role` ou uma RPC de bootstrap. Não é regressão: o caminho anterior era
qualquer gestor se autopromover com um `.update()` direto, que é o buraco que o
REVOKE fecha.

**Fora de escopo, deliberadamente:** a validação de `foto_url` que alimenta a
policy de `storage.objects` — mexer nela é mexer na invariante das fotos, e não
deve viajar no mesmo lote que seis outras mudanças — e o `ativo` de `usuarios`,
que permite a alguém desfazer a própria desativação mas não escala privilégio
(o controle de acesso real usa `usuario_unidades.ativo`).

---

### ⏳ Migration 28: `motorista_locations` entra na publicação de realtime

**Arquivo:** `20260908000000_realtime_motorista_locations.sql`

**O gestor nunca viu o motorista se mover.** `useMotoristaLocationMapLibre` e
`MotoristaMarker` assinam `postgres_changes` de INSERT em
`motorista_locations`, mas a tabela nunca esteve na publicação
`supabase_realtime` — que tinha apenas `notificacoes`, `paradas` e `rotas`.
Assinatura em tabela fora da publicação é falha silenciosa exemplar: o canal
conecta, entra em `SUBSCRIBED`, e nenhum evento chega jamais. Sem erro, sem log.

**Por que passou despercebido.** Os dois componentes fazem um `SELECT` inicial
(`order by timestamp desc limit 1`) ao montar. O gestor abre o mapa, vê o
motorista lá — e o marcador congela. Só nota quem fica olhando a tela enquanto
o motorista dirige. Não é problema de segundo plano: vale igual com o app
aberto. O "Rastreamento em Tempo Real" da landing page entregava, na prática,
"posição do instante em que você abriu a tela".

**Segurança: nenhuma policy muda, e isso é o ponto.** Verificado lendo o corpo
de `realtime.apply_rls` implantado neste projeto (`pg_get_functiondef`, não a
documentação): antes de decidir quem recebe cada linha, ela roda
`set_config('role', …)` e `set_config('request.jwt.claims', …)` com os valores
**do assinante** e então executa
`SELECT EXISTS(SELECT 1 FROM motorista_locations WHERE id = <pk do WAL>)`. Quem
responde é a policy nativa da tabela — não existe regra de acesso separada para
o realtime. Cada assinante recebe exatamente as linhas que já podia ler por
consulta. `anon` falha fechado: sem claim `sub`, `auth.uid()` é NULL e os dois
ramos da policy morrem.

**⚠️ O que essa proteção NÃO cobre: DELETE.** No mesmo `apply_rls`, o ramo
`if not is_rls_enabled or action = 'DELETE'` entrega a linha a qualquer
assinatura cujo filtro de CLIENTE case, sem checar RLS. Hoje é inerte — as duas
assinaturas são `event: 'INSERT'`. Trocar por `'DELETE'` ou `'*'` desligaria o
filtro de tenant em silêncio. O invariante é do código do cliente e está
vigiado em
`src/lib/__tests__/realtime-motorista-locations-somente-insert.test.ts`.

`replica identity` fica em `default` (PK), igual a `paradas` e `rotas`: só há
assinatura de INSERT, e INSERT carrega a linha nova inteira de qualquer forma.

**Custo:** desprezível. 17.734 linhas desde 18/12/2025 (~67/dia), 8,4 MB com
índices; o custo do realtime escala com inserções por segundo e assinaturas por
inserção, não com o acumulado.

**Achados pré-existentes registrados na revisão, fora do escopo desta
migration:** não há `pg_cron` no projeto, então nenhuma retenção agendada apaga
linhas antigas de `motorista_locations`, apesar do `DELETE` que a
`007_add_notifications_and_location_tracking.sql` documenta; e a policy de
SELECT permite a qualquer membro ativo da mesma unidade — não só ao `gestor` —
ver a posição de um colega.

Revisada pelo `rls-policy-reviewer`: **APPROVE**, sem achado crítico.

### ✅ Migration 29: deduplicação de `logs` considera a parada

**Arquivo:** `20261004120000_dedup_logs_por_parada.sql` · aplicada via MCP em
04/10/2026, registrada como `20261004232921` (o MCP grava o próprio horário).

**A auditoria perdia conclusões.** `prevent_duplicate_log` (BEFORE INSERT em
`logs`) descartava log com mesmo `rota_id` + `evento` + `usuario_id` nos últimos
5 s — sem olhar a parada. Duas paradas concluídas juntas viravam um registro:
em 60 dias, **34 de 1.168** paradas concluídas (3%) ficaram sem
`parada_concluida`; 22 tinham outra conclusão da mesma rota nos 5 s anteriores e
27 eram partida/chegada, que fecham junto com outra parada. Foi o mesmo filtro
que, na 1.12.6, escondeu o log do app atrás do `log_parada_status` (pendência 12).

**O que muda:** a comparação inclui `detalhes->>'parada_id'` com
`IS NOT DISTINCT FROM`. Log sem parada (eventos de rota, gestão) compara NULL com
NULL e segue deduplicado como antes. `SECURITY DEFINER` e `search_path` mantidos;
`CREATE OR REPLACE` preserva o vínculo do trigger.

**Provas:** sonda transacional (com `RAISE EXCEPTION`, nada persistido) antes e
depois de aplicar — função antiga: paradas X e Y nos 5 s → 1 linha (o defeito);
nova: X, Y, X → 2 linhas, X repetida descartada, dois logs sem parada → 1.

**Não recupera o passado:** as 34 linhas perdidas não foram reconstruídas.

**Nota da revisão (fora do escopo):** a deduplicação é filtro de ruído, não
controle de segurança — a policy de INSERT de `logs` só exige
`usuario_id = auth.uid()`, sem checar a unidade da `rota_id`; restringir isso é
outra migration.

Revisada pelo `rls-policy-reviewer`: **APPROVE**, sem achado crítico.

### ✅ Migration 30: telefone único entre motoristas ativos

**Arquivo:** `20261020200000_motorista_telefone_unico.sql` · **aplicada em 20/10/2026**
via MCP `apply_migration`, versão no banco `20261020184140`. Antes, uma sonda
transacional (desfeita) provou a normalização dos três formatos, a busca e o
bloqueio pelo índice.

**Conta duplicada entre lojas.** O mesmo motorista cadastrado por duas lojas com
e-mails diferentes virava duas contas, cada uma com as rotas de uma loja só. O
telefone passa a ser a identidade entre motoristas **ativos**.

**O que muda:** `normalizar_telefone(text)` (`IMMUTABLE`: só dígitos, tira o `55`
com 12/13 dígitos, menos de 10 dígitos = `NULL`);
`motorista_ativo_por_telefone(text)` (`STABLE`, `SECURITY INVOKER`, só
`service_role`, para a Edge Function); índice único parcial
`usuarios_motorista_telefone_unico` (`papel='motorista' AND ativo` e telefone
normalizado não nulo). Um `DO $$` antes do índice aborta, listando os números, se
já houver duplicata ativa. Sem tabela nova e sem policy.

**Cliente:** `errorMapping` traduz o índice para "Telefone já cadastrado"
(`UNIQUE_TELEFONE_MOTORISTA`), em vez do "Registro duplicado" genérico.

### ✅ Migration 31: vínculo de motorista só pelo servidor

**Arquivo:** `20261020220000_vinculo_motorista_seguro.sql` · **✅ aplicada em
20/10/2026 pelo SQL Editor.** O SQL Editor não registra em `schema_migrations`;
a linha foi inserida depois à mão, com a versão igual ao prefixo do arquivo
(`20261020220000`, `created_by` = `sql-editor`), para o `migration list` casá-la.
O MCP `apply_migration` recusou ("declined") por causa do `DROP POLICY`/`REVOKE`:
migration com isso vai para o SQL Editor, rodada pelo gestor. Edge Function `criar-motorista` v15 publicada a partir da
mesma PR. Antes, duas sondas transacionais (desfeitas) reproduziram os ataques no
estado atual e mostraram o bloqueio no novo.

**Vínculo sem consentimento.** A policy de INSERT de `usuario_unidades` só
conferia a unidade de destino, nunca o `usuario_id`: qualquer gestor vinculava
qualquer usuário à própria loja direto pelo PostgREST (medido: gestor de B
inseriu vínculo de motorista de C). Depois do vínculo, `usuarios_update_optimized`
deixava esse gestor desativar a pessoa, trocar o e-mail ou a unidade principal
de motorista de outra empresa.

**O que muda:**

- `usuario_unidades`: as policies de INSERT/UPDATE/DELETE saem e o
  `anon`/`authenticated` perdem INSERT/UPDATE/DELETE/TRUNCATE. Escrevem só a
  Edge Function (service_role) e RPCs `SECURITY DEFINER`. O app não escrevia lá.
- `motorista_atende_outra_loja(uuid)` (uso interno): vínculo, **ativo ou não**,
  numa unidade em que `auth.uid()` não é gestor ativo. O inativo conta de
  propósito: sem isso, a última loja a desativar caía no ramo "pessoa" e
  desativava o motorista para todas.
- Trigger `trava_motorista_outra_loja` (BEFORE UPDATE em `usuarios`): para quem
  atende outra loja, o gestor só muda `nome` e `telefone`. Isentos: sem
  `auth.uid()` (service role), o próprio usuário, quem tem `admin_role`, e o
  preenchimento de `unidade_id` nulo pelo `sync_usuario_unidade_ativa`.
- `listar_motoristas_unidade(uuid)`: a lista da tela Motoristas, com o vínculo
  inativo da própria loja (a RLS de `usuarios` o esconde). Vínculo e pessoa
  inativos ao mesmo tempo ficam fora, como antes. `vinculo_ativo` avisa a tela
  de que perfil e edição não abrem nesse estado (a mesma RLS os bloqueia).
- `alternar_motorista_na_unidade(uuid, uuid, boolean)`: o toggle. Quem atende
  outra loja é desativado só nesta loja (o vínculo); quem atende uma só, a
  pessoa, como antes. Reativar pessoa inativa que atende outra loja → suporte.

**Junto, na Edge Function `criar-motorista`:** e-mail que já tem conta vira 409
(não vincula mais), sai o `listUsers` + `deleteUser` de "órfão", e a loja do
cadastro é a `unidade_id` do body, exigindo vínculo de gestor ativo nela (app
antigo, sem o campo, cai na `usuarios.unidade_id`). Vínculo que falha desfaz a
conta criada. **Ordem de deploy:** migration primeiro, função em seguida — a
função nova não depende da migration, mas o app novo depende das duas RPCs.

**Fica de fora:** o ramo "próprio usuário" de `usuarios_update_optimized` ainda
aceita `ativo`/`unidade_id`, e o do gestor aceita `unidade_id` arbitrário para
motorista de uma loja só (nenhuma policy lê `get_user_unidade()` hoje).

Revisada pelo `rls-policy-reviewer`: **APPROVE**; os warnings da trava com o
`sync_usuario_unidade_ativa` e da corrida do toggle (`FOR UPDATE`) foram
incorporados.

### ⏳ Migration 32: push sem a service_role antiga, extensão http fechada

**Arquivo:** `20261022120000_push_sem_service_role_e_http_fechado.sql` · **⏳ a
aplicar pelo SQL Editor** (tem `REVOKE` e `DROP TRIGGER`, que o MCP recusa).
Depois de aplicada, inserir a linha em `schema_migrations` com a versão
`20261022120000`, como na Migration 31.

**Por quê.** Em 22/10/2026 a `service_role` (JWT do segredo legado) apareceu no
histórico do repositório público — e embutida no webhook "send-push-notification"
do painel. As chaves antigas foram desligadas; as Edge Functions passaram a ler
`SUPABASE_SECRET_KEYS`/`SUPABASE_PUBLISHABLE_KEYS` (`_shared/chaves.ts`).

**O que faz.**

1. Apaga o webhook do painel (chave em texto puro; cada push saía em dobro) e faz
   do gatilho `send_push_notification_trigger` (pg_net) o único caminho, com o
   cabeçalho `x-push-secret` lido do Vault (`push_webhook_secret`). O gatilho
   repassa todo insert — antes filtrava 4 dos 17 tipos, e o push só funcionava
   porque o webhook mandava todos.
2. Revoga EXECUTE de PUBLIC/anon/authenticated nas funções da extensão `http`
   (`http_get`, `http_post`, ...), que `anon` chamava por `/rest/v1/rpc`. Nada no
   projeto as usa.
3. `criar_notificacao`: na chamada direta (RPC), só gestor ativo, só para quem é
   ativo numa loja onde ele é gestor; rota (se vier) da loja dos dois; parada (se
   vier) da rota informada. Os gatilhos `notify_*` não passam pela trava
   (`pg_trigger_depth() > 0`) — e o `rls-policy-reviewer` achou dois deles que
   aceitam dado do usuário (SOS forjado em `logs`; `motorista_id` de outra loja
   em `rotas`): push entre empresas por esse caminho continua aberto, pré-existente,
   e é a Migration 33.

**Pré-requisitos, nesta ordem:** segredo `push_webhook_secret` no Vault igual ao
secret `PUSH_WEBHOOK_SECRET` das Edge Functions; `send-push-notification`,
`expire-routes` e `remind-routes` publicadas com `verify_jwt` desligado.

**Verificação.** Sonda transacional (desfeita) em 22/10, 6 casos: gestor → motorista
da mesma loja cria; gestor → outra loja, rota de outra loja, parada de outra rota e
motorista → gestor recusam. Revisão do `rls-policy-reviewer`: APPROVE.

### ✅ Migration 33: gatilhos `notify_*` sem push entre empresas

**Arquivo:** `20261022180000_gatilhos_notify_sem_push_entre_empresas.sql` · **✅ aplicada
em 22/10/2026 pelo SQL Editor** (tem `ALTER POLICY` e `REVOKE`, que o MCP recusa) e
registrada depois em `schema_migrations` com a versão `20261022180000`.

**Por quê.** A trava da Migration 32 não vale para os gatilhos
(`pg_trigger_depth() > 0`), e dois deles tiram o destinatário de dado do usuário:

1. `logs` → `notify_sos_acionado`: a policy de INSERT só exigia
   `usuario_id = auth.uid()`. Qualquer logado gravava `sos_acionado` com o
   `rota_id` de outra loja e o `motivo` que quisesse, e o gestor daquela loja
   recebia "SOS - EMERGÊNCIA" com esse texto.
2. `rotas` → `notify_motorista_nova_rota(_insert)`: nada conferia o
   `motorista_id`. O gestor da loja A atribuía um motorista da loja B e o
   gatilho dava push nele.

**O que faz.**

- Gatilho `trg_validar_motorista_e_loja_da_rota` (BEFORE INSERT/UPDATE OF
  `motorista_id`, `unidade_id`): `motorista_id` não nulo exige vínculo
  `motorista` ativo na `unidade_id` da rota — o critério da RPC
  `criar_rota_com_paradas` e do modal de troca de motorista. No UPDATE só
  confere quando uma das duas colunas muda: rota antiga cujo motorista perdeu o
  vínculo segue concluindo e expirando. Vale também para a service role.
- `logs_insert_optimized` passa a exigir, quando há `rota_id`, que o autor seja
  o motorista da rota ou tenha vínculo ativo (qualquer papel) na loja dela, via
  `pode_registrar_log_na_rota(uuid)` (SECURITY DEFINER, para não depender da RLS
  de `rotas`). Gatilhos e RPCs que gravam em `logs` são de `postgres` e ignoram
  a RLS.

`unidade_id` não muda pelo cliente: `authenticated` não tem UPDATE nessa coluna
(medido na sonda).

**Verificação.** Medido antes: 0 logs com rota seriam recusados; 3 rotas antigas
(fechadas) com vínculo inativo, que a guarda não afeta. Sonda transacional
(desfeita) em 22/10: controle com a regra atual reproduz os dois ataques (push
para o motorista de outra empresa; SOS forjado chega ao gestor). Com a migration:
atribuir, criar ou reatribuir para motorista sem vínculo na loja recusa, com 0
notificação; reatribuir para motorista de duas lojas, tirar o motorista, iniciar
a rota, a RPC e a rota antiga de vínculo inativo seguem; a regra de `logs`
aceita motorista da rota, gestor e colega da loja, e recusa outra empresa e rota
inexistente. O `ALTER POLICY` não roda pelo MCP: a policy em si se confere
depois de aplicar, com o roteiro do PR. Revisão do `rls-policy-reviewer`:
APPROVE (avisos não bloqueantes: o gatilho não confere `usuarios.ativo`, ao
contrário da RPC; a regra de `logs` aceita vínculo de qualquer papel, então um
membro da loja ainda grava SOS na rota de um colega da mesma loja).

**Depois de aplicada (22/10/2026),** sonda pós-aplicação (desfeita): a policy de
`logs` recusa o SOS e o log de gestor de outra empresa e aceita o SOS do motorista
da rota, o log do gestor, o do colega da loja e o log sem rota; reatribuir para
motorista de outra empresa recusa, com 0 notificação para ele; o SOS legítimo chega
ao gestor (1 notificação).

### ✅ Migration 34: incidente avisa o gestor da loja da rota

**Arquivo:** `20261022200000_incidente_avisa_loja_da_rota.sql` · **✅ aplicada em
22/10/2026** pelo `apply_migration` do MCP (só `CREATE OR REPLACE FUNCTION`).

**Por quê.** `notify_incidente_criado` escolhia a loja pelo vínculo principal do
motorista e ignorava a rota do incidente. Com motorista de duas lojas
(Migration 31), o incidente de uma rota da loja A ia para o gestor da loja B. E
os motoristas de duas lojas não têm vínculo principal marcado, então a loja
avisada saía do `LIMIT 1` sem ordem — arbitrária.

**O que faz.** Se o incidente traz `rota_id` e a rota é do próprio motorista, a
loja é a da rota. Senão, o comportamento de antes (vínculo principal, depois
qualquer vínculo ativo). A conferência do motorista existe porque
`incidentes_insert` só exige `motorista_id = auth.uid()`: um `rota_id` alheio não
pode levar o texto ao gestor de outra empresa. Pelo mesmo motivo, a notificação
só leva `rota_id` quando a rota foi aceita.

**Verificação.** Medido antes: 26 incidentes, 23 com rota, todos de rota do
próprio motorista e da loja que o gatilho escolhia — nenhum caiu no caso errado
ainda. Sonda transacional (desfeita) em 22/10, motorista de duas lojas, função
atual x nova: rota da loja A → gestor B (atual) / gestor A (nova); rota da loja B
→ gestor B nas duas; rota de outra empresa → gestor B com o link da rota alheia
(atual) / gestor B sem link (nova); sem rota → gestor B nas duas.
Revisão do `rls-policy-reviewer`: APPROVE (pendência fora do escopo: o `LIMIT 1`
do gestor segue sem ordem — loja com dois gestores ativos avisa um só, arbitrário).

**Depois de aplicada,** a mesma sonda contra a função viva deu o resultado da
função nova (rota A → gestor A; rota B → gestor B; rota alheia → gestor B sem
link; sem rota → gestor B), sem resíduo.

**Drift esperado, não é erro:** arquivo `20261022200000`, registro remoto
`20261022063859`.

### ✅ Migration 35: avisos da loja vão a todos os gestores ativos

**Arquivo:** `20261022210000_aviso_a_todos_os_gestores.sql` · **✅ aplicada em
22/10/2026 pelo SQL Editor** (tem `REVOKE`, que o MCP recusa) e registrada depois em
`schema_migrations` com a versão `20261022210000`.

**Por quê.** Os seis gatilhos que avisam o gestor (`notify_sos_acionado`,
`notify_incidente_criado`, `notify_parada_pulada`, `notify_parada_reaberta`,
`notify_rota_iniciada`, `notify_rota_concluida`) escolhiam o destinatário com
`SELECT ... LIMIT 1` sem ordem: numa loja com dois gestores ativos, só um
recebia, a critério do plano de execução — um SOS podia nunca chegar ao outro.

**O que faz.** Todos os gestores com vínculo ativo na loja recebem, pelo helper
`gestores_ativos_da_unidade(uuid)` (fonte única do critério; EXECUTE só para os
gatilhos). O critério não muda: vínculo `gestor` ativo. Loja com um gestor só
(todas, hoje) fica idêntica. `get_gestor_contato` e `get_gestor_principal`
devolvem um contato por desenho e ficam como estão.

**Verificação.** Medido antes: nenhuma loja com mais de um gestor ativo; 3 lojas
paradas desde 02/2026 têm como único gestor uma pessoa com `usuarios.ativo =
false` e seguem recebendo (o critério não passou a exigir `usuarios.ativo`).
Sonda transacional (desfeita) em 22/10, com um segundo gestor ativo na loja e os
seis eventos disparados: com as funções atuais, o segundo gestor recebeu 0 dos 6
avisos; com as novas, os dois receberam cada um 1 de cada.

**Depois de aplicar,** conferir que o helper é de `postgres` e que `postgres` tem
EXECUTE nele (consultas no cabeçalho do arquivo): os gatilhos rodam como
`postgres`, e sem esse EXECUTE a falha derruba a operação que disparou o aviso.
Revisão do `rls-policy-reviewer`: APPROVE (diff linha a linha contra os corpos
vivos: só o bloco do gestor mudou).

**Depois de aplicada,** helper com dono `postgres`, EXECUTE para `postgres` e não
para `anon`/`authenticated`; os seis gatilhos usam o helper e não sobrou `LIMIT 1`.
Sonda (desfeita) com os eventos disparados como `authenticated`: os seis passaram
e avisaram os dois gestores; o helper chamado direto por `authenticated` é recusado.

### ✅ Migration 36: remove `get_gestor_principal` (morta e quebrada)

**Arquivo:** `20261022220000_remove_get_gestor_principal.sql` · **✅ aplicada em
22/10/2026 pelo SQL Editor** (`DROP FUNCTION`, que o MCP recusa) e registrada
depois em `schema_migrations` com a versão `20261022220000`. Conferido: a função
não existe mais; `get_gestor_contato` e `transferir_gestao_principal` seguem.

**Por quê.** A função estava executável por `PUBLIC` e `anon` (apontado pelo
`rls-policy-reviewer` na revisão da Migration 35). Medido em produção: não é
SECURITY DEFINER e está quebrada — `search_path ''` com `usuarios` sem prefixo,
então toda chamada falha com `relation "usuarios" does not exist`, até como
`postgres`. Ninguém a usa: nenhum chamador no repositório, em função, policy ou
view; `pg_depend` sem dependentes; nenhuma chamada pela API nos logs de 24 h.

**O que faz.** `DROP FUNCTION public.get_gestor_principal(uuid)`. O conceito de
gestor principal segue em `get_gestor_contato` e `transferir_gestao_principal`,
que não dependem dela. O rollback recria a versão consertada, só para
`service_role`.

Provável origem da quebra: `tools/scripts/db/fix-function-search-path.cjs` aplica
`search_path ''` às cegas, e o corpo não tinha prefixo. A função saiu da lista do
script. Revisão do `rls-policy-reviewer`: APPROVE (conferiu prosrc de todos os
schemas, views, policies, gatilhos e `pg_depend`; das 37 funções com `search_path
''`, só esta lia `usuarios` sem prefixo).

### ✅ Migration 37: retenção de `motorista_locations` (90 dias)

**Arquivo:** `20261022230000_retencao_localizacoes_90_dias.sql` · **✅ aplicada em
22/10/2026 pelo SQL Editor** e registrada depois em `schema_migrations` com a
versão `20261022230000`. Conferido: `prosecdef` true, `search_path=public`,
`proacl` só `postgres` e `service_role` (`anon`/`authenticated` sem EXECUTE);
`cleanup_old_locations` não existe mais.

**Por quê.** A tabela recebe uma posição a cada ~5 s em movimento e nunca era
apagada: 67.090 linhas (22 MB) em 22/10/2026, desde 18/12/2025. Ninguém lê o
histórico — o app só usa a posição mais recente, para o mapa ao vivo
(`useMotoristaLocationMapLibre`, `MotoristaMarker`). Também é a base da
declaração de localização em segundo plano da Play (pendência 10): os dados têm
prazo.

**O que faz.** `limpar_localizacoes_antigas(p_dias integer DEFAULT 90)`,
SECURITY DEFINER, só para `service_role`. Apaga as posições das rotas
`concluida`, `cancelada` e `nao_executada` cujo `rotas.data` ficou mais de
`p_dias` para trás; pendente e em andamento nunca perdem posição. Piso de 30
dias (abaixo disso, exceção). Devolve quantas apagou. Prazo de 90 dias decidido
pelo gestor em 22/10/2026. Na primeira execução, ~12.900 linhas.

**Quem chama.** Não há `pg_cron` no projeto: a Edge Function `expire-routes`
(cron do GitHub, 22:00 BRT) chama a função depois da expiração e devolve
`localizacoes_apagadas`; falha na limpeza só vai ao log, sem derrubar a
expiração (guarda `expire-routes/__tests__/retencaoLocalizacoes.test.ts`).
Publicar a função depois de aplicar a migration — antes disso a chamada só
registra erro no log.

**Também remove `cleanup_old_locations()`** (Migration 007): sem chamador,
apagava tudo com mais de 24 h (contradiz a retenção) e seguia executável por
PUBLIC/anon/authenticated — o RLS barrava o DELETE. Saiu também da lista de
`tools/scripts/db/fix-function-search-path.cjs`. Revisão do
`rls-policy-reviewer`: APPROVE (privilégios cobrem os grants default; `rotas.data`
é NOT NULL; nenhum leitor do histórico no app ou no banco).

**Sonda.** O MCP recusa `DELETE` mesmo dentro de transação desfeita; a sonda
rodou no SQL Editor (bloco `DO` que cria a função, mede e termina em `RAISE`):
67.204 → 54.319 linhas, esperado 12.885 = apagadas 12.885; posições de rotas
pendente/em andamento 2.803 → 2.803 e dos últimos 90 dias 54.319 → 54.319
(intocadas); `p_dias = 7` barrado pelo piso.

### ✅ Migration 38: endurece `usuarios`, fotos de perfil/incidente, `incidentes` e grants

**Arquivo:** `20261023000000_endurece_usuarios_storage_incidentes.sql` · **✅
aplicada pelo SQL Editor em 23/10/2026** (tem `DROP POLICY`, `ALTER POLICY` e
`REVOKE`, que o MCP recusa) e registrada depois em `schema_migrations` com a versão
`20261023000000`. Sonda: todas as linhas OK (2c = SKIP, sem atacante com foto
própria). Conferência pós-aplicação: 8/9 como esperado; o `REVOKE` em
`spatial_ref_sys` não teve efeito, como previsto — resolvido desligando o PostGIS no
painel.

**Por quê.** Auditoria de segurança de 22/10/2026:
(a) a policy `usuarios_insert_optimized` deixava qualquer gestor ativo criar perfil
com qualquer `papel`/`admin_role`/`unidade_id`; (b) `spatial_ref_sys` (PostGIS) sem
RLS e com escrita para `anon`/`authenticated`; (c) a leitura de `perfis/` e
`incidentes/` no bucket `fotos-entrega` valia para qualquer objeto referenciado por
um `foto_url` visível — e o próprio usuário grava o seu, então bastava gravar o path
da foto de outra pessoa; (d) incidente aceitava `rota_id`/`parada_id` de qualquer
rota; (e) helpers de RLS executáveis por `PUBLIC`/`anon`, views `vw_*` com escrita
para `authenticated`, FK `rascunhos_rota.unidade_id` sem índice.

**O que faz.** (a) `DROP POLICY usuarios_insert_optimized` + `REVOKE INSERT` de
`anon`/`authenticated` — os únicos INSERT legítimos são da `criar-motorista` (chave
secreta) e da RPC `criar_unidade_para_novo_gestor` (SECURITY DEFINER). (b) `REVOKE`
de escrita em `spatial_ref_sys`; **provavelmente sem efeito** (tabela e grants de
`supabase_admin`, `postgres` sem grant option) — a migration avisa com `WARNING`. O
PostGIS não é usado (0 colunas geo, 0 funções/views com `ST_*`): a correção real é
desligá-lo no painel (Database → Extensions). (c) A policy de SELECT das fotos passa
a exigir que a linha que referencia o objeto seja do dono do objeto (`usuarios.id` /
`incidentes.motorista_id` = `owner`/`owner_id`). (d) Gatilho
`incidentes_confere_rota_parada`: rota do próprio motorista, parada da própria rota;
no UPDATE cada ligação só é conferida se mudou, e virar NULL nunca é recusado (o
`ON DELETE SET NULL` das duas FKs, em ordem não garantida, não bloqueia apagar a
rota — achado do `rls-policy-reviewer`). (e) As 4 policies que chamam os helpers
passam de `public` para `authenticated` (anon segue com 0 linhas, em vez de
"permission denied"), e o EXECUTE dos 5 helpers sai de `PUBLIC`/`anon`; views sem
escrita; índice `idx_rascunhos_rota_unidade_id`.

**Medido antes (23/10/2026, só SELECT):** 3/3 fotos de perfil e 9/9 de incidente
com o dono do objeto igual ao dono da linha (nenhuma foto legítima deixa de abrir);
0 incidentes com rota de outro motorista ou parada fora da rota; nenhuma função
SECURITY INVOKER nem view chama os helpers; o app não insere em `usuarios`.

**Depois de aplicar:** roteiro de conferência no fim do arquivo (9 consultas) e a
sonda `database/sondas/20261023000000_sonda_migration38.sql` (termina em `RAISE`,
desfaz tudo; esperado "OK" em todas as linhas).

### ✅ Migration 39: token de push pertence a uma conta só

**Arquivo:** `20261023010000_push_token_de_uma_conta_so.sql` · **✅ aplicada em
23/10/2026 via `apply_migration`** (PR #629), versão alinhada ao arquivo em
`schema_migrations`. Antes, a sonda rodou junto com a migration numa transação
só, desfeita pelo `RAISE`: positivo e negativos 0–4 como esperado. Recria a
trava `trava_motorista_outra_loja` (idêntica à viva + o bloco da marca).

**Por quê.** O app gravava o token direto na linha da conta logada. Se o logout
de A não limpou a linha (offline, sessão vencida) e B entrou no mesmo aparelho,
as duas linhas ficavam com o mesmo token. A RLS impede B de limpar a linha de A,
então só o servidor resolve.

**O que faz.** `registrar_push_token(p_token text)`, SECURITY DEFINER,
`search_path = ''`, EXECUTE só para `authenticated`: exige `auth.uid()` e token
no formato Expo (até 200 caracteres), trava por token
(`pg_advisory_xact_lock`), grava primeiro na própria linha (sem perfil em
`usuarios`, exceção — não tira o token de ninguém) e só então zera
`push_token = p_token` das outras contas. O app registra por ela
(`registerPushToken` em `src/lib/notifications.ts`) e, se a função ainda não
existir (PGRST202), cai no UPDATE direto antigo — não depende da ordem de
deploy. A `trava_motorista_outra_loja` (Migration 31) aceita a mudança que só
zera o `push_token` **apenas** com a marca da RPC (`rotamestre.push_rpc` da
transação); UPDATE direto de gestor segue recusado, e o logout do próprio
usuário não passa por ali (o atalho `auth.uid() = id` vem antes). Sem UNIQUE em
`push_token` de propósito (quebraria o registro das versões antigas). Em
23/10/2026: 7 tokens, todos distintos. Revisão do `rls-policy-reviewer`:
APPROVE (trava idêntica à viva + bloco novo); ajustes dele incorporados.

**Sonda.** Bloco `DO` comentado no fim do arquivo (rodar depois de aplicar;
termina sempre em `RAISE`): A = motorista ativo em duas lojas ou mais, B =
gestor de uma delas que não é gestor de todas (confirmado com
`motorista_atende_outra_loja` sob as claims de B; sem esse par, `SKIP` explícito).
B registra o token que está em A → A fica sem token, B com ele. Negativos, como
postgres com as claims de B (exercitam a trava, não a RLS): (0) UPDATE direto
sem a marca da RPC que só zera o token de A → recusado; (1) gravar token em A e
(2) zerar junto com o nome → recusados mesmo com a marca; (3) RPC sem
`auth.uid()` → 42501; (4) `anon` sem EXECUTE; token fora do formato recusado.
Sintaxe validada com o parser do Postgres (libpg-query).

termina sempre em `RAISE`): B registra o token que está num motorista A (com
vínculo) de loja onde B não é gestor → A fica sem token, B com ele. Negativos:
gravar token em A e zerar junto com o nome são recusados pela trava mesmo com a
marca; RPC sem `auth.uid()` → 42501; `anon` sem EXECUTE; token fora do formato
recusado. Sintaxe validada com o parser do Postgres (libpg-query).

termina em `RAISE`): B registra o token que está num motorista A de loja onde B
não é gestor → A fica sem token, B com ele; token fora do formato é recusado.

### ✅ Migration 40: RPC `finalizar_rota` (rota e chegada numa transação)

**Arquivo:** `20261023100000_finalizar_rota_rpc.sql` · **✅ aplicada em
23/10/2026 via `apply_migration`, antes do merge** do PR da Onda C (#630,
carregamento da rota do motorista), com a versão alinhada ao arquivo em
`schema_migrations`. Sonda rodada antes: os 6 casos como esperado e as contagens
de aviso/log iguais após a 2ª chamada (idempotente). O número 40
segue a ordem de aplicação (38 e 39 são de outras ondas); o prefixo do arquivo
não muda.

**Por quê.** O app finalizava em dois UPDATEs do cliente (rota, depois checkpoint
de chegada, com o erro deste ignorado) e conferia as paradas pendentes só na
lista em memória — que vinha vazia quando a consulta das paradas falhava, e a
rota aparecia "pronta para finalizar". O rastreamento também parava antes do
UPDATE: uma falha deixava a rota em andamento sem rastreamento.

**O que faz.** `finalizar_rota(p_rota_id uuid)`, SECURITY DEFINER,
`search_path = public`, EXECUTE só para `authenticated` (REVOKE de PUBLIC/anon).
Trava só a rota do próprio motorista (dono no `WHERE`, `FOR NO KEY UPDATE`):
"não existe" e "não é sua" caem no mesmo `NOT FOUND` → `ROTA_NAO_ENCONTRADA`. Rota
já `concluida` do próprio motorista retorna **sem erro** (idempotente: a resposta
da 1ª chamada pode se perder com sinal ruim e o motorista toca de novo). Fora
isso, exige `em_andamento`; trava as paradas da rota (`FOR NO KEY UPDATE`) e só então
conta as reais (`is_checkpoint` verdadeiro ou nulo) `pendente`/`em_andamento`;
conclui o checkpoint de chegada (maior `ordem` com `is_checkpoint = false`) e a
rota (`concluida_em = now()`). Cada recusa começa por uma sentinela
(`NAO_AUTENTICADO`, `ROTA_NAO_ENCONTRADA`, `ROTA_NAO_EM_ANDAMENTO`,
`ROTA_PARADAS_PENDENTES`) que `src/lib/errorMapping.ts` traduz para o motorista
(guarda: `src/lib/__tests__/rpc-finalizar-rota.test.ts`). Os gatilhos de log e de
aviso ao gestor disparam como antes. No app, `completeRoute` (`useRouteActions.ts`)
chama a RPC e só depois para o rastreamento.

**Alcance da trava das paradas.** Trava de linha não impede INSERT de linha nova.
Ela serializa com reabertura de parada (UPDATE) e com `inserir_parada`, que
sempre move o checkpoint de chegada antes de inserir; um INSERT direto em
`paradas` (sem a RPC) ao mesmo tempo ainda passaria — fechar isso exige mexer em
`inserir_parada`/policy de INSERT, fora desta migration. As travas são `FOR NO
KEY UPDATE`, nunca `FOR UPDATE`: o INSERT de `inserir_parada` pega `FOR KEY SHARE`
na rota pela FK, e `FOR UPDATE` conflitaria com ele (deadlock gestor-insere x
motorista-finaliza, apontado pelo `rls-policy-reviewer`); nenhuma chave muda aqui.

**Verificação.** Sonda transacional (desfeita) a rodar antes de aplicar: rota com
parada pendente → recusa; outro motorista → recusa; `anon` → sem permissão; sem
pendente → conclui (rota e chegada); 2ª chamada do dono → sucesso sem novo aviso
nem log; rota cancelada → recusa. Conta avisos `rota_concluida` e logs
`motorista_concluiu_rota`/`parada_concluida` depois da 1ª e da 2ª chamada.

### ✅ Migration 41: rota em andamento não se apaga

**Arquivo:** `20261023110000_rota_em_andamento_nao_se_apaga.sql` · **✅ aplicada
em 23/10/2026 via `apply_migration`** (gatilho com `CREATE OR REPLACE TRIGGER`,
sem `DROP TRIGGER`), versão alinhada em `schema_migrations`. A sonda tem
`DELETE` e rodou pelo SQL Editor: os 4 casos OK (em andamento bloqueado com a
sentinela, pendente apagado, cascata sem usuário passa, sem EXECUTE para
`authenticated`/`anon`).

**Por quê.** A política `rotas_delete` deixa o gestor ativo da loja apagar
qualquer rota dela, inclusive a que um motorista está fazendo — e o DELETE leva
em cascata paradas, registros de comprovante, notificações e posições. O
dashboard desktop fazia isso até o PR #631. O app agora reconsulta o status e
condiciona o DELETE, mas só no cliente.

**O que faz.** Gatilho `BEFORE DELETE` em `rotas`
(`recusa_apagar_rota_em_andamento`, SECURITY DEFINER, `search_path ''`, sem
EXECUTE para PUBLIC/anon/authenticated) que recusa com a sentinela
`ROTA_EM_ANDAMENTO` (P0001) quando `OLD.status = 'em_andamento'` e há usuário
(`auth.uid()` não nulo). Sem usuário — service_role, SQL Editor, e a cascata de
`unidades` (que só acontece por service_role: `unidades` não tem política de
DELETE) — segue livre. O app traduz a sentinela em `errorMapping`
(`ROUTE_IN_PROGRESS`) e em `excluirRota`.

**Alternativa descartada:** `status <> 'em_andamento'` na política. A RLS recusa
DELETE sem erro (0 linhas), e trocar política exige DROP POLICY.

**Sonda** (bloco `DO` que cria função e gatilho, monta unidade e rotas próprias
e termina em `RAISE`): autenticado apagando rota em andamento é recusado com a
sentinela; autenticado apaga pendente (1 linha); sem usuário, a cascata da
unidade apaga a rota em andamento; `authenticated`/`anon` sem EXECUTE.

### ✅ Migration 42: incidentes visíveis ao gestor só na loja da rota

**Arquivo:** `20261023120000_incidentes_visiveis_so_na_loja_da_rota.sql` · **✅
aplicada em 23/10/2026 via `apply_migration`** (o MCP aceita `ALTER POLICY`),
versão alinhada ao arquivo em `schema_migrations`. Antes, a migration e a sonda
rodaram numa transação só, desfeita pelo `RAISE`: os 17 casos OK.

**Por quê.** `incidentes_select` e `incidentes_update` liberavam ao gestor todo
incidente de motorista com vínculo ativo numa loja dele. Com motorista que
atende duas lojas (Migration 31), o gestor de uma loja via e alterava os
incidentes das rotas da outra — e a foto deles, porque o ramo `incidentes/` da
policy "fotos-entrega select" depende da visibilidade do incidente. A
`incidentes_delete_optimized` já filtrava pela loja da rota.

**O que faz.** `ALTER POLICY` nas duas (nomes mantidos, `public` →
`authenticated`), com a mesma expressão em USING e WITH CHECK: o próprio
motorista; incidente com rota → gestor ativo da loja da rota; incidente sem rota
→ a regra antiga (vínculo do motorista). O WITH CHECK impede o gestor de mover
o incidente para a rota de outra loja (o gatilho da Migration 38 só exige que a
rota seja do motorista). A policy de fotos não muda: herda a restrição.

**Incidente sem rota.** Medido em 23/10/2026: 3 de 26 (2 abertos), todos de
27/12/2025 e de motoristas com 2 lojas ativas — continuam visíveis aos gestores
das duas lojas. Escondê-los do gestor (só o motorista veria) deixaria incidente
sem ninguém para resolver: o app grava incidente sem rota (`useIncidentSubmit`).
A correção completa é gravar a loja no próprio incidente (`unidade_id`
preenchida por gatilho a partir da rota, ou da única loja ativa do motorista),
que sobrevive ao `ON DELETE SET NULL` da rota — pendente. Até lá, o
`rota_id` pode virar NULL depois do fato (rota apagada, ou o próprio gestor da
loja ou o motorista zerando o campo; o gatilho da Migration 38 aceita NULL), e o
incidente volta à regra antiga — visível também à outra loja do motorista
(achado do `rls-policy-reviewer`). Não é leitura cruzada espontânea: exige ação
de quem já tinha acesso ao incidente.

**App.** Nada depende de ver incidente de rota de outra loja:
`useIncidentesGestor` e o contador do dashboard filtram por motoristas da loja
ativa e passam a receber só os da loja; a timeline da rota consulta por
`rota_id`. Fica de fora (não é de segurança): um gestor de duas lojas, com a
loja A aberta, ainda vê na lista os incidentes das rotas da loja B do mesmo
motorista, porque o filtro do app é por motorista e não pela loja da rota.

**Verificação.** Guarda estática `database/__tests__/migration42-incidentes-por-loja.test.ts`;
sonda transacional `database/sondas/20261023120000_sonda_migration42.sql` (cenário
próprio: lojas A/B/C, motorista em A e B; 11 casos, termina em `RAISE`). O
roteiro de conferência só com SELECT está no fim da migration.

### ✅ Migration 43: o incidente grava a própria loja

**Arquivo:** `20261024000000_incidente_com_loja.sql` · **✅ aplicada em
23/10/2026 via `apply_migration`, antes do merge do PR** (o app passa a filtrar
por `incidentes.unidade_id`). Antes, a migration e a sonda rodaram juntas no SQL
Editor numa execução só, desfeita pelo `RAISE` (a sonda tem `DELETE` de linhas
próprias): os 14 casos OK. Gatilho com `CREATE OR REPLACE TRIGGER`. Conferido
depois: 26/26 incidentes com loja, helper e função do gatilho sem `EXECUTE` para
`anon`/`authenticated`, versão alinhada em `schema_migrations`.

**Por quê.** A Migration 42 decide a visibilidade pela loja DA ROTA. Incidente
sem rota (o app grava sem rota quando não há rota aberta; e a FK da rota é `ON
DELETE SET NULL`) não tinha loja para olhar e seguia o vínculo do motorista —
com motorista de duas lojas, valia para as duas.

**O que faz.** Coluna `incidentes.unidade_id` (FK `ON DELETE CASCADE`, como
`rotas.unidade_id`, + índice). Helper `unidade_do_incidente(motorista, rota)`
(SECURITY DEFINER, sem EXECUTE para a API), fonte única do critério: a loja da
rota; sem rota, o vínculo ativo do motorista — o único; com vários, o principal,
depois o de `usuarios.unidade_id`, depois o mais antigo; sem vínculo, NULL (só o
motorista vê). Gatilho `BEFORE INSERT OR UPDATE` `incidentes_define_unidade`:
no INSERT a loja é sempre a do helper (o cliente não escolhe); no UPDATE só muda
quando a rota muda para outra rota (ou a loja ainda estava vazia) — o `SET NULL`
da rota apagada **não** muda a loja. Backfill pelo mesmo helper antes do
gatilho. `incidentes_select`/`incidentes_update` (USING = WITH CHECK) e
`incidentes_delete_optimized` passam a `TO authenticated` com "próprio motorista
ou gestor ativo da loja gravada" (o DELETE segue só do gestor); sai o ramo
"rota_id IS NULL → vínculo". `notify_incidente_criado` avisa os gestores de
`NEW.unidade_id`, a mesma loja que vai enxergar o incidente (antes, sem rota,
vínculo principal ou `LIMIT 1` sem ordem).

**Decisão: várias lojas e sem rota.** O servidor escolhe, o app não manda
`unidade_id`. O app do motorista não tem loja ativa (o seletor é do gestor), as
versões nativas instaladas não mandariam o campo, e o valor do cliente teria de
ser validado de qualquer jeito. Recusar o INSERT perderia o incidente; NULL
visível a todas as lojas é o que a migration fecha.

**Alternativas.** (1) Gatilho que "congela" `rota_id`: a rota apagada deixa de
existir — o id não diz mais a loja, recusar o `SET NULL` bloquearia apagar a
rota, e não cobre o incidente que nasce sem rota. (2) View com a loja derivada:
não há de onde derivar a loja do incidente sem rota, e a tabela seguiria exposta
pela API. (3) Coluna + gatilho (escolhida): a loja é fato do momento do
incidente, sobrevive à rota, e a policy fica mais simples (um EXISTS por
índice, sem JOIN em `rotas`).

**Efeito em outras peças.** A policy "fotos-entrega select" (ramo
`incidentes/`, Migration 38) não muda: lê `incidentes` com o RLS de quem pede e
herda a regra. O gatilho `incidentes_confere_rota_parada` (Migration 38) não
muda e roda antes deste (ordem alfabética dos BEFORE), então a rota já está
conferida quando a loja é lida dela.

**Medido em 23/10/2026 (só SELECT).** 26 incidentes, 23 com rota (todos de rota
do próprio motorista; nenhuma rota sem loja) e 3 sem rota — os três do mesmo
motorista, de 27/12/2025, com dois vínculos ativos e nenhum principal;
`usuarios.unidade_id` aponta uma das duas, que é também a loja de todas as rotas
dele entre 24 e 28/12/2025. O critério, calculado por SELECT, dá loja a 26/26 e
essa loja aos 3. Efeito colateral: o backfill renova `updated_at` das 26 linhas
(gatilho `update_incidentes_updated_at`; o app não exibe esse campo).

**App.** `useIncidentesGestor`, o histórico do motorista (`useIncidentesModals` →
`fetchIncidentesForGestor`) e o contador do dashboard filtram por `unidade_id` da
loja ativa — antes, um gestor de duas lojas via na lista os incidentes sem rota
do motorista nas duas. O INSERT (`useIncidentSubmit`) não muda.

**Verificação.** Guarda estática `database/__tests__/migration43-incidente-com-loja.test.ts`;
sonda `database/sondas/20261024000000_sonda_migration43.sql` (lojas A/B/C,
motorista em A e B e outro só em A; 14 casos, inclusive apagar a rota e
conferir que a loja fica; tem `DELETE` só de linhas que ela cria, então roda no
SQL Editor; termina em `RAISE`). Roteiro de conferência só com SELECT (9
consultas) no fim da migration.

### ✅ Migration 45: o token de push mora em `push_tokens`, visível só ao dono

**Arquivo:** `20261024020000_push_tokens_so_do_dono.sql` · **✅ aplicada em
23/10/2026 pelo SQL Editor**, depois de publicada a `send-push-notification` v15;
sonda rodada e conferência 1–8 ok; versão registrada à mão em `schema_migrations`.
Rodar pelo **SQL Editor** (tem `REVOKE`, que o MCP recusa), numa execução só.
**Ordem: publicar `send-push-notification` ANTES** — sem a tabela ela lê a
coluna antiga (fallback em 42P01/PGRST205); a função velha depois da migration
leria a coluna vazia e o push pararia. `SET LOCAL lock_timeout = '5s'`: se
algum lock em `usuarios` demorar, a migration falha inteira em vez de
enfileirar a API — rodar de novo num horário calmo. Absorve a limpeza de
grants proposta para uma Migration 44 que não chegou à main.

**Por quê.** `usuarios.push_token` era lido por quem enxerga a linha de
`usuarios` (colegas e gestores da mesma loja), e `push_notification_logs`
guardava o token inteiro, legível pelo gestor. Quem sabe o token de outra conta
consegue registrá-lo para si (RPC da Migration 39 ou UPDATE direto das versões
antigas) e passa a receber os pushes dela. Não há como provar que o token é do
aparelho de quem chama; o que fecha é ninguém ler o token de outra conta.

**O que faz.** (1) Tabela `push_tokens (token PK, usuario_id → usuarios ON
DELETE CASCADE, atualizado_em)` + índice por `usuario_id`; RLS com SELECT e
DELETE só do dono; a API fica só com SELECT/DELETE (sem INSERT/UPDATE).
(2) `gravar_push_token(usuario, token)`, DEFINER sem EXECUTE para a API, é a
única escrita: com sessão, só para a própria conta (`auth.uid() <> usuario` →
42501, defesa em profundidade); formato Expo (`ExponentPushToken[…]` e
`ExpoPushToken[…]`, os dois que o Expo emite), até 200 caracteres, trava por
token, upsert trocando o dono (um aparelho, uma conta) e no máximo 5 aparelhos
por conta — `clock_timestamp()` em `atualizado_em` (o `now()` empataria os
registros da mesma transação) e desempate pelo token no corte. O limite não é
fronteira de segurança (em 23/10/2026: 7 tokens em 18 usuários).
`registrar_push_token` grava por ela e não toca mais em `usuarios`.
(3) Backfill (um dono por token, `updated_at` mais recente), coluna zerada e
CHECK `usuarios_push_token_vazio` (`push_token IS NULL`). (4) Gatilho
`push_token_vai_para_push_tokens` (BEFORE UPDATE, quando chega token): leva o
token da própria linha para `push_tokens` e devolve a coluna a NULL — o UPDATE
direto do 1.14.2 segue funcionando; token na linha de outra conta → 42501.
(5) `notify_push_on_insert` (sem gatilho ligado) passa a olhar `push_tokens`.
(6) Logs: token reduzido aos 6 últimos caracteres; token da mensagem da Expo
tirado de `error_message`/`response` (irreversível). Roda **primeiro**, antes
do `CREATE TABLE` (a FK pega lock em `usuarios`): os ~1.656 UPDATEs não ficam
dentro da janela de lock. (7) UPDATE de
`authenticated` em `usuarios` só em nome, email, telefone, unidade_id,
foto_url, updated_at, ultimo_login, primeira_senha e push_token; saem `id`,
`created_at` e `ativo` (o ramo "própria linha" deixava o desativado se
reativar; o toggle é só pela RPC `alternar_motorista_na_unidade`).

**Logout das versões antigas.** O 1.14.3 sai com `UPDATE ... SET push_token =
NULL WHERE id = uid AND push_token = <token>`: com a coluna sempre NULL, não
casa linha e nada acontece. Sem o token não dá para apagar só o daquele
aparelho; apagar todos os da conta desligaria os outros aparelhos (e nem teria
gatilho para disparar). Aceito: nessas versões o token sobrevive ao logout,
como já acontecia no logout offline, até outra conta entrar no aparelho (a RPC
troca o dono) ou a Expo o invalidar (o envio apaga o token morto). O app novo
(`unregisterPushToken`) apaga de `push_tokens` pelo token; se a tabela ainda
não existir (PGRST205), cai no UPDATE antigo.

**Alternativas.** (1) Só tirar `push_token` do SELECT por grant de coluna:
quebra todo `select('*')` de `usuarios` e o `WHERE push_token = …` do logout
do 1.14.3 (permission denied). (2) Gatilho que trava a escrita direta (a 44
proposta): não esconde o token, então a RPC seguia aceitando o token lido.
(3) Apagar a coluna: o UPDATE do 1.14.2 passaria a dar 400 e o registro de
push dessas instalações morreria. (4) Tabela própria com RLS do dono + coluna
vazia por CHECK + gatilho de compatibilidade (escolhida): fecha a leitura,
mantém as versões antigas registrando e ganha vários aparelhos por conta. A
coluna pode sair quando não houver mais 1.14.2/1.14.3 em uso.

**Resíduo.** Token copiado ANTES da migration continua válido para quem o
guardou (a RPC aceita qualquer token no formato). A vítima o recupera ao
entrar de novo na conta noutro aparelho ou reinstalar; o app só reenvia o
token quando ele muda ou quando muda a conta (`registerPushToken` pula o banco
com o mesmo token e a mesma conta) — reenviar a cada abertura encurtaria essa
janela.

**Conhecidos (aceitos).** **W6** — o logout do 1.14.3 deixa de limpar o token
(ver "Logout das versões antigas"); aceito, o app novo apaga pelo token.
**W7** — o registro (RPC e gatilho) não confere `usuarios.ativo`: conta
desativada que ainda tem sessão registra token; fora do escopo (a desativação
é por vínculo de loja, e a notificação já é decidida por quem a cria).

**Decisões da revisão (rodada 1).** Fallback da função: a alternativa era
publicar a função junto da migration, numa janela curta; o fallback tira a
janela e a dependência de ordem, ao custo de um ramo que morre quando a
migration for aplicada. Ordem da máscara dos logs: a alternativa era uma
migration à parte só para os logs; mover para o começo da mesma transação
mantém a atomicidade e já tira os UPDATEs da janela de lock. `lock_timeout`
local em vez de `statement_timeout`: o risco é esperar lock em `usuarios`
(lida em toda requisição), não consulta lenta. Checagem de `auth.uid()` no
helper com variável (`v_uid`) e não no gatilho apenas: o gatilho já confere a
linha, mas o helper é a porta única e não deve depender de quem o chama.

**Edge Function.** `send-push-notification` lê os tokens por
`lerTokensDaConta` (`tokensDaConta.ts`, testado no Jest): `push_tokens`, e sem
a tabela (42P01/PGRST205) a coluna antiga; outro erro não cai na coluna. Envia
para cada aparelho; aceita `ExponentPushToken[…]` e `ExpoPushToken[…]`; token
morto (`DeviceNotRegistered`) sai de onde veio (`apagarTokenMorto`: linha de
`push_tokens` se ainda for da mesma conta, ou a coluna se ainda for o mesmo
token); o log grava token mascarado, o resumo do ticket e o código de erro
(nunca a resposta crua nem a `message` da Expo).

**Verificação.** Guarda estática `database/__tests__/migration45-push-tokens-so-do-dono.test.ts`;
sonda `database/sondas/20261024020000_sonda_migration45.sql` (loja com
motorista M e gestor G; 14 casos numerados + A–F, inclusive G não ver o token
de M, o UPDATE direto do 1.14.2 ir para a tabela, G recusado na linha de M
exigindo 42501, troca de dono pela RPC, o logout do 1.14.3 como INFO, o limite
conferindo que ficam os lotes 3 a 7, M desativado não se reativar, as funções
internas sem EXECUTE e o helper recusando outra conta, os UPDATEs legítimos do
próprio usuário e do gestor depois do REVOKE, `id`/`created_at` recusados, o
service_role movendo token para a tabela e a RPC recusando conta sem perfil;
tem `DELETE` só de tokens que ela cria, então roda no SQL Editor;
termina em `RAISE`). Roteiro de conferência só com SELECT (9 consultas) no fim
da migration. Sintaxe validada com o parser do Postgres (libpg-query).

### ✅ Migration 48: logs, posições e logs de push lidos pela loja da rota

**Arquivo:** `20261024110000_logs_posicoes_push_pela_loja_da_rota.sql` · **✅ aplicada em
24/10/2026 pelo CLI** (sonda antes e depois).

**O que faz.** `ALTER POLICY` (nomes mantidos, todas `TO authenticated`) em
`logs_select`, `motorista_locations_select_optimized` e
`push_notification_logs_select_scoped`, no formato que `incidentes` usa desde a
Migration 42: o dono lê o que é seu (autor do log, motorista da posição); o
gestor lê a linha quando a rota dela é de uma loja onde ele é gestor ativo
(`usuario_unidades.unidade_id = rotas.unidade_id`). `push_notification_logs`
não tem rota: vale a da notificação, consultada pelo helper
`notificacao_da_loja_do_gestor(uuid)` (SECURITY DEFINER, `search_path` vazio,
devolve só booleano; EXECUTE para `authenticated`, que a policy exige, e não
para `anon`), porque `notificacoes` só é legível pelo destinatário. O log de
push segue sem leitura do próprio motorista, como antes.

**Escrita de posição.** Como a leitura segue `rota_id`,
`motorista_locations_insert_optimized` (`public` → `authenticated`) passa a
exigir, além de `motorista_id = auth.uid()`, que `rota_id` seja NULL ou de uma
rota cujo `motorista_id` é quem grava. Medido em 24/10/2026: 59.056 posições,
nenhuma fora dessa regra; posição recusada fica na fila offline
(`filaPosicoes`), que reenvia até um limite de tentativas. Alternativa: exigir
também vínculo ativo na loja da rota — ficou de fora
porque o acesso de quem tem vínculo desativado é decidido pelo RLS de `rotas`,
que a subconsulta já respeita; seriam duas fontes para o mesmo critério.
`logs_insert_optimized` não muda (já confere a rota por
`pode_registrar_log_na_rota`).

**Linhas sem rota: só o dono.** Medido em 24/10/2026: 411 de 8.196 logs sem
rota (gestão de usuários e logs de rotas apagadas, FK `ON DELETE SET NULL`), 0
posições sem rota (FK `ON DELETE CASCADE`) e 3 de 3.118 logs de push de
notificação sem rota. Nenhuma consulta do app lê log sem rota, e o SOS chega ao
gestor pela notificação do gatilho `notify_sos_acionado`, não pela leitura de
`logs`. Alternativas: (a) loja de um vínculo ativo em comum entre gestor e
autor — a linha sem rota de um motorista de duas lojas ficaria legível nas
duas; (b) loja gravada na linha, como a Migration 43 fez em `incidentes` —
coluna e gatilho em três tabelas para um dado que nenhuma tela usa. Se uma tela
vier a precisar, o caminho é (b).

**Efeito visível.** Nas rotas da sua loja, o gestor passa a ler também os logs
sem autor (conta apagada, `usuario_id` → NULL; 1.575 em rotas existentes,
nenhum repetindo um log com autor) e os de motorista com vínculo desativado.
Aparecem no histórico de rotas antigas.

**App.** Todas as leituras filtram por `rota_id` de rota que o gestor já
enxerga e seguem servidas: histórico da rota (`useTimelineData`, página e
"carregar mais"), prévia do mapa (`TimelineCollapsible`), marcador do motorista
(`MotoristaMarker`, `useMotoristaLocationMapLibre`, consulta e realtime). Só
`motorista_locations` está na publicação `supabase_realtime`; `logs` não está,
então a assinatura de `logs` do histórico não recebe eventos (estado anterior,
não muda aqui). O registro de foto sem vínculo (`src/lib/storage.ts`) faz `INSERT
… RETURNING` como autor e segue lendo a própria linha. `push_notification_logs`
não é lido pelo app (o painel usa service role).

**Índices.** Nenhum novo; conferidos com `EXPLAIN`: `idx_logs_rota`,
`idx_motorista_locations_rota_timestamp`, `rotas_pkey`, `idx_uu_ativo`,
`notificacoes_pkey`.

**Verificação.** Guarda estática
`database/__tests__/migration48-leitura-pela-loja-da-rota.test.ts`; sonda
`database/sondas/20261024110000_sonda_migration48.sql` (lojas A/B/C, motorista
em A e B, colega só em A, gestor com vínculo desativado; o motorista grava
posição e log nas duas rotas; 34 casos, inclusive linhas sem rota, log sem
autor, posição na rota de outro motorista recusada e `anon`; sem `DELETE`;
termina em `RAISE`). Roteiro de conferência só com SELECT (6 consultas) no fim
da migration.

### ✅ Migration 49: rotas e paradas do motorista pelo vínculo ativo com a loja

**Arquivo:** `20261024111000_rotas_paradas_pelo_vinculo_ativo.sql` · **✅ aplicada em
24/10/2026 pelo CLI** (sonda antes e depois).

**O que faz.** `ALTER POLICY` (nomes mantidos, todas `TO authenticated`) em
`rotas_select`, `rotas_update`, `paradas_select` e `paradas_update`, com uma
regra só: quem consulta tem vínculo ativo (`usuario_unidades.ativo`) na loja da
rota e é gestor dessa loja **ou** é o motorista da rota e está ativo como
pessoa (`usuarios.ativo`). O motorista que atende duas lojas e tem o vínculo
desativado numa delas lê e atualiza só as rotas da outra; o motorista
desativado como pessoa (caminho "pessoa" de `alternar_motorista_na_unidade`,
que mantém o vínculo) não lê nem atualiza nenhuma. Reativado, volta a ver. O
gestor não muda. `INSERT`/`DELETE` de `rotas` e `paradas` já eram só do gestor
ativo.

**Helper `usuario_atual_ativo()`.** STABLE, SECURITY DEFINER, `search_path`
vazio; devolve só o `usuarios.ativo` de quem chama (sem linha: false). Entra no
ramo do motorista como `(SELECT public.usuario_atual_ativo())`, que vira
initplan (uma avaliação por consulta). EXECUTE para `authenticated` e
`service_role`, não para `anon`. Alternativa: desativar também o vínculo no
caminho "pessoa" da RPC — mudaria a tela de Motoristas (vínculo inativo
esconde perfil e edição) e pediria backfill; fica como passo separado.

**Funções do motorista.** As SECURITY DEFINER que ele chama sobre a rota ou a
parada passam a conferir vínculo e pessoa ativos: `finalizar_rota` (no `WHERE`
do `SELECT … FOR NO KEY UPDATE`; sem eles, o mesmo `ROTA_NAO_ENCONTRADA`),
`reordenar_paradas` (ramo do motorista) e `pode_registrar_log_na_rota` (usada
por `logs_insert_optimized` e `registrar_sos`; passa a ser "vínculo ativo na
loja da rota, e gestor dela ou pessoa ativa"). Conferidas sem mudança:
`inserir_parada`, `criar_rota_com_paradas`, `criar_notificacao`,
`alternar_motorista_na_unidade`, `listar_motoristas_unidade` (só gestor ativo);
`estatisticas_rota`, `obter_paradas_ordenadas`, `rotas_ativas_motorista` (sem
EXECUTE para `authenticated`). Herdam pelo RLS de `rotas`: a posição
(`motorista_locations_insert_optimized`, Migration 48) e o embed
`paradas → rotas` do app.

**SOS nunca é recusado pela rota.** Se quem aciona o SOS não pode mais
registrar na rota informada (rota guardada no aparelho), o SOS é gravado sem
rota, com `detalhes.rota_recusada = true` e sem `rota_id`/`rota_status` em
`detalhes`; `notify_sos_acionado` → `avisar_gestores_do_sos` trata rota NULL
como SOS sem rota e avisa os gestores das lojas onde ele tem vínculo ativo.
Dois caminhos: gatilho BEFORE INSERT `logs_sos_sem_rota_quando_recusada` em
`logs` (SECURITY DEFINER, `search_path` vazio; só `evento = 'sos_acionado'`
com rota e com usuário na sessão), para o INSERT direto das versões do app
sem a RPC — o nome ordena antes de `prevent_duplicate_log_trigger`, e o WITH
CHECK de `logs_insert_optimized` é avaliado depois dos BEFORE, pelo ramo
`rota_id IS NULL`; e `registrar_sos` (Migration 46), redefinida a partir do
corpo em produção, com a recusa trocada pela mesma queda. Nos dois, a checagem
da rota roda num bloco `EXCEPTION WHEN OTHERS`: se ela falhar, o SOS segue sem
rota, com a mesma marcação, e o motivo vai para o log do Postgres (WARNING).
Alternativas: tornar `pode_registrar_log_na_rota` à prova de erro (função SQL
não captura exceção, nem cobre a função ausente) ou repetir a regra inline no
gatilho (duas fontes, e a consulta inline também pode falhar). A subtransação
só existe no INSERT de SOS com rota.

**Alternativas.** (a) Manter os dois ramos (`motorista_id = auth.uid() OR
gestor`) e acrescentar as condições ao do motorista — mesma semântica, duas
subconsultas; (b) helper SECURITY DEFINER único para a regra inteira — uma
fonte só, mas chamada opaca por linha e mais um RPC exposto; (c) só `rotas` e
deixar `paradas` herdar pelo RLS da subconsulta — a regra de `paradas`
passaria a depender de outra policy. Escolhido: um `EXISTS` por policy no
vínculo ativo, com gestor/motorista dentro dele, o helper de pessoa só no ramo
do motorista, e a mesma condição nas três funções.

**Medido em 24/10/2026.** 873 rotas; 652 com motorista de vínculo ativo na loja
da rota; 3 `nao_executada` com o vínculo desativado, que somem para o
motorista; nenhuma pendente ou em andamento afetada; nenhuma rota com motorista
sem linha em `usuario_unidades`; `usuarios.ativo` sem NULL.

**App.** As consultas do motorista filtram por `motorista_id` ou `rota_id` e
seguem servidas com vínculo e pessoa ativos: rota ativa e paradas
(`useLoadActiveRoute`), ações e fila offline de paradas (`useRouteActions`,
`filaAcoesParada`), finalizar (`finalizar_rota`), histórico, estatísticas,
streak e marcos (`useHistoricoData`, `useMotoristaStats`, `useDesempenhoStats`,
`useMotoristaStreak`, `useMilestones`, `useLastRoute`, `useExpiredRoute`),
realtime (`useRouteRealtimeSubscription`), geofence (`locationTracking`), fotos
(`storage.ts`) e SOS (`app/motorista/sos.tsx`, INSERT direto). Desativado, as
rotas daquela loja saem dessas telas e números, e ação offline pendente nelas
é descartada pela fila (a parada não é mais legível). `reordenar_paradas` só é
chamada pelo gestor.

**Índices.** Nenhum novo; conferidos com `EXPLAIN`: `idx_paradas_ordem`,
`rotas_pkey`, `idx_rotas_motorista` ou `idx_rotas_unidade` na lista do
motorista (sub-milissegundo; se crescer, `rotas(unidade_id, motorista_id)`);
`usuario_unidades` (21 linhas) por seq scan; `auth.uid()` e o helper em
initplan.

**Verificação.** Guarda estática
`database/__tests__/migration49-rotas-paradas-pelo-vinculo-ativo.test.ts`; sonda
`database/sondas/20261024111000_sonda_migration49.sql` (lojas A/B, motorista com
o vínculo de A desativado, motorista desativado como pessoa com vínculo ativo,
gestor com vínculo desativado; leitura e UPDATE de rota e parada, as três
funções, log direto, SOS com a rota recusada pelo INSERT direto e pela RPC
(aceito sem rota, avisa o gestor de B, nenhum de A), SOS de quem não tem loja
ativa (gravado, 0 avisados), ramo do gestor pelo vínculo de gestor ativo,
checagem da rota com erro forçado (o SOS segue sem rota), posição, gestores,
reativação, ordem dos gatilhos e `anon`; sem `DELETE`; termina em `RAISE`).
Rollback colável, com o corpo inteiro das quatro funções redefinidas.
Roteiro de conferência só com SELECT (4 consultas) no fim da migration.

### ✅ Migration 50: bucket fotos-entrega — comprovante vinculado é preservado

**Arquivo:** `20261024121500_fotos_entrega_comprovante_preservado.sql` · **✅ aplicada em
24/10/2026 pelo CLI** (sonda antes e depois).

**O que faz.** Troca as três policies do bucket `fotos-entrega` em
`storage.objects` (DROP + CREATE na mesma transação, nomes mantidos, todas
`TO authenticated`; continua sem policy de UPDATE):

- `"fotos-entrega delete"`: o dono remove o próprio objeto quando nada o
  referencia — `paradas.foto_url`, `paradas.foto_comprovante` ou
  `incidentes.foto_url`, por path ou URL legada terminada em `/<path>` (a mesma
  regra de casamento da policy de SELECT), ou o caminho que a fila offline
  registra em `logs` quando não liga a foto à parada
  (`evento = 'foto_comprovante_sem_vinculo'`, `detalhes->>'foto_path'`). O
  desfazer de
  `uploadELinkFotoParada` (upload que não chegou a ser vinculado) e a troca da
  foto de perfil seguem funcionando. A foto de perfil fica fora de propósito:
  a troca de avatar apaga a atual antes de subir a nova.
- `"fotos-entrega select"` e `"fotos-entrega insert"`: o ramo por loja (1º
  segmento do path) passa de `get_my_unidade_ids()` para
  `minhas_unidades_com_acesso()` — lojas com vínculo ativo em que a pessoa é
  gestor ou está ativa no cadastro, a mesma regra de `rotas`/`paradas` na
  Migration 49. Os ramos do dono, de perfil e de incidente não mudam.

**Helpers.** Os dois STABLE, SECURITY DEFINER, `search_path` vazio, EXECUTE
para `authenticated` e `service_role`, não para `anon`:
`minhas_unidades_com_acesso()` (SETOF uuid, mesma forma de
`get_my_unidade_ids()`) e `pode_apagar_foto_entrega(text)` (true quando o
objeto do bucket é de quem chama e nada o referencia; lê `paradas` e
`incidentes` inteiras e o registro da fila em `logs`, sem depender do RLS de
quem chama — o dono precisa ter BYPASSRLS (`postgres`) —, e não responde sobre
objeto de outra pessoa).

**Alternativas.** DELETE: `NOT EXISTS` inline na policy (dependeria do RLS de
quem apaga) ou janela de tempo desde o upload (objeto vinculado dentro da
janela continuaria removível; desfazer atrasado seria recusado). SELECT/INSERT:
`usuario_atual_ativo()` no ramo inteiro (cortaria também o gestor, que segue
lendo rotas e paradas pela Migration 49) ou deixar para uma tarefa à parte
(reabriria as mesmas policies).

**Medido em 24/10/2026.** 2.319 objetos no bucket; 2.106 referenciados por
paradas e 9 por incidentes. A checagem do DELETE varre `paradas` (a URL legada
não usa índice): ~7 ms no pior caso, com 5.036 paradas; DELETE no bucket é
raro. Se crescer muito, índice de expressão no caminho normalizado da foto.
Em `logs` (8.196 linhas) a busca entra por `idx_logs_evento` (~0,1 ms).

**App.** Sem mudança de código. Leitura por `useSignedUrl` (avatar, perfil,
incidente e comprovante na tela do gestor; foto própria do motorista pelo ramo
do dono), uploads de entrega, perfil e incidente (`storage.ts`), remoção em
`deletarFoto` (desfazer) e `deletarFotoPerfil` (troca de avatar). O painel e a
Edge Function `delete-account` usam a chave secreta, que ignora RLS.

**Verificação.** Guarda estática
`database/__tests__/migration50-fotos-entrega.test.ts`; sonda
`database/sondas/20261024121500_sonda_migration50.sql` (remoção pelo dono:
parada por path e por URL legada, `foto_comprovante`, incidente, registro da
fila em `logs`, dono que não enxerga a parada, em lote,
upload sem vínculo, foto de perfil, upload e desfazer como no app, correção
da foto pelo gestor; quem não é dono; o helper sobre objeto próprio e alheio; leitura e
upload por loja para gestor, gestor e motorista inativos no cadastro, motorista
com vínculo desativado e motorista de outra loja; perfil e incidente; `anon`;
catálogo; termina em `RAISE`). Rollback colável com as três policies vivas e o
DROP dos helpers.

### ✅ Migration 52: contato do gestor segue o vínculo ativo

**Arquivo:** `20261024140000_contato_do_gestor_pelo_vinculo_ativo.sql` · **✅ aplicada em
24/10/2026 pelo CLI** (sonda antes e depois).

**O que faz.** Redefine `get_gestor_contato()` (botão "Falar com o gestor" do
menu do motorista) a partir do corpo vivo, com a mesma assinatura e o mesmo
retorno (`TABLE(nome text, telefone text, email text)`, no máximo uma linha):

- quem chama precisa estar ativo no cadastro (`usuario_atual_ativo()`,
  Migration 49); senão, nenhuma linha;
- a loja é sempre uma em que quem chama tem vínculo ativo, nesta ordem: a rota
  aberta que o app mostra no card da Início (`em_andamento` antes de
  `pendente`, depois `data`, `created_at`, `id`); sem rota aberta, a loja da
  rota mais recente; sem rota, o vínculo ativo (`is_principal`, depois o mais
  antigo, depois `unidade_id`). Rota de loja sem vínculo ativo não conta;
- o gestor é ativo no cadastro e tem vínculo ativo de gestor naquela loja:
  primeiro o gestor principal da loja (definição de
  `transferir_gestao_principal`), depois o vínculo mais antigo;
- sem loja ou sem gestor: nenhuma linha (antes, "sem loja" era exceção).
  "Não autenticado" segue como exceção, agora com ERRCODE 42501.

As colunas `usuarios.unidade_id` e `usuarios.papel` deixam de decidir a loja
e o gestor. Passa a STABLE; SECURITY DEFINER com `search_path` vazio e nomes
qualificados; EXECUTE para `authenticated` e `service_role`, como antes.

**Alternativas.** Loja: vínculo mais recente (a regra anterior; com duas lojas,
aponta para a recém-vinculada mesmo sem rota lá) ou só a rota `em_andamento`
(com a rota pendente na tela, o contato poderia ser de outra loja). Gestor: a
flag `is_gestor_principal` sozinha (é da pessoa, não da loja) ou só o vínculo
mais antigo (ignoraria a transferência de gestão). Sem loja: manter a exceção
(o app teria de separar erro de estado esperado pela mensagem).

**Medido em 24/10/2026.** Nas 9 lojas com vínculo ativo, o gestor escolhido é
o mesmo da regra anterior. A loja muda para os 4 motoristas inativos no
cadastro (ficam sem contato) e para 2 dos 3 motoristas com duas lojas ativas,
sem rota aberta (passam à loja onde trabalham). Cada consulta < 1 ms.

**App.** `useDrawerContact` passa a usar `.maybeSingle()` e mostra mensagem
própria quando não há gestor. O app já instalado usa `.single()`: zero linhas
vira erro e ele mostra "Não foi possível obter os dados do gestor", o mesmo de
antes para "sem loja".

**Verificação.** Guarda estática
`database/__tests__/migration52-contato-do-gestor-pelo-vinculo.test.ts`;
sonda `database/sondas/20261024140000_sonda_migration52.sql` (rota em
andamento, rota pendente, só rota antiga, sem rota, vínculo principal, rota de
loja com vínculo desativado, sem vínculo ativo, inativo no cadastro, loja sem
gestor com vínculo ativo, gestor chamando; gestor principal × vínculo mais
antigo, gestores com vínculo desativado ou inativos no cadastro, flag de
principal de outra loja; formato; sem usuário; catálogo e grants; sem
`DELETE`; termina em `RAISE`). Rollback colável com o corpo anterior inteiro,
o comentário e os grants.

### ✅ Migration 57: foto de comprovante vinculada não é desfeita pelo motorista

**Arquivo:** `20261024190000_foto_comprovante_vinculada_preservada.sql` · **✅ aplicada em 24/10/2026 pelo CLI**
(sonda antes e depois).

**O que faz.** Dois gatilhos BEFORE UPDATE, um em `paradas` e um em
`incidentes`, que valem para quem tem sessão e não é gestor com vínculo ativo
na loja da linha (loja da rota da parada, ou `incidentes.unidade_id`):

- `paradas` (`foto_url`, `foto_comprovante`, `status`): foto preenchida não
  volta a NULL; em parada finalizada (`concluida` ou `pulada`), a foto não é
  trocada e a parada com foto não volta a um status aberto. A ligação tardia
  NULL → valor da fila offline (`subirFotoDaFilaOffline`, UPDATE só com
  `foto_url` nula, inclusive em parada concluída) e a nova foto enquanto a
  parada está aberta (`uploadELinkFotoParada`: o "Voltar" do
  `StopCompletionFlow` e a parada reaberta pelo gestor) seguem valendo.
- `incidentes` (`foto_url`): só NULL → valor.

O gestor ativo da loja corrige qualquer uma dessas colunas, e quem não tem
sessão (chave secreta do painel e das Edge Functions, jobs) não é afetado.
Funções SECURITY DEFINER com `search_path` vazio (a conferência de gestor não
depende do RLS de quem atualiza), sem EXECUTE para `anon` e `authenticated`.
Erro: `P0001`, mensagem iniciada por `FOTO_VINCULADA:`. Junto com a Migration
50, o objeto referenciado continua no bucket.

**Alternativas.** (a) Só NULL → valor em qualquer parada — recusaria a nova
foto antes de concluir, e o app apagaria o upload novo. (b) O helper
`pode_apagar_foto_entrega` contar também a foto já referenciada antes — o log
`log_parada_status` não carrega o caminho da foto. Escolhido: regra pelo estado
da parada, porque a foto vira prova na conclusão; só o gestor reabre parada no
app, e a fila do motorista só atualiza parada aberta.

**Medido em 24/10/2026.** 2.186 paradas concluídas e 1 pulada com `foto_url`;
nenhuma aberta com foto; `foto_comprovante` vazia em todas. Nenhuma função do
banco grava essas colunas. A cláusula WHEN limita a execução às linhas em que
algo dessas colunas muda.

**App.** Sem mudança de código. A fixture do e2e (`garantir-rota-do-mapa`)
reabre as paradas logada como gestor.

**Verificação.** Guarda estática
`database/__tests__/migration57-foto-vinculada-preservada.test.ts`; sonda
`database/sondas/20261024190000_sonda_migration57.sql` (motorista: foto da
parada concluída, reabertura com e sem troca, foto e `foto_comprovante` da
parada aberta, foto do incidente; ligação tardia na forma do app, mesmo valor,
nova foto em parada aberta, NULL → valor no incidente, conclusão e outra
coluna; gestor corrige e reabre; com a Migration 50, objeto e referência
continuam; sem sessão; catálogo; termina em `RAISE`). Rollback colável.
