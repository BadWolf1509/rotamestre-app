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

**Nota:** Tabela do sistema PostGIS, RLS não é necessário (somente leitura de metadados)

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

### ⏳ Migration 21: Onboarding self-service (testador cria a própria unidade)

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

**Status:** ⏳ Escrita e revisada, **ainda NÃO aplicada** no banco (nem via MCP
`apply_migration` nem via `db push`) — e a branch `feat/onboarding-self-service`
ainda não foi mergeada. Aplicar exige aval do gestor (banco único = produção,
sem staging — ver "Armadilhas" em `docs/PROJECT_CONTEXT.md`). Depois de
aplicar, a validação é manual: nenhum teste toca o banco real. Pendência
registrada em `docs/PROJECT_CONTEXT.md`.

**Ordem de deploy (obrigatória):** esta migration precisa ser aplicada **antes**
de o código da branch chegar em produção — nunca depois. Na ordem inversa, todo
cadastro novo (via `/onboarding/criar-unidade`, e também via `/auth/login` para
quem já tem sessão sem perfil) recebe `PGRST202` (`criar_unidade_para_novo_gestor`
ainda não existe no schema cache do PostgREST) e fica preso na tela — sem
voltar (`headerBackVisible: false`, `gestureEnabled: false` no
`app/onboarding/_layout.tsx`) até o botão "Sair" existir no `criar-unidade.tsx`.
A ordem correta (migration primeiro) é segura nos dois sentidos: `cnpj` deixar
de ser `NOT NULL` é inócuo para todo código antigo (só fica menos restritivo, não
quebra nenhum insert existente), e a RPC só é alcançável por um usuário
autenticado sem linha em `usuarios` — o código hoje em produção nunca chama
`criar_unidade_para_novo_gestor`, então aplicar a migration isolada, antes do
deploy do app, não tem efeito colateral observável.

---

### ⏳ Migration 22: RPC `atualizar_unidade` (sem policy de UPDATE)

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

**Status:** ⏳ Escrita e revisada, **ainda NÃO aplicada** no banco — confirmado
por consulta direta a `pg_proc` em 07/08/2026 (nenhuma linha para
`atualizar_unidade`). `unidades` continua com uma única policy
(`unidades_select`, somente leitura); nenhuma policy de UPDATE foi criada — é
o desenho, não uma lacuna. A branch `fix/policy-update-unidades` ainda não foi
mergeada e já inclui o código do app chamando esta RPC
(`app/unidade/index.tsx`) — pela mesma regra de ordem de deploy da Migration
21, aplicar **antes** do merge evita que "Minha unidade" chame uma função
ausente; se a ordem inverter, o erro já cai no mapeamento genérico de "RPC
ausente no schema cache" (`src/lib/errorMapping.ts`, `RPC_SCHEMA_NOT_READY`)
em vez de um erro cru. Aplicar exige aval do gestor (banco único = produção,
sem staging — ver "Armadilhas" em `docs/PROJECT_CONTEXT.md`).

---

**Última atualização:** 07/08/2026
