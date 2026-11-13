# Painel do gestor — correções da varredura de 25/10 — Plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development (escolhida) ou superpowers:executing-plans. Passos com checkbox (`- [ ]`).

**Objetivo:** fechar no painel do gestor (web e mobile) os achados GES-1 a GES-10 e DAT-1, DAT-2, DAT-3 e DAT-5 da varredura de 25/10/2026, sem migration.

**Arquitetura:** correções no cliente, em cima dos hooks que já existem. A tela da rota ganha no layout <1024 px as mesmas ações do desktop, reaproveitando `useMapaRotaHandlers`/`useMapaRotaModals` e um bloco de modais único (`renderModais()`). A importação em lote passa a ter duas fases (localizar → conferir e confirmar). Telas que dependem da loja ativa zeram o estado da loja anterior, no molde de `useGestaoRotas` (`lojaDaCargaRef`).

**Stack:** Expo Router, React Native/Web, Supabase JS, react-hook-form + Zod, Jest + Testing Library.

**Spec:** achados locais da varredura (fora do repositório, confidenciais). Este plano descreve cada um com palavras próprias; não copie o texto deles para o repo.

## Restrições globais

- PT-BR em código novo, comentários, mensagens e commits.
- Nada em `database/` nem `supabase/`; nenhuma escrita no banco (só SELECT para medir).
- `useResponsive()` para layout; ErrorBoundary por tela; toast pertence à página (hooks recebem `showToast`); nunca componente declarado dentro de render (use `renderX()`).
- Formulários: Zod + `useForm({ resolver: zodResolver(schema) })` + `Controller`; erro inline (`FieldError` ou `error` do `Input`).
- Número decimal na tela: `formatarDecimal`. Datas `date`: `src/lib/dateUtils.ts`.
- `logger.warn/error(msg, err)` (2 args); testes espiam `logger`, não `console`.
- Sem `as any` nem `: any` novos.
- Jest de um arquivo: `npx jest <caminho> --testPathIgnorePatterns=/node_modules/`. Lint: `npx eslint <arquivos> --max-warnings=0`; `npx tsc --noEmit`.
- **Regra de desenho:** antes de cada decisão de desenho não fixada aqui, compare pelo menos 2 alternativas e registre o porquê (no relatório da tarefa e, quando durável, num comentário curto no código).
- Commits pequenos, mensagem `fix(gestor): …`/`perf(web): …`, com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nunca `--no-verify`. Se o pre-commit reformatar, faça commit `style:` separado.

## Rulings (decisões já tomadas, com a alternativa descartada)

1. **GES-1 — ações no mobile:** barra de ações própria do mobile (`AcoesRotaMobile`) abaixo do cabeçalho, abrindo os MESMOS modais; o bloco de modais sai do ramo desktop para uma função `renderModais()` chamada nos dois ramos. _Descartado:_ reaproveitar `RouteInfoHeaderCompact` no mobile (layout em 1 linha, não cabe em 360 px) e menu "⋯" (esconde a ação mais usada, trocar motorista, atrás de dois toques). As regras de "pode cancelar/reativar/trocar/adicionar/reordenar" saem para uma função pura `permissoesRota(status)` usada pelos dois cabeçalhos — sem duas cópias da regra.
2. **GES-1 — cards do mobile:** `ParadaCard` ganha `rotaStatus`, `onEdit` e `onRemove` opcionais, com a mesma condição `podeAlterarParada` do `ParadaCardCompact`. _Descartado:_ trocar o mobile para `ParadaCardCompact` (muda o visual inteiro do celular e o tamanho de toque).
3. **GES-3 — toque duplo:** trava de reentrada DENTRO de `useMapaRotaHandlers` (ref) + estado `acaoEmVoo` exposto para o `loading` dos `Dialog`s. _Descartado:_ estado só na página (outra chamada ao handler, fora do diálogo, ainda duplicaria).
4. **GES-4 — status vivo:** UPDATE condicional no cliente: cancelar `.in('status', ['pendente','em_andamento'])`, trocar motorista `.eq('status','pendente')`, reativar `.eq('status','nao_executada')`. Zero linhas → mensagem "A rota mudou de situação enquanto a tela estava aberta. A tela foi atualizada." + recarga. _Descartado:_ gatilho/RPC (fora do escopo desta trilha; a RPC `cancelar_rota` da pendência 28 vai no relatório para a sessão principal).
5. **GES-5 — importação em lote:** duas fases. "Localizar endereços" resolve cada linha pelo roteador `geocodingService.autocompleteWithCoordinates(endereco, sede)` (Places com viés pela sede; CEP via ViaCEP) com o Photon só como fallback quando o roteador não devolve nada; mostra uma lista de conferência (texto colado → endereço encontrado, distância da sede, fonte) com "Remover" e "Corrigir" (edita o texto e localiza de novo só aquela linha); só "Adicionar N paradas" cria as paradas. Aviso visual quando a distância da sede passa de 30 km. _Descartado:_ (b) só viés no Photon (continua aceitando o 1º resultado às cegas) e marcar como "a conferir" na lista principal (exige estado novo no tipo `Parada` e no rascunho).
6. **GES-6:** `BulkParadaInput` carrega `linha` (número real da linha colada); as mensagens usam `Linha ${linha}`. Depois de adicionar, o campo fica só com as linhas que falharam (texto original), não vazio.
7. **GES-7/DAT-2 — troca de loja:** em cada hook, `lojaDaCargaRef` como em `useGestaoRotas.ts:221-237`: loja diferente da última carregada → zera lista/estatísticas/erro/`dadosDe` e volta a `loading` antes de carregar. No dashboard, a página zera `filters.motoristaId` quando a loja muda. `useMotoristas` troca `fetchingRef` por contador de requisição (só a mais recente escreve). _Descartado:_ remontar a tela com `key={unidadeAtiva}` (perde o estado de UI inteiro e recria canais realtime).
8. **GES-8:** `motorista_id` vem da COLUNA da rota; sem o embed (RLS esconde), o nome exibido/exportado é "Motorista removido da loja". O nome real exige RPC/view `security definer` → relatório para a sessão principal.
9. **GES-9 — senha do motorista:** `motoristaSchema` (já usa `passwordSchema`) para criar; variante `motoristaEdicaoSchema = motoristaSchema.omit({ senha: true, email: true })` para editar (lista e perfil). Placeholder da senha passa a descrever a regra real. Minha Unidade ganha `unidadeSchema` (nome obrigatório; telefone por `phoneSchema` opcional; CEP 8 dígitos opcional; UF 2 letras de `src/lib/estados.ts`, opcional). Observações do incidente: limite de 1000 caracteres (`maxLength` + schema). Mensagem técnica "função não deployada" vira "Sem conexão. Tente de novo." quando for falha de rede, e "Não foi possível criar o motorista. Tente de novo." nos demais.
10. **GES-10:** KPI com `error` → `null` no estado, "—" na tela (mesma forma de `incidentesAbertos`). Criação de rota: `mensagemRegraDoBanco(error)` (P0001) vira a mensagem do toast; para "Motorista indisponível para a unidade selecionada." também limpa a seleção e recarrega motoristas. _Descartado:_ tabela própria de mapeamento (duplicaria as frases que o banco já escreve em PT-BR).
11. **DAT-1:** conserta a classe em `useCachedData`: recarga (`refresh`/revalidação) com dado da MESMA chave na tela não liga `loading`; expõe `refreshing`. `RouteTimeline` só mostra skeleton com `loading && events.length === 0`. _Descartado:_ corrigir só a timeline.
12. **DAT-3:** `await import(...)` para `pdfmake/build/pdfmake`, `pdfmake/build/vfs_fonts` e `xlsx`. Medir `dist/_expo/static/js/web/` antes/depois (bytes e gzip de cada `.js`). Se o Metro não separar chunk, reverter e registrar a medição e a alternativa no relatório.

## Foco de revisão (sem teste nas tarefas, mais provável de morder)

1. Tablet 768–1023 px: `isDesktop` falso → precisa cair no layout com ações (teste usa `isTablet: true`).
2. Gestor confirma "Trocar motorista" depois de o motorista iniciar a rota → 0 linhas → mensagem de mudança de situação, sem toast de sucesso nem log `motorista_alterado`.
3. Importação em lote sem Places disponível (roteador devolve `null`) → fallback Photon ainda funciona e a linha aparece na conferência com fonte "Photon".
4. Troca de loja com a carga da nova falhando → a tela mostra erro sem dados da loja anterior.
5. Timeline com "Carregar mais" aberto recebendo evento de realtime → lista não vira skeleton.

---

### Tarefa 1: GES-2 — `&&` sobre número não vaza "0"

**Arquivos:**

- Modificar: `app/gestor/mapa-rota.tsx` (~639), `src/components/gestor/motorista-perfil/RotasRecentes.tsx` (~101), `src/components/gestor/mapa-rota/RouteInfoHeaderCompact.tsx` (~108 e o `tempo_total` ~121), `src/components/gestor/mapa-rota/RouteInfoHeader.tsx` (~198)
- Criar: `src/lib/__tests__/jsx-sem-and-numerico.test.ts`

- [ ] **Passo 1:** escrever a guarda estática `jsx-sem-and-numerico.test.ts`: varre `app/` e `src/` (`.tsx`, exceto `__tests__`) e falha em qualquer `{<expr terminando em distancia_total|tempo_total> &&`. Teste: `it('nenhum && renderiza distancia_total/tempo_total cru')` → lista de ocorrências `toEqual([])`. Inclua um caso que prova a regex: `expect(achar('{rota.distancia_total && (')).toHaveLength(1)`.
- [ ] **Passo 2:** rodar → FALHA listando os 5 pontos.
- [ ] **Passo 3:** trocar cada um por `x != null && x > 0 ? (…) : null`.
- [ ] **Passo 4:** teste de render em `src/components/gestor/mapa-rota/__tests__/RouteInfoHeaderCompact.test.tsx`: `distancia_total: 0, tempo_total: 0` → `queryByText('0')` é null. Rodar os dois testes → PASSA.
- [ ] **Passo 5:** commit `fix(gestor): distância e tempo zero não vazam "0" na tela`.

### Tarefa 2: GES-3 + GES-4 — ações da rota sem toque duplo e condicionadas ao status

**Arquivos:**

- Modificar: `src/components/gestor/mapa-rota/hooks/useMapaRotaHandlers.ts`, `app/gestor/mapa-rota.tsx` (prop `loading` nos 3 `Dialog`s)
- Teste: `src/components/gestor/mapa-rota/hooks/__tests__/useMapaRotaHandlers.test.ts` (estender)

**Interfaces — produz:**

- `acaoEmVoo: boolean` no retorno de `useMapaRotaHandlers`.
- `export const MENSAGEM_ROTA_MUDOU = 'A rota mudou de situação enquanto a tela estava aberta. A tela foi atualizada.'` (no mesmo arquivo).

- [ ] **Passo 1 — testes que falham:**
  - `cancelar filtra por status aberto`: o mock de `supabase.from('rotas').update` registra `.in('status', ['pendente','em_andamento'])`.
  - `trocar motorista exige rota pendente`: `.eq('status','pendente')`.
  - `reativar exige rota não executada`: `.eq('status','nao_executada')`.
  - `zero linhas → MENSAGEM_ROTA_MUDOU, recarrega, sem log`: `select` devolve `{data: [], error: null}` em trocar motorista → `showToast(MENSAGEM_ROTA_MUDOU, 'info')`, `loadRotaEParadas` chamado, `from('logs')` não chamado.
  - `toque duplo executa uma vez`: chamar `handleConfirmRemoveStop()` duas vezes sem await → `removerParadaERecalcular` chamado 1 vez; mesmo para `handleConfirmCancel` (1 update) e `handleConfirmReactivate` (1 log).
  - `acaoEmVoo fica true durante a ação e volta a false`.
- [ ] **Passo 2:** rodar → FALHA.
- [ ] **Passo 3:** implementar: `acaoEmVooRef` + `setAcaoEmVoo` envolvendo cancelar, reativar, trocar motorista e remover parada (`if (ref.current) return; ref.current = true; try {…} finally {ref.current = false}`); filtros de status; classe `RotaMudouDeSituacao extends Error` lançada quando o UPDATE da ROTA volta 0 linhas, tratada no `catch` com `MENSAGEM_ROTA_MUDOU` + `loadRotaEParadas()`. Na página, `loading={acaoEmVoo}` nos Dialogs de cancelar, reativar e remover parada.
- [ ] **Passo 4:** rodar o arquivo de teste e `app/gestor/__tests__/mapa-rota.toast.test.tsx` → PASSA.
- [ ] **Passo 5:** commit `fix(gestor): ações da rota conferem a situação e travam o toque duplo`.

### Tarefa 3: GES-1 — ações de gestão no layout <1024 px

**Arquivos:**

- Criar: `src/components/gestor/mapa-rota/permissoesRota.ts`, `src/components/gestor/mapa-rota/AcoesRotaMobile.tsx`, testes `__tests__/permissoesRota.test.ts`, `__tests__/AcoesRotaMobile.test.tsx`, `app/gestor/__tests__/mapa-rota.mobile.test.tsx`
- Modificar: `RouteInfoHeaderCompact.tsx` (usar `permissoesRota`), `ParadaCard.tsx` (+`rotaStatus`, `onEdit`, `onRemove`), `index.ts` (exports), `app/gestor/mapa-rota.tsx`

**Interfaces — produz:**

- `permissoesRota(status: string | null | undefined): { cancelar: boolean; reativar: boolean; trocarMotorista: boolean; adicionarParada: boolean; reordenar: boolean }` — mesma regra que hoje está inline em `RouteInfoHeaderCompact.tsx:54-63`.
- `AcoesRotaMobile({ rota, onCancelPress, onReactivatePress, onChangeDriverPress, onAddStopPress, onReorderPress })`: botões com rótulos "Trocar motorista", "Adicionar parada", "Reordenar", "Cancelar rota", "Reativar rota", mostrados conforme `permissoesRota`; quebra em linhas (`flexWrap`), alvo de toque ≥ 44 px, `accessibilityRole="button"`.

**Consome:** `acaoEmVoo` (Tarefa 2).

- [ ] **Passo 1 — testes que falham:**
  - `permissoesRota`: tabela com os 6 status (`pendente`, `em_andamento`, `concluida`, `cancelada`, `nao_executada`, `undefined`) e o objeto esperado.
  - `AcoesRotaMobile`: `pendente` mostra "Trocar motorista", "Adicionar parada", "Reordenar", "Cancelar rota"; `nao_executada` mostra só "Reativar rota"; pressionar chama o callback.
  - `mapa-rota.mobile.test.tsx` (copiar os mocks de `mapa-rota.toast.test.tsx`, com `useResponsive` → `{ isDesktop: false, isTablet: true, isMobile: false, width: 900 }`): rota `pendente` com parada `pendente` → pressionar "Cancelar rota" mostra o diálogo "Cancelar rota"; o card da parada tem "Editar parada"/"Remover parada" (mesmos `accessibilityLabel` do `ParadaCardCompact`); a linha do tempo (`TimelineCollapsible`) é montada.
- [ ] **Passo 2:** rodar → FALHA.
- [ ] **Passo 3:** implementar. Na página: mover todo o bloco de modais do desktop (PhotoModal…Dialog de descartar reordenação) para `const renderModais = () => (<>…</>)` e chamá-lo nos dois ramos; no mobile, `AcoesRotaMobile` logo abaixo de `styles.rotaInfo`, `ParadaCard` recebe `rotaStatus`/`onEdit`/`onRemove` iguais aos do desktop, e o `ListFooterComponent` ganha `TimelineCollapsible` (mesmas props do desktop). Toast e `logoutModal` continuam um por ramo.
- [ ] **Passo 4:** rodar os 3 testes novos + `ParadaCard.test.tsx` + `RouteInfoHeaderCompact.test.tsx` + `mapa-rota.toast.test.tsx` → PASSA.
- [ ] **Passo 5:** commit `feat(gestor): tela da rota no celular e tablet com as ações de gestão`.

### Tarefa 4: GES-5 + GES-6 (parte 1) — resolução do lote com conferência no hook

**Arquivos:**

- Criar: `src/lib/nova-entrega/localizarEnderecoLote.ts`, `src/lib/nova-entrega/__tests__/localizarEnderecoLote.test.ts`
- Modificar: `src/hooks/nova-entrega/useParadasManagement.ts`, `src/hooks/useNovaEntrega.ts` (expor), testes do hook em `src/hooks/nova-entrega/__tests__/`

**Interfaces — produz:**

- `BulkParadaInput` ganha `linha: number` (número real da linha colada).
- `interface EnderecoLocalizado { linha: number; item: BulkParadaInput; enderecoEncontrado: string; latitude: number; longitude: number; fonte: 'google' | 'viacep' | 'photon'; distanciaSedeKm: number | null }`
- `localizarEnderecoLote(endereco: string, sede: { latitude: number; longitude: number } | null): Promise<Omit<EnderecoLocalizado, 'linha' | 'item'> | null>` — roteador `geocodingService.autocompleteWithCoordinates(endereco, sede ?? undefined)`; se `null`, `photonService.geocodeAddress(endereco)`; distância por haversine (reusar o helper que `useNovaEntrega.helpers.ts` usa para `DISTANCIA_AVISO_KM`).
- `export const DISTANCIA_CONFERIR_LOTE_KM = 30`.
- No hook: `localizarLote(items: BulkParadaInput[]): Promise<{ localizados: EnderecoLocalizado[]; erros: string[] }>` (não cria paradas; duplicadas e limite de 50 viram erro com `Linha ${item.linha}`) e `importParadas(confirmados: EnderecoLocalizado[]): BulkImportResult` (síncrono: cria as paradas com a coordenada confirmada, sem geocodificar).

- [ ] **Passo 1 — testes que falham:** `localizarEnderecoLote` usa o roteador com o viés da sede; cai no Photon quando o roteador devolve null e marca `fonte: 'photon'`; devolve null quando os dois falham; `distanciaSedeKm` null sem sede. Hook: mensagens usam a linha real (`items` com `linha: 7` → erro "Linha 7: …"); `importParadas` não chama geocodificação; `localizarLote` não altera `paradas`.
- [ ] **Passo 2:** rodar → FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar os testes do hook e da lib → PASSA; `npx tsc --noEmit` sem erro (o componente ainda usa a assinatura antiga até a Tarefa 5: ajuste `BulkStopImporter` só o mínimo para compilar, ou faça as Tarefas 4 e 5 no mesmo commit se o tipo não fechar).
- [ ] **Passo 5:** commit `fix(nova-rota): lote localiza pelo Places com viés da sede e numera pela linha colada`.

### Tarefa 5: GES-5 + GES-6 (parte 2) — tela de conferência no importador

**Arquivos:**

- Modificar: `src/components/gestor/nova-entrega/BulkStopImporter.tsx`, `ParadasListAndActions.tsx`, `app/gestor/nova-entrega.tsx` (ou onde `onImport` é ligado)
- Teste: `src/components/gestor/nova-entrega/__tests__/BulkStopImporter.test.tsx` (estender/criar)

**Consome:** `localizarLote`, `importParadas`, `EnderecoLocalizado`, `DISTANCIA_CONFERIR_LOTE_KM`, `localizarEnderecoLote` (Tarefa 4).

**Comportamento:** etapa 1 = colar + "Localizar endereços" (`parseBulkStops` passa `linha`). Etapa 2 = lista de conferência: por linha, "Linha N", texto colado, endereço encontrado, distância da sede (`formatarDecimal`), selo de aviso acima de 30 km, botões "Corrigir" (abre campo com o texto, "Localizar de novo" chama `localizarEnderecoLote` só dela) e "Remover"; erros de localização listados com a linha real; "Voltar" volta à etapa 1 mantendo o texto; "Adicionar N paradas" chama `importParadas`. Ao fim, o campo de texto fica só com as linhas que não entraram (falha de localização, removidas pelo gestor, duplicadas); vazio se todas entraram. Exemplo do placeholder com cidade: `entrega;Rua Exemplo, 100, Bairro, Cidade - UF;Maria;(83) 99999-0000;Portaria`.

- [ ] **Passo 1 — testes que falham:** (a) "Localizar endereços" mostra a conferência e NÃO chama `onConfirmar`; (b) "Adicionar 2 paradas" chama `onConfirmar` com os 2; (c) "Remover" tira a linha e o botão vira "Adicionar 1 parada"; (d) linha a 45 km mostra o aviso; (e) depois de adicionar com 1 falha, o texto do campo é exatamente a linha que falhou.
- [ ] **Passo 2:** rodar → FALHA.
- [ ] **Passo 3:** implementar (estado local de etapa; sem componente dentro de render — linhas pela função `renderLinhaConferencia(...)` ou componente no nível do módulo).
- [ ] **Passo 4:** rodar → PASSA; `tsc` e eslint dos arquivos.
- [ ] **Passo 5:** commit `feat(nova-rota): gestor confere e corrige os endereços do lote antes de criar as paradas`.

### Tarefa 6: GES-7 + DAT-2 — troca de loja não mostra dado da loja anterior

**Arquivos:**

- Modificar: `src/components/gestor/dashboard/_hooks/useDashboardData.ts`, `app/gestor/inicio.tsx` (zerar `filters.motoristaId` quando `unidadeAtiva` muda), `src/hooks/useMotoristas.ts`, `src/hooks/motoristas-gestor/useMotoristasOperations.ts`, `src/hooks/useIncidentesGestor.ts`
- Testes: um `*.trocaDeLoja.test.ts(x)` por hook, ao lado dos testes existentes

- [ ] **Passo 1 — testes que falham** (por hook; `useUnidadeAtiva` mockado com valor mutável + `rerender`): loja A carrega; troca para B com a carga de B pendente → a lista é `[]` e `loading` true; carga de B falha → lista continua `[]` e `dadosDe` null. `useMotoristas`: resposta de A chegando DEPOIS da troca para B não entra no estado. Página Início: troca de loja zera o filtro de motorista.
- [ ] **Passo 2:** rodar → FALHA.
- [ ] **Passo 3:** implementar com `lojaDaCargaRef` (molde `useGestaoRotas.ts:221-237`); no dashboard também volta `cargaInicialFeitaRef` a false; `useMotoristas` com contador de requisição no lugar de `fetchingRef`.
- [ ] **Passo 4:** rodar os novos + os testes existentes desses hooks → PASSA.
- [ ] **Passo 5:** commit `fix(gestor): trocar de loja limpa painel, motoristas e incidentes da loja anterior`.

### Tarefa 7: GES-8 — rota com motorista oculto pela RLS

**Arquivos:** modificar `src/lib/gestor/consultaRotas.ts` (~276-296) e onde `RotaHistorico.motorista_nome` vira texto na tela e na exportação; teste em `src/lib/gestor/__tests__/consultaRotas*.test.ts`.

**Produz:** `export const ROTULO_MOTORISTA_OCULTO = 'Motorista removido da loja'`.

- [ ] **Passo 1:** teste: linha com `motorista_id: 'm1'` e `usuarios: null` → `motorista_id === 'm1'`, `motorista_nome === ROTULO_MOTORISTA_OCULTO`; linha com `motorista_id: null` → `motorista_nome` undefined (a tela continua "Sem motorista").
- [ ] **Passo 2:** FALHA. **Passo 3:** `motorista_id: rota.motorista_id` (incluir a coluna no select se faltar), nome pelo embed ou o rótulo. **Passo 4:** PASSA (incluindo os testes de exportação CSV/XLSX existentes).
- [ ] **Passo 5:** commit `fix(gestao-rotas): rota com motorista fora da loja não aparece como sem motorista`.

### Tarefa 8: GES-9 (motorista) — criar e editar motorista com Zod, senha única e mensagens claras

**Arquivos:** `src/lib/schemas/motorista.ts` (+`motoristaEdicaoSchema`), `src/hooks/motoristas-gestor/useMotoristasForm.ts` (passa a encapsular `useForm`), `useMotoristasOperations.ts` (mensagens, `any`), `app/gestor/motoristas.tsx` (modal criar/editar com `Controller` + erro inline; placeholder da senha com a regra real do `passwordSchema`), `app/gestor/motorista-perfil.tsx` (edição com `motoristaEdicaoSchema`); testes dos schemas e dos hooks.

- [ ] **Passo 1 — testes que falham:** `motoristaSchema` recusa `senha: '123456'` com a mensagem do `passwordSchema`; `motoristaEdicaoSchema` aceita sem senha/e-mail; criar motorista com senha fraca não chama a Edge Function e mostra erro no campo (não toast); erro de rede (`TypeError: Failed to fetch` / `FunctionsFetchError`) vira "Sem conexão. Tente de novo."; nenhuma mensagem contém "deploy".
- [ ] **Passo 2:** FALHA. **Passo 3:** implementar (máscara de telefone continua por `maskPhone` no `onChange` do `Controller`). **Passo 4:** PASSA + testes existentes de `motoristas`/`motorista-perfil`.
- [ ] **Passo 5:** commit `fix(motoristas): formulários com Zod, regra única de senha e mensagem de rede clara`.

### Tarefa 9: GES-9 (unidade e incidente) — Minha Unidade e observações validadas

**Arquivos:** criar `src/lib/schemas/unidade.ts` (+ teste); modificar `app/unidade/index.tsx` (form com `useForm`/`Controller`, erro inline; preservar as travas existentes de sede não confirmada e loja trocada no meio — `clearErrors` se pendurar erro cruzado), `src/hooks/incidentes-gestor/useIncidentesModals.ts` + o campo de observações (limite 1000, contador).

**Produz:** `unidadeSchema` = `{ nome (obrigatório), telefone (phoneSchema, opcional/vazio), cep (8 dígitos após tirar máscara, opcional), estado (sigla de UF válida, opcional), cidade, endereco }`.

- [ ] **Passo 1:** testes: schema recusa CEP "1234", UF "XX", telefone "123"; aceita campos vazios; salvar com CEP inválido mostra erro no campo e não chama a RPC; observação com 1001 caracteres é recusada.
- [ ] **Passo 2:** FALHA. **Passo 3:** implementar. **Passo 4:** PASSA + testes existentes de `app/unidade`.
- [ ] **Passo 5:** commit `fix(unidade): Minha Unidade valida telefone, CEP e UF; observação de incidente com limite`.

### Tarefa 10: GES-10 — KPI indisponível e motivo real na criação de rota

**Arquivos:** `useDashboardData.ts` (KPIs `number | null`), componentes que exibem `rotasSemana`/`rotasMes`/`tempoMedioMinutos` (exibir "—" para null; buscar com `grep -rn "rotasSemana\|tempoMedioMinutos" src app`), `src/hooks/nova-entrega/useRouteCreation.ts`, testes.

- [ ] **Passo 1:** testes: consulta de KPI da semana com `error` → `kpis.rotasSemana === null` (e o card mostra "—"); criação com erro `{code:'P0001', message:'A data da rota não pode estar no passado.'}` → toast com essa frase; com "Motorista indisponível para a unidade selecionada." → toast com a frase + callback de limpar seleção e recarregar motoristas chamado; outro erro → mensagem genérica atual.
- [ ] **Passo 2:** FALHA. **Passo 3:** implementar (`mensagemRegraDoBanco`; o hook recebe `onMotoristaIndisponivel?: () => void` de `useNovaEntrega`). **Passo 4:** PASSA.
- [ ] **Passo 5:** commit `fix(gestor): KPI que falha aparece indisponível e a criação de rota diz o motivo`.

### Tarefa 11: DAT-1 — recarga não troca a timeline por skeleton

**Arquivos:** `src/hooks/useCachedData.ts`, `src/components/RouteTimeline.tsx` (~404), `src/hooks/gestao-rotas/useTimelineData.ts` (repassar `refreshing` se útil), testes `src/hooks/__tests__/useCachedData.test.ts`.

- [ ] **Passo 1:** testes: com dado da chave atual, `refresh()` mantém `loading === false` e `data` presente, e `refreshing` vai a true e volta; troca de chave continua ligando `loading` (teste existente ~355/384 continua passando); `RouteTimeline` com `loading: true` e eventos presentes renderiza os eventos, não o skeleton.
- [ ] **Passo 2:** FALHA. **Passo 3:** implementar. **Passo 4:** PASSA.
- [ ] **Passo 5:** commit `fix(timeline): evento ao vivo não troca a linha do tempo por skeleton`.

### Tarefa 12: DAT-5 — contagem de hoje por HEAD e período aberto com teto

**Arquivos:** `useDashboardData.ts` (`buscarTotalHoje` ~196-204; `buscarLista` ~156-193), testes.

- [ ] **Passo 1:** testes: `buscarTotalHoje` chama `select('id', { count: 'exact', head: true })` e devolve `count`; período com só `dataInicio` aplica `lte('data', <hoje + 60 dias>)` (use `toLocalISODate`) — escolha de N registrada no comentário com a alternativa (limite + aviso) comparada.
- [ ] **Passo 2:** FALHA. **Passo 3:** implementar. **Passo 4:** PASSA.
- [ ] **Passo 5:** commit `perf(painel): total de hoje por contagem e período aberto com teto`.

### Tarefa 13: DAT-3 — bibliotecas de exportação sob demanda no web

**Arquivos:** `src/hooks/gestao-rotas/routeExportPDF.ts`, `routeExportXLSX.ts`, seus testes.

- [ ] **Passo 1:** medição "antes" já feita pelo controlador em `dist/` (registrada no relatório).
- [ ] **Passo 2:** trocar `require` por `await import(...)` (normalizar `default`), ajustar os testes (`jest.mock` continua valendo). Rodar os testes de exportação → PASSA.
- [ ] **Passo 3:** `npm run build:web` e listar `dist/_expo/static/js/web/*.js` com bytes e gzip; conferir que `pdfmake`, `Roboto-Regular` e `xlsx` saíram do chunk de entrada (grep). Se não saíram, reverter e registrar.
- [ ] **Passo 4:** commit `perf(web): pdfmake e xlsx em chunk sob demanda`.

### Final

- [ ] Suíte inteira, `npx eslint . --ext .js,.jsx,.ts,.tsx --max-warnings=0`, `npx tsc --noEmit`, `npm run scan:nao-declarado`.
- [ ] Revisão final da branch; push; PR em PT-BR; CI verde; relatório para a sessão principal.
