# Migração para um novo projeto Firebase (push / FCM)

> **Contexto:** a conta Google dona do projeto Firebase/GCP original do RotaMestre foi
> perdida. Sem ela não dá pra registrar SHA-1, gerenciar a API key do `google-services.json`
> nem a entrega de push. Este runbook recria o lado Firebase **sob uma conta sob seu controle**,
> sem reescrever o app nem o backend de envio.

## O que NÃO muda (importante)

A arquitetura de push é:

```
app (expo-notifications) → ExponentPushToken → usuarios.push_token
   │
   └─ Edge Function send-push-notification → exp.host (Expo Push API) → FCM → device
```

- A **Edge Function `supabase/functions/send-push-notification`** envia **só via Expo Push API**
  (`https://exp.host/--/api/v2/push/send`). Ela **não contém credencial Firebase/FCM** → **não muda**.
- A credencial FCM que o Expo usa pra entregar no Android fica no **projeto Expo/EAS**
  (`1ea74080-a787-46db-abbf-d303d1b7a9d4`), não no Google. → só **re-subir** a nova.
- `app.config.js` já aponta `googleServicesFile: "./google-services.json"`. → **não muda** (só troca o arquivo).

Logo, a migração mexe em **dois artefatos**: o `google-services.json` do app e a credencial **FCM V1** no Expo.

## Pré-requisito crítico — confirmar acesso ao Expo/EAS

Tudo isto assume que você **ainda tem** a conta Expo dona do projeto EAS. Confirme:

```powershell
npx eas whoami          # deve logar o dono do projeto 1ea74080-...
npx eas credentials     # deve listar credenciais Android do app
```

Se também perdeu o Expo, o cenário muda (novo projeto EAS + todos os apps precisam atualizar). Pare e reavalie.

## Parte A — Criar o novo projeto Firebase

1. [Firebase Console](https://console.firebase.google.com) → **Adicionar projeto** (ex.: `rotamestre`).
2. Adicionar app **Android** → package name **`br.tec.rotamestre`**.
3. **Registrar os SHA-1** (Configurações do projeto → seu app Android → _Adicionar impressão digital_). Registre os três:
   - **Debug (dev local):** `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
     (de `android/app/debug.keystore`; SHA-256 também disponível).
   - **Upload key (EAS):** rode `npx eas credentials` → Android → Keystore → copie o SHA-1/SHA-256.
   - **App signing key (Google Play):** Play Console → _Integridade do app → Assinatura de apps_ →
     SHA-1/SHA-256 da chave de assinatura do app. **Esse é o que vale pra push em produção**
     (o app instalado é re-assinado pelo Play).
4. No **Google Cloud Console** (mesmo projeto) → APIs e Serviços → habilitar:
   - **Firebase Cloud Messaging API** (FCM v1)
   - **Firebase Installations API**
5. Baixar o novo **`google-services.json`**.

## Parte B — Trocar o `google-services.json` no app

> O hook `block-sensitive-files` impede o Claude de escrever esse arquivo — **você** faz a troca.

6. Substituir pelo novo em **dois lugares**:
   - `./google-services.json` (raiz)
   - `./android/app/google-services.json`
7. Rebuild local pra validar: `npx expo run:android`.
   - **Esperado:** `getExpoPushToken` retorna `ExponentPushToken[...]` **sem `FIS_AUTH_ERROR`**
     (novo projeto + SHA-1 debug registrado).

## Parte C — Re-subir a credencial FCM V1 no Expo

8. No novo Firebase: **Configurações do projeto → Contas de serviço → Gerar nova chave privada**
   → baixa um JSON de service account.
9. Subir no projeto Expo:
   ```powershell
   npx eas credentials      # Android → Push Notifications (FCM V1) → fornecer o JSON
   ```
   (ou via [expo.dev](https://expo.dev) → projeto → Credentials → FCM V1).
10. Isso autoriza o **exp.host** a entregar no novo projeto. A Edge Function continua igual.

## Parte D — Tokens e rollout

11. Os `ExponentPushToken` salvos em `usuarios.push_token` **se renovam sozinhos**: ao abrir o app
    atualizado (novo `google-services.json`), o device re-registra e `registerPushToken`
    (`src/lib/notifications.ts`) grava o token novo.
12. Usuários em **versão antiga** param de receber push até atualizarem (Expo retorna
    `DeviceNotRegistered`). É o custo esperado da migração.
13. Publicar **build novo de produção** (EAS) — **OTA / EAS Update não basta**, porque
    `google-services.json` é nativo e exige rebuild do binário (`.aab`).

## Validação final

- [ ] `npx eas whoami` confirma acesso ao projeto Expo.
- [ ] Rebuild local sem `FIS_AUTH_ERROR`; token `ExponentPushToken[...]` obtido.
- [ ] Teste de envio: chamar a Edge Function direto e ver o push chegar:
  ```
  POST {SUPABASE_URL}/functions/v1/send-push-notification
  { "usuario_id": "<uuid de teste>", "titulo": "Teste", "mensagem": "Push migrado ✅" }
  ```
- [ ] Build de produção assinado com a key cujo SHA-1 foi registrado (Parte A.3).

## Riscos / pegadinhas

- **SHA-1 de produção é o do Google Play app-signing**, não o da upload key — registre ambos.
- **FCM legacy server key foi descontinuada (jun/2024)** — use **FCM V1** (service account JSON). A Edge Function já é compatível (vai via Expo).
- iOS (APNs) é trilha à parte: adicionar app iOS `br.tec.rotamestre` no Firebase e subir a key APNs no Expo quando o iOS entrar.
- Não comitar `google-services.json` com credenciais erradas; conferир o `project_id` do arquivo novo antes do build.
