# Recrutamento de testadores na plataforma web — Design

**Date:** 2026-08-04
**Branch:** `feat/recrutamento-testadores-web`
**Origem:** pedido do gestor — "disponibilizar o acesso à loja para baixar o app (ou o próprio app) na página da plataforma web". Refinado em brainstorming para o objetivo real: **captação de testadores**.

## Problema

A produção da Play Store está bloqueada: a submissão foi recusada com `Precondition check failed` (ver `docs/PROJECT_CONTEXT.md` e `docs/GOOGLE_PLAY_DEPLOYMENT.md`). A causa provável é o requisito do Google para **contas de desenvolvedor pessoais**: mínimo de ~12 testadores com opt-in contínuo por 14 dias no teste fechado antes de liberar a produção.

Logo, o gargalo do lançamento não é UI de download — é **número de testadores com opt-in**. Hoje não existe, em lugar nenhum da plataforma web, um caminho para uma pessoa virar testadora. A tela de login (`app/auth/login.tsx`) é o ponto de maior tráfego e não oferece isso.

## Objetivo

Transformar tráfego da web em testadores com opt-in no teste fechado Android, para satisfazer o requisito da Play e destravar a produção.

**Métrica de sucesso:** aumento de participantes com opt-in contínuo no teste fechado (verificado no Play Console), até satisfazer o requisito mostrado pelo Console.

## Escopo

Duas peças no app web:

1. Rota pública `app/testar.tsx` — hub de recrutamento com passo a passo, detecção de plataforma e QR (desktop).
2. Link discreto para `/testar` na tela de login.

Mais o suporte: util de detecção de plataforma, módulo de configuração dos links (env), documentação em `.env.example`, testes.

### Não-objetivos

- **iOS / TestFlight.** Não há build iOS ainda; a página trata iPhone com aviso honesto, sem prometer data.
- **Publicar o link no Git.** Os links são operacionais e vêm de env (`EXPO_PUBLIC_*`), nunca hardcodados — preserva o espírito de `docs/GOOGLE_PLAY_DEPLOYMENT.md` L177 ("não em documentação pública") mesmo exibindo o link publicamente em runtime.
- **PWA / prompt de instalação.** Descartado em favor do teste fechado (decisão do gestor).
- **Analytics de conversão.** Não há infra de métricas de produto hoje (P2 futuro em `PROJECT_CONTEXT.md`). Fora do primeiro corte.
- **Recrutamento pela área autenticada (motorista/gestor).** O gestor escolheu a tela de login pública como canal. Área logada fica como follow-up possível, não neste escopo.

## Decisões (validadas com o gestor no brainstorming)

- **Estratégia:** distribuir via **link do teste fechado** (não PWA, não esperar a loja pública).
- **Objetivo real:** aumentar o número de testadores.
- **Local:** tela de login **pública** + página dedicada compartilhável (formato "Página `/testar` + link no login").
- **Plataforma:** Android apenas (iOS sem build).
- **Links:** sempre via env var, nunca no Git.

## Passo 0 — pré-requisito externo (fora do código; bloqueia o resultado)

**Sem este passo, a UI funciona mas ninguém consegue instalar** — todo visitante bate em "você não é um testador".

O teste fechado precisa aceitar **auto-cadastro**. No Play Console:

1. **Testes → Teste fechado →** trilha `alpha` **→ aba Testadores.**
2. Definir os testadores por um **Grupo do Google** (ex.: `testadores-rotamestre@googlegroups.com`) em vez de lista de e-mails fixa.
3. Em [groups.google.com](https://groups.google.com), configurar o ingresso do grupo como **"Qualquer pessoa na web pode participar"**.
4. Copiar, na mesma tela do Console, o **link de opt-in** ("Como os testadores participam" → _Copiar link_) e o e-mail/link do grupo.

Esses dois valores alimentam as env vars abaixo. O estado do Console é externo: confirmar lá, não deduzir pelo código.

## Arquitetura da solução

```
Visitante na web
   │
   ├── tela de login (app/auth/login.tsx)
   │        └── link discreto "📱 Seja um testador do app" ──► /testar
   │
   └── /testar (app/testar.tsx)  — rota pública, sem auth
            ├── detectWebPlatform() → 'android' | 'ios' | 'desktop'
            ├── getTesterLinks() / isRecruitmentEnabled()  (lê EXPO_PUBLIC_*)
            └── passo a passo → Grupo → opt-in → Play Store
```

### Peça 1 — Rota `app/testar.tsx`

- Pública, acessível sem login. Segue o padrão das telas legais (`app/politica-de-privacidade.tsx` etc.): rota fina em `app/` que monta a "casca" visual (`src/components/legal/LegalPage` reaproveitado para header/logo/scroll/ErrorBoundary) e um screen de conteúdo em `src/components/testar/`.
- Não interfere no redirect inteligente de `app/index.tsx` (que só age a partir de `/`).
- Conteúdo adaptado por plataforma (ver seção "Detecção de plataforma").
- Responsivo via `useResponsive()`.

### Peça 2 — Link na tela de login

- Em `app/auth/login.tsx`, um link leve **"📱 Seja um testador do app"** logo abaixo do footer "Ainda não tem conta? Solicitar acesso" (nos dois layouts: desktop split e mobile vertical).
- `onPress` → `router.push('/testar')`.
- Estilo discreto (`footerLinkText`/variante), sem competir com o botão **Entrar**.

## Detecção de plataforma

Util novo `src/utils/detectWebPlatform.ts` (JS puro, testável), baseado em `navigator.userAgent`:

| Retorno   | Condição                   | Experiência em `/testar`                                                                   |
| --------- | -------------------------- | ------------------------------------------------------------------------------------------ |
| `android` | UA contém "Android"        | Passo a passo em destaque, botões diretos (grupo → opt-in → Play)                          |
| `ios`     | UA contém iPhone/iPad/iPod | Aviso honesto: teste só Android; pode usar pelo navegador enquanto isso                    |
| `desktop` | demais                     | QR code (asset estático → `app.rotamestre.tec.br/testar`) + "abra no seu Android" + passos |

No SSR/sem `navigator` (build web estático), assume `desktop` como padrão seguro.

## Comportamento defensivo (gates)

1. **Gate por env (interruptor):** a feature só aparece se `EXPO_PUBLIC_PLAY_TESTING_OPTIN_URL` estiver definida.
   - Sem ela: o link no login **não é renderizado** e `/testar` mostra um estado neutro ("recrutamento indisponível no momento"), sem botões quebrados.
   - Isso permite mergear e publicar o código **antes** de o Passo 0 estar pronto, sem expor nada quebrado em produção.
2. **Gate por plataforma:** link e página só operam na **web** (`Platform.OS === 'web'`). No app nativo o link não aparece (quem está no app já é testador/instalou).

## Configuração (env vars)

Centralizadas num módulo `src/lib/testerLinks.ts` que lê `process.env` e expõe `getTesterLinks()` + `isRecruitmentEnabled()` (facilita teste e evita `process.env` espalhado).

| Variável                             | Papel                                                                                          | Obrigatória       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- | ----------------- |
| `EXPO_PUBLIC_PLAY_TESTING_OPTIN_URL` | Link de opt-in do teste fechado — **interruptor** da feature                                   | Sim (para ativar) |
| `EXPO_PUBLIC_PLAY_TESTER_GROUP_URL`  | Link do Grupo do Google (passo "entrar no grupo")                                              | Recomendada       |
| `EXPO_PUBLIC_PLAY_STORE_URL`         | Página da Play. Default: `https://play.google.com/store/apps/details?id=br.tec.rotamestre.app` | Não               |

- Documentadas em `.env.example` (sem valores reais).
- Valores reais só no **Vercel** (ambiente web). Não vão para o Git nem para EAS (a feature é web-only).

## Conteúdo (copy proposta — revisável)

**Passos (Android/desktop):**

1. **Entre no grupo de testadores** — "Participe com sua Conta Google. É esse cadastro que libera o app de teste para você."
2. **Aceite o teste** — "Abra o convite e toque em 'Tornar-se testador'. Use a mesma Conta Google do passo anterior."
3. **Instale o app** — "Abra a Play Store e instale o Rota Mestre. Pode levar alguns minutos até o app de teste aparecer."

**Aviso-chave (todos):** "Importante: use a mesma Conta Google (e-mail) nos três passos. Com contas diferentes, a Play não reconhece você como testador."

**iPhone:** "O app de teste ainda é só para Android. A versão para iPhone está a caminho — por enquanto, você pode usar o Rota Mestre pelo navegador."

Regra de honestidade (`GOOGLE_PLAY_DEPLOYMENT.md`): nada de preço, prazo ou recurso não disponível.

## Testes

- **Unit:**
  - `detectWebPlatform()` — Android/iOS/desktop/sem navigator.
  - `testerLinks` — `isRecruitmentEnabled()` liga/desliga por env; defaults.
  - `/testar` — render nos 3 modos de plataforma + estado neutro sem env.
  - `login` — link aparece só na web e só com env presente; navega para `/testar`.
- **Regressão visual:** snapshot de `/testar` (rota pública, coberta pelo Playwright público) e da tela de login com o novo link.
- Sem novas contas-fixture (fluxo é público, não autenticado).

## Arquivos afetados

| Arquivo                          | Mudança                                            |
| -------------------------------- | -------------------------------------------------- |
| `app/testar.tsx`                 | **novo** — rota pública                            |
| `src/components/testar/*`        | **novo** — screen de recrutamento + subcomponentes |
| `src/utils/detectWebPlatform.ts` | **novo** — util testável                           |
| `src/lib/testerLinks.ts`         | **novo** — leitura/gate das env vars               |
| `assets/qr-testar.*`             | **novo** — QR estático para desktop                |
| `app/auth/login.tsx`             | editar — link discreto para `/testar`              |
| `.env.example`                   | editar — documentar as 3 variáveis                 |
| testes correspondentes           | **novo**                                           |

## Riscos e mitigação

| Risco                                          | Mitigação                                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Passo 0 não feito → link não recruta           | Gate por env mantém a feature invisível até o opt-in existir; documentar o Passo 0 como bloqueador        |
| Pessoa usa Conta Google diferente nos passos   | Aviso-chave repetido e explícito em cada tela                                                             |
| QR exigir dependência nativa nova              | QR **estático** como asset (URL fixa) — zero dependência, sem rebuild EAS                                 |
| Link exposto publicamente vs. regra do runbook | Decisão consciente do gestor (objetivo é recrutamento aberto); mitigado mantendo o link fora do Git (env) |
| iPhone frustrado                               | Aviso honesto + alternativa (usar pelo navegador)                                                         |
