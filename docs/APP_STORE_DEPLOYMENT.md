# Publicação iOS na App Store

> Runbook operacional. Atualizado em 24/07/2026.

## Estado e identidades

| Item                     | Valor                                  |
| ------------------------ | -------------------------------------- |
| Bundle identifier        | `br.tec.rotamestre.app`                |
| Versão pública           | `1.12.2`                               |
| Build number inicial     | `1`                                    |
| EAS project              | `c6401a59-af97-484a-93b7-c75016bf331d` |
| Distribuição             | App Store                              |
| Runtime do EAS Update    | `1.12.2`                               |
| Build iOS concluído      | nenhum em 24/07/2026                   |
| Credenciais Apple no EAS | configuração interativa pendente       |

O `app.config.js` declara o bundle identifier, permissões de localização,
execução de localização em segundo plano, `buildNumber` e
`ITSAppUsesNonExemptEncryption: false`. Essa última declaração é apropriada
quando o aplicativo usa somente criptografia isenta ou fornecida pelo sistema,
como HTTPS e armazenamento seguro do iOS. Se a implementação criptográfica
mudar, a declaração deve ser reavaliada antes da próxima submissão.

## Fontes de verdade

- Versão pública: `package.json`
- Bundle identifier, build number e permissões: `app.config.js`
- Perfis de build e submissão: `eas.json`
- Certificado, provisioning profile e APNs: EAS Credentials / Apple Developer
- Ficha, builds, TestFlight, privacidade e revisão: App Store Connect

Credenciais, chaves `.p8`, certificados, provisioning profiles, senhas e
códigos 2FA nunca devem ser versionados.

## Pré-requisitos externos

1. Associação ativa ao Apple Developer Program.
2. Apple ID com função suficiente no Apple Developer e App Store Connect.
3. Autenticação de dois fatores disponível durante a configuração inicial.
4. Contratos e informações fiscais/bancárias aceitos no App Store Connect
   quando aplicáveis.
5. Registro do app no App Store Connect para `br.tec.rotamestre.app`.
6. Certificado de distribuição e provisioning profile válidos no EAS.

## Validação antes do primeiro build

```bash
npm ci
npm run validate
npm run build:web
npx expo config --type public
npx eas config --platform ios --profile production
```

No iPhone físico, valide pelo menos:

- login e restauração de sessão;
- solicitação de localização “Durante o Uso” e “Sempre”;
- rota ativa, MiniMapa, mapa completo e navegação;
- rastreamento com tela bloqueada;
- conclusão/pulo de parada e foto de comprovação;
- notificações push via APNs/Expo;
- links externos e fluxo de exclusão de conta;
- perda e retorno de rede.

## Primeiro build e credenciais

O primeiro build precisa ser iniciado interativamente para que o EAS valide ou
crie o certificado de distribuição e o provisioning profile:

```bash
npx eas build --platform ios --profile production
```

Digite a senha e o código 2FA somente no terminal oficial do EAS. Depois que as
credenciais estiverem configuradas, builds posteriores podem ser iniciados de
forma não interativa.

Registre no handoff:

- commit usado;
- versão e build number;
- ID do build EAS;
- resultado do smoke test;
- estado no TestFlight e na revisão.

## App Store Connect

Antes da submissão, preencher e revisar:

- nome, subtítulo, descrição e palavras-chave;
- categoria principal e secundária;
- URL de suporte;
- política de privacidade;
- screenshots de iPhone e, como `supportsTablet` está ativo, de iPad;
- classificação etária;
- direitos sobre conteúdo;
- App Privacy coerente com a coleta real;
- instruções de acesso do revisor e conta de demonstração;
- justificativa clara para localização em segundo plano;
- disponibilidade por país/região;
- conformidade de exportação.

URLs públicas existentes:

- Site: <https://rotamestre.tec.br>
- Política: <https://rotamestre.tec.br/politica-de-privacidade>
- Termos: <https://rotamestre.tec.br/termos-de-uso>
- Exclusão: <https://rotamestre.tec.br/exclusao-de-conta>

## Submissão

Depois de o build estar concluído e o app existir no App Store Connect:

```bash
npx eas submit --platform ios --profile production --latest
```

O upload não publica automaticamente. No App Store Connect, selecione o build,
complete os metadados, responda às declarações, envie para revisão e acompanhe
o estado. Use TestFlight antes da produção para validar instalação, push,
localização em segundo plano e os fluxos operacionais em um artefato assinado
pela Apple.

## Pós-publicação

- instalar pela App Store/TestFlight, não por build local;
- confirmar login, mapa, fotos, push e localização;
- acompanhar crashes e feedback no App Store Connect;
- manter a ficha e o App Privacy coerentes com o produto;
- incrementar `ios.buildNumber` antes do próximo upload;
- atualizar `PROJECT_CONTEXT.md` após cada mudança de estado.

## Referências oficiais

- [Expo: versões de aplicativo](https://docs.expo.dev/build-reference/app-versions/)
- [Expo: configuração do EAS](https://docs.expo.dev/eas/json/)
- [Apple: criptografia no Info.plist](https://developer.apple.com/documentation/BundleResources/Information-Property-List/ITSAppUsesNonExemptEncryption)
- [Apple: conformidade de exportação](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance)
