# Execução da varredura de 05/11/2026 — plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** corrigir os bugs e aplicar as refatorações da varredura de 05/11, em branches locais
que o usuário confere no dia seguinte — sem push, sem merge, sem escrita no banco.

**Architecture:** cinco trilhas por domínio, em paralelo, cada uma num worktree e branch
próprios, sem arquivo em comum (Fase 1). Depois a integração junta as trilhas numa branch só
e aplica os itens que cruzam domínios (Fase 2). Todas partem do mesmo commit, a ponta da
`chore/expo-sdk-58` + o consolidado (`ef965132`), porque a varredura leu esse código; depois
do squash do #710 na `main`, rebaseiam com `git rebase --onto main 7df4c87a`.

**Tech Stack:** React Native 0.88 + Expo SDK 58, TypeScript, Jest 30 + RNTL, Supabase (Edge
Functions em Deno).

**Spec:** `docs/superpowers/2026-11-05-varredura-refatoracoes.md` (consolidado) e os
relatórios por domínio em `D:\rota-mestre\rotamestre-app\.superpowers\varredura-0511\`
(`motorista.md`, `gestor.md`, `nucleo.md`, `ui.md`, `tooling.md`, `banco.md`) — fora do git,
com o `arquivo:linha` e a proposta de cada item. O item do relatório é o requisito da tarefa.

## Global Constraints

- Só nos worktrees `D:\rota-mestre\rotamestre-app\.claude\worktrees\v0511-*`; cada trilha só no seu.
- **Sem banco:** nenhuma ferramenta Supabase/MCP de banco, nenhuma migration nova aplicada;
  nenhum deploy de Edge Function. Sem `git push`, sem merge, sem PR.
- Sem `npm install`/`npm ci` no worktree com junction de `node_modules` (compartilhado com o
  `expo-sdk-58`). Troca de dependência só na Fase 2, num worktree com `node_modules` próprio.
- Nunca `--no-verify`. O pre-commit reformata com prettier: se reformatar arquivo inteiro,
  faça um commit `style:` separado.
- Não tocar `.env*`, `*.keystore`, `eas.json`, `google-services.json`,
  `play-store-credentials.json` (o hook recusa). Não usar `python -` com heredoc. Texto com
  crase ou regex vai por Write/Edit, nunca por `node -e`.
- TDD por item: teste que falha → correção → teste passa. Antes de corrigir, procure o teste
  que **exige** o comportamento errado e mude-o primeiro (com o porquê no commit).
- Padrões do `CLAUDE.md` valem (logger com 2 args, sem `as any`, loja ativa por
  `useUnidadeAtiva`, datas por `dateUtils`, `formatarDecimal`, toast passado por parâmetro).
- Um commit por item (ou par de itens acoplados), mensagem em PT-BR no formato
  `fix(<área>): …` / `refactor(<área>): …` com o ID do item, terminando com
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Comandos de teste **de dentro do worktree**: `npx jest <caminhos>`; suíte inteira com
  `npx jest --silent`, que precisa passar com o mesmo total de suítes da referência ou mais.
  Também `npx tsc --noEmit` e `npx eslint <arquivos tocados> --max-warnings=0`.
- Comparar ≥2 alternativas antes de decidir um desenho e registrar a escolha no relatório.
- Comunicar em PT-BR.

## Review Focus

1. **OSRM fora do ar / rota estimada:** nada estimado pode ser gravado nem guardado em cache
   como real (B-GES-1, B-GES-2) — teste com `is_estimated: true`.
2. **Gestor com várias lojas:** toda tela tocada lê a loja de `useUnidadeAtiva()`, inclusive
   depois de trocar no seletor (B-GES-5, B-DB-2, R-GES-1).
3. **Troca de conta sem fechar o app:** só uma navegação para o login por saída (R-NUC-1);
   teste que conta as chamadas de `router.replace`.
4. **Rede lenta ou caindo:** chamada nova sem prazo (fetch cru) não pode prender modal
   (B-GES-7, R-DB-6); resposta velha não sobrescreve a nova (B-GES-8, B-NUC-3).
5. **Comportamento só do Android** (GPS, modais nativos, toque): o teste unitário não prova;
   listar no relatório da trilha o que fica para o aparelho.

## Fora deste plano (decisão do usuário ou exige o banco)

- **Banco:** B-DB-1 no servidor e R-DB-9 (códigos estáveis nas RPCs), B-DB-3 (guarda de rota
  encerrada nas RPCs), R-DB-3 (funções mortas), FK de `incidentes.motorista_id`. O lado do
  app de B-DB-1 (não mostrar o texto cru) entra na trilha do gestor.
- **Decisões abertas:** B-MOT-2 (remover ou implementar "Alertas Sonoros"), R-TOOL-9
  (`expo-updates`), R-GES-3 só na parte "trocar a biblioteca" (o patch fica).
- **Precisa de aparelho para validar** (entra no código, valida amanhã): R-MOT-1, R-NUC-1,
  R-UI-1, R-TOOL-1.

---

## Fase 1 — trilhas em paralelo

Cada trilha é uma tarefa com seus itens em ordem; o implementador faz um item por vez com
TDD e commit, roda a suíte inteira no fim e escreve o relatório da trilha em
`D:\rota-mestre\rotamestre-app\.superpowers\varredura-0511\exec-<trilha>.md`: por item,
feito / não feito (com motivo) / precisa de aparelho, e os commits.

### Task 1: Trilha motorista (`v0511-motorista`, branch `refactor/v0511-motorista`)

**Escopo de arquivos:** `app/motorista/**`, `src/components/motorista/**`,
`src/hooks/motorista/**`, `src/lib/motorista/**`, `src/services/locationTracking*`,
`src/services/unifiedLocationTracking*`, `src/hooks/useLocationWatcher.ts` e os testes deles.

Itens (relatório `motorista.md`): B-MOT-1 + R-MOT-1 (Início em `Balanced`, desligada durante
a navegação; o provedor único fica fora), B-MOT-3, B-MOT-4 + R-MOT-4, B-MOT-5 e a parte de
R-MOT-3 que **não** é o som (o som é decisão do usuário), R-MOT-2 (`useAcoesDaParada` +
`ModaisDaParada`, alternativa A do relatório), R-MOT-6, R-MOT-7, R-MOT-5.

- [ ] Cada item: teste vermelho → correção → verde → commit.
- [ ] `npx jest --silent`, `npx tsc --noEmit`, eslint nos tocados → verdes.
- [ ] Relatório `exec-motorista.md`.

### Task 2: Trilha gestor (`v0511-gestor`, branch `refactor/v0511-gestor`)

**Escopo:** `app/gestor/**`, `src/components/gestor/**`, `src/hooks/gestao-rotas/**`,
`src/hooks/nova-entrega/**`, `src/hooks/motoristas-gestor/**`, `src/hooks/useMotoristas*.ts`,
`src/hooks/useIncidentesGestor.ts`, `src/hooks/useDashboardData.ts`, `src/hooks/useGestaoRotas.ts`,
`src/lib/gestor/**`, `src/lib/routeUtils.ts`, `src/lib/route-optimization/**`, `src/lib/google.ts`.

Itens (`gestor.md`): B-GES-1, B-GES-2, B-GES-4, B-GES-5, B-GES-3 + B-GES-6 (guarda única nas
duas listas de arrasto; o patch fica), B-GES-7 + R-DB-6 só para `criar-motorista` (chamada com
prazo, pelo cliente do Supabase ou com `AbortController`), B-GES-8, B-GES-9, B-GES-10, lado do
app de B-DB-1 (mensagem genérica no toast, texto cru só no `logger`), R-GES-1, R-GES-2,
R-GES-4, R-GES-5, R-GES-6, R-GES-7, R-GES-8, R-GES-9, R-GES-10, R-NUC-5 (`distanciaMetros` de
`agrupamento.ts`), e a parte de R-DB-1 em arquivos deste escopo (`reordenarParadasFallback`).

- [ ] Cada item: teste vermelho → correção → verde → commit.
- [ ] Suíte, tsc, eslint → verdes. Relatório `exec-gestor.md`.

### Task 3: Trilha núcleo (`v0511-nucleo`, branch `refactor/v0511-nucleo`)

**Escopo:** `app/_layout.tsx` e os `_layout` fora de `app/motorista` e `app/gestor`,
`app/index.tsx`, `app/auth/**`, `app/onboarding/**`, `app/unidade/**`, `app/perfil/**`,
`src/lib/**` exceto motorista/gestor/route-optimization/routeUtils/google,
`src/context/**`, `src/hooks/**` fora dos escopos das tasks 1 e 2, e
`src/components/gestor/dashboard/_components/desktop/Sidebar.tsx` **só para B-NUC-5**
(a trilha do gestor não toca esse arquivo).

Itens (`nucleo.md`): R-NUC-1 primeiro (dona única da navegação de saída, no layout raiz, que
navega depois de os modais fecharem; os outros pontos deixam de navegar — teste que conta
`router.replace`), B-NUC-5, B-NUC-1 (credencial do tempo real no `SIGNED_OUT`), B-NUC-2 +
B-NUC-3 + R-NUC-3, B-NUC-4, B-DB-2 (`transferir.tsx` pela loja ativa), R-NUC-2, R-NUC-4,
R-NUC-6, R-NUC-7, a parte de R-DB-1 neste escopo (`resumoDesempenho.ts`, fallback do push
token, `tokensDaConta`), mantendo o fallback do SOS.

- [ ] Cada item: teste vermelho → correção → verde → commit.
- [ ] Suíte, tsc, eslint → verdes. Relatório `exec-nucleo.md` (com o que a pendência 33
  precisa provar no dev client).

### Task 4: Trilha UI (`v0511-ui`, branch `refactor/v0511-ui`)

**Escopo:** `src/components/**` exceto `motorista/` e `gestor/`, `src/design-system/**`,
`src/components/map/**`, `MapaWebMapLibre.tsx`, `MapaMobile.tsx`.

Itens (`ui.md`): B-UI-1 + R-UI-3 (cores sobre o mapa nativo; o balão segue no tema), B-UI-3,
R-UI-2 (`MobileEmptyState` → `EmptyState`, apagar `MobileButton` — call sites fora do escopo
ficam para a Fase 2, listados no relatório), R-UI-4, R-UI-5 (casca única de modal; se o
esforço passar do razoável, entregue a casca e migre só `Modal`/`DesktopModal`), R-UI-7, e a
**criação** do `Touchable` sobre `Pressable` (R-UI-1) com testes, aplicado só aos pontos deste
escopo; a aplicação no resto do repositório e a guarda estática ficam para a Fase 2.

- [ ] Cada item: teste vermelho → correção → verde → commit.
- [ ] Suíte, tsc, eslint → verdes. Relatório `exec-ui.md` com a assinatura do `Touchable` e
  a lista de pontos restantes.

### Task 5: Trilha ferramentas e Edge Functions (`v0511-tooling`, branch `refactor/v0511-tooling`)

**Escopo:** `jest.config.js`, `jest.setup.js`, `jest.mocks/**`, `__mocks__/**`,
`src/**/__tests__/**` **só** para R-TOOL-4 (guardas estáticas), `knip.jsonc`, `babel.config.js`,
`playwright.config.ts`, `scripts/**`, `tools/**`, `.github/workflows/**`,
`supabase/functions/**`, `database/MIGRATIONS.md`, `docs/TESTING.md`.
**Não** mexe em `package.json`/`package-lock.json` (Fase 2).

Itens (`tooling.md`, `banco.md`): B-TOOL-3 (só o script em `package.json` fica para a Fase 2;
aqui, a doc), B-TOOL-2 + R-TOOL-11, R-TOOL-4, R-TOOL-5, R-TOOL-6, R-TOOL-7, R-TOOL-8,
R-TOOL-10, B-TOOL-5, B-TOOL-1 + R-TOOL-3 (console real + lista de avisos conhecidos; falha em
aviso novo — medir antes e registrar a lista), B-DB-5, B-DB-4, R-DB-2, R-DB-4, R-DB-5, R-DB-7,
R-DB-10, B-TOOL-4/R-TOOL-12 só em `docs/TESTING.md`.

- [ ] Cada item: teste vermelho → correção → verde → commit (Edge Function: teste Deno se
  houver o padrão; senão, guarda estática em Jest, como as existentes).
- [ ] Suíte, tsc, eslint → verdes. Relatório `exec-tooling.md` (o deploy das funções fica
  para o usuário).

## Fase 2 — integração (sequencial, na branch `refactor/varredura-05-11`)

### Task 6: Juntar as trilhas
- [ ] `git merge --no-ff` de cada `refactor/v0511-*` na integração, uma por vez; conflito
  se resolve a favor das duas intenções e vai no ledger.
- [ ] Suíte inteira, tsc, `npm run lint` → verdes.

### Task 7: `Touchable` no repositório inteiro (R-UI-1 resto + R-UI-6) e call sites de R-UI-2
- [ ] Migrar os pontos restantes do inventário de `ui.md`, com `accessibilityRole`; trocar os
  `UNSAFE_*ByType(TouchableOpacity)` dos testes.
- [ ] Guarda estática: nenhum `TouchableOpacity`/`Animated.View` com array de 2+ estilos do
  Unistyles (provar em vermelho plantando um caso).
- [ ] Suíte, tsc, lint → verdes.

### Task 8: Dependências (R-TOOL-2, B-TOOL-3, R-TOOL-1) — worktree com `node_modules` próprio
- [ ] Remover a junction da integração (`cmd //c rmdir node_modules`) e rodar `npm ci`.
- [ ] R-TOOL-2 (dependências mortas), B-TOOL-3 (script), commit; depois R-TOOL-1
  (`npx expo install --fix`, 11 pacotes) num commit isolado.
- [ ] Suíte, tsc, lint, `npx expo install --check` → verdes.

### Task 9: Docs
- [ ] `CLAUDE.md` (knip: o número medido; estados vazios; R-DB-8), `PROJECT_CONTEXT.md`
  (pendência 32: `criarCadeia` já entrou; pendência nova com o que ficou para o aparelho e
  para o banco), `HISTORICO.md`.

### Task 10: Revisão final do branch inteiro (modelo mais capaz) e uma rodada de correção.
