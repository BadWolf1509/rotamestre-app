# Atualizar dados da unidade: fechar a gravação silenciosa

**Data:** 07/08/2026
**Estado:** desenho aprovado, plano de implementação pendente
**Origem:** pendência #7 do review final da branch `feat/onboarding-self-service`

## Problema

`unidades` tem RLS ligada e **uma única policy: `unidades_select`**. Não existe
policy de INSERT, UPDATE ou DELETE.

`app/unidade/index.tsx:147-161` faz:

```ts
const { error } = await supabase
  .from('unidades')
  .update({ nome, telefone, endereco, cidade, uf, cep })
  .eq('id', unidade!.id);
if (error) throw error;
showToast('Dados atualizados com sucesso!', 'success', 3000);
```

O RLS não devolve erro — devolve **0 linhas afetadas**. Como o código só olha
`error`, a tela afirma que salvou e recarrega os valores antigos.

### O alcance real é o inverso do que parecia

Levantamento no banco em 07/08/2026, com os 9 gestores:

| Flag                            | Quantos são `true` |
| ------------------------------- | ------------------ |
| `usuarios.is_gestor_principal`  | **0 de 9**         |
| `usuario_unidades.is_principal` | 7 de 9             |

O botão de editar é gateado por `userData?.is_gestor_principal === true`
(`index.tsx:335,404`), que é `false` para **todos**. Ou seja: hoje a tela é
somente-leitura para todo mundo e a gravação silenciosa é **inalcançável pela
UI**.

O que muda isso: a RPC `criar_unidade_para_novo_gestor` grava
`is_gestor_principal = true`. **O gestor self-service é o primeiro que verá o
botão** — e a unidade dele nasce sem CNPJ, endereço, telefone e CEP, então
completar esses dados é a primeira coisa que ele tenta. O bug atinge exatamente
quem a feature de onboarding acabou de trazer.

Os dois campos de "principal" também discordam entre si: Amanda e Lavínia estão
`false` nos dois; os outros sete só no vínculo.

## Decisões tomadas

| Decisão          | Escolha                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Mecanismo        | **RPC `SECURITY DEFINER`, sem policy de UPDATE**                                         |
| Campos editáveis | os 6 da tela + **endereço da sede** (`sede_endereco`, `sede_latitude`, `sede_longitude`) |
| Quem pode editar | **qualquer gestor ativo** da unidade — sem depender de flag de principal                 |

A sede entrou no escopo porque hoje **não é editável em lugar nenhum**, e é dela
que saem partida e chegada de toda rota
(`src/hooks/nova-entrega/useEnderecoUnidade.ts:43`). Quem errar o endereço no
onboarding fica sem conserto e sem conseguir criar rota — o mesmo beco que a
feature anterior fechou.

A guarda não usa flag de principal porque os dados estão inconsistentes:
exigir `usuarios.is_gestor_principal` travaria os 9 gestores atuais, e exigir
`usuario_unidades.is_principal` travaria Amanda e Lavínia. "Principal" continua
governando o que já governa hoje — transferir titularidade e gerenciar equipe.

## Por que RPC e não policy

`unidades` tem **17 colunas fora da lista editável**, várias comerciais:
`plano`, `status`, `data_inicio_trial`, `data_fim_trial`,
`data_inicio_contrato`, `desconto_percentual`, `asaas_customer_id`,
`observacoes_admin`, `ativa`, `origem`.

Uma policy de UPDATE liberaria **todas** de uma vez, porque RLS não restringe
coluna — e `anon`/`authenticated` já têm grant de tabela cheio em `unidades`
(default do Supabase, igual em `rotas`, `usuarios`, `paradas` e
`usuario_unidades`; verificado). Um gestor poderia se promover de plano,
estender o próprio trial e zerar o desconto.

Sem policy de UPDATE, o `.update()` direto continua bloqueado e a RPC é a única
porta. A proteção passa a ser **estrutural**: as colunas sensíveis não têm
caminho até elas. Não é uma regra que as proíbe; é ausência de porta.

Alternativas descartadas:

- **Policy + trigger** bloqueando colunas: a proteção passa a depender de duas
  coisas valerem juntas, e dropar o trigger reabre tudo em silêncio.
  `database/MIGRATIONS.md` registra que o projeto já se machucou com trigger
  duplicado duas vezes.
- **Policy + `REVOKE` + `GRANT` por coluna**: é o mecanismo nativo, mas faria da
  `unidades` a única tabela com grants diferentes das outras — assimetria que
  uma migration de rotina desfaz sem ninguém notar.

## Contratos

### RPC

```sql
atualizar_unidade(
  p_unidade_id      uuid,
  p_nome            text,
  p_telefone        text,
  p_endereco        text,
  p_cidade          text,
  p_uf              text,
  p_cep             text,
  p_sede_endereco   text,
  p_sede_latitude   numeric,
  p_sede_longitude  numeric
) returns void
```

`SECURITY DEFINER`, `SET search_path = ''`.
`REVOKE ALL FROM PUBLIC, anon` · `GRANT EXECUTE TO authenticated`.

**Guardas, em ordem:**

1. `auth.uid()` não nulo — `errcode = '28000'`, mensagem `NAO_AUTENTICADO`;
2. existe vínculo em `usuario_unidades` com `usuario_id = auth.uid()`,
   `unidade_id = p_unidade_id`, `papel = 'gestor'`, `ativo = true` —
   `errcode = '42501'`, mensagem `SEM_PERMISSAO`;
3. `p_nome` e `p_cidade` não vazios — `errcode = '22023'`, mensagem
   `CAMPOS_OBRIGATORIOS`. `cidade` entra aqui porque é `NOT NULL` no schema:
   sem a guarda, cidade vazia estouraria com violação de constraint crua em vez
   de sentinela tratável;
4. quando `p_uf` vier preenchida, precisa ter exatamente 2 caracteres —
   `errcode = '22023'`, mensagem `UF_INVALIDA`;
5. quando as coordenadas vierem, `p_sede_latitude` entre -90 e 90 e
   `p_sede_longitude` entre -180 e 180 — `errcode = '22023'`, mensagem
   `COORDENADAS_INVALIDAS`.

`p_unidade_id` é parâmetro de propósito: passar o id de outra unidade não passa
na guarda 2, e a função funciona para gestor multi-unidade.

**Os 6 campos cadastrais são sempre sobrescritos** com o que chegar, inclusive
nulo. A tela envia os seis a cada salvamento, e limpar um telefone precisa
funcionar. Só `nome` e `cidade` são protegidos, pelas guardas acima.

**Regra da sede — a única não óbvia:** a sede só é sobrescrita quando
`p_sede_endereco`, `p_sede_latitude` e `p_sede_longitude` vierem **as três**
preenchidas. Se qualquer uma vier nula, a sede atual é preservada. Apagar a sede
por omissão deixaria a unidade incapaz de gerar rota — o beco que a feature
anterior fechou.

### Tela `app/unidade/index.tsx`

`isGestorPrincipal` hoje faz duas coisas; passam a ser separadas:

| Uso                                   | Gate                             |
| ------------------------------------- | -------------------------------- |
| Badge "⭐ Gestor Principal" (l. 188)  | `isGestorPrincipal` (inalterado) |
| Botões de editar/salvar (l. 335, 404) | **`podeEditar`** (novo)          |

`podeEditar` = `userData?.papel === 'gestor'`. A tela já carrega a unidade a
partir de `userData?.unidade_id`, então o gestor está sempre olhando a própria.

**O gate da UI é conveniência, não segurança** — existe para não oferecer um
botão que vai falhar. Quem decide é a guarda da RPC.

`handleSave` troca o `.update()` pela RPC e passa a tratar erro de verdade, via
`showError(error, { title })` — a forma que aciona `src/lib/errorMapping.ts`.

**Campo novo:** endereço da sede via `AddressAutocomplete`, visível só em modo
de edição, deixando claro na tela que são dois endereços com finalidades
diferentes — o cadastral e o operacional, de onde saem partida e chegada.

### `src/lib/errorMapping.ts`

Padrão novo para `SEM_PERMISSAO`, em pt-BR. Sem ele a mensagem cai no
`DEFAULT_ERROR` ("contate o suporte"), conselho errado para falta de permissão —
mesma lição de `NAO_AUTENTICADO` no PR anterior.

## Testes

**Limite honesto:** nenhum teste do projeto toca o banco real. A RPC e a
ausência de policy — onde o erro seria mais caro — não são cobertas pela suíte.

### Jest

| Teste                                                                                | Trava                                    |
| ------------------------------------------------------------------------------------ | ---------------------------------------- |
| Payload da RPC **sem** `plano`, `status`, `asaas_customer_id`, `desconto_percentual` | reintrodução de campo sensível           |
| Erro da RPC → **não** exibe "salvo com sucesso"                                      | **o bug desta spec**                     |
| Sede não editada → os três `p_sede_*` vão nulos                                      | apagar a sede por omissão                |
| `podeEditar` com `papel = 'gestor'` renderiza o botão de editar                      | a regressão de esconder o botão de todos |

O primeiro testa uma **ausência** — o formato que revisão humana costuma deixar
passar.

### `rls-policy-reviewer`

Na migration, antes de aplicar.

### Validação manual (exige o gestor)

1. Editar a unidade pela tela e conferir **no banco** que a linha mudou.
2. **Confirmar que um `.update()` direto em `unidades` continua falhando.** Todo
   o desenho apoia-se em não existir policy de UPDATE; se alguém adicionar uma,
   os 17 campos protegidos abrem de uma vez e nenhum teste acusa. Vira linha nas
   "Armadilhas que já custaram caro".

## Fora de escopo

- Reconciliar `usuarios.is_gestor_principal` com `usuario_unidades.is_principal`.
  Os dois estão inconsistentes e o primeiro é `false` para todos, mas a flag
  também governa transferência de titularidade — mexer nela é decisão própria.
  Consequência aceita: o badge "⭐ Gestor Principal" continua não aparecendo
  para ninguém.
- Policies de INSERT e DELETE em `unidades`. Continuam ausentes, e isso está
  correto: unidade nasce pela RPC de onboarding e não deve ser apagada pelo app.
- Editar `cnpj`, `email`, `fantasia`, `logo_url` e `horario_funcionamento` —
  colunas que existem mas que a tela não expõe hoje.
