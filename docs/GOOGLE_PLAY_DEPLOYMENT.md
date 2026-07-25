# Publicação Android no Google Play

> Runbook operacional. Atualizado em 24/07/2026.
> Textos, assets e declarações da loja ficam em
> [play-store-metadata.md](play-store-metadata.md).

## Estado e identidades

| Item                           | Valor                                  |
| ------------------------------ | -------------------------------------- |
| Package definitivo             | `br.tec.rotamestre.app`                |
| Versão no código               | `1.12.2`                               |
| `androidVersionCode` no código | `3024`                                 |
| EAS project                    | `c6401a59-af97-484a-93b7-c75016bf331d` |
| Firebase                       | `rota-mestre-97084`                    |
| Formato de produção            | Android App Bundle (`.aab`)            |
| Play App Signing               | habilitado                             |

Estado consultado pela Google Play Developer API em 24/07/2026:

- teste fechado (`alpha`): `1.12.2` / `3024`, concluído;
- teste interno: `1.12.1` / `3021`, concluído;
- `beta`: vazia;
- produção: vazia;
- AAB `1.12.2` / `3024`: build EAS
  `630fe91d-a0b0-41f7-be7d-334876910375`, concluído;
- submissão ao teste fechado
  `b832dbc7-1b42-49fc-b7bc-838c2bb5fe46`, concluída;
- tentativa de submissão à produção
  `f3c7e7a5-db29-4131-bafe-972d7b565946`, recusada pelo Play com
  `Precondition check failed`.

A quantidade de participantes com opt-in contínuo, a situação do teste fechado
e a elegibilidade para produção continuam sendo estados externos. Consulte o
Play Console antes de cada submissão; o número em `package.json` não comprova
que o artefato já foi enviado.

Enquanto a produção estiver bloqueada, use a faixa `alpha` com
`releaseStatus: completed`. Não gere outro AAB para repetir a tentativa de
produção: solicite acesso no Play Console quando o requisito de teste fechado
estiver satisfeito e promova o artefato já validado quando permitido.

## Fontes de verdade

- Versão e `versionCode`: `package.json`
- Identidade do app: `app.config.js`
- Perfis de build/submit: `eas.json`
- Variáveis por ambiente: EAS
- Chaves de assinatura: EAS Credentials e Play Console
- Metadados/declarações/assets: `docs/play-store-metadata.md`
- Estado das trilhas, testers e revisão: Play Console

## Antes de qualquer release

1. Confirme que o alvo é teste interno, teste fechado ou produção.
2. No Play Console, anote o maior `versionCode` já utilizado e a versão em cada
   trilha.
3. Verifique `git status`, branch, último commit e CI.
4. Confirme que as variáveis públicas do Supabase existem no ambiente
   `production` do EAS.
5. Confirme que a chave pública usada no EAS é a atual após qualquer rotação no
   Supabase.
6. Confirme que `google-services.json` e a credencial FCM V1 no EAS pertencem ao
   projeto Firebase atual. O FCM não depende de fingerprint SHA.
7. Execute a validação local e o smoke test proporcional ao release.

Nunca incremente versão ou gere AAB apenas para descobrir o estado do Console.

## Validação do código

```bash
npm ci
npm run type-check
npm run lint
npm test
npm run build:web
```

Quando a mudança afeta fluxos principais, execute também:

```bash
npm run test:e2e
npm run test:visual
```

No Android físico, valide pelo menos:

- login e restauração de sessão;
- alternância entre unidades, quando aplicável;
- carregamento da rota atribuída;
- início e término da rota;
- localização com app em primeiro e segundo plano;
- navegação externa;
- conclusão/pulo de parada;
- captura e leitura da foto de comprovação;
- push recebido no app instalado;
- fluxo de exclusão de conta;
- comportamento em perda e retorno da rede.

## Versão

`versionCode` é monotônico e nunca pode ser reutilizado.

Depois de confirmar o maior código no Play:

```bash
npm run bump:android
```

Revise o diff de `package.json` e `package-lock.json`. Se também houver uma
mudança de versão pública, atualize `version` de forma intencional. Não altere
`app.config.js` para duplicar esses valores; ele os lê do `package.json`.

## Build

Autentique-se na conta Expo correta e confira o projeto:

```bash
npx eas whoami
npx eas project:info
```

Gere o bundle de produção:

```bash
npx eas build --platform android --profile production
```

Registre no handoff:

- commit usado;
- versão e `versionCode`;
- URL/ID do build EAS;
- resultado do smoke test;
- trilha de destino.

Não publique um build gerado de uma árvore com alterações não registradas.

## Submissão

O `eas.json` possui profiles `internal`, `alpha` e `production`. Escolha um
profile coerente com a trilha explicitamente aprovada. O profile `alpha` usa
`releaseStatus: completed` para liberar a versão aos testadores, não deixá-la
como rascunho.

Exemplo para teste interno:

```bash
npx eas submit --platform android --profile internal
```

Exemplo para produção, somente depois da aprovação do rollout:

```bash
npx eas submit --platform android --profile production
```

O arquivo `play-store-credentials.json` é local, gitignored e referenciado pelo
EAS Submit. Ele nunca deve aparecer em issue, log, documentação ou commit.

Se a service account precisar ser recriada:

1. crie a conta no Google Cloud do projeto controlado pela empresa;
2. habilite a Google Play Android Developer API;
3. adicione o e-mail da conta em **Play Console → Usuários e permissões**;
4. conceda somente as permissões de release necessárias;
5. gere o JSON e armazene-o fora do Git;
6. teste primeiro com uma submissão para a trilha interna.

## Testadores

- O Play libera o app pela **Conta Google** inscrita, não pelo e-mail de login
  usado dentro do Rota Mestre.
- Quando os endereços forem diferentes, cadastre a Conta Google efetiva; manter
  também o e-mail corporativo só ajuda se ele próprio for uma Conta Google.
- Não versione a lista nominal de testadores.
- Guarde o link de opt-in no canal operacional da equipe, não em documentação
  pública. Confirme abertura e instalação com pelo menos uma conta sem acesso
  administrativo ao Console.
- Teste interno não substitui eventual requisito de teste fechado para acesso à
  produção. Siga exatamente a quantidade e o período mostrados no Console.

## Conteúdo obrigatório da loja

Revise no Play Console, comparando com
[play-store-metadata.md](play-store-metadata.md):

- ficha principal em pt-BR;
- ícone, feature graphic e screenshots;
- política de privacidade;
- termos de uso;
- exclusão de conta;
- Segurança de dados;
- acesso do revisor;
- classificação indicativa;
- público-alvo;
- declaração de anúncios;
- permissões e justificativa de localização em segundo plano.

URLs públicas:

- Site: <https://rotamestre.tec.br>
- Política: <https://rotamestre.tec.br/politica-de-privacidade>
- Termos: <https://rotamestre.tec.br/termos-de-uso>
- Exclusão: <https://rotamestre.tec.br/exclusao-de-conta>

Não declare preço, teste grátis, compras, economia percentual ou recursos que
não estejam efetivamente disponíveis e comprovados.

## Rollout recomendado

1. Teste interno com equipe e contas reais de teste.
2. Teste fechado pelo período exigido no Play Console.
3. Correção de bloqueadores e novo AAB apenas se necessário.
4. Produção com rollout gradual.
5. Monitoramento de crashes, ANRs, autenticação, push, localização e suporte.
6. Expansão do rollout após estabilidade.

Em cada etapa, registre versão, data, percentual da distribuição e decisão de
avançar ou interromper.

## Credenciais e continuidade

A reconstrução do app foi causada pela perda das contas e chaves originais.
Por isso:

- faça backup do keystore/upload key e senhas em pelo menos dois locais
  corporativos controlados;
- mantenha mais de um administrador recuperável nas contas Expo, Firebase,
  Google Cloud e Play;
- documente proprietários e recuperação no gerenciador de senhas, não no Git;
- não dependa apenas da cópia hospedada pelo EAS;
- revise o acesso de terceiros periodicamente;
- nunca troque o package Android para resolver um problema de credencial.

## Pós-publicação

- Confirme instalação a partir da página do Play, não de APK local.
- Valide FCM no artefato assinado pelo Play.
- Acompanhe Android Vitals e feedback dos testadores.
- Confirme que as URLs legais respondem e continuam coerentes com Segurança de
  dados.
- Atualize [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) com a trilha, build e
  pendência seguintes.

## Problemas comuns

| Sintoma                                     | Verificação                                                                                   |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Credenciais corretas não autenticam         | conferir chave pública do Supabase no ambiente EAS e limpar sessão antiga                     |
| `versionCode` já usado                      | consultar o maior código no Play e incrementar uma vez                                        |
| Push funciona localmente, mas não pelo Play | testar o AAB da trilha; conferir projeto no `google-services.json`, FCM V1 e receipts da Expo |
| Testador não vê o app                       | confirmar Conta Google inscrita, opt-in aceito, país/dispositivo e trilha                     |
| Submit sem permissão                        | revisar vínculo e permissões da service account                                               |
| Localização para em segundo plano           | revisar permissões, declaração do Play e teste em aparelho real                               |
| Revisor não acessa o produto                | revisar instruções de acesso e conta de demonstração no Console                               |
