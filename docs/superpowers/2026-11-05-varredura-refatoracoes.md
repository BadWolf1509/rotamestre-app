# Varredura de refatorações — consolidado (05/11/2026)

Segunda varredura do projeto inteiro, feita **só lendo** a branch `chore/expo-sdk-58`
(Expo SDK 58), dois dias depois da primeira
([2026-11-03-varredura-refatoracoes.md](2026-11-03-varredura-refatoracoes.md), quase toda
mesclada em #714–#718). Seis agentes em paralelo, um por domínio; nenhum tocou no banco.
Itens da varredura anterior só reaparecem aqui com evidência nova, citados pelo ID antigo.

Os relatórios completos de cada domínio (com `arquivo:linha` de cada achado) ficaram fora do
repositório, em `.superpowers/varredura-0511/` (ignorado pelo git), porque descrevem alguns
pontos de segurança em detalhe. Este consolidado os resume em termos gerais.

## 1. Resumo

| Domínio                          | Sigla | Bugs   | Refatorações |
| -------------------------------- | ----- | ------ | ------------ |
| Motorista                        | MOT   | 6      | 7            |
| Gestor                           | GES   | 10     | 10           |
| Núcleo, autenticação e navegação | NUC   | 5      | 7            |
| UI compartilhada e mapas         | UI    | 3      | 7            |
| Testes, ferramentas e CI         | TOOL  | 5      | 12           |
| Banco e Edge Functions           | DB    | 5      | 10           |
| **Total**                        |       | **34** | **53**       |

**Conferidos no código pelo consolidador** (além da leitura do agente): B-GES-1, B-GES-4,
B-GES-5, B-NUC-2, B-MOT-1, B-TOOL-1, B-DB-1, B-DB-2. Os demais carregam a confiança que o
agente declarou.

## 2. Bugs de confiança alta (corrigir primeiro)

| ID       | O que acontece                                                                                                                                  | Onde                                                                                | Prova                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| B-GES-1  | `recalcularRota` grava distância e tempo **estimados em linha reta** (OSRM fora) como se fossem reais; o `is_estimated` do resultado é ignorado | `src/lib/routeUtils.ts:174-183`                                                     | unitário com `getDirectionsSequential` devolvendo `is_estimated` |
| B-GES-2  | O cache de otimização (24 h) guarda o resultado estimado e ninguém o descarta (rotas com vínculo retirada+entrega)                              | `src/lib/route-optimization/optimizer.ts:97-102,178-185`                            | unitário do optimizer                                            |
| B-GES-4  | WhatsApp do card de parada: telefone de DDD 55 (RS) começa com "55" e fica sem o código do país                                                 | `mapa-rota/ParadaCard.tsx:57-63`, `ParadaCardCompact.tsx:55-61`                     | unitário; `telefoneInternacional` já resolve                     |
| B-GES-5  | Início e Incidentes do gestor mostram o nome da loja **do perfil**, não da loja ativa                                                           | `DashboardDesktop.tsx:183`, `DashboardMobile.tsx:178`, `useIncidentesGestor.ts:185` | gestor com 2 lojas troca no seletor                              |
| B-DB-2   | "Transferir gestão" usa `userData.unidade_id` (legado) em vez de `useUnidadeAtiva()`                                                            | `app/unidade/transferir.tsx:56,116`                                                 | idem                                                             |
| B-NUC-2  | Abrir o Perfil regrava `ultimo_login` (o login já grava em `src/lib/auth.ts:182`); "nunca entrou" e auditoria ficam distorcidos                 | `src/hooks/useProfile.ts:75-79`                                                     | unitário                                                         |
| B-DB-1   | `reordenar_paradas` (versão viva, Migration de 24/10) devolve o texto cru do Postgres, e o toast do gestor o mostra                             | migration `20261024111000…:379`, `routeUtils.ts:250-254`                            | junto com R-DB-9 (códigos estáveis)                              |
| B-DB-5   | `send-push-notification` grava logs/notificações sem olhar `error` — o `try/catch` não pega nada — e devolve detalhe interno do erro ao cliente | `supabase/functions/send-push-notification/`                                        | teste da função + guarda R-DB-4                                  |
| B-TOOL-1 | `jest.setup.js` troca `console.error/warn` por `jest.fn()` nos ~645 testes: aviso do React e do Unistyles nunca aparece                         | `jest.setup.js:73-78`                                                               | ver R-TOOL-3                                                     |
| B-TOOL-3 | `npm run build:android:release` não funciona (não há `android/` versionado)                                                                     | `package.json:20`                                                                   | remover ou apontar para o workflow                               |

**Confiança média** (provar antes de corrigir): B-GES-3 e B-GES-6 (arrasto da Nova Entrega sem
as guardas do Reordenar; falha ao salvar deixa a lista na ordem arrastada), B-GES-7 (criar
motorista por `fetch` cru, sem prazo), B-GES-8 (seleção de motorista sem contador de
requisição), B-GES-9 (resumo da linha do tempo ignora erro), B-GES-10 (gravações do rascunho
sem ordem garantida), B-NUC-3 (`useProfile` sem guarda de resposta velha), B-NUC-4
(`.single()` onde zero linhas é estado legítimo, ex. `app/gestor/motorista-perfil.tsx:123`),
B-UI-3 (Toast: ramo "esconder pelo pai" nunca roda com auto-dispensa), B-MOT-3 (SOS pode
ficar em "Obtendo localização…" com a posição já chegada), B-MOT-4 (navegação reconsulta o
OSRM a cada leitura quando não há polyline), B-DB-4 (compensação do `criar-motorista` sem
conferir o resultado; conta órfã bloquearia o e-mail).

**Segurança (termos gerais):** B-NUC-1 (a conexão de tempo real não troca de credencial ao
sair da conta), B-DB-3 (duas RPCs de edição de paradas não conferem se a rota já foi
encerrada; hoje só a interface impede). Os dois pedem correção antes de crescer a base de
lojas; o detalhe está no relatório local.

## 3. Ondas

### Onda A — bugs pequenos com teste unitário (só JS, sem aparelho)

B-GES-1 + B-GES-2, B-GES-4, B-GES-5 + B-DB-2 (loja ativa), B-NUC-2, B-NUC-4, B-GES-8,
B-GES-9, B-UI-3, B-TOOL-3, B-MOT-3. Uma PR por domínio; nenhum toca o mesmo arquivo.

### Onda B — entra no SDK 58, antes da 3056

- **R-TOOL-1:** `expo install --check` pede 11 pacotes (os 10 da pendência 31 + `jest-expo`),
  **todos nativos**; maior risco em `expo-notifications`, `expo-router` e
  `react-native-safe-area-context`. Recomendado: subir num commit isolado antes da 3056, para
  o mesmo build validar o SDK e o alinhamento.
- **B-MOT-1 / R-MOT-1:** a Início, montada por trás das abas, pede `BestForNavigation`
  (`app/motorista/_screens/inicio.tsx:68`) só para o ponto do mini-mapa, inclusive durante a
  navegação; com o expo-location 58 respeitando `accuracy`, isso mantém o GPS no máximo.
  Recomendado: `Balanced` na Início e desligar durante a navegação; prova por
  `adb shell dumpsys location`. Provedor único de GPS só depois.
- **B-MOT-6 (medir):** o rastro em segundo plano agora em `Balanced` pode ter ficado mais
  ralo — comparar no teste de rua.

### Onda C — pendência 33 (troca de conta trava as abas; já existia na 1.14.13)

Ao confirmar "Sair" no menu lateral, até **quatro `router.replace('/auth/login')`** saem
quase juntos (`useDrawerLogout`, o `useRequireAuth` de `unidade/_layout` e de
`gestor/_layout`, e `app/index.tsx` na pilha remontada), com o `Modal` do menu e o `Dialog`
ainda fechando. Hipóteses, em ordem:

- **H1 (média):** `replace` com `Modal` saindo deixa o `react-native-screens` sem desanexar o
  login. Prova: adiar o `replace` ~600 ms e repetir 5 vezes; contraprova: sair pela tela de
  perfil, sem menu.
- **H2 (média):** login duplicado na pilha pelos `replace` concorrentes. Prova: estado de
  navegação × `uiautomator dump`, contando chamadas.
- H3 (baixa-média): a remontagem desmonta um `Modal` ainda visível; H4 (baixa): corrida do
  `useRequireAuth` do motorista no destino.

Correção escolhida: **R-NUC-1** — uma única dona da navegação de saída (layout raiz), que
navega depois de os modais fecharem; os demais pontos só deixam de navegar. Junto: B-NUC-5.

### Onda D — duplicação de alto valor

| ID       | O quê                                                                                                                                                                                                                                                                                   | Esforço |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| R-MOT-2  | Concluir/pular copiado em Início, Mapa e checkpoints → `useAcoesDaParada` + `ModaisDaParada` por tela (2.1 de 03/11, aberto)                                                                                                                                                            | M       |
| R-GES-1  | "Motoristas ativos da loja" em 3 cópias divergentes (`useMotoristas`, `useMotoristaSelection`, `ChangeDriverModal`) → consertar as 3, depois `useCargaPorLoja` (2.4)                                                                                                                    | M       |
| R-GES-2  | Escrita do mapa-rota numa lib só, remoção de parada atômica e relida do banco (2.9)                                                                                                                                                                                                     | M       |
| R-NUC-2  | Quatro classificadores de "falha de rede" (`errorMapping`, `falhaPerfil`, `queryClient`, `redeObservada`) → um                                                                                                                                                                          | M       |
| R-NUC-3  | `useProfile` passa a ler de `useUser` (fecha B-NUC-2/3)                                                                                                                                                                                                                                 | M       |
| R-DB-1   | Tirar os caminhos de reserva "função ainda não existe no banco" (~70 linhas em `resumoDesempenho.ts`, que já diverge da view da Migration 80; fallback do reordenar e do push token). Manter só o do SOS                                                                                | M       |
| R-DB-2   | `_shared/http.ts` (CORS + resposta JSON) nas Edge Functions (2.16, aberto)                                                                                                                                                                                                              | M       |
| R-UI-1   | Aviso do Unistyles: **90 pontos em 54 arquivos** (27 sempre ativos; pior: `NavigationInfoPanel:231,258,284`, 3 botões no modo navegação). Recomendado: `Touchable` sobre `Pressable` com guarda estática; custo: 32 `UNSAFE_*ByType(TouchableOpacity)` em 8 testes e 88 `activeOpacity` | M       |
| R-UI-2   | `MobileEmptyState` (9 usos) → `EmptyState` (3); apagar `MobileButton`                                                                                                                                                                                                                   | M       |
| R-UI-5   | `Modal`, `DesktopModal` e `Dialog` com a mesma casca (2.5)                                                                                                                                                                                                                              | G       |
| R-TOOL-3 | Console real nos testes, com lista de avisos conhecidos e falha em aviso novo (medir antes)                                                                                                                                                                                             | M       |
| R-TOOL-4 | ~12 guardas estáticas reimplementam o percurso de arquivos → helper único com checagem de volume                                                                                                                                                                                        | M       |

### Onda E — código morto, tipos e docs (P cada)

R-MOT-3 (metade morta do `LocationTrackingService`: "Alertas Sonoros" que não tocam — B-MOT-2
—, estado de navegação gravado e nunca lido — B-MOT-5), R-MOT-4, R-MOT-6, R-MOT-7, R-GES-9,
R-GES-10, R-NUC-5, R-NUC-6, R-UI-3 (cores do tema no mapa nativo do gestor, inclusive
`MapaMobile.tsx:184`), R-UI-4, R-UI-6/7, R-TOOL-2 (dependências mortas: `pg`, `sharp`,
`@testing-library/jest-native`, `@size-limit/preset-app`, `metro-minify-terser`), R-TOOL-5
(mocks de pacotes nem instalados), R-TOOL-6 (plugin do Reanimated redundante no Babel),
R-TOOL-7, R-TOOL-8, R-TOOL-10, R-TOOL-11 (knip com `jest.ambiente-jsdom.js` como entry — sem
isso ele acusa falsos mortos), R-DB-4, R-DB-5, R-DB-6, R-DB-7, R-DB-10.
**Docs desatualizados:** `CLAUDE.md` (knip agora **140** exports, não 216; estados vazios 9 e
3; policies citam `get_user_unidade()`, que não existe mais — R-DB-8), `docs/TESTING.md`
(Jest 29 / jest-expo 56), `PROJECT_CONTEXT.md` pendência 32 (a Parte 2 da trilha de testes,
`criarCadeia`, já entrou no #721).

### Pedem o banco (leitura, com o usuário)

R-DB-3: 10 funções aparentemente mortas para `DROP` — conferir `pg_depend` antes. Possível FK
sem índice em `incidentes.motorista_id` (confiança baixa).

## 4. Decisões para o usuário

1. **R-TOOL-1:** subir os 11 pacotes antes da 3056 (recomendado) ou depois do merge do SDK 58.
2. **R-UI-1:** `Touchable` sobre `Pressable` nos 90 pontos (recomendado) ou só os de alto volume.
3. **B-MOT-2:** remover "Alertas Sonoros" (não tocam som) ou implementar o som.
4. **R-TOOL-9:** `expo-updates` está configurado para OTA sem nenhum uso — manter (para OTA
   futuro) ou remover (198 arquivos nativos a menos). Confiança baixa.
5. **R-GES-3:** manter o patch do `react-native-draggable-flatlist` (recomendado por ora) ou
   abrir a troca de biblioteca.

## 5. Descartados (parecia problema, não é)

Fluxos da câmera (marcador + restore uma vez por montagem), conclusão só pelo
`StopCompletionFlow`, dedupe de posições; nenhum clicável dentro de `<Marker>`; nenhum `Modal`
nativo sem `GestureHandlerRootView` onde precise; nenhum `theme` em dependência de efeito;
nenhum componente declarado dentro de outro; datas, `toFixed` e ErrorBoundary sem achado no
núcleo; porteiro de sessão coerente; `cnpj_da_unidade` sem migration é a Migration 51,
guardada de propósito; o patch do `draggable-flatlist` não pode sair.
