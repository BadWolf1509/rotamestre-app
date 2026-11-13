# Filtros por período — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dar ao app uma regra única de período (atalhos, semana, mês e texto)
e um seletor único, aplicados à Gestão de Rotas com exportação, ao Início do
gestor, aos Incidentes, ao Perfil do motorista, ao Meu Desempenho e ao
Histórico do motorista.

**Architecture:**

- Um módulo puro (`src/lib/periodo.ts`) resolve o período para `{de, ate}`
  em texto `AAAA-MM-DD`.
- Um hook guarda o período por tela e por usuário.
- Um componente (`SeletorPeriodo`) é o único controle visual.
- As telas passam `de/ate` ao banco (`gte/lte` em `rotas.data`, instantes em
  `incidentes.created_at`) ou às RPCs de desempenho, que ganham `p_de/p_ate`
  na Migration 90.

**Tech Stack:** React Native 0.88 + Expo SDK 58 + TypeScript, Expo Router,
Supabase (PostgREST + RPCs SQL), Jest + Testing Library e Unistyles.

**Spec:** `docs/superpowers/arquivo/specs/2026-11-10-filtros-por-periodo-design.md`

## Global Constraints

- **Atalhos, nesta ordem e com estes rótulos:** "Hoje", "Ontem", "Esta
  semana", "Semana passada", "Este mês", "Mês passado", "Personalizado",
  "Todo o período".
- **Intervalo fechado:** os dois extremos entram. Todo atalho tem fim; "Todo o
  período" é `{ de: null, ate: null }`.
- **Semana:** de segunda a domingo.
- **"Este mês" nas listas:** do dia 1 ao último dia, incluindo os dias que
  ainda não chegaram.
- **Corte em hoje no Meu Desempenho e no Perfil:** o fim do período vira
  hoje. Se o período começar depois de hoje, a tela mostra o vazio do
  período, sem números zerados.
- **"Hoje":** é o dia no fuso do aparelho, por `getTodayISO` /
  `toLocalISODate` (`src/lib/dateUtils.ts`). O banco nunca calcula "hoje".
- **`rotas.data` é `date`:** nunca passa por `new Date()` e nunca sai de
  `toISOString()`. Guarda estática: `src/lib/__tests__/data-local-sem-utc.test.ts`.
  Timestamps como `incidentes.created_at` podem usar `new Date`.
- **Texto do período:** atalho e datas. Exemplos: "Este mês (01/11 a 30/11)",
  "Hoje (10/11)", "Personalizado (01/10 a 15/10)" e "Todo o período", sem
  datas. O ano só aparece quando não é o corrente: "(01/12/2025 a 31/12/2025)".
- **Padrão "Este mês"** em todas as telas do escopo.
- **Período lembrado por tela, no aparelho:**
  - chave `@rotamestre:periodo:<tela>:<usuarioId>`;
  - para atalho, grava-se o nome; para personalizado, as datas;
  - valor inválido volta ao padrão, sem erro.
- **Padrões do projeto (CLAUDE.md):**
  - `logger.warn(msg, err)` com no máximo 2 argumentos;
  - nada de `as any`;
  - `useResponsive()` (breakpoint de desktop: 1024);
  - Toast pertence à página;
  - `unidades` sem `select('*')`;
  - ErrorBoundary em toda tela;
  - nunca declarar componente dentro do render.
- **Commits:**
  - nunca `--no-verify`;
  - trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
  - mensagens em PT-BR;
  - subagente nunca escreve no banco nem faz push.
- **Verificação de toda task:** `npx tsc --noEmit`, `npm run lint` (o
  repositório inteiro, com `--max-warnings=0` e lint type-aware em
  lib/hooks/services) e o jest dos arquivos tocados. A suíte inteira roda na
  revisão final de cada grupo.

## Review Focus

1. **Virada do dia no fuso:** às 21:00 de UTC-3, "Hoje" e "Este mês" não
   podem andar um dia. Coberto na Task 1 (testes com `TZ=America/Sao_Paulo` e
   relógio falso às 21:30 locais) e pela guarda estática.
2. **Período lembrado de um mês anterior:** "Este mês" gravado em 31/10 e
   lido em 01/11 resolve para novembro. Coberto na Task 2.
3. **Personalizado inválido:** "de" maior que "até", ou datas vazias. O
   seletor não deixa aplicar, e o valor lido do disco não derruba a tela.
   Coberto nas Tasks 2 e 3.
4. **Exportação e lista vazias no período:** a exportação não gera arquivo
   vazio sem aviso; ela avisa "Nenhuma rota no período". Coberto na Task 5.
5. **App antigo chamando `resumo_desempenho_motorista(p_motorista_id,
p_dias)`:** a resposta continua igual. Coberto pela sonda da Task 4.

---

## Grupos, worktrees e ordem

Cada grupo é um PR, numa worktree própria a partir da `main`. O
`node_modules` é uma junction para o da `ajustes-3058`.

| Grupo                      | Tasks   | Depende de                   | PR                                                             |
| -------------------------- | ------- | ---------------------------- | -------------------------------------------------------------- |
| A — base                   | 1, 2, 3 | —                            | `feat(periodo): módulo, período lembrado e seletor`            |
| B — banco                  | 4       | — (em paralelo com A)        | `feat(banco): Migration 90 — desempenho por período e índices` |
| C — Gestão de Rotas        | 5       | A na main                    | `feat(gestor): período na Gestão de Rotas e na exportação`     |
| D — Início do gestor       | 6       | A na main                    | `feat(gestor): Início com o seletor de período`                |
| E — Incidentes             | 7       | A na main                    | `feat(gestor): período nos Incidentes`                         |
| F — desempenho e histórico | 8, 9    | A na main + **M90 aplicada** | `feat: período no Perfil, no Meu Desempenho e no Histórico`    |

- C, D e E correm em paralelo, porque tocam arquivos diferentes.
- A M90 é aplicada pela sessão principal logo depois do merge do grupo B,
  com sonda antes e depois e registro com `RETURNING`.

---

### Task 1: módulo `periodo`

**Files:**

- Create: `src/lib/periodo.ts`
- Test: `src/lib/__tests__/periodo.test.ts`
- Modify: `src/lib/__tests__/data-local-sem-utc.test.ts` (incluir o arquivo
  novo nas listas que a guarda percorre, se ela usar uma lista explícita)

**Interfaces — Produces:**

```ts
export type AtalhoPeriodo =
  | 'hoje'
  | 'ontem'
  | 'esta_semana'
  | 'semana_passada'
  | 'este_mes'
  | 'mes_passado'
  | 'todo';
export type Periodo =
  { tipo: AtalhoPeriodo } | { tipo: 'personalizado'; de: string; ate: string }; // 'AAAA-MM-DD'
export interface IntervaloDatas {
  de: string | null;
  ate: string | null;
}
export const ATALHOS_PERIODO: readonly AtalhoPeriodo[]; // ordem da UI, sem 'personalizado'
export const ROTULO_PERIODO: Record<AtalhoPeriodo | 'personalizado', string>;
export const PERIODO_PADRAO: Periodo; // { tipo: 'este_mes' }
export function resolverPeriodo(p: Periodo, hojeISO?: string): IntervaloDatas;
export function cortarEmHoje(
  i: IntervaloDatas,
  hojeISO?: string,
): IntervaloDatas | null; // null = começa depois de hoje
export function textoPeriodo(
  p: Periodo,
  intervalo?: IntervaloDatas,
  hojeISO?: string,
): string;
export function limitesEmInstante(i: IntervaloDatas): {
  desde: string | null;
  antesDe: string | null;
}; // ISO de instantes: meia-noite local de `de` e do dia seguinte a `ate`
export function lerPeriodo(valor: unknown): Periodo | null; // valida o que veio do disco
```

- `hojeISO` vem de `getTodayISO()` quando omitido. Os testes sempre o passam.
- A aritmética de datas trabalha sobre os componentes numéricos de
  `AAAA-MM-DD`, sem `new Date('AAAA-MM-DD')`. O dia da semana e a soma de
  dias saem de `Date.UTC(a, m, d)` / `getUTCDay`, que não sofrem com fuso.
  Confira se a guarda estática aceita essa forma.
- `cortarEmHoje`:
  - `ate` vira `min(ate ?? hoje, hoje)`;
  - `de` continua igual;
  - devolve `null` se `de > hoje`;
  - em "Todo o período" (`de: null`), devolve `{ de: null, ate: hoje }`.
- `textoPeriodo(p, intervalo)` usa o intervalo recebido. É assim que as telas
  de desempenho mostram o recorte já cortado, como "Este mês (01/11 a 10/11)".
- Datas iguais mostram uma só: "Hoje (10/11)".

- [ ] **Step 1: testes que falham** (`periodo.test.ts`). Hoje é passado
      explicitamente:
  - `resolverPeriodo({tipo:'hoje'}, '2026-11-10')` → `{de:'2026-11-10', ate:'2026-11-10'}`
  - ontem em 2026-03-01 → `2026-02-28`; em 2028-03-01 → `2028-02-29`
  - `esta_semana` em 2026-11-10 (terça) → `{de:'2026-11-09', ate:'2026-11-15'}`; em 2026-11-15 (domingo) → mesma semana; em 2026-11-16 (segunda) → `{de:'2026-11-16', ate:'2026-11-22'}`
  - `semana_passada` em 2026-12-02 → `{de:'2026-11-23', ate:'2026-11-29'}`; em 2027-01-03 → `{de:'2026-12-21', ate:'2026-12-27'}`
  - `este_mes` em 2026-11-10 → `{de:'2026-11-01', ate:'2026-11-30'}`; em 2028-02-10 → `ate:'2028-02-29'`
  - `mes_passado` em 2026-01-15 → `{de:'2025-12-01', ate:'2025-12-31'}`
  - `todo` → `{de:null, ate:null}`; personalizado devolve as próprias datas
  - `cortarEmHoje({de:'2026-11-01', ate:'2026-11-30'}, '2026-11-10')` → `ate:'2026-11-10'`; `cortarEmHoje({de:'2026-12-01', ate:'2026-12-31'}, '2026-11-10')` → `null`
  - `textoPeriodo({tipo:'este_mes'}, undefined, '2026-11-10')` → `'Este mês (01/11 a 30/11)'`; `{tipo:'hoje'}` → `'Hoje (10/11)'`; `{tipo:'mes_passado'}` em 2026-01-15 → `'Mês passado (01/12/2025 a 31/12/2025)'`; `{tipo:'todo'}` → `'Todo o período'`; com intervalo cortado → `'Este mês (01/11 a 10/11)'`
  - `lerPeriodo` aceita os atalhos válidos e o personalizado com duas datas `AAAA-MM-DD` com `de <= ate`; devolve `null` para `{tipo:'xyz'}`, `{tipo:'personalizado', de:'2026-11-10', ate:'2026-11-01'}`, `'texto'`, `null` e data impossível (`2026-02-30`)
  - `limitesEmInstante({de:'2026-11-10', ate:'2026-11-10'})` com `process.env.TZ='America/Sao_Paulo'` → `desde: '2026-11-10T03:00:00.000Z'`, `antesDe: '2026-11-11T03:00:00.000Z'`
  - **Review Focus 1:** com o relógio falso em `2026-11-30T21:30:00-03:00` e sem `hojeISO`, `resolverPeriodo({tipo:'este_mes'})` dá novembro, e `{tipo:'hoje'}` dá `2026-11-30`
- [ ] **Step 2:** `npx jest src/lib/__tests__/periodo.test.ts` falha (módulo inexistente).
- [ ] **Step 3:** implementar `src/lib/periodo.ts`, usando `formatDateBR` para as datas do texto (sem o ano quando ele é o corrente).
- [ ] **Step 4:** o jest do arquivo e a guarda `data-local-sem-utc` passam; `tsc` e lint em 0.
- [ ] **Step 5:** commit `feat(periodo): módulo único de período (atalhos, semana na segunda, texto)`.

### Task 2: período lembrado por tela

**Files:**

- Create: `src/hooks/usePeriodoLembrado.ts`
- Test: `src/hooks/__tests__/usePeriodoLembrado.test.ts`
- Modify: `src/lib/auth/limparEstadoLocal.ts` (acrescentar `'@rotamestre:periodo:'` a `PREFIXOS_DA_CONTA`, com o comentário apontando o hook)

**Interfaces:**

- Consumes: `Periodo`, `lerPeriodo`, `PERIODO_PADRAO` (Task 1).
- Produces:

```ts
export type TelaPeriodo =
  | 'gestao_rotas'
  | 'inicio_gestor'
  | 'incidentes'
  | 'perfil_motorista'
  | 'desempenho_motorista'
  | 'historico_motorista';
export function chavePeriodo(tela: TelaPeriodo, usuarioId: string): string; // '@rotamestre:periodo:<tela>:<usuarioId>'
export function usePeriodoLembrado(
  tela: TelaPeriodo,
  padrao?: Periodo, // default PERIODO_PADRAO
): {
  periodo: Periodo;
  definirPeriodo: (p: Periodo) => void;
  carregado: boolean;
};
```

- O id do usuário vem do hook de sessão que as telas já usam; use o mesmo
  das telas do gestor e do motorista. Sem usuário, não grava e usa o padrão.
- Antes de `carregado` ficar `true`, o `periodo` é o padrão. As telas só
  disparam a consulta depois de `carregado`, para não buscar duas vezes.
- A falha de leitura ou de gravação no AsyncStorage não é crítica: vira
  `logger.warn` e o app segue com o padrão.

- [ ] **Step 1: testes que falham:**
  - sem nada gravado, devolve o padrão e `carregado: true`;
  - `definirPeriodo({tipo:'mes_passado'})` grava o JSON na chave `@rotamestre:periodo:gestao_rotas:u1`;
  - **Review Focus 2:** `{tipo:'este_mes'}` gravado e lido com o relógio em outro mês continua `{tipo:'este_mes'}`, e não as datas antigas;
  - o personalizado volta com as mesmas datas;
  - **Review Focus 3:** JSON quebrado e personalizado com `de > ate` voltam ao padrão sem lançar;
  - usuários diferentes não se veem;
  - `limparEstadoLocalDoUsuario` apaga as chaves com o prefixo (no teste existente de `limparEstadoLocal`, ou num novo).
- [ ] **Step 2:** confirmar que os testes falham.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** testes, `tsc` e lint.
- [ ] **Step 5:** commit `feat(periodo): período lembrado por tela e por usuário`.

### Task 3: componente `SeletorPeriodo`

**Files:**

- Create: `src/components/periodo/SeletorPeriodo.tsx` (e, se ficar grande,
  arquivos irmãos na mesma pasta), com `index.ts`
- Test: `src/components/periodo/__tests__/SeletorPeriodo.test.tsx`
- Pode extrair, sem mudar o comportamento atual, o calendário de intervalo
  (web) e os pickers nativos de `src/components/route-filters/DateRangeFilterSection.tsx`
  para a pasta nova. O `DateRangeFilterSection` continua funcionando até a
  Task 6.

**Interfaces:**

- Consumes: Tasks 1 e 2 (só os tipos).
- Produces:

```ts
export interface SeletorPeriodoProps {
  valor: Periodo;
  aoMudar: (p: Periodo) => void;
  cortarEmHoje?: boolean; // texto mostra o intervalo cortado (telas de desempenho)
  testID?: string; // default 'seletor-periodo'
}
export function SeletorPeriodo(props: SeletorPeriodoProps): JSX.Element;
```

- **O botão** mostra `textoPeriodo(valor, cortarEmHoje ? cortarEmHoje(resolverPeriodo(valor)) : undefined)`.
  Quando o corte devolve `null`, mostra só o texto sem corte.
- **Abaixo de 1024 px**, uma folha (Modal) com os 8 itens, na ordem de
  `ATALHOS_PERIODO`, com "Personalizado" antes de "Todo o período".
- **A partir de 1024 px**, um menu ancorado com os mesmos itens. No
  personalizado, o calendário de intervalo.
- **"Personalizado"** pede "De" e "Até". O botão "Aplicar" fica desabilitado
  enquanto faltar data ou `de > ate`.
- **Visual:** tokens de `.claude/refs/design-system.md` e `useResponsive()`.
- **Acessibilidade:** `accessibilityRole="button"` e `accessibilityLabel`
  "Período: <texto>".

- [ ] **Step 1: testes que falham:**
  - o botão mostra "Este mês (01/11 a 30/11)" com o relógio em 2026-11-10;
  - abrir e tocar "Mês passado" chama `aoMudar({tipo:'mes_passado'})` e fecha;
  - "Personalizado" com `de > ate` deixa "Aplicar" desabilitado (**Review Focus 3**);
  - com `cortarEmHoje`, o botão mostra "Este mês (01/11 a 10/11)";
  - os 8 rótulos, na ordem.
- [ ] **Step 2:** confirmar que falham.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** testes, `tsc` e lint. Rodar também os testes de `src/components/route-filters/__tests__`, caso algo tenha sido extraído.
- [ ] **Step 5:** commit `feat(periodo): SeletorPeriodo (folha no celular, menu no computador)`.

### Task 4: Migration 90 — desempenho por período e índices (só arquivos; quem aplica é a sessão principal)

**Files:**

- Create: `database/migrations/20261110120000_periodo_desempenho.sql` e uma
  cópia idêntica em `supabase/migrations/` (a paridade é cobrada por
  `database/__tests__/pastas-de-migration.test.ts`)
- Create: `database/sondas/` com a sonda da M90, no padrão das sondas
  existentes: transacional, termina em RAISE que desfaz tudo e diz N/N OK
- Modify: `database/MIGRATIONS.md` (entrada "⏳ Migration 90", no formato das
  M85–M89)

**Conteúdo (as assinaturas finais são estas):**

- `desempenho_motorista_na_loja(p_motorista_id uuid, p_unidade_id uuid, p_de date DEFAULT NULL, p_ate date DEFAULT NULL) RETURNS jsonb`:
  - recriada a partir do corpo **vivo** da M89;
  - para obter o corpo vivo, ler o arquivo `20261108124000_desempenho_motorista_por_loja.sql`; a sessão principal confere no catálogo antes de aplicar;
  - acrescenta o filtro `(p_de IS NULL OR r.data >= p_de) AND (p_ate IS NULL OR r.data <= p_ate)` nas rotas;
  - `DROP FUNCTION` da assinatura de dois argumentos e `CREATE` da nova;
  - mantém `SECURITY DEFINER`, `SET search_path = public`, GRANT/REVOKE e o `SEM_PERMISSAO`;
  - a chamada nomeada com dois argumentos continua respondendo igual.
- `resumo_desempenho_motorista(p_motorista_id uuid, p_dias integer DEFAULT NULL, p_de date DEFAULT NULL, p_ate date DEFAULT NULL)`:
  - recriada a partir de `20261024180000_resumo_desempenho_motorista.sql` (e de alguma versão posterior, se existir; procure pelo nome em `database/migrations`);
  - **regra:** se `p_de` ou `p_ate` não for nulo, eles valem e `p_dias` é ignorado; senão, o comportamento atual de `p_dias`, idêntico;
  - **retorno:** a mesma `TABLE` de hoje mais `tempo_medio_minutos numeric`;
  - **tempo médio:** a mesma fórmula que `src/hooks/motorista/historico/useHistoricoMetrics.ts` usa hoje para o cabeçalho do Histórico. Leia-a e replique; registre a fórmula no comentário da função;
  - `DROP` da assinatura `(uuid, integer)` e `CREATE` da nova;
  - mantém permissões e segurança.
- **Índices:**
  - `CREATE INDEX IF NOT EXISTS idx_rotas_unidade_data_id ON public.rotas (unidade_id, data DESC, id DESC);`
  - `CREATE INDEX IF NOT EXISTS idx_incidentes_unidade_created_id ON public.incidentes (unidade_id, created_at DESC, id DESC);`
- Bloco `-- ROLLBACK:` no fim.

**Sonda: os casos que precisam dar OK**

1. A chamada antiga `resumo_desempenho_motorista(m, 7)` devolve os mesmos números que a versão viva (compare com valores calculados na própria sonda sobre dados semeados nela) (**Review Focus 5**).
2. `resumo_desempenho_motorista(m, NULL, '2026-11-01', '2026-11-30')` conta só rotas de novembro.
3. `p_de` e `p_ate` com `p_dias` vencem o `p_dias`.
4. `tempo_medio_minutos` bate com o esperado num cenário semeado.
5. `desempenho_motorista_na_loja(m, u)` sem período é igual ao de antes.
6. Com período, recorta.
7. Quem não é gestor da loja continua recebendo `SEM_PERMISSAO`.
8. Os dois índices existem.

- [ ] **Step 1:** escrever a sonda primeiro, com os casos acima. Ela vai rodar junto com o corpo da migration.
- [ ] **Step 2:** escrever a migration e a cópia.
- [ ] **Step 3:** `npx jest database/__tests__` passa (paridade) e `npm run lint` passa.
- [ ] **Step 4:** a entrada no `MIGRATIONS.md`, ⏳ não aplicada.
- [ ] **Step 5:** commit `feat(banco): Migration 90 — desempenho por período e índices de loja+data`.

> **Sessão principal, depois do merge do grupo B:**
>
> 1. Revisão de RLS (agente `rls-policy-reviewer`).
> 2. Sonda pré: corpo sem BEGIN/COMMIT + sonda, num único `npx supabase db query --linked -f`.
> 3. Aplicação.
> 4. Sonda pós.
> 5. Registro com `insert … returning`.
> 6. Conferir pela API que as duas RPCs respondem: chamada sem login → 42501, nunca PGRST202.
> 7. `MIGRATIONS.md` para ✅, num PR de docs.

### Task 5: Gestão de Rotas e exportação

**Files:**

- Modify: `src/lib/gestor/consultaRotas.ts`, `src/hooks/useGestaoRotas.ts`, `app/gestor/gestao-rotas.tsx`, `src/hooks/gestao-rotas/routeExport.ts`, `src/hooks/gestao-rotas/routeExportXLSX.ts`
- Test: testes existentes desses módulos (ajuste) mais novos em `src/lib/gestor/__tests__/` e `src/hooks/__tests__/`

**Interfaces:**

- Consumes: `IntervaloDatas`, `resolverPeriodo`, `textoPeriodo` (Task 1); `usePeriodoLembrado('gestao_rotas')` (Task 2); `SeletorPeriodo` (Task 3).
- Produces: `FiltrosRotas` ganha `periodo: IntervaloDatas`.
- `BuscaRotas` e `interpretarBusca` deixam de reconhecer data. A busca é só
  por nome de motorista. Remova o código de data e `ANO_INICIAL_BUSCA`, se
  ficarem sem uso (o knip acusa export morto).
- `nomeArquivoExportacao(intervalo: IntervaloDatas, extensao: 'csv' | 'xlsx', hojeISO?: string): string`, em `routeExport.ts`:
  - com período, `gestao-rotas-01-11-2026_a_30-11-2026.csv`;
  - sem período, o nome de hoje (`gestao-rotas-<dd-mm-aaaa>.<ext>`).

**Comportamento:**

- **Seletor** ao lado dos chips de status, no desktop e no mobile.
- **Consulta:** o período vira `.gte('data', de)` e `.lte('data', ate)` dentro de `aplicarFiltros`, com os nulos ignorados. O cursor e a contagem (`count=exact`, `contarRotasPorStatus`) respeitam o período.
- **Total:** "N rotas no período". Em "Todo o período", o texto de hoje.
- **Busca:** o placeholder passa a ser "Buscar por motorista".
- **Exportação:** mesmo filtro e nome com período.
  - **Review Focus 4:** com zero rotas no período, não gera arquivo e mostra o toast "Nenhuma rota no período".
  - O teto `TETO_EXPORTACAO_ROTAS` e o aviso continuam.

- [ ] **Step 1: testes que falham:**
  - `buscarRotas` com `periodo {de:'2026-11-01', ate:'2026-11-30'}` chama `gte('data','2026-11-01')` e `lte('data','2026-11-30')` (mock do cliente no padrão dos testes existentes);
  - com `{null,null}`, não chama `gte`/`lte` em `data`;
  - `interpretarBusca('05/10/2026')` passa a ser busca por texto;
  - `nomeArquivoExportacao` nos dois casos;
  - exportação vazia mostra o toast e não chama o download;
  - a tela renderiza o `SeletorPeriodo` com "Este mês (…)" por padrão.
- [ ] **Step 2:** confirmar que falham.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** testes, `tsc` e lint. Procure e ajuste qualquer teste que ainda exija busca por data: teste que fixa o comportamento antigo deve mudar junto, não ser contornado.
- [ ] **Step 5:** commit `feat(gestor): período na Gestão de Rotas e na exportação; busca só por motorista`.

### Task 6: Início do gestor

**Files:**

- Modify: `src/components/gestor/dashboard/_hooks/useDashboardData.ts`, `app/gestor/inicio.tsx`, `src/components/RouteFilters.tsx`, `src/components/route-filters/*` (sai a seção de período antiga, e `PeriodPreset` e o `_handlePresetSelect` saem), `src/components/gestor/dashboard/_components/mobile/DashboardMobile.tsx` e o desktop correspondente (`ResumoDoDia.tsx` e outros que mostram "hoje")
- Test: testes existentes de `useDashboardData`, `RouteFilters` e `route-filters` (ajuste) mais novos

**Interfaces:**

- Consumes: Tasks 1–3; `usePeriodoLembrado('inicio_gestor')`.
- O estado de período sai de `RouteFiltersState` (status e motorista
  continuam lá). `useDashboardData` passa a receber `periodo: IntervaloDatas`
  no lugar de `dataInicio/dataFim`.

**Comportamento:**

- **Padrão "Este mês"**, com o seletor no lugar do "Selecionar período".
- **Textos que diziam "hoje" seguem o período.** O resumo da barra de filtros passa a ser "Todos os status, este mês, todos os motoristas", com o rótulo do atalho em minúsculas, ou as datas no personalizado. O vazio "Nenhuma rota cadastrada hoje" vira "Nenhuma rota em <texto do período>". O botão "Criar rota" continua.
- **`JANELA_PERIODO_ABERTO_DIAS`** só se aplica a "Todo o período".
- **Lista do Início:** com período, segue como está. Em "Todo o período", ganha limite de 500 rotas, ordenadas por data decrescente. Se o limite for atingido, aparece o aviso "Mostrando as 500 rotas mais recentes. Escolha um período para ver as demais." (spec: o teto de 1.000 linhas do PostgREST cortaria em silêncio).
- **KPIs fixos do celular:** "Esta Semana" passa a usar `resolverPeriodo({tipo:'esta_semana'})`, com `de` na segunda e `ate` em hoje, para não contar o futuro do KPI. "Rotas no Mês" continua no mês corrente, com `ate` em hoje como está.
- **Troca de loja:** continua resetando só o motorista, e o período se mantém.

- [ ] **Step 1: testes que falham:**
  - a consulta da lista com o período usa `gte/lte` de novembro;
  - "Esta Semana" em 2026-11-10 consulta `gte('data','2026-11-09')`;
  - o texto do vazio com "Este mês";
  - o limite de 500 com o aviso em "Todo o período";
  - o resumo da barra.
- [ ] **Step 2:** confirmar que falham.
- [ ] **Step 3:** implementar e apagar o código morto dos presets antigos (o knip não pode acusar sobra nova).
- [ ] **Step 4:** testes, `tsc`, lint e `npm run scan:nao-declarado`.
- [ ] **Step 5:** commit `feat(gestor): Início com o seletor de período (padrão este mês)`.

### Task 7: Incidentes do gestor

**Files:**

- Modify: `src/hooks/incidentes-gestor/consultaIncidentes.ts`, `src/hooks/useIncidentesGestor.ts`, `app/gestor/incidentes.tsx`
- Test: testes existentes (ajuste) mais novos

**Interfaces:**

- Consumes: `limitesEmInstante`, `resolverPeriodo` (Task 1); `usePeriodoLembrado('incidentes')`; `SeletorPeriodo`.
- Produces:
  - `FiltrosIncidentes` ganha `periodo: IntervaloDatas`;
  - `contarPendentesAntesDoPeriodo(unidadeId: string, categoria: string | null, de: string): Promise<number>`: HEAD com `count`, status `aberto` ou `em_analise` e `created_at < desde(de)`. Use os valores de status reais de `src/hooks/incidentes-gestor/constants.ts`.

**Comportamento:**

- **Lista e contagens por status:** `created_at >= desde` e `created_at < antesDe`, em instantes de `limitesEmInstante`.
- **Aviso:** com `de` não nulo e contagem maior que zero, aparece acima da lista "N incidentes pendentes de antes do período" (no singular quando N=1: "1 incidente pendente de antes do período"), com o botão "Ver". O "Ver" faz `definirPeriodo({tipo:'todo'})` e marca os status Aberto e Em análise. Em "Todo o período" não há aviso.
- **O Início** continua contando os abertos da loja inteira, sem mudança.

- [ ] **Step 1: testes que falham:**
  - a consulta com novembro usa `gte('created_at', '2026-11-01T03:00:00.000Z')` e `lt('created_at', '2026-12-01T03:00:00.000Z')` com `TZ=America/Sao_Paulo`;
  - a contagem de pendentes antes;
  - o aviso aparece, some em "Todo o período" e o "Ver" troca o período e o status;
  - o singular e o plural.
- [ ] **Step 2:** confirmar que falham.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** testes, `tsc` e lint.
- [ ] **Step 5:** commit `feat(gestor): período nos Incidentes, com aviso dos pendentes anteriores`.

### Task 8: Perfil do motorista (gestor) e Meu Desempenho (motorista)

**Pré-requisito:** a M90 aplicada (a sessão principal confirma antes de despachar).

**Files:**

- Modify: `src/lib/gestor/performanceMotorista.ts`, `app/gestor/motorista-perfil.tsx`, `src/components/gestor/motorista-perfil/PerformanceKPIs.tsx`, `src/lib/motorista/resumoDesempenho.ts`, `src/hooks/motorista/useDesempenhoStats.ts`, `app/motorista/desempenho.tsx`
- Test: testes existentes (ajuste) mais novos

**Interfaces:**

- Consumes: `cortarEmHoje`, `resolverPeriodo`, `textoPeriodo` (Task 1); `usePeriodoLembrado('perfil_motorista' | 'desempenho_motorista')`; `SeletorPeriodo` com `cortarEmHoje`.
- Produces:
  - `buscarPerformanceMotorista(motoristaId, unidadeId, intervalo: IntervaloDatas)`, que manda `p_de/p_ate`. Leia a assinatura atual e acrescente o parâmetro;
  - `buscarResumoDesempenho(motoristaId, opcoes: { dias?: number | null; intervalo?: IntervaloDatas })`, que manda `p_de/p_ate` quando há `intervalo` e mantém `p_dias` para quem ainda o usa (`useMilestones.ts`);
  - `ResumoDesempenho` ganha `tempoMedioMinutos: number | null`.

**Comportamento:**

- **Nas duas telas o intervalo passa por `cortarEmHoje`.** Quando o corte devolve `null`, a tela não chama a RPC e mostra o vazio "Nenhuma rota neste período", sem cartões zerados.
- **Perfil:** o seletor fica acima dos indicadores, e o título da seção leva o texto do período. "Rotas recentes" passa a ordenar por `data` desc, depois `id` desc, ainda com `limit(10)`.
- **Meu Desempenho:** "7 dias", "30 dias" e "Total" saem e entra o seletor.

- [ ] **Step 1: testes que falham:**
  - o perfil com "Este mês" em 2026-11-10 chama a RPC com `p_de:'2026-11-01', p_ate:'2026-11-10'`;
  - o personalizado futuro não chama a RPC e mostra o vazio;
  - Meu Desempenho chama `resumo_desempenho_motorista` com `p_de/p_ate` e sem `p_dias`;
  - `useMilestones` continua chamando com `p_dias`;
  - "Rotas recentes" ordena por `data`;
  - `tempoMedioMinutos` é lido da linha.
- [ ] **Step 2:** confirmar que falham.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** testes, `tsc` e lint.
- [ ] **Step 5:** commit `feat: período no Perfil do motorista e no Meu Desempenho (fim cortado em hoje)`.

### Task 9: Histórico do motorista

**Files:**

- Modify: `src/hooks/motorista/historico/useHistoricoData.ts`, `useHistoricoFilters.ts`, `useHistoricoMetrics.ts`, `types.ts`, `index.ts`, `app/motorista/_screens/historico.tsx`
- Test: testes existentes do histórico (ajuste) mais novos

**Interfaces:**

- Consumes:
  - Tasks 1–3;
  - `usePeriodoLembrado('historico_motorista')`;
  - `buscarResumoDesempenho(motoristaId, { intervalo })` (Task 8), para o cabeçalho, **sem** `cortarEmHoje`;
  - `{ dias: null, intervalo: resolverPeriodo({tipo:'este_mes'}) }` para a métrica "{n} este mês" quando o filtro não for "Este mês".
- `FiltroPeriodo` sai de `types.ts`; quem usava passa a usar `Periodo`.

**Comportamento:**

- **A consulta leva o período ao banco** (`gte/lte` em `data`), em páginas de 50 com "Carregar mais", ordenada por `data` desc e `id` desc. Ela não baixa mais todas as rotas nem conta as paradas de todas: conta só as da página.
- **Os chips de status** continuam filtrando a lista no banco (`eq('status', …)`).
- **O cabeçalho** (N rotas, concluídas, taxa, tempo médio, paradas X/Y e km) vem do resumo do período, e não da lista baixada. Ele segue só o período, não o chip de status **(decisão do Claude, no plano)**. "Mostrando X de Y" usa Y = `totalRotas` do resumo quando o status é "Todos"; com status escolhido, usa o `count` da consulta.
- **"Hoje" não traz a rota de amanhã**, porque `ate` é hoje.

- [ ] **Step 1: testes que falham:**
  - a rota com `data` de amanhã não aparece em "Hoje" (o mock do banco recebe `lte('data', hoje)`);
  - a consulta pede uma página (`range(0, 49)`) e não faz loop de todas;
  - o cabeçalho usa os números do resumo, e não a soma da lista;
  - "{n} este mês" com o filtro em "Mês passado" faz a consulta à parte;
  - "Carregar mais" pede a página seguinte.
- [ ] **Step 2:** confirmar que falham.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** testes, `tsc` e lint.
- [ ] **Step 5:** commit `feat(motorista): Histórico com período no banco e cabeçalho do período`.

---

## Integração (sessão principal)

- [ ] **Por grupo:**
  - revisão de cada task e revisão final do grupo (o modelo mais capaz);
  - push e PR, com o CI verde;
  - merge com squash `--admin`, delegado no plano;
  - `gh pr update-branch` nos PRs abertos.
- [ ] **Banco:** aplicar a M90 (protocolo da Task 4) antes de despachar a Task 8.
- [ ] **Navegador:** build da branch servida localmente (`expo export --platform web --clear`, a `dist` servida em outra porta e o service worker limpo), com login do gestor. Conferir:
  - Gestão de Rotas com exportação;
  - Início;
  - Incidentes;
  - Perfil.
- [ ] **Docs:**
  - `PROJECT_CONTEXT`: pendência nova com o que falta no aparelho (Histórico e Meu Desempenho na próxima versão nativa);
  - `HISTORICO`;
  - `MIGRATIONS.md` (M90 ✅).
- [ ] **Aparelho:** Histórico e Meu Desempenho entram na próxima versão nativa. Cada etapa da Play precisa de OK do gestor.
