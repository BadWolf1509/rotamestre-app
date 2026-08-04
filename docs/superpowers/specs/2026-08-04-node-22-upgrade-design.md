# Upgrade Node 20 → 22 — Design

**Date:** 2026-08-04
**Branch:** `chore/node-22-upgrade`
**Origem:** o Dependabot `size-limit` 13 (#332/#335) exigia Node 22+, o que expôs a dívida real: o projeto roda em Node 20, **EOL desde 30/04/2026**.

## Problema

O projeto está fixado em Node 20 em todos os ambientes (dev, CI, EAS, Vercel). O **Node 20 chegou ao fim de vida em 30/04/2026** — não recebe mais patches de segurança. Um app em produção não deve rodar sobre um runtime EOL. Além disso, dependências novas já exigem Node 22+ (o `size-limit` 13 tem `engines: ^22.18.0 || ^24.0.0 || >=26.0.0` e não roda no CI atual), e o Expo SDK 57 exigirá Node 22.13+.

## Objetivo

Migrar todos os ambientes de Node 20 para **Node 22** (LTS até abr/2027), destravando o `size-limit` 13 e preparando o terreno para o Expo 57.

**Métrica de sucesso:** CI, build web (Vercel) e build nativo (EAS) todos verdes em Node 22, com o `size-limit` 13 passando o Bundle Size Check.

## Viabilidade (confirmada)

- **Expo SDK 56** suporta Node ≥20.19.4; o monorepo do Expo roda em **22.14**. Node 22 e 24 são suportados. Risco técnico baixo.
- Node 22 é LTS até **abr/2027** (+1 ano vs Node 20).

## Escopo

Um PR que:

1. Fixa Node 22 por **linha** (padrão atual do projeto, que usa `20.x`), em todos os pontos de config.
2. Sobe o `size-limit` 13 (#332+#335), destravado pelo Node 22.
3. É validado em CI + Vercel (web) + **build EAS de teste** (nativo) antes do merge.

### Não-objetivos

- **Expo SDK 57** (upgrade futuro próprio).
- **Node 24** — 22 é o LTS estável e o que o Expo usa; 24 fica para quando necessário.
- **Nitro #336 e maplibre #338** — pendentes de deps não relacionados a esta migração.
- Alterar a lógica da aplicação — é só runtime/toolchain.

## Decisões (validadas com o gestor no brainstorming)

- **Forma:** fixar por linha (`22.x` / `.nvmrc: 22` / `engines: >=22`), não pin exato.
- **size-limit 13:** incluído no mesmo PR (o Bundle Size Check valida os dois juntos).
- **Validação nativa:** o plano inclui um `eas build --profile preview` em Node 22 antes do merge.
- **Timing:** montar/abrir depois de estabilizar o lançamento (mergear #341/#342/#343).

## Como cada ambiente resolve o Node (mapa)

| Ambiente               | Fonte da versão              | Mudança                                                |
| ---------------------- | ---------------------------- | ------------------------------------------------------ |
| Dev local              | `.nvmrc`                     | `20` → `22`                                            |
| **EAS Build** (nativo) | lê o `.nvmrc` do repo        | herda o `.nvmrc: 22` (images já em `latest`)           |
| CI (GitHub Actions)    | `node-version` nos workflows | 6 pins `20.x` → `22.x`                                 |
| Vercel (web)           | dashboard + `engines.node`   | `engines >=22` + **setar 22.x no dashboard** (externo) |
| Documentação/mínimo    | `package.json` `engines`     | `>=20` → `>=22`                                        |

## Arquivos a mudar

| Arquivo                                  | Mudança                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `.nvmrc`                                 | `20` → `22`                                                                                                  |
| `.github/workflows/quality.yml`          | 2× `node-version: '20.x'` → `'22.x'`                                                                         |
| `.github/workflows/test.yml`             | 3× `node-version: [20.x]` → `[22.x]`                                                                         |
| `.github/workflows/update-snapshots.yml` | 1× `node-version: [20.x]` → `[22.x]`                                                                         |
| `package.json`                           | `engines.node` `>=20`→`>=22`; `size-limit` `^12.0.0`→`^13.0.1`; `@size-limit/preset-app` `^12.1.0`→`^13.0.1` |
| `package-lock.json`                      | regenerado via `npm install`                                                                                 |

**Passo externo (gestor):** Vercel → Project Settings → Node.js Version → **22.x**, antes do deploy de preview validar.

## Auto-consistência do PR

Os workflows já vão em `22.x` na branch do PR, então o CI do próprio PR roda em Node 22 — e o `size-limit` 13 (que exige 22+) passa o Bundle Size Check dentro do mesmo PR. Sem isso, o size-limit 13 sozinho falharia (foi o que derrubou o #332). Merge fecha #332 e #335.

## Estratégia de validação (ordem, antes de mergear)

1. **Local:** trocar para Node 22 (se `nvm`/`fnm` disponível), `npm install`, `npm run validate` (type-check + lint + test), `npm run build:web`, `npm run size`. Se só houver Node 24 local, ele valida a lógica (mesma família ≥22); o Node 22 canônico é o CI.
2. **CI:** abrir o PR → os 3 workflows rodam em `22.x` → confirmar verde: Tests, TypeScript & Linting, **Bundle Size (size-limit 13)**, Visual Regression, Design System Drift.
3. **Vercel:** após setar o dashboard em 22.x, o deploy de preview do PR → confirmar build web OK em Node 22.
4. **EAS (nativo):** `eas build --platform android --profile preview` na branch (Node 22 via `.nvmrc`) → confirmar que o `.apk` compila. **Não submeter** — só validar o build.
5. Só com 1–4 verdes → mergear.

## Riscos e mitigação

| Risco                                           | Mitigação                                                                           |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| Build nativo depender de Node 20                | build EAS de teste (passo 4) pega antes de qualquer release                         |
| Vercel dashboard esquecido → web cai em Node 20 | setar o dashboard cedo e conferir a versão no log do preview                        |
| Regressão de glob no size-limit 13.0.0          | usar **≥13.0.1** (já corrige a regressão do `tinyglobby`)                           |
| Flaky `reset-password` (timeout) na suíte       | partir da `main` **já com #342 mergeado**, que leva o fix do timeout — não duplicar |
| Conflito de `package.json`/lock com #342/#343   | este é o **último** PR de deps a mergear; rebaseia sobre os anteriores              |

## Rollout

- **Timing:** só depois de estabilizar o lançamento (mergear #341 → #342 → #343 e confirmar o recrutamento de testadores).
- PR único (Node + size-limit 13), validado por CI + Vercel + EAS.
- Depois do merge: monitorar o primeiro build de release (EAS) e o deploy de produção (Vercel) em Node 22.
