# Plano de reconstrução e relançamento (app novo)

> **STATUS (2026-06-16):** Fases 0–2 ✅ — app reconstruído como **`br.tec.rotamestre.app`**, EAS `c6401a59-af97-484a-93b7-c75016bf331d` (`@wellington.ribeiro.mkt`), Firebase **`rota-mestre-97084`**; `.aab` v1.12.0 (versionCode **3019**) buildado; **keystore com backup**; SHA-1 da upload key + credencial FCM V1 registrados; **push validado em device**. Fase 3 🔄 — `.aab` no **Teste interno** com Play App Signing ligado; **falta**: "Conteúdo do app" (Segurança de dados/classificação/público-alvo) + promover pra produção. Fases 4–5 ⏳ pendentes. Trabalho na branch `chore/relaunch-new-app`. MapLibre v11 migrado em paralelo na branch `chore/maplibre-v11` (pendente QA em device).

> **Contexto:** as 3 contas de plataforma do app original foram perdidas — **Firebase/GCP**,
> **Expo/EAS** (`1ea74080-a787-46db-abbf-d303d1b7a9d4`) e **Google Play Console** (publica
> `br.tec.rotamestre`). O app instalado **continua funcionando** (fala com o Supabase, que é
> nosso), mas **não recebe mais atualizações**. Decisão: **reconstruir como app novo** sob contas
> novas e migrar os usuários.
>
> **Seguro (não se perde):** código-fonte (repo), Supabase (dados + backend), domínio
> `rotamestre.tec.br` + web (Vercel). **SDK 56** já está pronto na branch `chore/upgrade-expo-sdk-56`
> e entra no app novo de saída.

## Princípio que evita repetir o problema

Criar a nova identidade como **Google Workspace no domínio `rotamestre.tec.br`** (controlamos o DNS).
Assim Firebase, Play e Expo ficam sob uma conta **sempre recuperável via prova de domínio**.
**Nunca mais** amarrar infraestrutura a Gmail pessoal ou conta de terceiro (sócio/agência/contratado).
Guardar todas as credenciais novas num gerenciador de senhas da empresa, com donos documentados.

## Fase 0 — Identidade e contas (começar JÁ — têm prazo de verificação)

1. **Google Workspace** (ou ao menos um Google corporativo) em `@rotamestre.tec.br`.
2. **Google Play Developer** ($25, **verificação de identidade leva dias/semanas** → iniciar primeiro).
   Conta de **organização** (com D-U-N-S) se for empresa.
3. **Conta Expo** nova.
4. **Projeto Firebase** novo (sob o Workspace).
5. iOS está fora de escopo hoje (Android-only; não há presença na App Store a perder).

## Fase 1 — Novo package + repoint no código (na branch `chore/upgrade-expo-sdk-56`)

> `br.tec.rotamestre` está **permanentemente reservado** ao Play da conta perdida — não dá pra reusar.

1. Escolher novo applicationId — sugestão **`br.tec.rotamestre.app`** (definitivo, escolher com cuidado).
2. `app.config.js`:
   - `android.package` e `ios.bundleIdentifier` → novo id.
   - `extra.eas.projectId` → novo projeto EAS.
   - `updates.url` → nova URL do EAS Update.
3. Regenerar nativo: `npx expo prebuild --clean` (regenera `android/` com o novo package).
   - **Antes:** conferir se há customização nativa manual no `android/`/`ios/` commitado (se houver, reaplicar pós-prebuild).
4. Trocar `google-services.json` (do novo Firebase) na **raiz** e em **`android/app/`**.
5. `scheme: "rotamestre"` pode **ficar** (não é globalmente único). Se houver App Links em
   `rotamestre.tec.br/.well-known/assetlinks.json`, atualizar com o **SHA-256 da nova chave**.

## Fase 2 — Build + credenciais (EAS novo)

1. `npx eas login` (conta nova) → `npx eas init` (vincula o novo projectId).
2. `npx eas build -p android` → a EAS gera a **nova keystore (upload key)** e a guarda.
3. Registrar no **novo Firebase** os SHA-1/256: **debug** (`5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`),
   **nova upload key** (`eas credentials`) e, após o Play (Fase 3), a **app-signing key**.
4. Push: seguir [docs/FIREBASE_MIGRATION.md](FIREBASE_MIGRATION.md) Parte C apontando pras contas novas
   (service account FCM V1 → `eas credentials`). A Edge Function `send-push-notification` **não muda**.

## Fase 3 — Publicar no Play (conta nova)

1. Criar o app no Play Console (novo package), ativar **Play App Signing**.
2. Trilha: **internal testing → closed → production**.
3. Pegar o **SHA-1 app-signing** (Play → Integridade do app) e registrar no Firebase — **senão o push
   de produção quebra** (o app instalado é assinado com essa chave).

## Fase 4 — Migração de usuários (a alavanca: controlamos o backend)

Os dois apps usam o **mesmo Supabase** → quem instalar o novo e logar vê **os mesmos dados**. Sem perda.
Canais pra avisar quem está no app antigo (que não atualiza):

- ✅ **In-app via `notificacoes`** — inserir uma notificação por usuário ("Novo app disponível: <link Play>").
  O app antigo **já renderiza** `notificacoes`. Canal que já existe.
- ⚠️ **Push (testar primeiro)** — os `ExponentPushToken` antigos podem ainda entregar (o projeto Expo
  perdido ainda existe; a cred FCM pode estar viva). Fazer **1 envio de teste** via a Edge Function; se
  chegar, usar pra um blast de migração.
- 🌐 **Web** (`rotamestre.tec.br`) — banner "baixe o novo app".
- 📇 **Direto** — e-mail/WhatsApp aos gestores (é B2B; os contatos estão em `usuarios`/`unidades`).
- **Não desligar** o backend do app antigo durante a transição — manter os dois vivos até a maioria migrar.

## Fase 5 — Encerramento do app antigo

- Quando a maioria migrar: deixar definhar (não há como despublicar sem o Play) — ele some para **novas**
  instalações com o tempo (exigência de target-API), enquanto os instalados seguem.
- Opcional: usar a `notificacao`/uma tela de aviso pra reforçar a migração dos retardatários.

## Sequência crítica (o que atrasa o resto)

1. **Play Developer (Fase 0.2)** — maior lead time (verificação). **Iniciar hoje.**
2. Workspace no domínio (Fase 0.1) — base de tudo.
3. Firebase + Expo novos (rápidos).
4. Code repoint + build + publish.
5. Migração.

## Riscos / notas

- Verificação de identidade do Play pode levar semanas — é o gargalo.
- **Testar se push ainda chega no app antigo** ANTES de contar com ele pra migração.
- Conferir customização nativa antes de `prebuild --clean`.
- Registrar a **app-signing SHA-1 do Play** no Firebase (não só a upload key).
- O SDK 56 já validado (boot, login, dados, realtime) sai junto no app novo.
