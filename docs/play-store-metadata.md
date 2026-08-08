# Google Play — metadados canônicos do Rota Mestre

Atualizado em 08/08/2026. Este arquivo é a fonte de verdade para a listagem,
declarações e acesso de avaliação do pacote `br.tec.rotamestre.app`.

## Identificação

- Nome: `Rota Mestre`
- Idioma padrão: Português (Brasil)
- Aplicativo gratuito
- Categoria: Empresas
- Tags prioritárias disponíveis: Produtividade; Automóveis e veículos
- Público-alvo: somente 18 anos ou mais
- País inicial: Brasil
- E-mail: `contato@rotamestre.tec.br`
- Site: `https://rotamestre.tec.br`
- Política: `https://rotamestre.tec.br/politica-de-privacidade`
- Termos: `https://rotamestre.tec.br/termos-de-uso`
- Exclusão de conta: `https://rotamestre.tec.br/exclusao-de-conta`

## Listagem principal

### Título

```text
Rota Mestre
```

### Descrição curta

```text
Planeje entregas, organize paradas e acompanhe rotas em tempo real.
```

### Descrição completa

```text
O Rota Mestre ajuda empresas e equipes de entrega a planejar, executar e acompanhar rotas em um só lugar.

PARA GESTORES
• Crie rotas com múltiplas paradas
• Organize a ordem das entregas
• Atribua rotas aos motoristas
• Acompanhe o progresso de rotas ativas
• Consulte histórico, ocorrências e comprovantes
• Gerencie motoristas e unidades

PARA MOTORISTAS
• Receba no celular as rotas atribuídas
• Use navegação durante as entregas
• Consulte paradas e detalhes do destino
• Registre entregas, retiradas e ocorrências
• Envie fotos de comprovação
• Mantenha o gestor informado durante a rota

LOCALIZAÇÃO DURANTE A ROTA
Quando o motorista inicia uma rota, o aplicativo pode usar a localização em segundo plano para manter a navegação e permitir o acompanhamento operacional pelo gestor. O rastreamento é interrompido quando a rota é pausada ou encerrada.

O Rota Mestre possui interface em português e foi desenvolvido para operações logísticas de empresas brasileiras.

Suporte: contato@rotamestre.tec.br
```

Não publicar alegações quantitativas de economia ou tempo, nem promessa de
período grátis, sem documentação comercial que as comprove.

## Ativos

Arquivos finais:

- Ícone: `assets/store/icon-512.png` — PNG 512 × 512, até 1.024 KB.
- Feature graphic: `assets/store/feature-graphic-1024x500-v2.png` — PNG
  1024 × 500. **É o publicado.** A versão sem `-v2` foi removida em 08/08/2026
  para não deixar dúvida sobre qual está no ar.
- Screenshots de telefone: `assets/store/screenshots/phone/final/` — 8
  imagens 1080 × 1920, sem dados reais de clientes.

As capturas originais do Android ficam em `assets/store/screenshots/phone/raw/`
e não devem ser enviadas ao Play Console.

As 8 capturas foram refeitas em 08/08/2026 com as contas demo renovadas, uma
rota atual de João Pessoa e dados fictícios exclusivos da unidade de avaliação.

Sequência recomendada:

1. Gestão em um só lugar
2. Crie rotas em poucos passos
3. Acompanhe toda a operação
4. Visualize a rota e cada parada
5. Próxima parada sempre à vista
6. Todas as paradas no mapa
7. Navegue com seu app favorito
8. Ajuda sempre à mão

## Acesso para avaliação

**Onde fica no Play Console** (verificado em 05/08/2026 — a declaração foi
renomeada e o caminho não é óbvio):

- A declaração **não** se chama mais "Acesso ao app". Hoje é **"Detalhes do
  login"**; a própria página avisa o nome antigo.
- **"Políticas e programas" está aninhado dentro de "Monitorar e aprimorar"**,
  não é seção de topo do menu lateral.
- Caminho: **Monitorar e aprimorar → Políticas e programas → Conteúdo do app →
  aba "Concluídas" → Detalhes do login → Gerenciar**.
- Atalho: `…/app/<appId>/app-content/testing-credentials`. A página de índice é
  `…/app-content/overview` — `…/app-content` sem `/overview` redireciona para a
  lista de apps.
- O Play Console exibe usuário e senha **em texto puro** para quem tem
  permissão. É a fonte de verdade dessas credenciais.

**Quais contas usar — não é escolha cosmética.** As duas entradas devem apontar
para o par **demo** (`gestor.demo@` / `motorista.demo@`), que vive na **Unidade
Demo - Avaliacao Google**. Até 06/08/2026 a entrada de motorista apontava para
uma conta de uma **unidade real**, e as policies dão a qualquer motorista da
unidade: o registro completo da empresa (`unidades` — CNPJ, endereço, telefone,
e-mail, plano) e **nome, e-mail e telefone de todo o time** (`usuarios`). Isso é
dado pessoal de terceiros entregue a um revisor externo. As rotas em si ficam
protegidas (`rotas_select` casa por `motorista_id`), mas o cadastro não.

Ao revisar essas entradas, confirme sempre que o e-mail termina em `.demo@` — a
Unidade Demo contém apenas as duas contas demo, nenhuma pessoa real.

Cadastrar duas entradas no Play Console, sem copiar senhas para este documento:

### Manager reviewer account

```text
Sign in with the manager review account provided above. No OTP or additional
authentication is required. After signing in, the app opens the manager
dashboard. The reviewer can create a delivery route, add stops, assign a driver,
view route progress, reports, incidents, profile settings, privacy documents,
and the account deletion option.
```

### Driver reviewer account

```text
Sign in with the driver review account provided above. No OTP or additional
authentication is required. A demonstration route is assigned to this account.
Open the active route to view stops, start navigation and location tracking,
register a completed or skipped stop, attach a proof photo, report an incident,
view performance, profile settings, privacy documents, and the account deletion
option. Location and camera permissions may be granted when requested.
```

As contas devem permanecer ativas, reutilizáveis e válidas em qualquer país
durante toda a revisão.

## Declarações

### Anúncios e identificadores

- Contém anúncios: Não.
- Usa Advertising ID: Não.
- Compras no aplicativo: Não.

### Público e conteúdo

- Público-alvo: 18 anos ou mais.
- Não direcionado a crianças.
- Conteúdo gerado pelo usuário: Sim — fotos e observações operacionais,
  restritas à empresa e sujeitas a controle de acesso.
- Violência, sexualidade, linguagem ofensiva, drogas e jogos de azar: Não.
- Compartilhamento/localização: Sim, para acompanhamento de rotas.

### Segurança dos dados

Dados coletados:

- Informações pessoais: nome, e-mail, telefone, identificador, empresa e função.
- Localização aproximada e precisa, inclusive em segundo plano durante rota.
- Fotos: perfil, comprovantes e incidentes.
- Conteúdo do usuário: rotas, paradas, destinatários, observações e ocorrências.
- Atividade no app: interações, registros operacionais e auditoria.
- Identificadores: token de push, IP e identificadores técnicos necessários.

Finalidades:

- Funcionalidade do aplicativo.
- Gerenciamento de conta.
- Segurança, prevenção de abuso e auditoria.
- Relatórios e desempenho operacional.
- Comunicação do desenvolvedor por notificações.

Não são utilizados para anúncios ou personalização publicitária. Supabase,
Google Maps/Routes e Expo/FCM atuam como prestadores de serviço. Confirmar os
contratos de tratamento antes de selecionar a exceção de “não compartilhado”.

- Criptografia em trânsito: Sim.
- Solicitação de exclusão: Sim, dentro e fora do app.
- Conta necessária: Sim.

### Localização em segundo plano

Finalidade do app:

```text
O Rota Mestre permite que empresas planejem entregas, atribuam rotas e acompanhem sua execução. Motoristas consultam paradas, navegam, registram entregas e incidentes; gestores acompanham o progresso e consultam comprovantes e relatórios.
```

Recurso principal:

```text
Durante uma rota iniciada pelo motorista, o app coleta e envia a localização mesmo quando está fechado ou não está em uso. Isso mantém a navegação e permite que o gestor da empresa acompanhe a entrega em tempo real. A coleta é interrompida quando a rota é pausada ou encerrada.
```

O vídeo deve mostrar, nesta ordem:

1. Motorista abrindo uma rota atribuída.
2. A divulgação destacada “Localização durante a rota”.
3. O toque em “Continuar”.
4. Os diálogos de permissão do Android.
5. A notificação persistente da rota.
6. O gestor visualizando o progresso.

### Serviço em primeiro plano

Selecionar somente:

- Compartilhamento de local iniciado pelo usuário.
- Navegação.

O serviço começa após o motorista iniciar a rota e termina ao pausar ou encerrar.

## Teste fechado

- Usar o AAB mais recente, nunca o rascunho `3019`.
- País inicial: Brasil.
- Manter pelo menos 12 contas Google inscritas continuamente por 14 dias.
- Guardar evidências de feedback, problemas encontrados e correções.
- O teste interno não conta para o requisito de acesso à produção.

## Notas da versão

```text
• Exclusão de conta disponível no perfil
• Mais transparência no uso de localização durante rotas
• Proteção aprimorada da sessão e dos dados locais
• Correções de permissões, estabilidade e desempenho
```
