# Firebase e push Android

> Runbook operacional. Migração concluída; atualizado em 24/07/2026.

## Estado atual

| Item               | Valor                                            |
| ------------------ | ------------------------------------------------ |
| Firebase project   | `rota-mestre-97084`                              |
| Android package    | `br.tec.rotamestre.app`                          |
| Entrega no cliente | `expo-notifications`                             |
| Token persistido   | `usuarios.push_token` (`ExponentPushToken[...]`) |
| Envio no backend   | Edge Function `send-push-notification`           |
| Credencial         | FCM V1 administrada no EAS                       |

O novo projeto, o `google-services.json` e a credencial FCM V1 foram
configurados. Registro de token e entrega foram validados em dispositivo físico
durante a reconstrução.

## Arquitetura

```text
Android
  expo-notifications
       │
       └── ExponentPushToken ──> usuarios.push_token (Supabase)
                                      │
                                      ▼
Edge Function send-push-notification ──> Expo Push API ──> FCM ──> aparelho
```

- A Edge Function envia para a Expo Push API e não carrega a credencial FCM.
- A credencial FCM V1 fica no projeto EAS e autoriza a entrega da Expo ao
  Firebase.
- `google-services.json` vincula o binário Android ao projeto Firebase.
- O app atualiza o token no Supabase quando registra notificações.

## Esclarecimento sobre fingerprints SHA

O fluxo atual usa FCM, mas não usa Google Sign-In, Phone Auth ou App Check.
**FCM não exige SHA-1/SHA-256 da chave Android.** É aceitável registrar as
fingerprints de debug, upload e Play App Signing como inventário ou preparação
para serviços futuros, mas sua presença não comprova nem bloqueia o push atual.

A verificação correta é receber uma notificação no artefato instalado pela
trilha do Google Play.

## Fontes de verdade

- Identidade Android/Firebase: `app.config.js` e configuração nativa
- Projeto EAS: `app.config.js`
- Credencial FCM V1: EAS Credentials
- App e service accounts: Firebase/Google Cloud Console
- Token do usuário: Supabase `usuarios.push_token`
- Código de registro: hooks/serviços de notificações no app
- Código de envio: `supabase/functions/send-push-notification`

Não exponha o conteúdo de `google-services.json` ou da service account em
documentos, logs ou commits.

## Verificação segura

### 1. Identidades

```bash
npx eas whoami
npx eas project:info
npx eas credentials
```

Confirme que o EAS project é o atual e que existe uma credencial FCM V1 para o
package `br.tec.rotamestre.app`.

### 2. Registro no aparelho

Em um build Android real:

1. aceite a permissão de notificações;
2. confirme que não ocorre `FIS_AUTH_ERROR`;
3. confirme que o token Expo foi persistido para o usuário atual;
4. evite imprimir o token completo em logs compartilhados.

### 3. Entrega

Envie uma notificação de teste pelo fluxo normal da aplicação/Edge Function.
Valide:

- app em primeiro plano;
- app em segundo plano;
- app encerrado;
- toque e deep link esperado;
- recebimento no build instalado pelo Play.

Use uma conta e um aparelho controlados. Não dispare mensagens em massa durante
um diagnóstico.

## Rotação ou reconstrução futura

Somente execute este fluxo se o projeto/credencial atual tiver sido revogado ou
se houver decisão formal de migração.

1. Crie ou selecione um projeto Firebase sob controle corporativo.
2. Registre um app Android com o package **exato**
   `br.tec.rotamestre.app`.
3. Habilite Firebase Cloud Messaging API/FCM V1.
4. Baixe o novo `google-services.json` e substitua as cópias esperadas pelo
   projeto, sem versionar o segredo.
5. Gere uma service account com o menor escopo necessário.
6. Atualize a credencial FCM V1 em EAS Credentials.
7. Gere um novo build Android; configuração Firebase não muda um binário já
   publicado.
8. Instale em aparelho real, abra o app para renovar/persistir o token e faça um
   envio único de teste.
9. Só então avance para uma trilha com mais usuários.

Tokens existentes podem deixar de ser válidos após uma mudança de projeto. O
app precisa ser aberto para registrar o novo token; trate receipts
`DeviceNotRegistered` removendo tokens inválidos.

## Diagnóstico

| Sintoma                              | Verificação                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| `FIS_AUTH_ERROR`                     | package/projeto no `google-services.json`, API e binário reconstruído                   |
| token Expo não é salvo               | permissão, device físico, sessão e update no Supabase                                   |
| token existe, mas mensagem não chega | credencial FCM V1 no EAS, receipt da Expo e projeto Firebase                            |
| funciona em APK, falha no Play       | compare o conteúdo incorporado/configuração do build e teste o AAB entregue pela trilha |
| `DeviceNotRegistered`                | invalide o token armazenado e registre novamente                                        |
| envio em massa parcial               | processe tickets/receipts da Expo e não reutilize tokens inválidos                      |

## Continuidade e segurança

- Mantenha pelo menos dois administradores recuperáveis no Firebase/Google
  Cloud e no Expo.
- Guarde service accounts e recovery codes no gerenciador corporativo.
- Revogue credenciais antigas depois de validar a nova, não antes.
- Não coloque JSON de serviço, token de usuário ou chave em issue/PR.
- Registre data, motivo, build e resultado de qualquer rotação em
  [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).
