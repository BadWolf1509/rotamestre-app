# Contexto operacional — Rota Mestre App

> Documento de entrada para novas sessões. Atualizado em 04/08/2026.
> Consulte o código ou o serviço responsável antes de alterar um estado externo.

## Retomada imediata

- Caminho local canônico: `D:\rota-mestre\rotamestre-app`.
- `main` integra, em 04/08/2026, cinco PRs por squash: recrutamento de
  testadores web (`/testar`), maplibre-gl 5→6, upgrade de **Node 20→22**
  (dev/CI/EAS/Vercel), alinhamento do Sentry e um lote de dependências. CI verde
  em cada um. Detalhe em "Estado confirmado em 04/08/2026".
- **Node 22 é o novo baseline** de runtime (`.nvmrc`, `engines.node`, CI e EAS
  Build). O próximo build EAS será o primeiro sob Node 22 — observe-o.
- Web: <https://app.rotamestre.tec.br> está publicada e revalidada após o merge
  (deploy de produção concluído; smoke test sem erros de console).
- Android: `1.12.2` / `3024` está concluído no teste fechado. A faixa de
  produção permanece vazia porque o Play recusou a submissão por
  `Precondition check failed`; confirme a elegibilidade no Console antes de
  tentar novamente.
- iOS: configuração inicial versionada, mas ainda não existe build. A próxima
  ação bloqueante é executar interativamente
  `npx eas-cli build --platform ios --profile production` e validar as
  credenciais Apple.
- Próxima prioridade sem credenciais Apple: ampliar e acompanhar o opt-in do
  teste fechado — agora com o hub público `/testar` para recrutar testadores — e
  manter os metadados/declarações das lojas coerentes.

## Resumo executivo

Este repositório contém o produto operacional do Rota Mestre:

- painel web para gestores em <https://app.rotamestre.tec.br>;
- aplicativo Android para motoristas;
- backend compartilhado no Supabase;
- otimização, execução e acompanhamento de rotas;
- fotos privadas de comprovação, ocorrências, notificações e histórico.

O código local está na versão **1.12.2**, com
`androidVersionCode` **3024**. O app foi reconstruído sob uma nova identidade
Android após a perda das contas de distribuição originais. O Supabase e os
dados dos usuários foram preservados.

## Identidades e serviços

| Item                     | Valor atual                            | Fonte de verdade                       |
| ------------------------ | -------------------------------------- | -------------------------------------- |
| Repositório              | `BadWolf1509/rotamestre-app`           | `git remote -v`                        |
| Caminho local canônico   | `D:\rota-mestre\rotamestre-app`        | workspace                              |
| Branch de produção       | `main`                                 | Git/Vercel                             |
| Web                      | <https://app.rotamestre.tec.br>        | Vercel                                 |
| Android package          | `br.tec.rotamestre.app`                | `app.config.js`                        |
| Versão Android no código | `1.12.2` / `3024`                      | `package.json`                         |
| EAS project              | `c6401a59-af97-484a-93b7-c75016bf331d` | `app.config.js`                        |
| Firebase                 | `rota-mestre-97084`                    | console Firebase / configuração nativa |
| Supabase project ref     | `xezslsyxjivunmhhyxtd`                 | `supabase/.temp/project-ref`           |
| Site institucional/legal | <https://rotamestre.tec.br>            | repositório `lp-rotamestre`            |
| Plataforma               | Expo 56, React Native 0.85.3, React 19 | `package.json`                         |

Não copie versões para outros documentos. Quando houver divergência, prevalecem
`package.json`, `app.config.js`, `eas.json` e o estado consultado nos consoles.

## Estado confirmado em 24/07/2026

### Aplicação e banco

- A Nova Entrega preserva rascunhos, faz validações mais defensivas, oferece
  revisão da rota e cria rota/paradas de forma transacional e idempotente.
- As migrations `20260722195606_security_revoke_definer_anon_param` e
  `20260723223000_nova_entrega_drafts_atomic_route` aparecem no histórico
  remoto do Supabase. A primeira revoga acesso indevido a funções
  `SECURITY DEFINER`; a segunda cria os rascunhos protegidos e a RPC atômica.
- O bucket `fotos-entrega` é privado. A aplicação resolve signed URLs em leitura
  e o RLS isola objetos por unidade.
- A autenticação Android foi corrigida após a rotação da chave pública do
  Supabase. Credenciais/sessões usam armazenamento seguro quando disponível.
- Os mapas usam a `polyline` viária persistida em `rotas` como fonte principal,
  com cache local e OSRM como fallback. Na ausência de geometria viária real, o
  app mantém os marcadores e informa a indisponibilidade; nunca representa
  paradas por segmentos retos como se fossem vias.
- Alterações de paradas invalidam a geometria e as métricas anteriores antes do
  recálculo. Se o serviço de rotas falhar, a operação permanece salva, o gestor
  recebe um aviso e o mapa não reutiliza um trajeto incompatível.
- As páginas de política de privacidade, termos e exclusão de conta existem no
  app e no site público.

### Android e Google Play

- A identidade nova está configurada no EAS, Firebase e Google Play; Play App
  Signing está habilitado.
- Estado das trilhas confirmado pela API em 24/07: teste fechado (`alpha`) em
  `1.12.2` / `3024`, teste interno em `1.12.1` / `3021`, `beta` e produção
  vazias. O AAB `1.12.2` / `3024` foi concluído no EAS sob o ID
  `630fe91d-a0b0-41f7-be7d-334876910375` e enviado com sucesso ao teste fechado
  pela submissão `b832dbc7-1b42-49fc-b7bc-838c2bb5fe46`.
- A submissão `f3c7e7a5-db29-4131-bafe-972d7b565946` à produção foi recusada
  pelo Play com `Precondition check failed`. O bloqueio é de elegibilidade da
  faixa, não de compilação ou assinatura do AAB. O profile `alpha` agora usa
  `releaseStatus: completed`.
- O build EAS de prévia `35fff202-d45b-4664-b447-8bc4c8756827`
  (`1.12.2` / `3024`) foi concluído e instalado incrementalmente no dispositivo
  de validação em 24/07. A atividade iniciou sem crash. É um artefato de teste,
  não uma publicação no Play.
- O teste interno foi configurado e a lista de testadores foi revisada nesta
  sessão. O endereço usado no Google Play deve ser o da **Conta Google** do
  testador; ele pode ser diferente do e-mail cadastrado no Rota Mestre.
- A versão presente em cada trilha, o período do teste fechado e a elegibilidade
  para produção são estados externos: confirme-os no Play Console antes de
  qualquer nova submissão. Não deduza isso apenas pelo `versionCode` local.
- Metadados, declarações e assets preparados para a loja estão em
  [play-store-metadata.md](play-store-metadata.md). O procedimento seguro de
  release está em [GOOGLE_PLAY_DEPLOYMENT.md](GOOGLE_PLAY_DEPLOYMENT.md).

### Web e iOS

- O commit funcional `3788f55` está publicado em
  <https://app.rotamestre.tec.br>. O bundle de produção foi validado no Chrome
  desktop e no Chrome de um Android físico: a consulta carrega `rotas.polyline`,
  o mapa usa a geometria viária persistida e não desenha segmentos retos.
- Site, política de privacidade, termos de uso e exclusão de conta responderam
  HTTP 200 em 24/07/2026.
- O iOS usa o bundle identifier `br.tec.rotamestre.app`. O commit `191db5a`
  adicionou `buildNumber` 1, a declaração de criptografia isenta e o profile de
  submissão. O primeiro build ainda depende da configuração interativa do
  certificado/provisioning profile com Apple ID e 2FA.
- O procedimento iOS está em
  [APP_STORE_DEPLOYMENT.md](APP_STORE_DEPLOYMENT.md).

### Qualidade

- O projeto possui Jest, Playwright, regressão visual, lint, type-check e CI.
- Em 24/07, `npm run validate` e `npm run build:web:clear` passaram. O Jest
  executou 312 suites, 5729 testes e 5 snapshots com exit code 0.
- No E2E, os cenários públicos de login passaram; os autenticados não puderam
  prosseguir porque as duas contas-fixture do ambiente não existem ou não têm
  credenciais válidas. Na regressão visual pública, 24/26 passaram; os dois
  snapshots de toast possuem diferença de rasterização de 1 px no Windows. Os
  detalhes e critérios de correção estão em `docs/TESTING.md`.
- Um dispositivo Android físico foi usado nesta sessão, mas sua conexão e
  autorização ADB devem ser verificadas novamente em cada ambiente.
- No aparelho de validação, `RUN_ANY_IN_BACKGROUND` estava em `ignore`. Isso é
  uma restrição de bateria configurada no dispositivo e pode impedir o
  rastreamento quando o app não está visível, mesmo com as permissões de
  localização concedidas. Confirme esse estado no smoke test de cada aparelho.
- O smoke visual da geometria da build 3024 foi concluído após o desbloqueio:
  a rota ativa carregou 28 pontos viários, coincidiu com a sequência de ruas
  retornada pelo OSRM e não usou ligação direta entre marcadores. No cenário
  inspecionado, o trecho longo parece diagonal porque acompanha a própria
  Avenida Rui Barbosa.
- A validação completa recomendada antes de release é `npm run validate`,
  seguida dos testes E2E/visuais relevantes e de um smoke test no Android.

## Estado confirmado em 04/08/2026

- Cinco PRs foram integrados à `main` por squash, em série com rebase entre cada
  um: `/testar` (#341), maplibre-gl 5→6 (#345), Sentry alinhado (#343), lote de
  dependências do Dependabot (#342) e Node 20→22 (#344). Como todos os PRs são
  do mesmo autor e a `main` exige uma aprovação de revisão, o merge usou override
  de administrador; os checks obrigatórios estavam verdes em cada um.
- **Node 22** passou a ser o baseline de dev, CI, EAS e Vercel: `.nvmrc` em `22`,
  `engines.node` em `>=22` e os workflows na matriz `22.x`. O EAS Build lê o
  `.nvmrc`, então o próximo build nativo será o primeiro sob Node 22.
- A proteção da `main` foi ajustada de `Run Tests (20.x)` para `Run Tests (22.x)`
  (mais `TypeScript & Linting`), acompanhando a renomeação dos jobs de CI.
- As versões de Sentry foram realinhadas juntas (dependência acoplada),
  `size-limit` subiu para a linha 13 e `react-native-nitro-modules` recebeu um
  patch — validados na suíte completa antes do merge. No conflito do lote de Node
  22, `supabase` foi mantido na versão da `main`, evitando um downgrade
  silencioso trazido pela base antiga da branch.
- Os dez PRs individuais do Dependabot que esses lotes substituem foram fechados
  (a maioria pelo próprio Dependabot ao detectar as versões já na base).
- O hub público `/testar` recruta testadores para o teste fechado Android, com
  passo a passo, detecção de plataforma e aviso de "mesma Conta Google". É a peça
  web que apoia o P0 de destravar a produção.
- O deploy de produção no Vercel concluiu com sucesso. Smoke test em
  <https://app.rotamestre.tec.br>: login e `/testar` carregam sem erros de
  console e a detecção de plataforma responde. As telas de mapa (maplibre 6)
  ficam atrás de login e não foram exercitadas no smoke test, mas o bundle que as
  contém foi construído e carregado sem erro, e o CI cobriu Bundle Size, Visual
  Regression e testes.

## Mudanças relevantes desta etapa

| Data       | Mudança                                                                                  | Referência                                   |
| ---------- | ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| 23/07/2026 | Nova Entrega com rascunho persistente, importação, revisão e criação atômica/idempotente | commit `e1f1bd5`, migration `20260723223000` |
| 23/07/2026 | Migration de segurança já aplicada foi incorporada ao histórico versionado               | commit `de8a036`, migration `20260722195606` |
| 24/07/2026 | Correção da autenticação Android após rotação de chave                                   | commit `6dd8aa8`                             |
| 24/07/2026 | Preparação do app e da ficha para o Google Play, páginas legais e exclusão de conta      | commit `b7a39dc`                             |
| 24/07/2026 | Geometria viária persistida nos mapas; remoção dos fallbacks visuais em linha reta       | commit `3788f55`                             |
| 24/07/2026 | Configuração inicial de distribuição e conformidade iOS                                  | commit `191db5a`                             |
| 04/08/2026 | Integração de 5 PRs: `/testar`, maplibre 6, Sentry, deps e Node 22 (baseline/CI)         | PRs #341/#345/#343/#342/#344                 |

O histórico completo do rebuild está em
[REBUILD_RELAUNCH_PLAN.md](REBUILD_RELAUNCH_PLAN.md), agora tratado como
registro de decisão e rollout — não como checklist inicial ainda não executado.

## Arquitetura e limites entre projetos

```text
rotamestre.tec.br
  Site institucional, SEO, marca e páginas legais públicas
                  │
                  ├── CTA de login
                  ▼
app.rotamestre.tec.br ── Expo Web / React Native
                  │
                  ├── Supabase: Auth, Postgres, RLS, Storage, Realtime
                  ├── Edge Functions: Google Places, exclusão de conta, push
                  ├── OSRM: cálculo/otimização de rotas
                  └── Firebase/Expo: notificações no Android
```

- Este repositório não é o site institucional.
- O repositório irmão `D:\rota-mestre\lp-rotamestre` não contém lógica
  autenticada nem dados operacionais.
- As páginas legais públicas do site são as URLs informadas ao Google Play. Ao
  alterar coleta, retenção ou compartilhamento de dados, atualize o app, a
  landing e as declarações do Play no mesmo trabalho.

## Regras que não podem regredir

- Nunca exponha `service_role`, chave do Google Places ou credencial do Play no
  cliente ou no Git.
- Toda leitura/escrita de tenant deve respeitar `unidade_id` e RLS.
- `fotos-entrega` permanece privado; não recrie URLs públicas.
- Migrations de schema devem ser versionadas em `database/migrations/` e
  `supabase/migrations/` com o mesmo timestamp e conteúdo. Exceções históricas
  aplicadas manualmente precisam ser documentadas, nunca executadas novamente
  por suposição.
- `versionCode` é monotônico. Confirme o maior código no Play Console antes do
  próximo bump.
- Não altere `br.tec.rotamestre.app`, o EAS project ID ou o Firebase project sem
  um plano formal de migração.
- Dependências acopladas exigem validação nativa: versões de Sentry devem ficar
  alinhadas; Unistyles e Nitro Modules devem ser testados juntos em build EAS.
- O baseline de runtime é **Node 22** (`.nvmrc`, `engines.node`, CI e EAS). Não
  regrida para Node 20; a proteção da `main` espera `Run Tests (22.x)`.

## Próximas ações

### P0 — concluir distribuição móvel

1. Confirmar no Play Console a quantidade e a continuidade dos participantes
   com opt-in; divulgue o hub `/testar` para ampliar a base. Contas cadastradas
   sem opt-in não contam para o requisito.
2. Solicitar acesso à produção quando o requisito mostrado pelo Console estiver
   satisfeito e promover o build `3024`; não gerar um novo AAB apenas para
   repetir a tentativa.
3. Revisar “Conteúdo do app”, Segurança de dados, classificação, público-alvo,
   acesso do revisor e URLs legais contra `play-store-metadata.md`.
4. Concluir a autenticação interativa da Apple para criar/validar certificado e
   provisioning profile, gerar o primeiro build iOS e testá-lo no TestFlight.
5. Preencher a ficha e o App Privacy no App Store Connect, anexar screenshots
   de iPhone/iPad e enviar o build validado para revisão.

### P1 — qualidade e acompanhamento funcional

1. Monitorar erros da Nova Entrega: recuperação de rascunho após refresh,
   importação em massa, dependências retirada/entrega, retries e duplicidade.
2. Provisionar de forma segura as contas-fixture autenticadas do Playwright e
   rerodar o E2E completo.
3. Validar no Android e no iOS o ciclo completo de um motorista em rede instável.
4. Confirmar entrega de push nos artefatos instalados pelas lojas e revisar
   tickets/receipts da Expo.
5. Planejar o aviso aos usuários do app antigo sem interromper o backend
   compartilhado.

### P2 — evolução posterior ao rollout

1. Definir métricas de produto e alertas operacionais sem coletar dados além do
   declarado.
2. Retomar cobrança/Asaas somente com regras comerciais e de acesso definidas.
3. Definir uma estratégia de rollout e monitoramento equivalente para Android e
   iOS após a aprovação das lojas.

## Roteiro para a próxima sessão

1. Leia este documento e `git status --short --branch`.
2. Confira `package.json`, o último commit e os checks do GitHub.
3. Se houver banco no escopo, rode `npx supabase migration list` e compare o
   schema vivo antes de criar SQL.
4. Se houver release Android no escopo, consulte primeiro o Play Console e o
   EAS; não gere build só para descobrir o estado.
5. Execute a menor validação proporcional à mudança e registre aqui qualquer
   nova decisão, estado externo ou pendência.

## Mapa da documentação

| Necessidade                               | Documento                                                |
| ----------------------------------------- | -------------------------------------------------------- |
| Começar uma nova sessão / estado atual    | este arquivo                                             |
| Arquitetura, padrões e phonebook técnico  | [`../CLAUDE.md`](../CLAUDE.md)                           |
| Testes                                    | [TESTING.md](TESTING.md)                                 |
| Histórico e processo de migrations        | [`../database/MIGRATIONS.md`](../database/MIGRATIONS.md) |
| Google Play: procedimento                 | [GOOGLE_PLAY_DEPLOYMENT.md](GOOGLE_PLAY_DEPLOYMENT.md)   |
| Google Play: textos, assets e declarações | [play-store-metadata.md](play-store-metadata.md)         |
| App Store / iOS: procedimento             | [APP_STORE_DEPLOYMENT.md](APP_STORE_DEPLOYMENT.md)       |
| Reconstrução da identidade Android        | [REBUILD_RELAUNCH_PLAN.md](REBUILD_RELAUNCH_PLAN.md)     |
| Firebase e push                           | [FIREBASE_MIGRATION.md](FIREBASE_MIGRATION.md)           |
| Recuperação de senha                      | [PASSWORD_RECOVERY.md](PASSWORD_RECOVERY.md)             |
| Marca e tokens                            | [`../brand-guidelines.md`](../brand-guidelines.md)       |

## Segurança documental

Não registre senhas, tokens, chaves, arquivos JSON de serviço, keystores ou
listas nominais de usuários/testadores. Este documento pode registrar **onde**
uma credencial é administrada e como verificar seu funcionamento, nunca seu
conteúdo.
