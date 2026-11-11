# Filtros por período: uma regra só no app (design)

Data: 10/11/2026. Decisões do gestor tomadas nesta data, em menu, com
recomendação. O que está marcado **(decisão do Claude)** foi decidido por mim
e pode ser revisto.

## Por que

O app filtra por período em quatro lugares, e cada um tem uma definição
própria de "semana" e de "mês". O mapa completo foi levantado em 10/11 sobre
a main `230c1b06`.

| Onde                        | Definição atual                                                                                                                                                                                                                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Início do gestor            | Intervalo livre e, sem filtro, só hoje. Os atalhos existem no código (`route-filters/utils.ts`, `DateRangeFilterSection.tsx:162-174`), mas não aparecem na tela.                                                                                                                                                 |
| Início do gestor no celular | "Esta Semana" vai de domingo até hoje; "Rotas no Mês" é o mês corrente (`useDashboardData.ts:507-572`).                                                                                                                                                                                                          |
| Histórico do motorista      | Hoje / Semana / Mês / Todos, filtrados no aparelho depois de baixar **todas** as rotas (`useHistoricoData.ts:56-95`, `useHistoricoFilters.ts:23-55`). Hoje, Semana e Mês não têm fim e incluem as rotas agendadas para amanhã. É o mesmo defeito que o Início do gestor já corrigiu (`useDashboardData.ts:308`). |
| Meu Desempenho              | 7 dias / 30 dias / Total, pela RPC `resumo_desempenho_motorista(p_motorista_id, p_dias)`. O "7 dias" cobre 8 dias, porque conta hoje mais 7.                                                                                                                                                                     |

Faltam filtros onde o gestor mais precisa:

- **Gestão de Rotas e exportação CSV/XLSX.** É onde se fecha o mês. Hoje o recorte só sai digitando `mm/aaaa` na busca, e ninguém descobre isso sozinho.
- **Perfil do motorista no gestor.** Os indicadores somam todo o histórico e a tela não avisa.
- **Incidentes.** Lista e contagens cobrem a vida inteira da loja.

O volume ainda é pequeno: 950 rotas, sendo 539 na maior loja. O problema de
hoje é de uso e de leitura dos números. Desempenho só vai pesar mais tarde, e
o Histórico do motorista é o primeiro onde isso vai acontecer.

## Objetivo

1. **Uma definição de período** para o app inteiro: os mesmos atalhos, a
   mesma semana, o mesmo mês e o mesmo texto na tela.
2. **Um seletor de período** com cara e comportamento iguais em todas as
   telas listadas abaixo.
3. O fechamento do mês na **Gestão de Rotas e na exportação** funciona em
   dois toques.
4. O **Histórico do motorista** baixa só o período escolhido.

### Fora do escopo

- Notificações e linha do tempo da rota. A linha do tempo já é por rota, e as
  notificações vêm paginadas.
- Relatórios novos e gráficos.
- Trocar a data do incidente pela hora em que o motorista reportou. Na fila
  offline essas horas diferem; isso já está anotado como pendência e não
  entra aqui.

### O que seria um fracasso

- **Rota que some sem aviso.** Como o padrão passa a ser "Este mês", o
  período ativo precisa estar sempre visível.
- **Erro de fuso.** Um dia a mais ou a menos na virada, a partir das 21:00.
- **App antigo quebrado.** Os motoristas com versões anteriores à próxima
  continuam chamando as RPCs atuais.

## Definição do período

### Atalhos

A lista é a mesma em todas as telas, nesta ordem:

| Atalho         | De                         | Até                        |
| -------------- | -------------------------- | -------------------------- |
| Hoje           | hoje                       | hoje                       |
| Ontem          | ontem                      | ontem                      |
| Esta semana    | segunda-feira desta semana | domingo desta semana       |
| Semana passada | segunda-feira anterior     | domingo anterior           |
| Este mês       | dia 1 do mês               | último dia do mês          |
| Mês passado    | dia 1 do mês anterior      | último dia do mês anterior |
| Personalizado  | escolhido                  | escolhido                  |
| Todo o período | sem limite                 | sem limite                 |

- **Intervalo fechado.** Os dois extremos entram, e todos os atalhos têm um
  fim. Isso corrige o "Hoje" do Histórico, que trazia amanhã.
- **A semana começa na segunda** (decisão do gestor). O "Esta Semana" do
  Início no celular passa a seguir essa regra.
- **"Este mês" inclui os dias que ainda não chegaram** **(decisão do Claude)**.
  Uma rota agendada para o dia 28 aparece na lista de novembro, que é o que o
  fechamento e o planejamento esperam.
- **Personalizado** exige que "de" seja anterior ou igual a "até" e não tem
  teto de duração. O teto da exportação (`TETO_EXPORTACAO_ROTAS`, 10.000)
  continua valendo e continua avisando.
- **"Hoje" é o dia no fuso do aparelho**, por `getTodayISO` e
  `toLocalISODate` (`src/lib/dateUtils.ts`). É a mesma regra da meia-noite
  local que o app já usa. O banco recebe as datas prontas, em texto
  `AAAA-MM-DD`, e não calcula "hoje".

### Texto na tela

O seletor mostra o atalho e as datas. Exemplos:

- "Este mês (01/11 a 30/11)"
- "Hoje (10/11)"
- "Personalizado (01/10 a 15/10)"
- "Todo o período", sem datas.

O ano só aparece quando não é o corrente, e as datas saem de `formatDateBR`.

### Módulo único

Um arquivo em `src/lib/` com:

- o tipo do período: o atalho, ou o personalizado com `de` e `até`;
- a resolução para `{ de, ate }` em texto `AAAA-MM-DD`, onde "Todo o período"
  vira `{ de: null, ate: null }`;
- o texto de exibição.

Os três tipos paralelos de hoje saem: `FiltroPeriodo` do Histórico, `Periodo`
de `useDesempenhoStats.ts` e `PeriodPreset` de `route-filters/types.ts`. O
módulo entra na guarda estática `src/lib/__tests__/data-local-sem-utc.test.ts`.

### Seletor

**(decisão do Claude, quanto à forma)** Um componente só, usado em todas as
telas da lista abaixo:

- **Celular:** um botão com o texto do período, que abre uma folha com os
  atalhos. "Personalizado" abre os dois seletores de data.
- **Computador:** um botão que abre um menu com os atalhos e um calendário de
  intervalo para o personalizado.

O componente reaproveita o que já existe em `src/components/route-filters/`
(calendário web e pickers nativos), mas sem depender do estado de status e de
motorista (`RouteFiltersState`). O visual segue o design system
(`.claude/refs/design-system.md`).

### Lembrar o período

O app guarda o período **por tela**, no aparelho (AsyncStorage, que no web é o
localStorage) (decisão do gestor).

- **Atalho:** grava-se o nome. Quem deixou "Este mês" em novembro abre
  dezembro já em dezembro.
- **Personalizado:** gravam-se as datas.
- **Chave:** inclui o id do usuário **(decisão do Claude)**, porque o
  aparelho pode ter mais de uma conta. As chaves entram na limpeza de dados
  da conta (`limparEstadoLocal`).
- **Valor ilegível ou atalho desconhecido:** volta ao padrão da tela, sem
  erro.

## Telas

| Tela                                    | Padrão   | Coluna                  | Onde filtra            |
| --------------------------------------- | -------- | ----------------------- | ---------------------- |
| Gestão de Rotas: lista e exportação     | Este mês | `rotas.data`            | Banco                  |
| Início do gestor (computador e celular) | Este mês | `rotas.data`            | Banco                  |
| Histórico do motorista                  | Este mês | `rotas.data`            | Banco, sem baixar tudo |
| Meu Desempenho do motorista             | Este mês | `rotas.data`            | RPC                    |
| Perfil do motorista (gestor)            | Este mês | `rotas.data`            | RPC                    |
| Incidentes do gestor                    | Este mês | `incidentes.created_at` | Banco                  |

### Gestão de Rotas e exportação

- **Seletor:** fica ao lado dos chips de status. O total passa a dizer
  "N rotas no período".
- **Exportação:** segue exatamente o período e o status escolhidos. O nome do
  arquivo leva o período, por exemplo `gestao-rotas-01-11-2026_a_30-11-2026.csv`.
  Em "Todo o período", mantém o nome de hoje.
- **A busca passa a ser só por motorista** (decisão do gestor). A busca por
  data em texto (`dd/mm/aaaa`, `mm/aaaa`, `dd/mm`, `aaaa`, em
  `consultaRotas.ts:131-171`) sai. O texto de ajuda do campo passa a ser
  "Buscar por motorista". O período fica só no seletor.
- A consulta continua paginada por cursor (`data desc, id desc`). O período
  vira `gte/lte` em `data` no mesmo `aplicarFiltros`.

### Início do gestor

- **Seletor:** o filtro "Período" dentro de `RouteFilters` passa a ser o
  seletor novo. Os atalhos escondidos aparecem, e o código morto sai, junto
  com o `_handlePresetSelect`.
- **Padrão "Este mês"** (decisão do gestor). Os textos que hoje dizem "hoje"
  passam a seguir o período. Exemplos: o resumo da barra de filtros ("Todos os
  status, este mês, todos os motoristas") e o vazio "Nenhuma rota cadastrada
  hoje", que vira o texto do período.
- **O teto de 60 dias à frente** (`JANELA_PERIODO_ABERTO_DIAS`) era para o
  intervalo sem fim. Com todo atalho tendo um fim, ele só continua valendo
  para "Todo o período".
- **Indicadores fixos do celular** ("Esta Semana", "Rotas no Mês") continuam
  como estão, mas a semana passa a começar na segunda.
- **A lista não é paginada.** `buscarLista` em `useDashboardData.ts` traz as
  paradas junto, e em "Todo o período" não tem limite para trás. O teto de
  1.000 linhas do PostgREST cortaria a lista sem avisar. Hoje são 539 rotas
  na maior loja, então isso ainda está longe, mas quem constrói precisa
  paginar ou pôr um limite com aviso.

### Histórico do motorista

- **Mesmo seletor** no lugar de Todos / Hoje / Semana / Mês. Os chips de
  status ficam.
- **A consulta leva o período ao banco** e pagina ("carregar mais"). Deixa de
  baixar todas as rotas e de contar as paradas de todas.
- **Os números do cabeçalho passam a ser do período** (decisão do gestor):
  N rotas, concluídas, taxa, tempo médio, paradas, km e "Mostrando X de Y".
  - Saem do banco com o mesmo `de/até`, porque somar só as páginas já
    baixadas daria errado com o "carregar mais".
  - A RPC de desempenho passa a devolver também o tempo médio.
  - O fim do período **não** é cortado em hoje: o Histórico é uma lista, e
    o cabeçalho descreve a lista.
- **A métrica "{n} este mês"** continua sendo o mês corrente. É um indicador
  fixo, não o filtro. Quando o filtro não for "Este mês", ela sai de uma
  consulta à parte.

### Desempenho: o fim do período para em hoje

**Valem para o Meu Desempenho e o Perfil do motorista** (decisão do gestor).
Nessas duas telas, o fim de qualquer atalho é cortado em hoje. As rotas
agendadas para os dias que ainda não chegaram baixariam a taxa durante o mês
inteiro.

- **O texto do seletor mostra o recorte real:** "Este mês (01/11 a 10/11)".
  O módulo de período oferece essa variante; não é cada tela que corta por
  conta própria.
- **Período inteiro no futuro:** se o período começar depois de hoje (só
  acontece no Personalizado), a tela mostra o vazio do período, sem números
  zerados que pareçam um resultado.
- **A Gestão de Rotas, o Início, o Histórico e os Incidentes** continuam com o
  período inteiro.

### Meu Desempenho (motorista)

- **Os atalhos novos** substituem 7 dias / 30 dias / Total, com o corte em
  hoje descrito acima.
- **A RPC passa a receber `de` e `até`.** Detalhe na seção Banco.

### Perfil do motorista (gestor)

- **O seletor fica acima dos indicadores**, e eles passam a ser do período,
  com o corte em hoje e o período escrito no título da seção.
- **"Rotas recentes"** continua mostrando as 10 últimas, mas passa a ordenar
  por `data` **(decisão do Claude)**. Hoje ordena por `created_at`, numa
  ordem diferente da Gestão de Rotas.

### Incidentes do gestor

- **O seletor fica ao lado dos chips de status e categoria.**
- **A lista e as contagens por status** passam a respeitar o período, por
  `created_at` (decisão do gestor), sem exceção para os pendentes.
- **Aviso de pendentes de antes do período** (decisão do gestor). Quando
  existir incidente Aberto ou Em análise criado antes do início do período, a
  tela mostra acima da lista "N incidentes pendentes de antes do período", com
  a ação "Ver". Nada pendente some sem aviso no dia 1.
  - **"Ver"** **(decisão do Claude)** troca o período para "Todo o período" e
    marca os status Aberto e Em análise. O período lembrado da tela passa a
    ser esse.
  - **A contagem do aviso** sai de uma consulta à parte (HEAD com `count`), com
    os mesmos filtros de loja e categoria.
  - **Em "Todo o período"** o aviso não aparece.
- **O Início continua contando os abertos da loja inteira**, sem período. O
  aviso explica a diferença entre o número do Início e a lista.

## Banco

As migrations entram no protocolo de sempre: sonda transacional antes, com o
corpo na mesma execução; aplicação pelo CLI; sonda depois; registro com
`RETURNING`. Push, merge, aplicação e deploy deste plano foram delegados pelo
gestor em 10/11, com o mesmo protocolo.

- **`desempenho_motorista_na_loja`** ganha `p_de date DEFAULT NULL` e
  `p_ate date DEFAULT NULL`. Nulo nos dois significa sem limite, o que
  preserva o comportamento atual de quem chama sem os parâmetros.
- **`resumo_desempenho_motorista`** ganha `p_de` e `p_ate` com o mesmo
  significado e passa a devolver também o **tempo médio por rota**, que o
  cabeçalho do Histórico precisa.
- **O corte em hoje das telas de desempenho é feito pelo app**, que manda o
  `p_ate` já cortado. A RPC não calcula "hoje". A assinatura atual `(uuid, int)` **continua existindo e
  respondendo igual**, porque o app nativo publicado a chama. Ela sai pelo
  processo do B-7, quando as versões que a usam sumirem dos acessos.
  **(decisão do Claude)** O Postgres não deixa duas sobrecargas ambíguas com
  defaults conflitantes; quem constrói escolhe a forma que compila, desde que
  a chamada antiga `(p_motorista_id, p_dias)` responda como hoje.
- **Índices** **(decisão do Claude)**: `rotas (unidade_id, data desc, id desc)`,
  que serve a lista, a exportação e o Início, e `incidentes (unidade_id,
created_at desc, id desc)`. Hoje não pesam; entram junto para não depender
  de alguém lembrar depois.
- As permissões das RPCs não mudam. Gestor ativo da loja e o próprio
  motorista continuam sendo as mesmas regras de hoje, e a revisão de RLS
  (agente `rls-policy-reviewer`) roda antes do merge.

## Fuso: regras que valem aqui

- `rotas.data` é `date`: nunca passa por `new Date()` e nunca sai de
  `toISOString()`. O período é montado como texto pelas funções de
  `dateUtils`.
- `incidentes.created_at` é timestamp: o limite do dia é a meia-noite local
  do aparelho convertida para instante. "Até" vale até 23:59:59.999 do dia,
  ou "menor que a meia-noite do dia seguinte".
- O CI roda em UTC, onde o código errado também passa. Os testes do módulo
  fixam um fuso de São Paulo no relógio falso **e** a guarda estática cobre o
  arquivo novo.

## Testes que provam a entrega

- **Módulo:**
  - cada atalho, com hoje numa segunda, num domingo, no dia 1 e no último dia
    do mês, em ano bissexto e na virada de ano;
  - "Semana passada" atravessando o mês;
  - o texto de exibição com e sem ano.
- **Lembrar o período:**
  - atalho gravado em novembro e lido em dezembro;
  - personalizado mantém as datas;
  - valor quebrado volta ao padrão;
  - chave por usuário.
- **Gestão de Rotas:**
  - a consulta leva `gte/lte` em `data`;
  - a exportação usa o mesmo filtro e põe o período no nome do arquivo;
  - a busca por data deixou de filtrar.
- **Histórico:** "Hoje" não traz a rota de amanhã; a consulta não baixa tudo.
- **Banco:** a sonda das duas RPCs com período, sem período e pela chamada
  antiga `(uuid, int)`.
- **Validação manual:** no navegador, a Gestão de Rotas, o Início, os
  Incidentes e o Perfil; no aparelho, o Histórico e o Meu Desempenho, na
  próxima versão nativa.

## O que fica para quem constrói

- Partir em PRs e decidir a ordem. Sugestão: módulo e seletor; Gestão de Rotas
  e exportação; Início; Incidentes; banco; Perfil e Meu Desempenho; Histórico.
- O desenho exato do seletor dentro do design system.
- A forma da sobrecarga ou dos parâmetros novos nas RPCs, desde que a chamada
  antiga continue respondendo igual.

## Impacto na distribuição

- **Só web e banco:** Gestão de Rotas, Início, Incidentes e Perfil.
- **Pedem versão nativa nova:** o Histórico e o Meu Desempenho do motorista.
  O Android do gestor também, para o celular.
