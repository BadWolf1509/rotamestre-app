# Supabase Edge Functions - RotaMestre

Todas as funções rodam **sem `verify_jwt`** (desde 22/10/2026 ele só entende o
JWT antigo, desligado) e **autorizam por dentro**. O `verify_jwt = false` de cada
uma está declarado em `supabase/config.toml` — guarda em
`_shared/__tests__/configFuncoes.test.ts`: função nova sem a entrada quebra o
teste. Chaves só por `_shared/chaves.ts` (`chaveSecreta`/`chavePublica`).

| Função                       | Quem chama                      | Autorização                                      |
| ---------------------------- | ------------------------------- | ------------------------------------------------ |
| `criar-motorista`            | app (gestor)                    | JWT do usuário + vínculo de gestor ativo na loja |
| `delete-account`             | app (qualquer usuário)          | JWT do usuário                                   |
| `google-places-autocomplete` | app (busca de endereço)         | JWT do usuário (`_shared/autenticacao.ts`)       |
| `google-place-details`       | app (busca de endereço)         | JWT do usuário (`_shared/autenticacao.ts`)       |
| `expire-routes`              | cron do GitHub Actions          | `x-cron-secret` × `CRON_SECRET`                  |
| `remind-routes`              | cron                            | `x-cron-secret` × `CRON_SECRET`                  |
| `send-push-notification`     | gatilho `pg_net` (Migration 32) | `x-push-secret` × `PUSH_WEBHOOK_SECRET`          |

`google-directions` e `google-distance-matrix` foram apagadas em 23/10/2026: sem
chamador (o roteamento é OSRM) e proxies abertos da chave Google.

## Deploy

```bash
npx supabase functions deploy <fn> --no-verify-jwt --project-ref xezslsyxjivunmhhyxtd
```

O `--no-verify-jwt` é redundante com o `config.toml`, mas não custa. Para fora,
as funções devolvem mensagens genéricas; o detalhe do erro vai só para o log
(`console.error`) — veja em Dashboard → Edge Functions → Logs.

Secrets usados: `GOOGLE_MAPS_API_KEY` (Places), `CRON_SECRET`,
`PUSH_WEBHOOK_SECRET`, `SUPABASE_SECRET_KEYS`/`SUPABASE_PUBLISHABLE_KEYS`
(injetados pelo Supabase).
