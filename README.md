# Rota Mestre

[![Tests](https://github.com/BadWolf1509/rotamestre-app/actions/workflows/test.yml/badge.svg)](https://github.com/BadWolf1509/rotamestre-app/actions/workflows/test.yml)
[![Code Quality](https://github.com/BadWolf1509/rotamestre-app/actions/workflows/quality.yml/badge.svg)](https://github.com/BadWolf1509/rotamestre-app/actions/workflows/quality.yml)
[![codecov](https://codecov.io/gh/BadWolf1509/rotamestre-app/branch/main/graph/badge.svg)](https://codecov.io/gh/BadWolf1509/rotamestre-app)

SaaS de planejamento e gestão de rotas de última milha. Gestores montam,
otimizam e acompanham rotas; motoristas executam as paradas no Android, com
navegação, ocorrências e foto privada de comprovação.

- Web: <https://app.rotamestre.tec.br>
- Android: `br.tec.rotamestre.app`
- Estado atual e próximos passos:
  [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md)

## Stack

- React Native, Expo SDK 56, Expo Router e TypeScript
- Supabase: Auth, Postgres, RLS, Storage, Realtime e Edge Functions
- MapLibre para mapas e OSRM para cálculo/otimização
- Google Places somente por Edge Functions, sem chave Google no cliente
- Jest, Testing Library, Playwright e regressão visual
- Vercel para web; EAS, Google Play e App Store para os aplicativos móveis

## Desenvolvimento

Requer Node.js 20 ou superior.

```bash
npm install
cp .env.example .env
npm run web
```

Preencha o `.env` local com a URL e a chave pública atual do Supabase. Não use
`service_role` no app. Em builds EAS, as variáveis são administradas por
ambiente no EAS e não ficam versionadas.

Para um dispositivo ou emulador Android conectado:

```bash
npm run android
```

## Validação

```bash
npm run type-check
npm run lint
npm test
npm run build:web
```

Atalhos adicionais:

| Comando                        | Uso                                 |
| ------------------------------ | ----------------------------------- |
| `npm run validate`             | type-check, lint e Jest             |
| `npm run test:e2e`             | testes E2E com Playwright           |
| `npm run test:visual`          | regressão visual                    |
| `npm run verify:design-system` | validação dos tokens visuais        |
| `npx supabase migration list`  | compara migrations locais e remotas |

Antes de release Android, siga
[docs/GOOGLE_PLAY_DEPLOYMENT.md](docs/GOOGLE_PLAY_DEPLOYMENT.md); não gere um
novo build sem conferir o maior `versionCode` já enviado ao Play.

Para preparar ou publicar a versão iOS, siga
[docs/APP_STORE_DEPLOYMENT.md](docs/APP_STORE_DEPLOYMENT.md). O primeiro build
exige a configuração interativa das credenciais Apple.

## Estrutura

```text
app/                     rotas e telas do Expo Router
src/components/          componentes e design system
src/hooks/               hooks organizados por domínio
src/lib/                 Supabase, mapas, logs, storage e utilitários
src/types/               tipos de domínio
database/migrations/     histórico canônico de SQL
supabase/migrations/     migrations operacionais do Supabase CLI
supabase/functions/      Edge Functions
docs/                    contexto, operação, testes e release
```

## Perfis e segurança

Os papéis são `gestor` e `motorista`. Usuários podem participar de múltiplas
unidades por `usuario_unidades`; o acesso é isolado por `unidade_id` e RLS.
Ações administrativas com `service_role` pertencem ao painel administrativo,
nunca a este cliente.

O bucket `fotos-entrega` é privado. O app persiste paths e gera signed URLs em
leitura; não substitua esse fluxo por URL pública.

## Documentação

| Tema                            | Documento                                                        |
| ------------------------------- | ---------------------------------------------------------------- |
| Handoff, estado atual e backlog | [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md)               |
| Arquitetura e padrões técnicos  | [CLAUDE.md](CLAUDE.md)                                           |
| Testes                          | [docs/TESTING.md](docs/TESTING.md)                               |
| Migrations                      | [database/MIGRATIONS.md](database/MIGRATIONS.md)                 |
| Publicação no Google Play       | [docs/GOOGLE_PLAY_DEPLOYMENT.md](docs/GOOGLE_PLAY_DEPLOYMENT.md) |
| Publicação na App Store         | [docs/APP_STORE_DEPLOYMENT.md](docs/APP_STORE_DEPLOYMENT.md)     |
| Conteúdo da ficha do Play       | [docs/play-store-metadata.md](docs/play-store-metadata.md)       |
| Histórico do rebuild Android    | [docs/REBUILD_RELAUNCH_PLAN.md](docs/REBUILD_RELAUNCH_PLAN.md)   |
| Firebase e push                 | [docs/FIREBASE_MIGRATION.md](docs/FIREBASE_MIGRATION.md)         |
| Recuperação de senha            | [docs/PASSWORD_RECOVERY.md](docs/PASSWORD_RECOVERY.md)           |
| Marca                           | [brand-guidelines.md](brand-guidelines.md)                       |
| Contribuição e CI               | [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md)               |

## Licença

Proprietário — Rota Mestre © 2026. Desenvolvimento: Wellington Ribeiro.
