# Contexto operacional — Rota Mestre App

> Documento de entrada para novas sessões. Atualizado em 11/11/2026.
> Consulte o código ou o serviço responsável antes de alterar um estado externo.
>
> **O que este documento é:** estado atual, pendências e armadilhas — o que você
> precisa para **começar a agir**. **O que ele não é:** histórico e validações já
> feitas (em [HISTORICO.md](HISTORICO.md)), arquitetura e padrões de código (em
> [`../CLAUDE.md`](../CLAUDE.md)), versões (no `package.json`) nem estado de
> schema (`npx supabase migration list --remote`). Duplicar qualquer um deles aqui é como
> este arquivo já ficou desatualizado.
>
> **Para começar rápido:** leia Pendências → Armadilhas → Estado atual. Bastam
> para agir; o resto é referência sob demanda.
>
> **Contrato de tamanho:** este arquivo é lido por inteiro em toda sessão, então
> cresce a um custo que ninguém vê. Já foi cortado **cinco vezes** — a cronologia
> está em [HISTORICO.md](HISTORICO.md) — e **volta a crescer entre um corte e o
> seguinte**, sempre por acréscimo legítimo.
>
> O que sobrevive a um corte é regra que muda decisão. Sai daqui: relato de
> trabalho terminado, e **cópia do que já está no `CLAUDE.md`** — os dois são
> lidos em toda sessão, então duplicar entre eles custa em dobro e ainda deixa as
> versões divergirem. Antes de somar uma seção, pergunte se ela precisa ser lida
> **em toda sessão** ou só quando alguém for mexer naquele fluxo; no segundo
> caso, o lugar é o `HISTORICO.md` ou o doc do tema, com uma linha no Mapa da
> documentação.

## Pendências (comece por aqui)

Lista única e canônica. Se resolver uma, risque daqui. **Os números não são
renumerados** quando uma sai — a 2 foi fechada em 06/09/2026 e o resto do
documento cita as outras pelo número ("pendência 4"), que passaria a apontar
para outra coisa.

- **3.** **Fase 2 da auditoria:** chip na tela da rota + indicador/filtro/contador na Gestão de Rotas. Plano próprio ainda não escrito — melhor depois de algumas semanas de dado acumulado.<br>_Quem:_ qualquer sessão · _Detalhe:_ spec `2026-08-04-auditoria-otimizacao-rotas-design.md`
- **4.** **Play Store: produção continua vazia, e o gargalo é contável.** Teste fechado (`alpha`) e interno publicados e `completed` — confira qual build com `npm run play:status`. Para solicitar produção faltam **12 testadores com opt-in mantidos por 14 dias corridos** no teste fechado (em 31/08 eram **6**; o número vivo está no Painel do app no Console, não aqui). O caminho para os que faltam é divulgar o hub público `/testar`. **O teste aberto não é atalho:** ele fica bloqueado até haver acesso de produção — a dependência corre nesse sentido, e tentar promover para `beta` antes disso devolve `FAILED_PRECONDITION`.<br>_Quem:_ gestor (Play Console) · _Detalhe:_ `GOOGLE_PLAY_DEPLOYMENT.md`
- **5.** **iOS:** não existe build. Bloqueado na autenticação interativa da Apple (`npx eas-cli build --platform ios --profile production`).<br>_Quem:_ gestor (Apple ID + 2FA) · _Detalhe:_ `APP_STORE_DEPLOYMENT.md`
- **6.** **4 das 9 unidades têm coordenadas de sede NULL, mas só 1 está ativa** — o registro anterior dizia "4 unidades não conseguem gerar rota"; conferido no banco em 15/08, três delas estão inativas e o impacto real hoje é **uma**. A tela "Minha Unidade" é o caminho de conserto e desde 08/08 funciona de verdade (ver Migration 22 e a armadilha do componente aninhado). Desde o PR #385 a Nova Rota avisa e leva até lá, em vez de só sumir com o cartão de partida.<br>_Quem:_ gestor (edita a unidade ativa) · _Detalhe:_ `database/MIGRATIONS.md` (Migration 22)
- **7.** **Proteção contra senha vazada: exige plano Pro, não dá para ligar hoje.** O advisor aponta `auth_leaked_password_protection`, mas a checagem contra o HaveIBeenPwned é **Pro ou acima** — a assinatura é por organização, não por projeto. **Não é um toggle**, é upgrade de plano. O que o free permite e vale conferir: comprimento mínimo e caracteres exigidos, em Auth → Providers → Email.<br>_Quem:_ gestor (decisão de plano; ou ajuste no Email) · _Detalhe:_ "Política de senha" em [HISTORICO.md](HISTORICO.md)

- **8.** **Mapa nativo continua sem executar em CI — e nenhum check distingue tile com marca d'água.** Fechado em 31/08: a divergência web/nativo virou teste estático (`src/lib/__tests__/maplibre-fonte-unica.test.ts`, quebra se um lado embutir outro provedor) e o e2e passou a exigir que tiles reais tenham sido buscados, sem falha e só do provedor esperado — antes ele parava no evento `load`, que dispara mesmo com tile em 403. **O que sobra é o caro:** rodar o mapa nativo exigiria emulador Android + app compilado (~25 min por execução), desproporcional para check de PR; e tile marcado chega como **200 com PNG válido**, que só análise de imagem ou olho humano distingue. Para essa classe, o caminho é canário agendado contra o endpoint, não check de PR.<br>_Quem:_ qualquer sessão · _Detalhe:_ armadilha "Fonte de tiles"

- **9.** **Duas decisões de produto levantadas no smoke de 05/09/2026 — nenhuma é defeito.** (a) **"Excluir motorista" é só desativar**, e o vínculo em `usuario_unidades` continua `ativo` — o seletor do app checa os dois, mas código que filtre só pelo vínculo veria um motorista desativado. (b) **Não existe caminho para reabrir parada concluída** em nenhuma das duas contas: o botão "Retomar" só aparece para parada _pulada_, e o painel do gestor não oferece a ação.<br>_Quem:_ gestor (decisão) · _Detalhe:_ [HISTORICO.md](HISTORICO.md), sessão de 05/09

- **10.** **O app coleta localização em background e persiste — a ficha do Play precisa dizer isso.** `motorista_locations` acumula desde 18/12/2025 e **cresce rápido**: 17.725 linhas em 414 rotas em 06/09/2026, **32.193 em 466** em 17/09 — quase o dobro em onze dias. O número vivo sai de `select count(*), count(distinct rota_id) from motorista_locations`; **não copie o valor para cá de novo** (a versão anterior deste item trazia o de 06/09 como se fosse atual, e é a mesma regra "um fato, uma fonte" que o cabeçalho cobra). O código pede `requestBackgroundPermissionsAsync()` (`src/services/unifiedLocationTracking.ts:151`) e roda `startLocationUpdatesAsync` com foreground service (`:256`). Isso obriga a **Declaração de Permissões Sensíveis** com vídeo demonstrativo e a marcação de coleta **em background** na Segurança de Dados — divergência entre ficha e comportamento é motivo de suspensão. **Retenção desde 22/10/2026 (Migration 37):** posições de rotas encerradas há mais de 90 dias são apagadas toda noite pela `limpar_localizacoes_antigas`, chamada pela Edge Function `expire-routes` (não há `pg_cron`); a declaração pode citar esse prazo. A produção ainda está vazia (pendência 4), então dá para corrigir antes de pedir acesso. A _prominent disclosure_ que o Google exige **já está** implementada e correta (`:157`), antes do diálogo do sistema. **Como o registro anterior errou:** observou-se `ProviderRequest[OFF]` com o app em background e concluiu-se "só primeiro plano" — mas o rastreamento só começa em `startRoute`, então medir fora de uma rota `em_andamento` produz `OFF` tanto no código certo quanto no errado. Evidência que não distingue as hipóteses, a mesma armadilha do banner de expiração.<br>_Quem:_ gestor (Play Console) · _Detalhe:_ `GOOGLE_PLAY_DEPLOYMENT.md`

- **11.** **Nenhuma das 9 unidades tem gestor principal, e não há caminho no app para estabelecer o primeiro.** Medido em 06/09/2026: 0 de 16 usuários com `is_gestor_principal = true`, porque nenhuma unidade nasceu pelo fluxo self-service — o único que liga o flag. Efeito hoje: a tela de transferência de gestão está **inalcançável para todos os gestores** (ela exige ser o principal), e o mesmo vale para o badge do drawer. A Migration 27 fechou a autopromoção por `.update()` direto, que era o único "caminho" anterior e era o próprio buraco — então o bootstrap do primeiro titular passa a exigir `service_role` ou uma RPC dedicada, **nenhuma das duas existe**. Não é esquecimento: escolher quem é o titular de cada unidade dá poder sobre ela e é decisão de produto, não de quem escreve a migration.<br>_Quem:_ gestor (decidir os titulares) · _Detalhe:_ `database/MIGRATIONS.md`, Migration 27

- **12.** **Interna e alpha na 1.16.0 (3060) desde 11/11/2026 (pendências 37 e 38). A Play não tem release em produção. Falta o teste de rua antes de produção.** **1.14.7 validada no moto g15 com o binário da Play (26/10):** Wi-Fi conectado sem internet, a rota aparece em 12 s (60–75 s na 1.14.6); token vencido sem rede, até 6 s e sem pedir login; modo avião, 5 s; foto sem rede em menos de 2 s, com `concluida_em` preservado; na volta da rede com fila, tudo sobe sem requisição anônima. **1.14.8 (26/10):** atualizada pela Play mantendo o login; o pulo com texto grava em `observacao_pulo` e preserva `observacoes`. O que as versões até a 1.14.6 trouxeram e as validações de 22 e 24/10 estão em [HISTORICO.md](HISTORICO.md). **Falta:** teste de rua com tela apagada (o intervalo de 50 m em movimento não foi exercitado — aparelho parado). **Como saber quem atualizou:** o app nativo põe a versão no `X-Client-Info` (`rotamestre/1.14.4+3042; supabase-js; runtime=react-native`) — consulte `log_attributes['request.headers.x_client_info']` nos `edge_logs` (header próprio não serve: os edge_logs só guardam uma lista fixa). **`eas update`:** seguro só para binários do mesmo `version` (o `runtimeVersion` é `appVersion`). **No dia seguinte a cada upload:** conferir que o robô de pré-lançamento entrou na conta de avaliação, não na demo do e2e. **Promover:** `npm run play:promote -- <faixas> <versionCode> <nome> --notas=<arquivo>` — **sem `--notas`, apaga as notas que a faixa tinha** (o PUT substitui a release inteira). Notas usadas em `docs/HISTORICO.md`. Produção segue presa na pendência 4.<br>_Quem:_ gestor (teste de rua, promoção) · _Detalhe:_ [HISTORICO.md](HISTORICO.md), 21–26/10/2026

- **21.** **Vínculo multi-loja: travado; falta o convite aceito pelo motorista.** Em 20/10/2026 o vínculo pelo e-mail saiu (qualquer gestor puxava o motorista de outra empresa, também direto pelo PostgREST), a `criar-motorista` deixou de apagar conta do Auth, e o gestor não mexe mais na pessoa de quem atende outra loja (Migration 31). **Migration e função publicadas só depois do merge — confira `supabase migration list` e a versão da função antes de dar por aplicado.** Novo vínculo entre lojas hoje é pelo suporte (service role). Próximo passo, ainda não aprovado: convite pendente que o motorista aceita no app (precisa de release).<br>_Quem:_ gestor (aprovar o desenho do convite) · _Detalhe:_ `supabase/functions/criar-motorista/index.ts`, `database/MIGRATIONS.md` (Migration 31)
- **22.** **Sobras do incidente da `service_role` (22/10/2026).** As Migrations 33–36 fecharam a parte do banco (push entre empresas, destino do incidente, todos os gestores da loja, `get_gestor_principal` apagada). Falta: (a) o **painel administrativo** (outro projeto) roda com `service_role` e precisa trocar para a chave secreta nova — e lá vale um grep por `get_gestor_principal` e `cleanup_old_locations`, que não existem mais (Migrations 36 e 37); (b) opcional: `git filter-repo` para tirar a chave morta do histórico.<br>_Quem:_ gestor · _Detalhe:_ armadilha "Chaves do Supabase"; [HISTORICO.md](HISTORICO.md), 22/10/2026

- **23.** **1.14.12 (3050): na interna e na alpha desde 03/11/2026, validada no moto g15 pela Play** (leva #702, #706, #707 e #711; notas em [HISTORICO.md](HISTORICO.md)). Medido: com Wi-Fi sem internet a rota guardada aparece em 7,0–7,7 s (1.14.11: 26,5 s; 1.14.10: ≈ 11 s) e a faixa "Sem conexão" entra aos ~30 s, com o rastreamento ativo; com rede, 6,9 s. Posições: 120 pontos e 0 duplicatas em 15 min com três `force-stop`, período sem internet e reconexão. Tema claro/escuro com o Unistyles 3.7.0 imediato e mapa nativo sem erro no logcat (conferido na 1.14.11, sem mudança de UI). **A 1.14.11 não subiu à alpha:** com o #707 o perfil sai do aparelho sem ir à rede, e a busca da rota passou a ser a primeira a esbarrar no DNS, com o retry inteiro do postgrest-js; o #711 põe o retrato guardado na tela antes da busca, e só a resposta do banco confirma a rota para o rastreamento (`confirmadoPeloBanco`). **Ainda pode duplicar posição** (raro, 2 em 30 min na 1.14.11, ligados a `force-stop`): lote que o banco gravou e o processo morreu antes de tirá-lo da fila, resposta perdida e dois contextos JS. Recomendado e a decidir pelo usuário: `id` da posição derivado do fix (hash de conta + rota + timestamp + lat/lng) com `ON CONFLICT DO NOTHING` na chave primária — dispensa migration e a limpeza das ~380 linhas antigas; o `authenticated` já pode mandar o `id` no INSERT. Não exercitados: tela apagada andando (50 m), Retomar depois de finalizar, push na bandeja.<br>_Quem:_ gestor (teste de rua, decisão das posições) · _Detalhe:_ [HISTORICO.md](HISTORICO.md), 03/11/2026
- **24.** **Pendências conhecidas da fila offline (nenhuma bloqueia):** (a) atomicidade de `avancarProxima` (duas escritas); (b) sonda do UPDATE condicional que a fila usa para não regredir status. Fechados no #638: aviso de ações de outra conta no aparelho e foto de comprovante desacoplada da ação (ligada sem sobrescrever, registrada em `logs` com evento `foto_comprovante_sem_vinculo`, ou mantida no aparelho).<br>_Quem:_ qualquer sessão · _Detalhe:_ `src/lib/offline.ts`
- **25.** **Release 1.14.3 distribuído → publicar as Edge Functions que dependem dele (detalhe fora do repositório).**<br>_Quem:_ gestor · _Detalhe:_ fora do repositório
- **26.** **Sobra do adiado do gestor:** `resumo_desempenho_motorista(uuid,int)` ainda soma todas as lojas; a tela do gestor já usa `desempenho_motorista_na_loja` (M89, #749, 08/11/2026) e a função antiga só sai quando nada mais a chamar.<br>_Quem:_ qualquer sessão · _Detalhe:_ [HISTORICO.md](HISTORICO.md), "Execução das varreduras de 08/11/2026"
- **29.** **Não existe tela para adicionar ou promover gestor de uma loja.** Lacuna de produto; a decisão é do gestor.<br>_Quem:_ gestor (decisão) · _Detalhe:_ pendência 11
- **30.** **Restos das varreduras de 25 e 26/10 (com o gestor):** (a) e (b) fechados em 26/10 (passo 5 feito; `.env.example` sem a chave antiga); (g) BKD-5: ligar a proteção contra senha vazada no Auth (painel do Supabase); (h) fechado em 08/11 — indicadores do perfil do motorista por loja (M89 `desempenho_motorista_na_loja`, #749); (i) fechado em 08/11 — gatilho de `resolvido_em` (M87, #749); (j) fechado em 08/11 — `iniciar_rota(uuid)` transacional (M88, #749); (k) fechado em 08/11 — fila offline de incidentes (#750); (l) fechado em 08/11 — escrita atômica do `secureAuthStorage` (#747); (m) fechado em 08/11 — resumo de testes instáveis/lentos do jest no CI (#745). (c) Migration 51 (SELECT de `unidades` só pelas colunas de `COLUNAS_UNIDADE_APP`: REVOKE SELECT da tabela para `anon`/`authenticated` + GRANT SELECT nas 14 colunas da lista, e a RPC `cnpj_da_unidade(uuid)` SECURITY DEFINER que devolve o CNPJ só a gestor ativo da loja, senão 42501; o app já está pronto desde o #654). Os arquivos guardados se perderam com o scratchpad em 26/10 — reescrever com sonda quando for aplicar, a aplicar quando as versões anteriores à 1.14.6 sumirem dos acessos (em 30/10/2026 os nativos com versão eram só 1.14.9 e 1.14.10, mas ainda havia 354 requisições de um nativo sem o cabeçalho `rotamestre/`, `supabase-js/2.110.8; runtime=react-native` — build anterior ao #607; a M51 segue esperando; **medição de 08/11** com o critério do gestor — zero acessos em 14 dias, nativo sem o cabeçalho `rotamestre/` conta como dependente: ainda houve acesso de nativo sem o cabeçalho em 06/11 (`supabase-js/2.110.8` e `2.117.2`, runtime react-native), então **nada foi aplicado; data mínima 20/11/2026**, se não houver novo acesso) (em 26/10 a 1.14.5 ainda fazia ~3,2 mil requisições por dia, e a 1.14.4 algumas — conferir pelo `x_client_info` nos `edge_logs`; a produção da Play precisa receber uma versão ≥1.14.6 antes); (d) um projeto de staging do Supabase para o e2e não escrever na produção (armadilha "Banco único"); (e) fechado em 08/11 — alerta de falha do cron que chama `expire-routes`/`remind-routes`: o agendador abre uma issue com label `agendador-falhou`, uma por job (#745); (n) B-7 (varredura de 07/11): aposentar, **um por vez**, os atalhos de compatibilidade com app antigo — a coluna `usuarios.push_token` (fallback de `tokensDaConta.ts`), o gatilho que preserva `observacoes` quando o app até a 1.14.7 manda o pulo nela (Migration 73), o `em_andamento → concluida` por UPDATE direto do motorista (app até a 1.14.2; Migration 76, que desde a 83 já exige as paradas reais fechadas) e o `unidade_id` opcional na `criar-motorista` — cada um só quando o `x_client_info` dos `edge_logs` mostrar que as versões que dependem dele sumiram. **Em 08/11 nada foi aposentado** (mesma medição da M51, acima); reavaliar a partir de 20/11/2026.<br>_Quem:_ gestor · _Detalhe:_ [HISTORICO.md](HISTORICO.md), 25–26/10/2026
- **31.** **Expo SDK 58: na `main` desde 06/11 (#710, d4a9223e); interna e alpha na 3059 (1.15.2, #740) desde 08/11/2026, com notas que cobrem o caminho desde a 3051 (a alpha pulou a 3052–3058). A promoção saiu antes do teste de rua e do M-3 (pendência 35(c)), por decisão do gestor.** O relatório da migração está em `docs/superpowers/2026-11-05-relatorio-expo-sdk-58.md`. O #710 levou também os 11 pacotes do alinhamento 58.0.23 (13f8adbe). RN 0.88, React 19.3, Gesture Handler 3, Jest 30, um `GestureHandlerRootView` na raiz e o patch do `react-native-draggable-flatlist`. A allowlist do audit sai vazia, e o prazo de 24/11 deixa de existir. **Validado no moto g15 (04–05/11):** partida a frio (Nitro e Unistyles), atualização pela Play mantendo o login, mapa nativo, balão e Waze com destino, rastreamento com a tela acesa, `install -r` sem ClassNotFound, conclusão com foto na parada certa, o modal duplicado do #723 não volta, tema escuro com partida a frio, deslizar do motorista nos dois sentidos, e o **arrasto** — modal Reordenar (rolar a lista, autoscroll até o fim, levar a 15 à 18, dois arrastos seguidos, toque longo sem mexer não grava) e Nova Entrega (a página rola sobre a lista e o arrasto grava a ordem no rascunho). **Correções feitas no aparelho, em ordem:** root view do Gesture Handler dentro do `Modal` nativo (c80f80a2); ativação manual do Pan no patch (9f2888e0); a lista aninhável da Nova Entrega foi tentada e revertida (e2be5844, jogava a página para o topo); alça do Reordenar no toque longo (936c030b); trocar de conta desmonta a pilha da anterior (54eede95); arrasto sem mudança de ordem não deixa parada fantasma (9918a01f) nem grava e fecha o modal (8e3228fb); sai a flag experimental do LayoutAnimation (6595dc04). **Validado na 3056 da Play (06/11):** as duas telas de arrasto, push FCM com toque abrindo Paradas, Sair → "Esqueci a senha" (`/auth/v1/recover` 200) → login. **Falta:** rastreamento com a tela apagada **em movimento** (parado, o Android desliga o GPS — a 1.14.13 faz igual). **Decidir:** o aviso do Unistyles com dois estilos num `TouchableOpacity`/`Animated.View` (~70 pontos, 30 por abertura do mapa da rota) — o `Touchable` proposto foi revertido (R-UI-1); ver a pendência 34(e). A 58 passou a respeitar `accuracy`/`timeInterval`/`distanceInterval` do expo-location, que a 57 descartava: mais posições e mais bateria na navegação — medir na rua antes de recalibrar.<br>_Quem:_ qualquer sessão (aparelho com o gestor) · _Detalhe:_ `docs/superpowers/2026-11-03-expo-sdk-58-relatorio-e-roteiro.md` §6, [HISTORICO.md](HISTORICO.md) "Expo SDK 58 no aparelho"
- **32.** **Varredura de refatorações de 03/11/2026: as cinco trilhas estão na `main` (#714–#718), falta validar fora do CI.** Só JavaScript mudou. A 1.14.13 (3051) da Play já contém as cinco trilhas, então o aparelho se valida nela, sem dev client nem build no EAS — e **antes** do build do SDK 58 (pendência 31), para uma regressão nele apontar para o SDK e não para a refatoração. **Feito em 03–04/11 (#717):** o aviso de rota estimada no dev web e, no moto g15, a volta sem rede com foto, o mapa da navegação no tema escuro (bordas e números brancos sobre o mapa), o rastreamento ligado ("Rastreando", posições gravando) e a foto com `always_finish_activities` gravando na parada certa ([HISTORICO.md](HISTORICO.md)). **Navegador (04/11, feito):** "Não executada" em vermelho no card e no cabeçalho, telefone duplicado pelo perfil, pinos no tema escuro, menu lateral e "Falar com Gestor" citando a rota e o endereço; o popup do mapa web no tema escuro estava ilegível e foi corrigido no #726. **Moto g15, ainda sem prova:** a chegada no raio e o ritmo das posições em movimento (teste de rua — parado, os filtros de distância de 5/20/50 m quase não soltam posição); a restauração pós-câmera, porque este aparelho não recria a Activity mesmo com `always_finish_activities`. **Depois:** sobras — (o mapa nativo do gestor com cores do tema e a `distanciaMetros` duplicada foram fechados na varredura de 05/11, ver a 34) docstring de `geocoding.ts:152`, chave `default` morta no mock do `useAlert`, fallbacks do `locationTracking`; decisão sobre os 4 `.bat` mantidos (`start-android.bat`, `setup-android-env.bat`, `scripts/dev-edge.bat`, `tools/scripts/assets/update-favicons.bat`); Ondas 2 (pede aparelho) e 3 (pede decisão).<br>_Quem:_ qualquer sessão (navegador e aparelho com o gestor) · _Detalhe:_ `docs/superpowers/2026-11-03-varredura-refatoracoes.md`, [HISTORICO.md](HISTORICO.md) "Varredura de 03/11/2026"
- **34.** **Varredura de 05/11/2026: na `main` (#728, #729, #731) e na interna como 3057 (sem o #729/#731 no app; a 3058 os leva).** App (#728), banco (Migrations 81 e 82, #729, aplicadas e registradas em 07/11 — sondas 11/11 e 3/3), Edge Functions publicadas em 07/11 (`criar-motorista` v24, `google-place-details` v17, `google-places-autocomplete` v17, `send-push-notification` v18 — 401 sem credencial, Places e push validados) e os ajustes da bancada (#731: recusa das RPCs de parada pelo `code`, card de Motoristas sem ":", vazios da Equipe e do Histórico, `ConnectivityBanner` apagado — o arquivo é `ConnectivityIndicator.tsx`). **Validado na 3057 (07/11, moto g15)** — o que passou está no [HISTORICO.md](HISTORICO.md) "Bancada da 3057". **Falta:** (a) **aparelho:** o 409 do cadastro de motorista (pede senha inicial — é do gestor); restauração pós-câmera e visita combinada em sequência (o g15 não recria a Activity nem com `always_finish_activities`; na 3059 o A17 também não recriou com o uso normal — a foto voltou à parada certa pelo caminho comum, e a recuperação segue sem prova); B-MOT-4 (OSRM bloqueado na navegação: uma consulta por 50 m — a build de produção não loga); "Erro ao sair" com o token vencido e sem rede (exige ~1 h sem rede); gestor com 2 lojas trocando no seletor (B-GES-5); na 3058, os ajustes do #731 e a recusa pelo `code`; (b) decisões do usuário tomadas em 08/11: B-MOT-2 removido (#742) e R-TOOL-9 (`expo-updates`) fica de fora por enquanto; (c) **R-UI-1 suspenso:** o aviso do Unistyles só dispara com `style` objeto (não array) com 2+ chaves `unistyles_`; medir pelo `displayName` no dev client antes de agir; (d) **sobras anotadas:** tokens `components.connectivityBanner` sem uso (tirar mexe no pipeline de `tokens/` e na checagem de drift); um ajuste de baixo risco no `reordenar_paradas` apontado pela revisão de RLS do #729 (detalhe fora do repositório). Não feitos por escopo: R-TOOL-10, R-DB-7, R-DB-10; parciais: R-TOOL-4, R-DB-2, R-TOOL-8.<br>_Quem:_ qualquer sessão (aparelho e banco com o gestor) · _Detalhe:_ `docs/superpowers/2026-11-05-varredura-refatoracoes.md`, [HISTORICO.md](HISTORICO.md) "Varredura de 05/11/2026 executada"
- **35.** **Varredura de 07/11/2026: falta o que só se faz depois do merge.** (a) **Banco:** feito em 07/11/2026 — Migration 83 aplicada e registrada, sonda 11/11 OK depois de aplicada. (b) **Edge Functions:** feito em 07/11/2026 — `criar-motorista` (v25), `google-place-details` (v18), `google-places-autocomplete` (v18), `send-push-notification` (v19) e `expire-routes` (v18) publicadas pelo CLI, `verify_jwt` inalterado; chamada sem login responde 401 nas cinco. (c) **Validação:** no aparelho (3059, 08/11), N-1/N-2 feito — trocar de conta sem fechar o app (gestor → Minha Unidade → menu → Sair → motorista) passou 5/5, e a antiga pendência 33 fechou (ver [HISTORICO.md](HISTORICO.md) "Validação da 3059"); a Ajuda e o WhatsApp (`https://wa.me/...`) feitos; **faltam** M-3 em modo avião com token vencido e U-4. **Navegador (08/11, produção):** U-1 feito (o mapa da rota carrega, sem "Erro ao carregar o mapa"; a falha de tile não foi forçada); U-3 parcial (grupos da timeline do mais novo ao mais velho, mas só no mesmo mês — o defeito antigo aparecia entre meses); **N-3 sem teste** (a janela maximizada não aceitou redimensionar — digitar na busca da Gestão de Rotas e estreitar abaixo de 1024 px: o texto tem de ficar). (d) **Pino da sede (#739, 98c13130, 08/11):** partida e chegada viram um pino de sede nos seis mapas; validado no navegador (build da branch, gestor) e na 3059 (mapa nativo do motorista com o balão "Sede da unidade", mini-mapa da Início, Mapa da Rota nativo do gestor); falta ver na navegação (o zoom no destino deixa a sede fora da tela; voltando à sede o pino some). **Design desktop do gestor (#735, 4a1c71d3):** validado em produção em 08/11 — Início com resumo, linhas de paradas e filtros recolhidos; menu "⋯" ancorado, fecha com Esc (teclado não medível pela extensão); nenhuma tabela rola a 1366/1280 px (a 1024, Gestão de Rotas e Motoristas rolam, aceito); sem "(s)" e sem erro no console. A validação trouxe o #736 (cc44ddb1): sem loja ativa resolvida, a Início pintava "Nenhuma rota cadastrada hoje" numa loja com rota — a mesma classe na Equipe, na Minha Unidade e na Transferir Gestão (que dizia ao principal "Apenas o gestor principal..."); o carregando soma o `loading` do `useUnidadeAtiva`. **Falta:** no aparelho, que o mobile do gestor não mudou; "PARTIDA"/"CHEGADA" em caixa alta no Mapa da Rota vão para o PR dos 44 pontos menores do ledger. (e) **Fora do plano (atualizado em 08/11):** T-2 feito (`no-floating-promises` type-aware, #752) e B-11 feito (aviso ao motorista ao cancelar e reativar, M86, #749); B-6 endurecido em vez de trocado (o agendador segue no GitHub, #745); B-9 adiado por decisão do gestor; seguem fora B-3, B-12 e a janela A→B (telas remontadas com a loja de A sob a sessão de B).<br>_Quem:_ qualquer sessão (banco e aparelho com o gestor) · _Detalhe:_ `docs/superpowers/2026-11-07-varredura-refatoracoes.md`
- **36.** **Execução das varreduras de 08/11/2026: na `main` (#745–#752), banco e Edge Functions publicados; validado no aparelho na 3060 em 11/11/2026, exceto U-4; o achado do M-3 foi corrigido no #776 e validado na 3061 em 12/11.** Banco: Migrations 85–89 aplicadas e registradas (sondas 7/7, 10/10, 8/8, 7/7, 7/7); Edge Functions `google-places-autocomplete`, `google-place-details`, `expire-routes` e `criar-motorista` publicadas, 401 sem login. **Validado no moto g15 (11/11):** fila de incidentes offline (reporte sem rede → "Reporte guardado"; com a rede de volta, um registro só em ~19 s; o gatilho da M87 preencheu `resolvido_em` ao resolver); B-11 no cancelamento (push "Rota cancelada pelo gestor" com a data; a reativação só vale para rota `nao_executada` e não foi exercitada); sessão atômica (motorista → Sair → gestor sem fechar o app); U8-1 (tocar na sede troca o balão da parada pelo da sede). U8-3 sem deslocamento visível em zoom alto, não conclusivo. **M-3 (11/11, 63 min de modo avião, token vencido):** pular sem rede foi para a fila ("Sem internet: ficou salvo…", "Aguardando envio"), sem tela de login; com a rede de volta, o token renovou (`POST /auth/v1/token` 200) mas **a fila não enviou por ~5 min** — os logs mostram só GETs; subiu (posições 201 e `PATCH paradas`) assim que o app voltou ao primeiro plano. Nada se perde e nada vai sem sessão, mas a volta da rede com o token vencido não envia: `sincronizarFilaAcoesParada` sai sem tentar quando `lerUsuarioParaEnvio` não acha sessão, e o `TOKEN_REFRESHED` não dispara o envio (o comentário em `filaAcoesParada.ts` registra a escolha). **Corrigido no #776 (3061):** o `TOKEN_REFRESHED` também dispara o envio, fora do callback; rede e renovação no mesmo envio notificam uma vez só. **M-3 de novo (12/11, 3061, 66 min de modo avião, app em primeiro plano):** token renovado às 14:57:49 e `PATCH paradas` às 14:57:52, 13 s depois da volta da rede; uma notificação "Sincronização". **Falta:** U-4 (coberto por teste de unidade). **Achados pequenos:** "1 ação sincronizadas" corrigido no #776; o cancelamento gravava a notificação com tipo `rota_nao_executada` — corrigido no #780 (tipo `rota_cancelada`): `send-push-notification` v20 publicada e Migration 91 aplicada em 13/11 (sondas 8/8, 4 linhas antigas corrigidas). Falta ver no aparelho um cancelamento com a versão nova do app (ícone e toque no Histórico); até a 1.16.1, ícone genérico e toque sem destino. **Pendências novas (nenhuma bloqueia):** (a) Edge Functions em Deno sem checagem de tipos no CI; (b) CSP `connect-src` sem `blob:`/`data:` (afeta a fila de incidentes na web); (c) o gestor vê a hora do envio do incidente, não a do reporte feito offline; (d) se a cópia da foto do incidente para o armazenamento do app falhar, o reporte se perde; (e) `formatDate` com `toLocaleDateString` (o Hermes pode devolver en-US); (f) caixa alta em ~20 títulos (inclui "PARTIDA"/"CHEGADA" no Mapa da Rota); (g) token de fonte de 13 px fora da escala; (h) foto órfã no Storage (upload sem vínculo); (i) lint type-aware: `permissoes.test.ts:118-119` espera com 2× `await Promise.resolve()` (frágil) e os mocks de `Linking`/`setAuth`/`abrirNavegacao` precisam devolver promessa. **#772 validado na 3061 (12/11):** os cartões de Desempenho da Início batem com o banco (15 paradas no período, 1 concluída, 7%), e a busca sem resultado mostra "Ajuste a busca ou o período.", sem convite de criar rota. **3061 na interna e na alpha.** **Próximo passo:** nenhum para esta pendência; sobram U-4 e os achados pequenos.<br>_Quem:_ qualquer sessão (aparelho com o gestor) · _Detalhe:_ [HISTORICO.md](HISTORICO.md) "Execução das varreduras de 08/11/2026"
- **37.** ✅ **Filtros por período — concluído em 11/11/2026, na Play na 3060 (1.16.0, interna e alpha).** Na `main`: #761 (Migration 90), #762 (base: `periodo.ts`, `usePeriodoLembrado`, `SeletorPeriodo`; regra no `CLAUDE.md`), #763 (Gestão de Rotas e exportação), #764 (Incidentes), #766 (Início), #767 (Perfil do motorista, Meu Desempenho e Histórico). Validado no navegador (gestor) e no moto g15 (gestor e motorista), inclusive cancelar a data no Android. **Menores que seguem (nenhum bloqueia):** `setItem` em voo no logout pode regravar a chave do período (só da própria conta); o seletor de data inline do iOS fecha na primeira mudança; o comentário de cabeçalho de `useIncidentesGestor.ts:6-7` ainda diz "loja inteira"; `resumo_desempenho_motorista` e `desempenho_motorista_na_loja` calculam o tempo médio de forma diferente, de propósito.<br>_Quem:_ — · _Detalhe:_ spec e plano `2026-11-10-filtros-por-periodo`; [HISTORICO.md](HISTORICO.md) "Filtros por período (10–11/11/2026)"
- **38.** ✅ **Dependabot #754–#760 — todos mesclados em 11/11/2026, na 3060.** #757 (Supabase CLI 3.0) veio com #768 (`config.toml`) e #769 (docs): comandos de produção levam `--remote`; `db query` de agente pede `--read-only` (leitura) ou `--yes` (alteração, só com OK do usuário) — ver "Protocolo de banco no CLI 3.0" nas armadilhas. Nativos #756 (Nitro 0.37.2) e #759 (Unistyles 3.8.1) validados no moto g15 (tema alternado sem travar, Nitro carregado).<br>_Quem:_ — · _Detalhe:_ [HISTORICO.md](HISTORICO.md) "11/11/2026"

Fechadas em 26/10/2026: a **27** (reabrir com Wi-Fi sem internet; medido na 1.14.7 — armadilha "Teste sem rede") e a **28** (cancelar rota pelo painel: RPCs `cancelar_rota`/`reativar_rota`, Migrations 70/71, app no #670, e Migration 75).

**Trabalho já fechado não mora aqui.** As listas "Fechadas em ..., não reabra"
de 08, 15, 17 e 25/08 foram para [HISTORICO.md](HISTORICO.md) em 25/08 — eram
**86 linhas** lidas em toda sessão para responder "isso já foi resolvido?", que
é pergunta rara. Consulte-as lá antes de reabrir qualquer frente. O que era
regra durável ficou nas Armadilhas; o que segue **aberto** está abaixo.

Follow-ups menores (nenhum bloqueia): **Timeline não narra o autor da
otimização** — o dado existe em `logs.usuario_id` e falta o join em
`src/hooks/gestao-rotas/useTimelineData.ts`. Deixado aberto de propósito em
08/09/2026: é melhoria, não defeito, e tem uma dobra de design real — o handler
de realtime (`:195`) recebe `payload.new`, que **não traz dado de join**, então
o autor apareceria na carga inicial e sumiria nos eventos ao vivo. Resolver isso
exige escolher entre resolver nomes no cliente (cache de usuários da unidade) ou
aceitar a inconsistência; é decisão de produto, não conserto óbvio. ~~Cada envio de localização chamava `getUser()`~~ — fechado no #568 (sessão local, `getSession`).

**Achado na validação em aparelho de 08/09/2026, ainda aberto** (o outro, rastreamento só ligado por `startRoute`, fechou no #613):

- **O painel do gestor esconde rota em andamento de dia anterior.**
  `useDashboardData` filtra por `data >= hoje` quando não há filtro explícito,
  então uma rota `em_andamento` com `data` passada — estado legítimo, dentro da
  carência de 7 dias da expiração (Migrations 25/26) — não entra na consulta, e
  o cartão "Em Andamento" mostra **0 com o motorista na rua**. Reproduzido em
  08/09 com a rota `31d4b0d2…` (`data` 05/09). A Gestão de Rotas mostra tudo,
  então o gestor não fica cego — o resumo é que mente. **Não é regressão** e o
  conserto é decisão de produto: "Início" significa _hoje_ ou _hoje mais o que
  segue aberto_? Mudar a janela padrão altera a primeira tela de todo gestor.

**Fechados em 08/09/2026** (não reabra): `mapLogToTimelinePreview` devolvia
`null` para 6 dos 15 eventos que `TIMELINE_LOG_EVENTS` conta, então o widget
colapsado somava eventos que nunca exibia — corrigido com um teste de
INVARIANTE (todo evento contado tem preview), que quebra sozinho quando alguém
acrescentar o 16º; e `finalizar_rota`/`update_parada` em `src/lib/offline.ts`
ganharam allowlist de colunas, derivada do que o caminho online grava, tirando
a armadilha que o `REVOKE UPDATE (unidade_id)` da Migration 27 tinha criado.

## Armadilhas que já custaram caro

Cada uma quebrou algo de verdade. Leia antes de agir na área correspondente.
O relato de como cada uma foi descoberta está em [HISTORICO.md](HISTORICO.md).

**Banco e migrations**

- **Chaves do Supabase: só as novas, desde 22/10/2026.** A `service_role` antiga estava no histórico do repositório público; `anon`/`service_role` foram desligadas e o segredo JWT legado revogado (token assinado por ele → 401 `PGRST301`). App (1.12.9 em diante) e web usam `sb_publishable_`; as Edge Functions leem `SUPABASE_SECRET_KEYS`/`SUPABASE_PUBLISHABLE_KEYS` por `supabase/functions/_shared/chaves.ts` (guarda `semChaveAntiga.test.ts`) e rodam com `--no-verify-jwt` — o `verify_jwt` só entende JWT antigo, então cada função autoriza por dentro (`auth.getUser`, `x-cron-secret`, `x-push-secret`). O push só sai pelo gatilho `pg_net` com o segredo do Vault `push_webhook_secret` (= secret `PUSH_WEBHOOK_SECRET`). Publicar: `npx supabase functions deploy <fn> --no-verify-jwt --remote=xezslsyxjivunmhhyxtd` (`--project-ref` segue valendo, deprecado; alteração remota por agente pede `--yes`, só com OK do usuário). **Nunca grave chave em arquivo, SQL ou webhook do painel** — foi assim que a antiga ficou em texto puro. Relato em [HISTORICO.md](HISTORICO.md), 22/10/2026; Migration 32.

- **`supabase db push`:** o MCP `apply_migration` registra sob **timestamp
  próprio** (≠ nome do arquivo) e colar no Dashboard não registra nada. Rode
  `npx supabase migration list --remote` antes de qualquer push. Ver `database/MIGRATIONS.md`.
- **Protocolo de banco no CLI 3.0:** `migration list`, `migration repair`, `db query` e `gen types` são locais por padrão; produção exige `--remote` (o projeto linkado) ou `--remote=<ref>`. `--linked`, `--project-ref` e `--project-id` seguem valendo, deprecados com aviso. Leitura em produção: `db query --remote --read-only`. Alteração: `db query --remote --yes`, **só com OK do usuário** (agente sem `--yes` é recusado).
- **Assinatura de realtime em tabela fora da publicação não recebe nada, e não
  reclama.** O gestor nunca viu o motorista se mover: os dois componentes
  assinavam `postgres_changes` em `motorista_locations`, que só entrou na
  publicação `supabase_realtime` em 08/09/2026 (Migration 28). O canal conecta,
  entra em `SUBSCRIBED`, e nenhum evento chega — sem erro, sem log. Passou
  despercebido porque os componentes fazem um `SELECT` inicial: abre-se o mapa,
  o motorista está lá, e o marcador congela. **Ao criar assinatura, confirme que
  a tabela está na publicação**, com
  `SELECT ... FROM pg_publication_tables WHERE pubname='supabase_realtime'`.
- **O RLS do realtime NÃO cobre DELETE.** Verificado lendo
  `realtime.apply_rls` implantado: para INSERT/UPDATE ela roda a checagem com o
  role e as claims do assinante, mas o ramo
  `if not is_rls_enabled or action = 'DELETE'` entrega a linha a qualquer
  assinatura cujo filtro de CLIENTE case, sem RLS. Assinar `'DELETE'` ou `'*'`
  numa tabela multi-tenant vaza entre unidades. Guarda em
  `src/lib/__tests__/realtime-motorista-locations-somente-insert.test.ts`.
- **Banco único = produção.** Não há staging. Peça aval antes de aplicar
  migration e **nunca deixe subagente escrever no banco**. Desde 01/09/2026 o
  **CI também escreve**: `e2e/fixtures/garantir-rota-do-mapa.ts`, quando o
  motorista de teste não tem rota aberta, cria uma cópia da encerrada mais
  recente por `criar_rota_com_paradas` (chave idempotente derivada do modelo) e
  a inicia como o app. **Não reabra rota encerrada** no fixture: desde a
  Migration 75 o UPDATE de status vindo da API é recusado (`ROTA_ENCERRADA`).
  Decisão testável em `e2e/fixtures/planoDaRotaDoMapa.ts`. É escrita
  condicional — conte com ela ao auditar acesso ao banco.
- **A leitura de `usuarios` depende do RLS de `usuario_unidades`.** A policy
  `usuarios_select_optimized` libera a pessoa que tem vínculo ativo numa loja
  minha, consultando `usuario_unidades` com o RLS de quem lê; como
  `usuario_unidades_select` só mostra ao motorista as próprias linhas (ao
  gestor, as da loja), o motorista só lê a própria linha de `usuarios`. Por
  isso a Migration 67 não foi feita. **Afrouxar `usuario_unidades_select` abre
  a leitura de `usuarios`** (nome, telefone) — confira as duas juntas.
- **`src/types/database.ts` não existe** — regra e motivo em
  [`../CLAUDE.md`](../CLAUDE.md), seção Skills. Escapou da deduplicação de
  27/08, que pegou a cópia em "Regras" e deixou esta.
- **RPC com parâmetro novo cria _overload_** (custou a `criar_rota_com_paradas`), não substitui (identidade de função
  no Postgres = nome + tipos). Exige `DROP` da assinatura antiga + reaplicar os
  grants. Reverter a migration depois de mergear o código derruba a criação de
  rotas: **reverta o código primeiro**.
- **`unidades` não tem — e não deve ter — policy de UPDATE.** RLS **não restringe
  coluna** e `authenticated` já tem grant cheio, então uma policy liberaria as 17
  colunas fora do app de uma vez, incluindo comerciais (`plano`, `status`,
  `desconto_percentual`, `asaas_customer_id`) — o gestor se promoveria de plano. A
  escrita passa pela RPC `atualizar_unidade`; **se ela parar, o conserto não é
  adicionar policy.** Verificação: `.update()` direto em `unidades` tem que falhar.
- **O supabase-js _devolve_ o erro em vez de lançar, então `try/catch` não pega.**
  A escrita falha, o código segue, e a falha vira no máximo um `logger.warn` —
  foi assim que `logs.parada_id`, coluna inexistente, custou **oito meses** de
  auditoria. Em qualquer `.insert()`, confira `error` no retorno. Schema real e
  padrão no phonebook do [`../CLAUDE.md`](../CLAUDE.md).
- **Foto de entrega multiunidade usa a unidade da ROTA, nunca
  `usuarios.unidade_id`.** O campo do usuário é legado/principal e pode divergir
  da unidade de uma rota atribuída ao motorista. Como a policy do bucket privado
  autoriza pelo 1º segmento do path, gravar
  `{usuarios.unidade_id}/{rotaId}/...` permite o upload ao motorista vinculado
  às duas unidades, mas impede o gestor da rota de assinar a URL. A fonte
  autoritativa é `RouteData.unidade_id`, carregada de `rotas.unidade_id`; vale
  igualmente para upload direto e para a fila offline. No retry, não confie no
  `unidadeId` persistido no índice: filas criadas por versões antigas podem
  carregá-lo errado; resolva `rotas.unidade_id` novamente antes do upload.

- **Ao registrar à mão uma migration aplicada em `supabase_migrations.schema_migrations`, nunca use `ON CONFLICT DO NOTHING`.** Use `INSERT ... RETURNING` e confira a linha devolvida: o `DO NOTHING` escondeu uma colisão de versão (a Migration 50 com a 53, que acabou registrada como `20261024121500`).
- **Antes de criar migration, liste os timestamps** de `database/migrations` de **todos** os worktrees em `.claude/worktrees/*` e os de `schema_migrations`. Sessões paralelas escolhem o mesmo prefixo sem se ver.

**Auth, chaves e segredos**

- **As API keys legacy estão DESABILITADAS.** O projeto usa `sb_publishable_…` e
  `sb_secret_…` — mas **a variável mantém o nome herdado
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`**, o que engana. Pegadinha: a `sb_secret_…`
  devolve **401 na Admin API do Auth** (`/auth/v1/admin/users/…`). Para redefinir senha, use o SQL Editor (o
  Auth guarda bcrypt e `pgcrypto` está em `extensions`), e limpe o editor depois —
  o histórico de execuções guarda a query:

  ```sql
  update auth.users
  set encrypted_password = extensions.crypt('<senha>', extensions.gen_salt('bf')),
      updated_at = now()
  where id = '<uuid>';
  ```

- **Nenhuma senha no repo** — nem como fallback, nem em `console.log`. O
  repositório é público e o log sobrevive no scrollback e no CI. Em 05/08/2026
  quatro contas com senha em texto puro estavam vivas em produção.
- **Editar `supabase/templates/*.html` NÃO muda o email enviado** — o Supabase lê
  só do painel. A regra completa, com a proteção anti link-scanner, está no
  phonebook do [`../CLAUDE.md`](../CLAUDE.md) e em `supabase/templates/README.md`.
- **São 5 arquivos para 6 abas do painel, e é intencional.** O Magic Link saiu do
  repo porque o app nunca chama `signInWithOtp`. A aba continua no painel com o
  layout antigo — inofensivo só enquanto nada dispara o envio. Se o login sem
  senha entrar no produto, recupere `supabase/templates/magic-link.html` do git **antes** de usar.
- **Operação que precisa de mais de uma linha vira RPC em transação**, nunca dois
  passos no client. O cadastro público criava a conta no Auth e só depois inseria
  em `usuarios`, insert que o RLS bloqueia — pessoas reais ficaram com conta
  órfã. Indicador de saúde (hoje retorna zero):
  `select au.email from auth.users au left join public.usuarios u on u.id = au.id where u.id is null;`

**React e formulários**

- **`Modal` nativo precisa do próprio `GestureHandlerRootView`.** No Android o `Modal` do RN abre numa janela à parte, que o root view da raiz (`app/_layout.tsx`) não alcança: gesto do Gesture Handler dentro dele não recebe toque, sem erro. O `DesktopModal` e o `Modal` do app já têm o seu (c80f80a2); os outros `Modal` crus (Dialog, DrawerMenu, SupportModal, RouteReviewModal…) **não**, e hoje não têm gesto dentro — quem puser `SwipeableRow` ou lista arrastável num deles trava em silêncio. Na lista arrastável, o Pan só pode ativar depois do `drag()` (patch, ativação manual), senão toma a rolagem.
- **Componente aninhado no render** — a regra e o mecanismo estão em
  [`../CLAUDE.md`](../CLAUDE.md). O que só existe aqui: manteve o autocomplete da
  sede **impossível** de usar em "Minha Unidade" e destruiu um `Slider` no meio do
  arrasto. Diagnóstico: marque o nó (`el.dataset.x = '1'`) e digite uma letra; se
  a marca sumir, remontou. Onde a tela tem vários returns, o invólucro vai **em
  volta** do componente de conteúdo, não return a return.
- **`ResponsiveContainer` envolvendo `ScrollView flex:1` dá tela vazia no nativo.**
  Um filho `flex: 1` dentro de pai de altura automática contribui zero para a
  altura: ambos ficam em 0. Na web o RN Web mapeia para CSS e o sintoma **não
  existe** — o screenshot passa. Manteve `/auth/register` vazia no Android por
  **nove meses**. Ordem correta: `ScrollView` **por fora**, container por dentro
  (padrão de `app/onboarding/criar-unidade.tsx`). Sintoma: cabeçalho aparece,
  corpo em branco, sem erro no logcat.
- **Não remova o `KeyboardAvoidingView` das telas de auth "porque o
  `adjustResize` já resolve".** Não resolve mais: com
  `android:windowSoftInputMode="adjustResize"` a janela roda em
  `EDGE_TO_EDGE_ENFORCED` e **não encolhe** — medido, o frame segue
  `[0,0][1080,2400]` com o teclado aberto. Quem consome os insets é o
  `KeyboardAvoidingView` de `login`, `forgot-password` e `reset-password`; sem
  ele o campo em foco fica atrás do teclado. Verifique com
  `adb shell dumpsys window windows | grep -A3 MainActivity`, comparando o
  `frame=` com teclado aberto e fechado.
- **`loading` vale só para a carga inicial.** `DesktopPageLayout` e
  `DashboardMobile` retornam **só** o spinner quando `loading` é true — descartam
  cabeçalho, filtros e tabela. Religá-lo numa recarga apaga a página com conteúdo
  já na tela. Recarga sinaliza por `refreshing` ou pelo toast da própria ação.
- **Erro de formulário num campo pode ser causado por outro** — coberto por
  inteiro em [`../CLAUDE.md`](../CLAUDE.md) ("Erro cruzado em form"), com os dois
  arquivos de exemplo.

**Medição e testes**

- **No e2e, o Service Worker esconde os GET do `page.route`.** O app registra o `sw.js`, que responde a todo GET (inclusive do Supabase); o que ele atende não passa pelo `page.route`, e o mock só pegava o POST. `serviceWorkers: 'block'` no `playwright.config.ts` (#727). O mock do rascunho da Nova Rota (#724) só passava porque a conta de teste estava vazia.
- **No aparelho, `adb install -r` de um app da Play aciona a proteção da loja:** o app passa a pedir "obter na Play" e a sessão some na prática; reinstale pela Play (o login se mantém). O teste de R8 com `install -r` serve, mas termine reinstalando pela loja. A árvore de acessibilidade (`uiautomator dump`) mostra o que está **de fato** por cima — foi o que revelou a tela fantasma da pendência 33 quando a captura mostrava outra.
- **`always_finish_activities` mata o swipe injetado por `adb` — o tap continua
  funcionando.** É o flag que reproduz a recriação de Activity de forma
  determinística, mas com ele ligado o gesto de swipe simplesmente não chega ao
  app; em 05/09 gastei seis tentativas achando que o build tinha quebrado o
  gesto. A receita é ligar o flag **só na ida à câmera**: abre o modal com o flag
  em `0`, liga, dispara a foto, observa a volta, desliga. Devolva sempre para `0`
  no fim — com ele ligado o aparelho fica ruim de usar.
- **Dev build + Metro transforma build de 20 min em reload.** `eas build
--profile development`, instalar uma vez, `adb reverse tcp:8081 tcp:8081`,
  `npx expo start --dev-client` e abrir por
  `rotamestre://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081`. A
  partir daí o JS servido é o da árvore de trabalho. Cuidado ao concluir: no dev
  client a recriação de Activity **recarrega o bundle inteiro**, condição mais
  dura que produção, onde o contexto JS sobrevive.
- **O Fast Refresh não aplica no dev web — recarregue antes de medir.** O Metro
  registra só o bundle inicial e a página segue executando código velho. Já
  produziu três medições contraditórias, incluindo um teste diferencial em que o
  bug foi reintroduzido de propósito e o navegador insistiu que não existia. Force
  `window.location.reload()` e espere (~10 s). Para saber qual versão está no ar:
  `curl -s "http://localhost:8082/index.ts.bundle?platform=web&dev=true" | grep -c meuSimbolo`.
- **O toast vermelho de erro e o `Unexpected text node` são do LogBox — não
  existem em produção.** Nenhum componente do app renderiza saída de log; se você
  vê `console.error` na tela, é ferramenta de dev. Armadilha de método: um
  interceptor instalado **depois** de `src/utils/configureLogBox.ts` fica acima do
  filtro e conta mensagens que nunca chegaram ao console.
- **Teste que afirma um schema inventado dá cobertura ao defeito.** Dois bugs
  sobreviveram porque os testes os _exigiam_ — um esperava `parada_id` no insert,
  outro esperava `'150.5'` citando o `toFixed` no próprio comentário. Ao testar
  escrita em tabela, confira as colunas no banco (`information_schema.columns`) antes de fixar o payload.
- **O terceiro card de estatísticas do dashboard aparece cortado de propósito.**
  É um `ScrollView horizontal` com `accessibilityHint="Deslize para ver mais
estatísticas"` — o corte é a dica de rolagem. Já foi reportado como defeito
  numa bateria de teste; não "conserte".
- **O rascunho de rota não vive no `sessionStorage`.** A fonte é a tabela
  `rascunhos_rota`, com expiração de 7 dias; o `sessionStorage` é espelho
  síncrono. Fechar o navegador **não** perde o rascunho.

- **Jest: caminho de arquivo depois de `--testPathIgnorePatterns=...` vira mais um padrão de exclusão.** A suíte inteira roda (ou o arquivo é ignorado) sem erro. Ponha o caminho **antes** das opções.
- **No Windows (Git Bash), `python - <<EOF` com heredoc vazio espera entrada para sempre** e trava a tarefa em segundo plano.
- **Teste sem rede no aparelho: o pior caso é Wi-Fi "conectado" sem internet (DNS inválido).** Modo avião não reproduz isso. Até a 1.14.6 cada consulta do postgrest-js tentava 4 vezes (~20 s) e reabrir a Início levava 60–75 s; na 1.14.7 (`src/lib/redeObservada.ts` liga o "sem rede" na primeira falha de `fetch`, e o perfil da abertura sai sem retry) leva 12 s, e o resto é o DNS do Android desistindo (4,4–7,8 s por tentativa). Melhoria possível: tempo-limite curto na verificação de sessão.
- **O preview da Vercel por PR roda em modo mock** (dados falsos, sem Supabase) e não serve para validar fluxo. Valide servindo o `dist` local (`npm run build:web` e um servidor estático).

**Infra e distribuição**

- **Distâncias em dev web não conferem com produção.** O CORS do OSRM
  self-hosted bloqueia `localhost`, então o dev web cai no demo público (cadeia
  em `../CLAUDE.md`). Antes do fallback, o otimizador caía no
  `buildHaversineMatrix` (linha reta × 1,3) **sem erro visível** — rota
  "otimizada" com distância plausível e sem roteamento por vias. Correção
  definitiva é liberar `localhost` no CORS do openresty; **CORS não é controle
  de acesso**, o endpoint já responde a qualquer um via `curl`.
- **Fonte de tiles: serviço externo degrada em silêncio.** Até 31/08/2026 o web
  usava OpenFreeMap e o nativo, Carto — assimetria não escrita em lugar nenhum.
  Quando a Carto passou a exigir chave, o endpoint respondeu **200 com PNG
  marcado "API KEY REQUIRED"**, não erro: nada quebrou, só apareceu errado para o
  motorista. Unificado em `src/lib/maplibre.ts` e **guardado por teste**
  (`maplibre-fonte-unica.test.ts`; o e2e julga o tráfego). Não refaça a análise —
  o que segue sem cobertura é tile marcado, que chega como 200 válido. **Chave de
  tiles no bundle é extraível**: se precisar de uma, vai server-side.
- **`import()` dinâmico no web depende do async-require do Metro.** O
  `metro.config.js` o resolvia como módulo vazio: o build passava, o chunk saía
  separado, o size-limit ficava verde — e em produção todo `import()` falhava
  (`require(...) is not a function`; apareceu na exportação de PDF/XLSX, que
  passou a carregar sob demanda no #664). Não devolva resolver próprio para `async-require`. Guarda:
  `src/lib/__tests__/metro-config-import-dinamico.test.ts`.
- **Play Store: precedência de trilha e `eas submit` não promove.** A Play serve
  a trilha de maior prioridade a que a conta tem direito — **internal ganha de
  closed** —, então publicar só no fechado prende o testador interno na versão
  antiga com sintoma enganoso: o link funciona, o opt-in é aceito, chega o build
  velho. Publique nas duas. `eas submit` **sempre faz upload** e falha se o
  versionCode já subiu; promover exige a API (`edits` → `PUT tracks/<track>` →
  `:commit`), já versionada em `npm run play:status` e
  `npm run play:promote -- <trilha[,trilha]> <code> [nome] --notas=<arquivo>` sobre
  `scripts/lib/play-api.mjs`. Fluxo: `eas submit` ao **interno** uma vez, depois
  `play:promote` — nunca dois `eas submit`.
- **Para testar no aparelho, atualize pela Play — não `adb install`.** O sideload
  exige desinstalar (a assinatura do EAS diverge da do Play App Signing), o que
  derruba a sessão e ainda testa um binário que **não** é o que o testador
  recebe. Publique no interno e atualize pela loja: os dados sobrevivem.
- **Trocar só o `versionName` exige `versionCode` novo.** Um versionCode já
  enviado não aceita metadados diferentes, então renomear 1.12.2 → 1.12.3 sobre
  um build já submetido não existe: é build novo. Decida o nome **antes** de
  submeter, ou aceite queimar um code.
- **Não use here-string do PowerShell (`-m @'…'@`) na ferramenta Bash.** O `@` vira texto e o
  Git toma a primeira linha como **assunto** do commit. No bash use heredoc
  (`git commit -F -`).

## Estado atual

- Caminho local canônico: `D:\rota-mestre\rotamestre-app`.
- Web: <https://app.rotamestre.tec.br> publicada e validada. Deploy automático a
  cada push na `main`.
- **Node 22** é o baseline de dev/CI/EAS/Vercel (`.nvmrc`, `engines.node`,
  matriz `22.x`). A proteção da `main` exige **quatro** checks bloqueantes:
  TypeScript & Linting, Run Tests, Visual Regression (desde 25/08) e Bundle Size
  Check (desde 21/09). Não bloqueiam: o Vercel, que aparece como _pending_, e o
  Design System Drift Check. O Bundle Size foi promovido depois de ser **o único
  que pegou** a duplicação da árvore do Sentry — 3,39 MB contra 3,9 MB, limite de
  3,5 MB, no PR #537 — enquanto era informativo e não impedia o merge.
  **Atenção ao nome exato:** o status carrega o sufixo da matriz do Node, e a
  proteção compara letra por letra. Os `scripts/setup-branch-protection.*` pediam
  a versão 20.x até 21/09; rodá-los teria exigido um status que nunca chega, o
  que **trava todos os PRs**. Hoje os dois abortam se o nome ou a versão não
  existirem nos workflows.
- Merge exige **admin override** (`gh pr merge --squash --admin`): a `main` pede
  1 review, o gestor é autor de tudo e não há segundo revisor. Histórico linear
  obrigatório, então squash — merge commit não passa. Desde 26/10/2026 o GitHub
  apaga a branch ao mesclar; branches e worktrees antigos foram removidos.
- Android: teste fechado e interno costumam servir o mesmo build (desde 08/11/2026 os dois estão no SDK 58, pendência 31). Produção nunca teve
  release (pend. 4). **Não anote o versionCode aqui** — ele muda a cada release e
  já deixou este documento errado. Pergunte com `npm run play:status`.
- O acompanhamento ao vivo do gestor **funciona desde 08/09/2026** (Migration 28)
  e foi verificado ponta a ponta: uma linha nova em `motorista_locations`, um
  movimento do marcador, sem recarregar. Antes disso o marcador congelava depois
  da carga inicial — ver a armadilha de publicação de realtime.
- iOS: configuração versionada, sem build (pend. 5).
- Banco: migrations 46 a 50, 52 a 66 e 68 a 90 aplicadas (a 90 é a última, em 10/11/2026); a 51 aguarda a pendência 30 e a 67 não foi feita (armadilha do RLS de `usuario_unidades`). O detalhe de cada uma está em `database/MIGRATIONS.md` e em `npx supabase migration list`. Faixas da Play: ver a pendência 12. Edge Functions (26/10): `delete-account` v10, `send-push-notification` v17, `criar-motorista` v23, `google-places-autocomplete` e `google-place-details` v16 (exigem usuário logado desde o #668; as versões vivas mudaram em 07 e 08/11 — consulte o painel). `google-directions` e `google-distance-matrix` foram despublicadas e saíram do repositório.

## Identidades e serviços

O que o produto é e quais serviços externos usa está na abertura do
[`../CLAUDE.md`](../CLAUDE.md) — não repetimos aqui. **Versão e
`androidVersionCode` saem do `package.json`**; foi duplicando isso que este
documento já ficou errado antes.

Só o que **não** está no `CLAUDE.md` (que já traz package Android, EAS project,
Firebase e o ref do Supabase):

| Item                     | Valor atual                     | Fonte de verdade            |
| ------------------------ | ------------------------------- | --------------------------- |
| Repositório              | `BadWolf1509/rotamestre-app`    | `git remote -v`             |
| Caminho local canônico   | `D:\rota-mestre\rotamestre-app` | workspace                   |
| Branch de produção       | `main`                          | Git/Vercel                  |
| Web                      | <https://app.rotamestre.tec.br> | Vercel                      |
| Site institucional/legal | <https://rotamestre.tec.br>     | repositório `lp-rotamestre` |

Não copie versões para outros documentos. Quando houver divergência, prevalecem
`package.json`, `app.config.js`, `eas.json` e o estado consultado nos consoles.

## Histórico

Snapshots datados por etapa e a tabela de mudanças por PR ficam em
[HISTORICO.md](HISTORICO.md) — foram tirados daqui em 15/08/2026 porque eram
**290 das 923 linhas** deste documento, lidas em toda sessão para responder
perguntas raras. Consulte-o para "como chegamos aqui" e "isso já foi tentado?".

## Arquitetura e limites entre projetos

```text
rotamestre.tec.br
  Site institucional, SEO, marca e páginas legais públicas
                  │
                  ├── CTA de login
                  ▼
app.rotamestre.tec.br ── Expo Web / React Native
                  │
                  ├── Supabase: Auth, Postgres, RLS, Storage, Realtime
                  ├── Edge Functions: Google Places, exclusão de conta, push
                  ├── OSRM: cálculo/otimização de rotas
                  └── Firebase/Expo: notificações no Android
```

- Este repositório não é o site institucional.
- O repositório irmão `D:\rota-mestre\lp-rotamestre` não contém lógica
  autenticada nem dados operacionais.
- As páginas legais públicas do site são as URLs informadas ao Google Play. Ao
  alterar coleta, retenção ou compartilhamento de dados, atualize o app, a
  landing e as declarações do Play no mesmo trabalho.

## Regras que não podem regredir

> As **Armadilhas** acima também não podem regredir — esta seção não as repete.
> Quatro entradas saíram daqui em 27/08/2026 por serem cópia literal de lá
> (`loading` na recarga, componente aninhado no render, `src/types/database.ts`,
> OSRM no dev web). Duplicar entre as duas seções custa leitura dobrada em toda
> sessão e cria o risco de as cópias divergirem. O que entra aqui é regra que
> **não** tem armadilha correspondente.

- Nunca exponha `service_role`, chave do Google Places ou credencial do Play no
  cliente ou no Git.
- **Conta de teste nunca tem senha no repo.** As quatro antigas (`gestor@`,
  `motorista@`, `gestor.test@`, `motorista.test@`) foram excluídas em
  05/08/2026; se recriar alguma, a senha vem de variável de ambiente. Era a
  pendência 1, cuja ação já estava feita — o que sobrava era esta regra,
  ocupando um slot da lista canônica lida em toda sessão.
- Migrations de schema devem ser versionadas em `database/migrations/` e
  `supabase/migrations/` com o mesmo timestamp e conteúdo. Exceções históricas
  aplicadas manualmente precisam ser documentadas, nunca executadas novamente
  por suposição.
- `versionCode` é monotônico. Confirme o maior código no Play Console antes do
  próximo bump.
- Não altere `br.tec.rotamestre.app`, o EAS project ID ou o Firebase project sem
  um plano formal de migração.
- Dependências acopladas exigem validação nativa: Unistyles e Nitro Modules
  devem ser testados juntos em build EAS.
- **A carência de 7 dias para expirar rota `em_andamento` não é número
  arbitrário.** Expirá-la junto com as pendentes, às 22:00 do próprio dia, teria
  encerrado **67 das 604 rotas concluídas (11%)** com o motorista ainda
  entregando — 47 delas fecham no dia seguinte. Antes de mexer no predicado de
  `expire_old_pending_routes`, refaça o replay contra o histórico de
  `motorista_iniciou_rota`/`motorista_concluiu_rota`. `remind_pending_routes`
  usa o **mesmo** predicado de propósito: separá-los faz a rota expirar sem
  aviso. Ver `database/MIGRATIONS.md` (Migrations 25 e 26).
- O baseline de runtime é **Node 22** (`.nvmrc`, `engines.node`, CI e EAS). Não
  regrida para Node 20; a proteção da `main` espera `Run Tests (22.x)`.
- O mapa web só funciona com o worker do `maplibre-gl 6` servido de `public/` —
  a cadeia inteira que não pode ser quebrada (postinstall, `build:web`,
  `configureMaplibreWorker()` e o step explícito no job de visual regression)
  está em [`../CLAUDE.md`](../CLAUDE.md). O e2e `renders motorista mapa` cobre
  isso desde 25/08/2026, **mas não em PR do Dependabot**: secrets de bot são um
  store separado e vazio, e o mapa roda no job `E2E autenticado`, que o `if:` de
  job **pula** para Dependabot e fork: ele aparece cinza ("Skipped") na lista de
  checks, e o `Visual Regression (22.x)` (mesmo nome, depende dele) sai verde
  sem ter aberto o mapa (medido no #519 e no #536, os dois bumps de
  `maplibre-gl`, quando o pulo era um `exit 0` invisível). Humano sem secret
  falha. **O push na `main` roda de verdade** — então um bump quebrado
  passa verde no PR, entra, e só acende com o deploy já disparado. Para validar
  antes, rode o e2e local (`npx playwright test e2e/visual-critical.e2e.ts -g
"mapa"`, com `.env` preenchido). Como distinguir no log um step que rodou de
  um que degradou: memória `ci-verde-em-pr-do-dependabot-nao-testa-o-mapa`.
- **O bloco `ignore` do `.github/dependabot.yml` não é burocracia.** `expo`,
  `expo-*`, `@expo/*`, `@react-native/*`, `@react-native-community/*`,
  `react-native` e os demais pacotes fixados pelo SDK sobem **só** por
  `npx expo install`, em lockstep. Bump isolado quebra: em 24/08 o
  `@react-native/jest-preset` 0.87 derrubou **as 334 suítes de uma vez** (o preset
  mocka `react-native/setup-env`, ausente na 0.85.3). O preço da regra é deriva
  silenciosa — coberta pelo `expo install --check` no CI, informativo de propósito.
- **O audit de produção bloqueia merge** e mantém allowlist **por ID de advisory**
  em `scripts/audit-producao.js` (nunca por pacote, para que advisory novo no
  mesmo pacote continue quebrando). Quando falhar: suba a dependência se houver
  correção upstream; se não houver e o risco for aceitável, acrescente o ID com
  motivo e data de revisão. **Não devolva `continue-on-error`** — foi assim que 4
  advisories high do `image-size` ficaram falhando sem ninguém ver.
- `otimizacao_estado = NULL` significa **sem registro**, nunca `'manual'`. Não
  conte, filtre nem exiba rota antiga como manual: não há como saber se ela foi
  otimizada, e assumir falsearia a auditoria.
- Autoria de ações sensíveis vem de `auth.uid()` **dentro** da função
  `SECURITY DEFINER`, nunca de parâmetro enviado pelo cliente — caso contrário
  qualquer usuário autenticado pode forjá-la.
- **Número com decimal na tela passa por `formatarDecimal`** — regra completa,
  com as exceções, em [`../CLAUDE.md`](../CLAUDE.md). Estava duplicada aqui e
  lá; duas cópias de uma regra divergem no primeiro ajuste.

## Próximas ações

> As pendências ativas estão na **tabela do topo**, que é a lista canônica. Aqui
> fica só o detalhe operacional das frentes abertas. O backlog de médio prazo
> (métricas de produto, retomada do Asaas, estratégia de rollout pós-aprovação)
> saiu daqui em 25/08/2026 — não precisava ser lido em toda sessão.

### P0 — concluir distribuição móvel (detalhe das pendências 4 e 5)

1. Confirmar no Play Console a quantidade e a continuidade dos participantes com
   opt-in; divulgue o hub `/testar` para ampliar a base. Contas cadastradas sem
   opt-in não contam para o requisito.
2. Solicitar acesso à produção quando o requisito estiver satisfeito. As duas
   trilhas de teste já servem o mesmo build (alinhadas em 08/09/2026), então não
   há promoção pendente entre elas. Promoção entre trilhas é feita pela API
   (`npm run play:promote`), nunca por `eas submit`, que sempre sobe artefato
   novo; não gere um AAB só para repetir a tentativa.
3. Revisar "Conteúdo do app", Segurança de dados, classificação, público-alvo,
   acesso do revisor e URLs legais contra `play-store-metadata.md`.
4. Concluir a autenticação interativa da Apple, gerar o primeiro build iOS e
   testá-lo no TestFlight.
5. Preencher a ficha e o App Privacy no App Store Connect, anexar screenshots de
   iPhone/iPad e enviar o build para revisão.

### P1 — qualidade e acompanhamento funcional

1. Monitorar erros da Nova Entrega: recuperação de rascunho após refresh,
   importação em massa, dependências retirada/entrega, retries e duplicidade.
2. Validar o ciclo completo de um motorista **em rede instável**. Em rede boa o
   ciclo foi percorrido no Android em 05/09/2026 (iniciar, concluir com foto,
   pular, reportar incidente, finalizar, recriação de Activity) e o build de
   08/09 foi validado em aparelho para mapa nativo, decimais pt-BR, Waze com
   destino, aviso de localização, permissão de câmera e SOS nos dois ramos. O
   iOS segue sem build (pend. 5).
3. Confirmar entrega de push nos artefatos instalados pelas lojas.
4. Planejar o aviso aos usuários do app antigo sem interromper o backend
   compartilhado.
5. A 3061 (1.16.1, #776 e #772) está na interna e na alpha desde 12/11, com
   o M-3 e o #772 validados no aparelho. Sobram: U-4 (coberto por teste de
   unidade) e ver no aparelho, na próxima versão, o cancelamento com o tipo
   `rota_cancelada` (Migration 91 aplicada e push v20 publicado em 13/11).

## Roteiro para a próxima sessão

1. `git status --short --branch` — espere a árvore limpa. Se aparecer
   `.claude/settings.json` modificado, é porque uma permissão foi salva no escopo
   "projeto" em vez de "local": reverta o versionado e mova para
   `.claude/settings.local.json`, que o `.gitignore` cobre.
2. Confira `package.json`, o último commit e os checks do GitHub.
3. Se houver banco no escopo, rode `npx supabase migration list --remote` e compare o
   schema vivo antes de criar SQL.
4. Se houver release Android no escopo, consulte o Play Console e o EAS — não
   gere build só para descobrir o estado.
5. Se houver worktrees de sessões paralelas em `.claude/worktrees/`, o Jest da
   checkout principal os varre; o `jest.config.js` já os ignora por regex, então
   basta `npx jest`. **Não passe `--testPathIgnorePatterns`**: a flag de CLI
   sobrescreve a config e, rodada de dentro de um worktree, zera a suíte.
6. Se o escopo for release: bump em PR próprio → build pelo workflow
   `eas-build-android.yml` → submit à interna de uma worktree com o mesmo SDK
   da `main` → aparelho → alpha, com OK do gestor em cada etapa da Play.
7. Execute a menor validação proporcional à mudança, e registre aqui o que for
   durável: regra que pode regredir vai para "Armadilhas" ou "Regras que não
   podem regredir"; relato datado vai para [HISTORICO.md](HISTORICO.md).

> Se abrir uma seção "Trabalho em curso", siga o contrato: estado real
> verificado, e apagada ao fechar.

## Mapa da documentação

- **Começar uma nova sessão / estado atual** — este arquivo
- **Como chegamos aqui / o que já foi tentado** — [HISTORICO.md](HISTORICO.md) — snapshots datados e mudanças por PR
- ****Isso já foi resolvido? posso reabrir?**** — [HISTORICO.md](HISTORICO.md) → "Frentes fechadas, por data": as listas "Fechadas em ..., não reabra" de 08, 15, 17 e 25/08
- ****Este fluxo já foi validado? o que foi medido?**** — [HISTORICO.md](HISTORICO.md) → "Validações e varreduras": onboarding, otimizador, massa demo, política de senha, contas órfãs, emails do Auth e guardas de precondição
- **Arquitetura, padrões e phonebook técnico** — [`../CLAUDE.md`](../CLAUDE.md)
- **Testes** — [TESTING.md](TESTING.md)
- **Histórico e processo de migrations** — [`../database/MIGRATIONS.md`](../database/MIGRATIONS.md)
- **Google Play: procedimento** — [GOOGLE_PLAY_DEPLOYMENT.md](GOOGLE_PLAY_DEPLOYMENT.md)
- **Google Play: textos, assets e declarações** — [play-store-metadata.md](play-store-metadata.md)
- **App Store / iOS: procedimento** — [APP_STORE_DEPLOYMENT.md](APP_STORE_DEPLOYMENT.md)
- **Reconstrução da identidade Android** — [REBUILD_RELAUNCH_PLAN.md](REBUILD_RELAUNCH_PLAN.md)
- **Firebase e push** — [FIREBASE_MIGRATION.md](FIREBASE_MIGRATION.md)
- **Recuperação de senha** — [PASSWORD_RECOVERY.md](PASSWORD_RECOVERY.md)
- **Templates de email do Auth** — [`../supabase/templates/README.md`](../supabase/templates/README.md) — e por que colar no painel
- **Marca e tokens** — [`../brand-guidelines.md`](../brand-guidelines.md)
- **Specs e planos de features** — [`superpowers/specs/`](superpowers/specs/) e [`superpowers/plans/`](superpowers/plans/)

Os specs e planos em `superpowers/` são **registro de decisão**, não estado
atual: leia-os quando for continuar a feature de que tratam (ex.: a Fase 2 da
auditoria). Onde eles divergirem deste documento ou do código, **o código vence** —
vários deles registram passos que a execução provou errados.

## Segurança documental

Não registre senhas, tokens, chaves, arquivos JSON de serviço, keystores ou
listas nominais de usuários/testadores. Este documento pode registrar **onde**
uma credencial é administrada e como verificar seu funcionamento, nunca seu
conteúdo.
