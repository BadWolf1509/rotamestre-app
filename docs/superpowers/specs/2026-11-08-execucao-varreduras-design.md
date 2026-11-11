# Execução das varreduras (08/11 + pendências anteriores) — design

**Fonte dos achados:** `docs/superpowers/2026-11-08-varredura-refatoracoes.md` (ids G8-, M8-, U8-,
L8-, B8-), `docs/superpowers/2026-11-07-varredura-refatoracoes.md` (B-6, B-7, B-11, T-2) e as
pendências 26, 30 e 35 de `docs/PROJECT_CONTEXT.md`. O executor lê o item na fonte antes de
implementar.

## Por quê

Fechar de uma vez a dívida apontada pelas varreduras, para a 3060 sair com os defeitos médios
corrigidos e o banco sem os atalhos de compatibilidade que já não têm uso.

## Objetivos

Executar **todos** os achados da varredura de 08/11 e, das anteriores, os itens listados abaixo,
cada um com teste que falha antes (bug) ou com testes verdes mantidos (refatoração).

## Fora do escopo (decidido pelo usuário em 08/11)

- **B-9** (gestor principal com duas fontes): adiado.
- **B-6** (pg_cron): não migrar; o agendador continua no GitHub Actions, endurecido.
- 30(c) M51 e B-7 **só** se a medição dos logs mostrar que nenhuma versão dependente ainda acessa
  (ver Trilha E). 30(d) staging, 30(g) painel do Auth: não entram (infra/painel).

## Decisões do usuário (08/11/2026)

| item                | decisão                                                                                                                                                                                                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B8-1                | teto de `details` sobe de 300 para **1000** por usuário/dia (migration). Sem aviso no lote.                                                                                                                                                                                                                                                                        |
| G8-8                | "N de M paradas feitas" **exclui** paradas de rotas `cancelada` e `nao_executada` do total (e do feito).                                                                                                                                                                                                                                                           |
| L8-7                | o gancho `prebuild:web` continua; os jobs de CI que rodam `build:web` **pulam** o `tsc` (Vercel e EAS seguem checando).                                                                                                                                                                                                                                            |
| Banco/deploy        | migrations com sonda e teste estático, Edge Functions prontas; **aplicar e publicar só com OK do usuário, item por item, no fim**.                                                                                                                                                                                                                                 |
| B-11                | `cancelar_rota` e `reativar_rota` criam notificação (com push) para o motorista da rota, nos dois casos.                                                                                                                                                                                                                                                           |
| B-6/30(e)/L8-9      | manter GitHub Actions: `timeout-minutes`, `curl --max-time`, script único para os 3 jobs e **issue automática** no repositório quando um job agendado falha (texto neutro, sem segredo).                                                                                                                                                                           |
| 26/30(h)            | indicadores do perfil do motorista passam a contar só a loja aberta (view ou RPC nova com `unidade_id`).                                                                                                                                                                                                                                                           |
| 30(i), 30(j)        | gatilho de `resolvido_em` em `incidentes`; iniciar rota numa RPC transacional (o app passa a chamá-la).                                                                                                                                                                                                                                                            |
| 30(k), 30(l), 30(m) | fila offline de incidentes; escrita atômica do `secureAuthStorage`; resumo de testes instáveis no CI.                                                                                                                                                                                                                                                              |
| T-2                 | lint type-aware (`no-floating-promises`) em `src/lib`, `src/hooks`, `src/services`, com as ocorrências corrigidas — **último PR**, depois dos outros mesclados.                                                                                                                                                                                                    |
| 44 pontos do #735   | reconstruir a lista a partir do histórico (transcrito da sessão `72b809b0…` em `C:\Users\welli\.claude\projects\D--rota-mestre-rotamestre-app\`, linhas `minor (deferred)` das tasks do plano `2026-11-07-design-desktop-gestor.md`), conferir cada um no código atual e corrigir os que ainda valem, inclusive "PARTIDA"/"CHEGADA" em caixa alta no Mapa da Rota. |
| B-7 / M51           | medir `x_client_info` nos `edge_logs` (só contagem por versão, sem dado pessoal) e aposentar o que não tiver mais uso, um atalho por vez; o resto fica registrado com a data da medição.                                                                                                                                                                           |
| Retomar parada      | o UPDATE de retomar também zera `foto_url`; a foto continua no Storage e no log. A fila offline não passa a cobrir o retomar.                                                                                                                                                                                                                                      |
| Entrega             | **um PR por grupo**, cada um revisado e com CI verde; merge só com OK do usuário; depois a 3060.                                                                                                                                                                                                                                                                   |

### Rodada 2 de perguntas (08/11/2026)

- **G8-8:** parada concluída numa rota que depois foi cancelada sai **do total e do feito**.
- **B-7/M51:** um atalho só sai com **zero acessos da versão dependente nos últimos 14 dias**
  medidos nos `edge_logs`. O nativo sem o cabeçalho `rotamestre/` conta como dependente. A medição
  vem **antes** de escrever essas migrations.
- **Arquivos grandes:** `app/unidade/index.tsx`, `app/gestor/mapa-rota.tsx` e `gestao-rotas.tsx`
  **não** se dividem nesta rodada. Entra só o `useMemo` de `actions`/`columns` em `gestao-rotas.tsx`.

### Decisões da sessão (conferir na leitura)

- **"Todos os achados de 08/11"** são todos os ids do relatório, inclusive os que aparecem só nas
  listas (G8-7, M8-2, M8-5, M8-6, U8-5/6/7, B8-2, B8-5, L8-6…L8-12). O grupo de cada um está
  abaixo. As "observações" do relatório viram só o item de retomar parada.
- **B-11:** reaproveita `criar_notificacao` e o tipo de notificação de rota que o app já
  trata; se precisar de tipo novo, o app ganha só o rótulo e o ícone. Os textos ("Rota
  cancelada pelo gestor", "Rota reativada") aparecem no PR para você revisar.
- **Ordem banco × app:** o PR do app que chama RPC ou view nova (30(j), 26/30(h)) só é mesclado
  **depois** de a migration ser aplicada com seu OK. O app não ganha fallback para RPC
  inexistente.
- **44 pontos:** a fonte é o transcrito. Vale a lista que sair de lá, mesmo que não dê 44, e
  o que já foi corrigido no código cai fora, com o motivo no relatório.
- **Issue automática do CI:** uma issue aberta por workflow agendado, com o label
  `agendador-falhou`. Falha repetida vira comentário na mesma issue, e o job que volta a passar
  fecha a issue. O workflow ganha `issues: write`. O texto é neutro: nome do job, link da
  execução e horário.
- **T-2:** `void` só onde a promessa é disparada de propósito e sem espera, com comentário dizendo
  por quê; as demais ganham `await` ou `.catch` com `logger.warn`. Comportamento novo só com teste.
- **L8-1:** se o Photon não trouxer cidade/UF, o fallback é o ViaCEP pelo CEP da sugestão; sem
  CEP, os campos ficam para o gestor preencher, sem chamar o Google. **30(l)** cobre os dois lados
  (nativo e web) onde o `secureAuthStorage` grava.
- **Pendência 35:** é só contexto. M-3, U-4, N-3 e U-3 entre meses são validações e entram na lista
  de validação, não em código.

## Grupos (um PR cada)

Os grupos não tocam os mesmos arquivos, salvo onde indicado; a ordem resolve o resto.

1. **Gestor** — G8-1…G8-10 (G8-8 conforme decisão), os 44 pontos reconstruídos.
2. **Motorista e mapas** — M8-1…M8-6, U8-1…U8-8, retomar com `foto_url` (só o lado do app; se a
   limpeza puder ser feita no próprio UPDATE do app, não precisa de migration).
3. **Lib e endereço** — L8-1 (recomendado: helper `ehPlaceIdDoGoogle` + `fromPhoton` levar
   cidade/UF), L8-2 (memorizar esgotamento até o fim do dia de Brasília), L8-3 (mock do tema a
   partir do tema real), L8-4, L8-5, L8-11, L8-12, 30(l).
4. **Fila offline de incidentes** — 30(k), seguindo o desenho de `filaAcoesParada`
   (marcador em disco, envio na volta da rede, descarte de recusa definitiva). Depois do grupo 2
   (mesma área do motorista).
5. **Banco e Edge Functions** — uma migration por assunto (B8-1+B8-4+B8-5 juntos no Places; B-11;
   30(i); 30(j); 26/30(h); atalhos de B-7/M51 que a medição liberar), cada uma com sonda
   transacional e teste estático; B8-2, B8-3, B8-6 nas funções/guardas. O lado do app de 30(j) e
   26/30(h) entra neste PR, depois dos grupos 1 e 2 mesclados.
6. **CI** — L8-6, L8-7 (decisão), L8-8, L8-9 + 30(e) (decisão), L8-10, 30(m).
7. **Lint type-aware** — T-2, por último.

## Restrições (valem para todos)

- Padrões do `CLAUDE.md`; PT-BR em código, commit e relatório; TDD para bug; ≥2 alternativas
  comparadas quando houver escolha, com o porquê registrado.
- Banco único = produção: subagente **nunca** escreve no banco; aplicação de migration e deploy
  só pela sessão principal, com OK do usuário. Nada de `db push`.
- Repositório público: nada de detalhe de fraqueza aberta em código, comentário, commit ou PR.
- Nunca `--no-verify`; não tocar `.env*`, `eas.json`, keystore, `google-services.json`,
  `play-store-credentials.json`.
- Cada grupo numa worktree própria a partir da main; `node_modules` por junction.

## O que fica com o executor

Forma exata de cada correção onde o relatório deu alternativas sem decisão do usuário (escolher a
recomendada, salvo evidência contrária registrada); nome de arquivos novos; divisão em commits.

## Validação

CI verde em cada PR. No navegador: gestor (G8, 44 pontos), endereço (L8-1/L8-2), N-3 e U-3 entre
meses. No aparelho, com a 3060 na interna: U8-1/U8-3, a fila de incidentes, o aviso de B-11, M-3
e U-4.
