# Gestor: tela da rota, edição de paradas, listas e dados

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:**

- o gestor vê a rota atualizada e não consegue estragar uma entrega já feita;
- as listas e os números não se cortam em silêncio;
- desativar um motorista não deixa rota órfã.

**Origem (spec):** a varredura de 24/10/2026, relatórios `gestor.md` (G1–G15) e `dados-performance.md` (DP-1, DP-2, DP-3, DP-7, DP-8, DP-9, DP-10, DP-11). Os requisitos abaixo são a autoridade.

**Decisão do usuário (24/10):** o gestor só desativa um motorista depois de reatribuir ou cancelar as rotas abertas dele naquela loja, e a tela lista quais são.

**Tech Stack:** Expo Router (web + mobile), React Native, MapLibre, OSRM, Supabase (RPCs, realtime), Jest + RNTL.

## Global Constraints

- Tudo em PT-BR. Siga os padrões do `CLAUDE.md`:
  - formulários com Zod + `zodResolver` + `Controller`;
  - `useResponsive`;
  - fuso por `dateUtils`;
  - número decimal por `formatarDecimal`;
  - nenhum componente declarado dentro do render.
- Inserir e reordenar paradas continua só pelas RPCs atômicas (`inserir_parada`, `reordenar_paradas`). O invariante do split em `useReorderState.ts` cobre os 4 status.
- **Banco único = produção.** Implementador não escreve no banco. A migration vai em `database/migrations/` e entra em `MIGRATIONS.md` (números **53 a 55** reservados), com sonda em `database/sondas/`. Quem aplica é o controlador, pelo CLI.
- TDD com vermelho visto. Antes de declarar pronto: jest completo (`npx jest --testPathIgnorePatterns=worktrees`), `tsc`, `eslint app src e2e --max-warnings=0` e `scan:morto:arquivos`.

## Review Focus

1. O motorista conclui a parada 3 enquanto o gestor está com a tela da rota aberta. A tela mostra "concluída" sem recarregar, e Remover/Editar ficam indisponíveis para ela.
2. O gestor tenta apagar uma parada que o motorista acabou de concluir (tela velha). O banco recusa e a tela explica.
3. Motorista com 393 rotas e 2.235 paradas: o histórico e o desempenho mostram os totais certos.
4. Loja com mais de 100 rotas: a lista avisa ou pagina, e a busca e a exportação cobrem todas.
5. O gestor desativa um motorista com uma rota em andamento e duas pendentes. A desativação é recusada, e a tela lista as três rotas.

---

### Task 1: tela da rota viva e sem ação sobre entrega feita (G1, G4, G15)

- **G1/G15:** `useMapaRotaData.ts:80-155` não assina realtime de `paradas`/`rotas` daquela rota, e cada ação troca a página inteira por skeleton e remonta o mapa.
  - Assinar realtime filtrado por `rota_id`, com cleanup e revalidação na reconexão.
  - Recarga silenciosa: o skeleton só aparece na primeira carga.
- **G4:** Remover (`routeUtils.ts:~262`) e Editar (`useEditStopForm.ts:~165`) agem sobre dado velho e sem trava.
  - **No banco** (Migration 53): impedir DELETE de parada `concluida` ou `pulada`, e UPDATE que altere endereço ou tipo de parada `concluida`. Compare trigger e policy e decida.
  - No cliente: Editar e Remover desabilitados para parada feita e para rota concluída ou cancelada. A edição confere as linhas afetadas e mostra o erro do banco em PT-BR.
- Testes: realtime atualiza o status; skeleton só na primeira carga; os botões somem para parada feita; erro do banco tratado. A sonda cobre os itens 1 e 2 do Review Focus.

### Task 2: inserir parada no meio recalcula certo (G2)

`useAddStopForm.ts:~239-262` e `routeUtils.ts:~109` recalculam polyline, distância e tempo com as ordens de antes do `inserir_parada`.

- Recalcular com a lista devolvida ou relida depois da RPC.
- Teste: inserir na posição 2 de 4 grava a polyline e a distância na ordem nova.

### Task 3: regras de parada coerentes entre os fluxos (G3, G7, G12, G14)

- **G3:** `useAddStopForm.ts:43` usa `MAX_PARADAS = 23`, obsoleto, enquanto a Nova Entrega aceita 50. Usar uma fonte única para o limite.
- **G7:** o vínculo retirada→entrega (`vinculo_parada_id`) não é respeitado ao reordenar (`useReorderState.ts`) nem ao editar o tipo (`useEditStopForm.ts`). Remover a retirada zera o vínculo em silêncio.
  - Ao reordenar, a entrega não pode ir antes da retirada; avisar e recusar.
  - Editar o tipo ou remover a retirada avisa e pede confirmação.
- **G12:** adicionar, remover ou editar parada numa rota otimizada marca `otimizada_alterada`, como a reordenação já faz (`useMapaRotaHandlers.ts:~524`).
- **G14:** os modais de adicionar e editar parada passam para Zod + `Controller`, no padrão de `FormularioParada.tsx`, com erro cruzado tratado por `clearErrors`.
- Testes para cada item.

### Task 4: desativar motorista sem deixar rota órfã (G6)

- Migration 54: `alternar_motorista_na_unidade`, ao desativar, recusa com erro estruturado quando o motorista tem rota `pendente` ou `em_andamento` naquela loja. O erro traz os ids e as datas das rotas.
- UI (`app/gestor/motoristas.tsx:~392`, `useMotoristasOperations.ts:~340`, perfil e Equipe, que passam pela mesma RPC): mostrar a lista de rotas com o caminho para reatribuir ou cancelar, e não desativar.
- Sonda: item 5 do Review Focus. Também: sem rota aberta, desativa normalmente.

### Task 5: histórico, desempenho e marcos com totais certos (DP-1)

`useHistoricoData.ts:42-90`, `useMilestones.ts:77-100,165-180` e `useDesempenhoStats.ts:100-125` usam `.in('rota_id', todas)`. Isso passa do corte de 1.000 linhas do PostgREST e do tamanho da URL.

- Migration 55: RPC de agregação (`SECURITY DEFINER`, `search_path` fixo, valida quem chama: o próprio motorista ou gestor da loja). Ela devolve os totais por período, e as listas usam paginação. Compare com paginação no cliente e decida.
- Testes do hook com o mock da RPC. Sonda: os totais da RPC batem com um COUNT direto para o motorista de maior volume (item 3 do Review Focus).

### Task 6: listas sem corte silencioso (G5, DP-8)

A Gestão de Rotas (`useGestaoRotas.ts:~178-212`) mostra só as 100 rotas mais recentes, sem aviso, e a busca, os filtros e a exportação CSV/XLSX/PDF ficam incompletos. A lista de incidentes (`useIncidentesGestor.ts:127-160`) não tem limite.

- Paginação, com "carregar mais" ou intervalo de datas. A busca e os filtros vão ao servidor. A exportação busca tudo em páginas, com progresso.
- Incidentes com limite e paginação.
- Testes: mais de 100 rotas mostra o controle de paginação; a exportação cobre todas as páginas.

### Task 7: gestor com dado fresco e sem consulta repetida (DP-2, DP-7, DP-3, DP-9, DP-10, G13)

- **DP-2:** `useRealtimeRoutes.ts:123-129` e `useTimelineData.ts:180-229` não revalidam na reconexão e não têm fallback. Revalidar ao voltar a `SUBSCRIBED` e ao voltar o app para o primeiro plano.
- **DP-7:** o dashboard (`useDashboardData.ts:400-455,543-550`) roda 5 consultas a cada evento de realtime, incluindo os KPIs de mês. Os KPIs ficam só na carga inicial e no refresh manual; os eventos atualizam só o que mudou, com debounce.
- **DP-3/G13:** `useUser`, `useUnidadeAtiva` e `useAuth` guardam estado por instância. `SeletorUnidade` não é montado em lugar nenhum.
  - Unificar `useUnidadeAtiva` num contexto, para a troca valer em todas as telas.
  - Montar o seletor no cabeçalho do gestor quando ele tiver mais de uma loja, filtrando por papel.
  - Deduplicar as consultas de `useUser` (cache ou contexto). Escolha justificando.
- **DP-9:** `useCachedData.ts:83-139,157-170` descarta a carga da chave nova quando há uma busca em voo, e `update` usa o `data` da closure. Corrigir.
- **DP-10:** `PreRouteChecklist.tsx:141-181` refaz as checagens nativas a cada render do pai. Rodar só na montagem e nas mudanças relevantes.
- Testes para cada item.

### Task 8: mapa e otimização sem valor enganoso (G8/DP-11, G9, G10, G11)

- **G8/DP-11:** o marcador do motorista (`useMotoristaLocationMapLibre.ts:~30-100`, `MotoristaMarker.tsx:~30-103`, `MapaWebMapLibre.tsx:~812-845`) aceita posição mais antiga que a atual, e a fila offline da 1.14.5 reenvia posições velhas.
  - Comparar pelo `timestamp` da posição.
  - Mostrar a idade da posição ("há N min"), atualizada por timer, no mobile e na web.
- **G9:** na matriz do OSRM (`osrm/table.ts:~56-64`, `tsp.ts`), um `null` (par sem rota) vira distância 0. Tratar como inalcançável (custo alto) e avisar quando nenhuma ordem resolve.
- **G10:** `ChangeDriverModal.tsx:100-138` fica preso em "carregando" depois de uma falha. Mostrar o erro e um "Tentar de novo".
- **G11:** o CSV (`routeExport.ts:~95-103`) não escapa aspas nem neutraliza fórmula (`=`, `+`, `-`, `@` no começo da célula). Corrigir.
- Testes para cada item.
