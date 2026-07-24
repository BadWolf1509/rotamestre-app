# Reconstrução e relançamento do aplicativo Android

> Registro histórico e plano de rollout. Atualizado em 24/07/2026.
> Para o estado operacional atual, comece por
> [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

## Decisão

As contas originais do Firebase/GCP, Expo/EAS e Google Play que publicavam o
package `br.tec.rotamestre` foram perdidas. O app instalado continuou acessando
o Supabase, mas não podia mais receber atualizações confiáveis.

A decisão foi reconstruir a identidade de distribuição:

| Item            | Identidade atual                       |
| --------------- | -------------------------------------- |
| Android package | `br.tec.rotamestre.app`                |
| EAS project     | `c6401a59-af97-484a-93b7-c75016bf331d` |
| Firebase        | `rota-mestre-97084`                    |
| Backend e dados | Supabase `xezslsyxjivunmhhyxtd`        |

O package antigo permanece reservado à conta perdida e não deve ser reutilizado.
Os dois aplicativos usam o mesmo backend; usuários que instalam a versão nova
mantêm conta e dados.

## O que foi preservado

- código-fonte e histórico Git;
- domínio `rotamestre.tec.br`;
- web em Vercel;
- Supabase Auth, banco, Storage e dados operacionais;
- contas e vínculos de unidade dos usuários.

## O que foi reconstruído

- application ID Android;
- projeto Expo/EAS;
- keystore/upload key;
- projeto Firebase e credenciais FCM;
- app no Google Play e Play App Signing;
- fluxo de build e submissão;
- assets e metadados da ficha da loja;
- páginas públicas de política, termos e exclusão.

## Estado das fases

### 0. Contas e propriedade — concluída

As novas contas de distribuição estão operacionais. A continuidade agora
depende de manter administradores recuperáveis, backup de credenciais e
propriedade corporativa documentada fora do Git.

### 1. Nova identidade no código — concluída

`app.config.js` referencia o package, EAS project e configuração Firebase
atuais. O scheme `rotamestre` foi preservado.

### 2. Build, assinatura e push — concluída

O app foi compilado sob a identidade nova e a credencial FCM V1 foi
configurada. Push foi validado em dispositivo físico. Como FCM não depende de
fingerprint SHA, a validação relevante é no artefato instalado pelo Play.

### 3. Google Play — em rollout

O app e o teste interno foram configurados, os testadores foram revisados e o
material de publicação foi preparado. O estado exato das trilhas não vive no
Git: confirme no Play Console a versão ativa, o teste fechado exigido e a
elegibilidade para produção.

Runbook: [GOOGLE_PLAY_DEPLOYMENT.md](GOOGLE_PLAY_DEPLOYMENT.md).

### 4. Migração de usuários — próxima etapa

O backend compartilhado elimina migração de dados, mas não instala o novo app
automaticamente. O plano de comunicação pode combinar:

- notificação dentro do app antigo;
- e-mail/WhatsApp aos gestores;
- comunicação no site institucional;
- suporte direto às unidades;
- push antigo apenas se ainda for comprovadamente entregável.

Não desligue o backend compartilhado durante a transição.

### 5. Encerramento do app antigo — pendente

A conta perdida impede uma despublicação administrada. O objetivo é mover os
usuários para o package novo, manter o backend compatível durante a janela de
transição e só então encerrar suportes específicos ao cliente antigo.

## Critérios para concluir o relançamento

- última versão aprovada e disponível na trilha pretendida;
- requisito de teste fechado cumprido, se aplicável à conta;
- autenticação, rota, localização, foto, push e exclusão validados no artefato
  instalado pelo Play;
- dados de Segurança do app e páginas legais coerentes;
- canal de suporte e instruções de atualização comunicados;
- adoção do app novo acompanhada por unidade;
- credenciais e recuperação testadas/documentadas.

## Riscos ainda relevantes

- tester cadastrado com e-mail diferente da Conta Google;
- `google-services.json` ou credencial FCM V1 apontando para o projeto errado;
- ambiente EAS usando chave pública antiga do Supabase;
- gerar `versionCode` duplicado ou AAB a partir de árvore não registrada;
- interromper o app antigo antes da migração dos usuários;
- divergência entre coleta real de dados, páginas legais e declaração do Play;
- voltar a concentrar propriedade das plataformas em uma única conta pessoal.

## Política de continuidade

1. Contas críticas devem ter pelo menos dois administradores recuperáveis.
2. Keystore, senhas e recovery codes ficam no gerenciador corporativo e em
   backup separado.
3. Credenciais nunca entram no repositório.
4. Alterações de package, assinatura, projeto Firebase ou EAS exigem registro de
   decisão e plano de rollback.
5. O estado do rollout deve ser atualizado em
   [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) após cada avanço.
