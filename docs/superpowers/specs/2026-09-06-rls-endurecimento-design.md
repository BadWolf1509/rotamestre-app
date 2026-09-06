# Endurecimento de RLS: fechar escalonamento de papel e vazamento para anônimo

**Data:** 06/09/2026
**Estado:** desenho aprovado, plano de implementação pendente
**Origem:** varredura de 06/09/2026 — sub-projeto 1 de 6

## Problema

Seis buracos, todos **confirmados por consulta ao banco de produção**, não por
leitura de arquivo. Dois são exploráveis com uma chamada comum do cliente
Supabase, sem ferramenta especial.

### 1. `admin_dashboard_metrics` é legível sem login

O contraste com as views irmãs é a prova de que se trata de regressão, e não de
desenho:

| view                          | `reloptions`            | `anon` lê | `authenticated` lê |
| ----------------------------- | ----------------------- | --------- | ------------------ |
| `vw_rotas_resumo`             | `security_invoker=true` | não       | sim                |
| `vw_performance_motoristas`   | `security_invoker=true` | não       | sim                |
| **`admin_dashboard_metrics`** | **null**                | **sim**   | sim                |

A view pertence a `postgres` (`rolbypassrls=true`) e está sem `security_invoker`,
logo roda ignorando RLS. Ela agrega **todos os tenants**, sem filtro de
`unidade_id`: `mrr`, `taxa_conversao_trial`, `churn_30_dias`,
`total_unidades_ativas`, `total_pagas`, `total_usuarios`, `total_rotas`,
`rotas_hoje`, `paradas_hoje`, entre outros.

A `ANON_KEY` é `EXPO_PUBLIC_SUPABASE_ANON_KEY` — vai no bundle web e é legível
por qualquer visitante do site. Um `GET` no endpoint REST com essa chave devolve
os números.

A migration `20260622183805_security_hardening_multitenant.sql` (linhas 216-220)
**já continha** o `REVOKE` e o `ALTER VIEW`. As linhas irmãs do mesmo bloco
pegaram; estas duas não. Causa não determinada — por isso a correção é
idempotente em vez de condicional.

### 2. Motorista pode se promover a gestor, e a admin do painel

`usuarios_update_optimized` tem `with_check = NULL` e um `USING` cujo primeiro
ramo é `id = auth.uid()` — que **não depende de nenhuma outra coluna**. Sem
`WITH CHECK`, o Postgres reusa o `USING` contra a linha NOVA, e esse ramo aprova
qualquer valor desde que o `id` não mude.

Nenhum GRANT de coluna barrava a escrita — verificado por
`has_column_privilege`: `papel`, `admin_role`, `unidade_id`, `ativo` e
`is_gestor_principal` eram todos graváveis por `authenticated`.

`admin_role` é a coluna do **painel administrativo**, projeto separado que
compartilha este Postgres.

### 3. Dono de notificação reescreve o conteúdo dela

Mesma forma: `USING (usuario_id = auth.uid())` sem `WITH CHECK`, e o `USING` não
é sensível a coluna nenhuma. Permite reescrever `titulo`, `mensagem`, `tipo` e
`rota_id` — falsificação do próprio histórico. Sem alcance cross-tenant.

### 4. `incidentes_delete_optimized` decide pelo `usuarios` legado

É a única policy de `incidentes` ainda apoiada em `usuarios.papel` +
`usuarios.unidade_id`; as irmãs `incidentes_select` e `incidentes_update` já
usam `usuario_unidades`.

Isolada, é bug funcional: nega gestor multi-unidade legítimo cuja coluna legada
aponta para a outra unidade. **Combinada com o item 2**, é o gadget que
transforma "envenenei minha própria linha em `usuarios`" em DELETE cross-tenant
— apagar o incidente de outro franqueado.

### 5. Motorista move a própria rota para outro tenant (pendência 2)

`rotas_update` tem `with_check = NULL` e `USING: (motorista_id = auth.uid()) OR
(ramo gestor)`. O ramo do gestor **é** seguro: correlaciona `unidade_id`, então
o fallback barra a fuga. O ramo do motorista não é.

Consequência em cascata: `paradas_select`/`paradas_update` decidem por
`rotas.unidade_id`, então mover a rota leva junto nome, endereço e telefone de
todos os destinatários. `rotas` está na publicação `supabase_realtime`, então o
gestor da unidade de destino recebe o evento ao vivo.

Rastreado como **pendência 2**, com advisory privado `GHSA-vw63-jxg2-28vx` e a
observação de que "o fix óbvio quebra o motorista".

### 6. `transferir.tsx` deixa a unidade sem gestor principal

Encontrado pelo `rls-policy-reviewer` durante a revisão desta migration. **É
pré-existente**, não regressão — mas mora exatamente na policy que este trabalho
reescreve.

`app/unidade/transferir.tsx:131` faz
`.update({ is_gestor_principal: true }).eq('id', selectedGestor)`, e
`selectedGestor` é sempre `papel='gestor'` (filtrado na query da linha 74). O
`USING` de `usuarios_update_optimized` só libera edição de terceiros quando o
alvo é `papel='motorista'` — **esse update já é bloqueado hoje**.

Como o código não usa `.select()`, zero linhas afetadas não produz erro: o
`if (addError) throw` nunca dispara e a tela mostra "Transferência Concluída!".
Mas a linha 123 (self-update, esse permitido) já removeu o flag do gestor
antigo. **A unidade fica sem nenhum `is_gestor_principal = true`**, e como só o
gestor principal pode transferir, o estado é irrecuperável pelo app.

## A decisão central: REVOKE por coluna, não `WITH CHECK`

Quatro dos seis itens acima são da mesma forma — "esta coluna não deveria poder
mudar" — e a resposta natural seria `WITH CHECK`. Ela não funciona.

**`WITH CHECK` no Postgres enxerga apenas a linha NOVA.** Não existe `OLD` numa
policy de RLS. Então "o `papel` não pode mudar de valor" é inexprimível ali:
qualquer expressão que se escreva ou aprova todos os valores novos, ou proíbe
valores que são legítimos para outra pessoa.

A tentativa de contornar com subconsulta na própria tabela
(`papel = (SELECT papel FROM usuarios WHERE id = auth.uid())`) causa recursão de
RLS.

**Num GRANT, a mesma regra é trivial.** `REVOKE UPDATE (papel) ON usuarios FROM
authenticated` diz exatamente "esta coluna não é escrita por este papel", sem
precisar comparar nada.

Isto não é técnica nova aqui: o `PROJECT_CONTEXT` já registra, para `unidades`,
que "RLS **não restringe coluna**" e que por isso aquela tabela deliberadamente
não tem policy de UPDATE. A diferença é que ali a saída foi remover a porta;
aqui, como parte das colunas precisa mesmo ser escrita, a saída é estreitar a
porta.

**A divisão de trabalho fica assim:**

- **Coluna que o app nunca escreve** → `REVOKE` da coluna. Custo zero, nenhum
  fluxo quebra, e o buraco fecha por construção.
- **Coluna que o app escreve, mas cujo valor novo tem de ser restrito** →
  `WITH CHECK`, que é o que ele sabe fazer bem, porque é propriedade do valor
  novo e não comparação com o antigo.

## Por que isso destrava a pendência 2

O registro da pendência diz que "o fix óbvio quebra o motorista", e está certo
**sobre o fix óbvio**.

O fix óbvio é `WITH CHECK` no ramo do motorista, exigindo que ele pertença à
unidade da rota. Qualquer motorista com vínculo inativo ou fora de sincronia
perde a capacidade de iniciar e concluir a própria rota — o app dele para.

Mas `rotas.unidade_id` cai no primeiro caso da divisão acima. Levantamento do
que o app escreve em `rotas`:

| coluna                                  | escrita pelo app? | onde                                                         |
| --------------------------------------- | ----------------- | ------------------------------------------------------------ |
| `status`, `iniciada_em`, `concluida_em` | sim               | `useRouteActions`, `locationTracking`, `useMapaRotaHandlers` |
| `data`                                  | sim               | reativação de rota                                           |
| `distancia_total`, `tempo_total`        | sim               | `routeUtils`                                                 |
| **`unidade_id`**                        | **não**           | nenhum lugar — só lida e filtrada                            |

A unidade nasce na criação, pela RPC `criar_rota_com_paradas`, que é
`SECURITY DEFINER` (confirmado em `pg_proc`) e portanto imune a grant de
`authenticated`. Nenhuma Edge Function toca `rotas`.

`REVOKE UPDATE (unidade_id) ON rotas FROM authenticated` fecha o furo **sem
tocar em nada que o motorista faz**.

**Trade-off aceito:** fecha a porta para um futuro "mover rota entre unidades".
Se isso virar produto, o caminho passa a ser uma RPC dedicada — que é onde uma
operação dessas deveria estar de qualquer forma, para poder validar as duas
pontas e registrar auditoria.

## Decisões tomadas

1. **`admin_dashboard_metrics`**: `security_invoker = true` + `REVOKE ALL` de
   `anon` e `authenticated`. O app não consulta a view (conferido); ela é do
   painel, que usa `service_role` e não é afetado.
2. **`usuarios`**: `REVOKE UPDATE (papel, admin_role, is_gestor_principal)`.
   `papel` e `admin_role` não são escritos por caminho nenhum do app — conferido
   em `src/`, `app/`, `supabase/functions/` e `scripts/`.
   `is_gestor_principal` **é** escrita hoje, em `transferir.tsx`, e entra na
   lista porque a RPC do item 7 passa a ser a única porta até ela. As RPCs de
   onboarding são `SECURITY DEFINER` e a Edge Function `criar-motorista` usa
   `service_role`; nenhuma das duas é atingida.
3. **`usuarios.unidade_id`**: continua gravável (a troca de unidade ativa a
   escreve, em `useUnidadeAtiva.ts:197`), mas presa por `WITH CHECK` a
   `get_my_unidade_ids()` **só no ramo de auto-edição** — que já filtra por
   `ativo = true`. O revisor confirmou que o conjunto de valores que a tela
   pode enviar é exatamente esse. **O ramo gestor→motorista não tem a mesma
   proteção:** é cópia literal do `USING` e não menciona `unidade_id`, então um
   gestor pode gravar qualquer valor na linha de um motorista da sua unidade,
   inclusive de outro tenant. Não é regressão — sem `WITH CHECK` nenhum, já era
   possível antes —, mas o `WITH CHECK` novo não fecha essa porta.
4. **`notificacoes`**: `REVOKE UPDATE` da tabela + `GRANT UPDATE (lida)`. O app
   escreve exatamente esse campo. Revogar tudo e reconceder um também protege
   colunas futuras por padrão.
5. **`incidentes_delete_optimized`**: tradução **fiel** para `usuario_unidades`
   — mantém a base "gestor ativo da unidade **da rota**" e só troca a fonte da
   verdade. O revisor comparou os conjuntos autorizados pela fórmula antiga e
   pela nova contra os dados de hoje: **23 pares em ambas, zero ganhos, zero
   perdas**.
6. **`rotas`**: `REVOKE UPDATE (unidade_id)`, conforme a seção acima.
7. **Transferência de gestão principal**: vira uma **RPC
   `SECURITY DEFINER`**, `transferir_gestao_principal(p_unidade_id, p_novo_gestor_id)`,
   e não um alargamento da policy. Ver a seção seguinte.
8. **`anon`**: as revogações valem para `anon` além de `authenticated`.
   Inofensivo hoje (toda policy relevante depende de `auth.uid()`, nulo para
   anônimo), mas coerente com a própria justificativa de defesa em profundidade.

## Por que RPC e não policy, na transferência

A saída natural para o item 6 seria acrescentar um terceiro ramo à
`usuarios_update_optimized`: "gestor principal pode editar outro gestor da mesma
unidade". Ela é pior que parece.

**Alarga demais.** RLS não restringe coluna — é a mesma frase que motiva todo o
resto deste desenho. Um ramo assim libera a **linha inteira** do outro gestor
(`unidade_id`, `ativo`, `foto_url`, `telefone`) para consertar a escrita de um
booleano. Trocaríamos um buraco por outro, com a agravante de ser um buraco que
nós mesmos abrimos.

**Não resolve o defeito de verdade.** A transferência é intrinsecamente atômica:
tira o flag de A e põe em B. Hoje são dois `update` soltos, e é exatamente daí
que nasce o estado sem nenhum gestor principal — o passo 1 tem sucesso, o passo
2 é negado, e o rollback (`transferir.tsx:134`) também não é verificado. Nenhum
tratamento de erro no cliente conserta uma operação que não é uma transação.

**O repo já decidiu isso antes.** `atualizar_unidade` existe pelo mesmo
raciocínio, e o spec de 07/08/2026 tem uma seção inteira chamada "Por que RPC e
não policy". Seguir o precedente vale mais que inventar um caminho paralelo.

### Contrato da RPC

```
transferir_gestao_principal(p_unidade_id uuid, p_novo_gestor_id uuid)
  → void, SECURITY DEFINER, SET search_path = public
```

Valida, nesta ordem, e levanta exceção com mensagem própria em cada falha:

1. o chamador (`auth.uid()`) é gestor **ativo** da `p_unidade_id` **e** tem
   `is_gestor_principal = true` — só o principal transfere;
2. `p_novo_gestor_id` é gestor **ativo** da mesma unidade;
3. os dois são pessoas diferentes.

Feito isso, numa transação: remove o flag do chamador e o concede ao alvo. O índice
único parcial `idx_one_main_manager_per_unit` continua sendo a rede de segurança
do banco.

`REVOKE` de `anon`; `GRANT EXECUTE` só para `authenticated`.

**Nenhuma policy de UPDATE é alargada.** `is_gestor_principal` inclusive entra na
lista de colunas revogadas de `authenticated`, junto com `papel` e `admin_role`
— com a RPC no lugar, nada no app precisa escrevê-la diretamente.

## Contratos

### Migration

Arquivo: `database/migrations/20260906120000_rls_endurecimento_papel_e_view_admin.sql`.
Só em `database/` — é mudança de policy e grant, não de schema, e as duas
migrations mais recentes do repo também não são espelhadas.

Aplicada por `mcp__supabase__apply_migration`, **SQL sem `BEGIN`/`COMMIT`** (o
runner abre a própria transação), pelo controlador da sessão e com aval
explícito do gestor. **Nenhum subagente escreve no banco.**

### `usuarios_update_optimized`

O `USING` recriado é **byte a byte idêntico** ao que está no banco hoje
(verificado contra `pg_policies`); a única mudança é o `WITH CHECK` novo.
Nenhum ramo é acrescentado — o item 7 sai por RPC justamente para não alargar
esta policy.

### `app/unidade/transferir.tsx`

Os dois `update` soltos e o rollback manual saem, substituídos por uma chamada a
`transferir_gestao_principal`. A tela passa a tratar o erro da RPC, que agora
existe de verdade: hoje a falha é indistinguível do sucesso, porque zero linhas
afetadas não produz erro sem `.select()`.

## Testes

### Verificação no banco, depois de aplicar

Cada item tem uma consulta que o confirma — **o `apply_migration` sair sem erro
não é evidência de nada**:

| item | consulta que confirma                                                                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `has_table_privilege('anon', 'admin_dashboard_metrics', 'SELECT')` = `false` e `reloptions` contém `security_invoker=true`                                  |
| 2    | `has_column_privilege('authenticated','usuarios','papel','UPDATE')` = `false`                                                                               |
| 3    | `polwithcheck` de `usuarios_update_optimized` não é nulo                                                                                                    |
| 4    | `has_column_privilege('authenticated','notificacoes','titulo','UPDATE')` = `false` e `lida` = `true`                                                        |
| 5    | `pg_get_expr(polqual)` de `incidentes_delete_optimized` referencia `usuario_unidades`                                                                       |
| 6    | `has_column_privilege('authenticated','rotas','unidade_id','UPDATE')` = `false` e `status` = `true`                                                         |
| 7    | `has_function_privilege('authenticated','transferir_gestao_principal(uuid,uuid)','EXECUTE')` = `true`, `anon` = `false`, e `proconfig` contém `search_path` |

**Sonda transacional** para a RPC, no molde já usado neste projeto: dentro de uma
transação, transferir entre dois gestores de teste, conferir que exatamente uma
linha ficou com `is_gestor_principal = true`, e encerrar com `RAISE EXCEPTION`
para desfazer. Também conferir que a RPC **recusa** quem não é o principal.

### Jest

`transferir.tsx` ganha teste de que o erro da RPC aparece na tela em vez de
virar toast de sucesso.

### `rls-policy-reviewer`

Já revisou os itens 1-5 e devolveu **APPROVE**, com verificação ao vivo de cada
fluxo de app que poderia quebrar — inclusive `useUnidadeAtiva.ts:197` e
`NotificationDataContext.tsx:227`, os dois que o `WITH CHECK` e o
`GRANT UPDATE (lida)` poderiam ter quebrado. Foi ele quem encontrou o item 6.

Os itens 6 e 7 são novos e **precisam de nova passagem** — em especial a RPC,
que é código `SECURITY DEFINER` novo.

### Validação manual (exige o gestor)

Transferir a gestão principal entre dois gestores no app e confirmar no banco
que exatamente uma linha tem `is_gestor_principal = true` ao fim. Hoje esse
mesmo roteiro termina com **zero**.

## Fora de escopo

- **Validação de `foto_url` alimentando a policy de `storage.objects`.**
  `incidentes_insert` valida só `motorista_id = auth.uid()` e nunca `foto_url`;
  a policy de storage confia em "existe alguma linha visível com `foto_url` =
  nome do objeto", e a linha do próprio atacante sempre é visível a ele. A
  correção estrutural muda a policy de `storage.objects`, que é a invariante das
  fotos — não deve viajar no mesmo lote que seis outras mudanças. **Sub-projeto
  próprio.**
- **`ativo` em `usuarios`.** Um usuário desativado pode se reativar. O revisor
  confirmou que nenhum controle de acesso usa essa coluna (o real usa
  `usuario_unidades.ativo`), então não escala privilégio. Fica como endurecimento
  posterior.
- **Divergência de base entre `incidentes_update` (unidade do autor) e
  `incidentes_delete` (unidade da rota).** Anterior a este trabalho; registrada
  para não ser resolvida em silêncio aqui.
