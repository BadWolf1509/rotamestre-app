# Rota Mestre

[![Tests](https://github.com/BadWolf1509/rotamestre-app/actions/workflows/test.yml/badge.svg)](https://github.com/BadWolf1509/rotamestre-app/actions/workflows/test.yml)
[![Code Quality](https://github.com/BadWolf1509/rotamestre-app/actions/workflows/quality.yml/badge.svg)](https://github.com/BadWolf1509/rotamestre-app/actions/workflows/quality.yml)
[![codecov](https://codecov.io/gh/BadWolf1509/rotamestre-app/branch/main/graph/badge.svg)](https://codecov.io/gh/BadWolf1509/rotamestre-app)

> SaaS de otimização e gestão de rotas de última milha. Dois perfis: **gestor** (cria e atribui rotas) e **motorista** (executa com navegação e foto de comprovação de entrega).

**Stack:** React Native · Expo SDK 56 · TypeScript · Supabase · React Native Unistyles · MapLibre (sem Google Maps) · Expo Router

**Produção:** web em **https://app.rotamestre.tec.br** · Android **`br.tec.rotamestre.app`** (em publicação na Play)

> ℹ️ Contexto técnico completo (stack, padrões, phonebook): **[CLAUDE.md](CLAUDE.md)**. Estado do relançamento do app: **[docs/REBUILD_RELAUNCH_PLAN.md](docs/REBUILD_RELAUNCH_PLAN.md)**.

---

## 🚀 Setup rápido

```bash
git clone https://github.com/BadWolf1509/rotamestre-app.git
cd rotamestre-app
npm install

# Crie o .env na raiz — o Supabase é OBRIGATÓRIO (sem ele o app cai num
# placeholder e toda query falha com UnknownHostException):
cp .env.example .env
#   EXPO_PUBLIC_SUPABASE_URL=https://xezslsyxjivunmhhyxtd.supabase.co
#   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key: Supabase Dashboard → Settings → API>

npm run web        # web em http://localhost:8081
npm run android    # build nativo + instala no device/emulador conectado
```

> **Mapas** (MapLibre + OSRM + Photon) são gratuitos e **não exigem chave do Google**.
> Em **builds EAS**, as variáveis do Supabase vivem **por-ambiente no EAS** (`eas env:*`), não no repositório.

---

## 📁 Estrutura

```
app/                     # Telas (Expo Router): (auth)/, gestor/, motorista/
src/
├── components/          # UI reutilizável + base do design system
├── hooks/               # Hooks por domínio (auth/, gestao-rotas/, motorista/, ...)
├── lib/                 # supabase, logger, sentry, photon, osrm, navegação
├── context/             # React Contexts (notificações, status de rota)
└── types/               # Tipos de domínio (Rota, Parada, Usuario, ...)
database/migrations/     # Migrations SQL (diretório canônico)
docs/                    # Documentação
```

---

## 🛠️ Comandos

| Comando                              | O quê                                                         |
| ------------------------------------ | ------------------------------------------------------------- |
| `npm start`                          | Dev server (Expo)                                             |
| `npm run web` / `android` / `ios`    | Rodar por plataforma                                          |
| `npm test` · `npm run test:coverage` | Testes unitários (Jest)                                       |
| `npm run test:e2e`                   | E2E (Playwright)                                              |
| `npm run type-check`                 | TypeScript (`tsc --noEmit`)                                   |
| `npm run lint`                       | ESLint (`--max-warnings=0`)                                   |
| `npm run build:web`                  | Build web (deploy automático no Vercel ao dar push em `main`) |

---

## 👥 Perfis & multi-tenancy

Papéis em `usuarios.papel`: **`gestor`** (CRUD da própria unidade) e **`motorista`** (rotas atribuídas + suas paradas). Ações de **admin** ficam no projeto do **painel**, nunca aqui. Os dados são isolados por `unidade_id` via **RLS** (Row Level Security) — um usuário pode pertencer a várias unidades via `usuario_unidades`.

---

## 📚 Documentação

| Tema                                                 | Onde                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| Contexto técnico (stack, padrões, phonebook)         | [CLAUDE.md](CLAUDE.md)                                           |
| Testes (comandos, cobertura, layout)                 | [docs/TESTING.md](docs/TESTING.md)                               |
| Migrations (convenções + histórico)                  | [database/MIGRATIONS.md](database/MIGRATIONS.md)                 |
| Recuperação de senha (fluxo de ponta a ponta)        | [docs/PASSWORD_RECOVERY.md](docs/PASSWORD_RECOVERY.md)           |
| Relançamento do app (contas perdidas → reconstruído) | [docs/REBUILD_RELAUNCH_PLAN.md](docs/REBUILD_RELAUNCH_PLAN.md)   |
| Push / Firebase (FCM)                                | [docs/FIREBASE_MIGRATION.md](docs/FIREBASE_MIGRATION.md)         |
| Publicação na Google Play                            | [docs/GOOGLE_PLAY_DEPLOYMENT.md](docs/GOOGLE_PLAY_DEPLOYMENT.md) |
| Marca (cores, tipografia, contraste)                 | [brand-guidelines.md](brand-guidelines.md)                       |
| Contribuição (PRs, branches, CI)                     | [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md)               |

---

## 📝 Licença

Proprietário — Rota Mestre © 2026. Dev: Wellington Ribeiro.
