# Faxina do repositório e do código — 13/11/2026

## Intenção

Duas metas, em entregas separadas: deixar o repositório navegável (branches, docs, raiz) e deixar
o código mais saudável (mortos, `as any` evitáveis, vitrine pública). A varredura de 13/11 mostrou
o código já limpo — 0 `@ts-ignore`, os 9 `console.*` são legítimos (exemplos em comentário e o
filtro do LogBox), os itens de código morto da varredura de 08/11 já saíram. O acúmulo está em volta.

**Não-metas:** refatorar arquivos grandes (`design-system.tsx` 4.984 linhas, `styles.base.ts`),
trocar o padrão de estilo web, mexer em banco ou Edge Functions, retomar os bugs P1/P2 da varredura
de 08/11.

**Anti-metas:** apagar variante de plataforma (`.web.tsx`) por parecer morta; quebrar o e2e da
vitrine; perder documento que algum doc vivo ainda cita.

## Abordagens consideradas (vitrine `/design-system`)

| opção                                              | troca                                      | escolha       |
| -------------------------------------------------- | ------------------------------------------ | ------------- |
| Flag de build `EXPO_PUBLIC_VITRINE_DS` + `__DEV__` | simples; exige lembrar da flag em job novo | **escolhida** |
| Só gestor logado                                   | e2e precisa logar; cliente gestor ainda vê | descartada    |
| Tirar do bundle pelo Metro                         | bundle menor; frágil com rotas por arquivo | descartada    |

O `__DEV__` sozinho não serve: o e2e roda contra a `dist` de produção (`serve-dist.cjs`).

## PR 1 — repositório e docs (`[skip ci]` quando só doc)

1. **Branches:** apagar os 78 remotos e os 18 locais cujo PR está `MERGED` (conferido por `gh pr
list --head`). Dos 2 sem PR: `claude/quizzical-feistel-da0b25` não tem commit à frente da main e
   `docs/varredura-07-11` tem conteúdo idêntico ao da main — ambos saem. Descartar o stash
   `lint-staged automatic backup`. Feito fora do PR (não é arquivo).
2. **`docs/superpowers/`:** mover para `docs/superpowers/arquivo/` (preservando `plans/` e `specs/`)
   todo plano, spec e varredura de trabalho entregue. Fica fora do arquivo o que um doc vivo
   (`CLAUDE.md`, `PROJECT_CONTEXT.md`, `README.md`, `TESTING.md`) cita como pendente; links que
   apontam para os movidos são atualizados. `git mv` para manter o histórico.
3. **Docs paradas** (`FIREBASE_MIGRATION.md`, `REBUILD_RELAUNCH_PLAN.md`,
   `design-system-hex-report.md`): o que ainda vale vira parágrafo no `HISTORICO.md`; o arquivo vai
   para o arquivo. O `CLAUDE.md` cita `REBUILD_RELAUNCH_PLAN.md` — atualizar a referência.
4. **Raiz, um a um:** `setup-android-env.bat`, `start-android.bat`, `brand-guidelines.md`,
   `AGENTS.md`. Para cada um: quem o referencia (`git grep`), se ainda funciona. Morto sai; vivo vai
   para `scripts/` ou `docs/` com referências corrigidas. `AGENTS.md` pode ser lido por outras
   ferramentas na raiz — se ficar, fica na raiz.
5. **Números velhos:** o "134 `Unused exports`" do `CLAUDE.md` passa ao valor medido depois do PR 2
   (o PR 2 atualiza esse trecho).

## PR 2 — código (CI completo)

1. **Mortos do knip:** remover os 45 exports, 67 tipos e o export duplicado. Export usado só por
   teste sai junto com o teste. Variantes de plataforma (`entry` no `knip.jsonc`) ficam intactas.
   Depois: `npm run scan:morto:autoteste` (o knip ainda enxerga), `tsc`, `npm run lint` (repo
   inteiro), jest.
2. **`as any` não-estilo:** tipar os que não são estilo web — `role` em `AddressAutocomplete.tsx`
   (507, 509, 597), o tema em `design-system.tsx` (1178, 1189, 1200) e os demais que a leitura
   mostrar. Os de estilo web seguem a exceção documentada.
3. **Vitrine:** `VITRINE_LIBERADA = __DEV__ || process.env.EXPO_PUBLIC_VITRINE_DS === '1'`; sem ela,
   `<Redirect href="/" />`. Ligar a flag nos jobs do `test.yml` que buildam a `dist` para e2e e
   visual regression. **Prova:** a vitrine abre no e2e do CI e, na `dist` buildada sem a flag
   (como a Vercel), `/design-system` redireciona — conferido servindo a dist local.
4. Atualizar o trecho do knip no `CLAUDE.md` com o número novo e a data.

## Entrega

PR 1, merge (squash + `--admin`, pending = 0), depois PR 2 a partir da main nova. Sem empilhar.

## Deixado a quem executa

Ordem interna de cada PR; agrupamento dos commits; o tipo exato que substitui cada `as any`.
