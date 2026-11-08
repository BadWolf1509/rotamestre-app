# Revisão de design do desktop do gestor (07/11/2026)

O pedido veio do usuário: executar todas as ações da revisão de design do desktop do gestor (largura ≥ 1024). Ele dispensou as perguntas de descoberta. Por isso, as escolhas marcadas como **decisão do agente** são minhas e devem ser conferidas na revisão do PR.

## Intenção

O gestor acompanha várias rotas ao mesmo tempo, do escritório, e o objeto central desse trabalho é a rota: uma linha com paradas. Hoje a Início não responde à pergunta "como está o dia". A cor aparece por toda parte sem significar nada, cada tela fala uma língua diferente de status, e a fonte de títulos da marca (Viga) não aparece no desktop.

**Objetivos**

1. A Início mostra, sem rolar a tela, o resumo do dia e uma linha de paradas por rota.
2. O status tem uma só linguagem visual em todas as telas do gestor, e os chips de filtro são um só componente.
3. A ação destrutiva sai da linha da tabela, e a linha clicável abre o detalhe.
4. As tabelas desktop ocupam a largura do cartão, e o nome não quebra linha.
5. Títulos de página e números grandes usam Viga, e nenhum texto de dados no desktop fica abaixo de 13 px nem abaixo de 4,5:1 de contraste.
6. O laranja da marca fica reservado para "precisa de atenção". Ele sai do indicador ativo da barra lateral e dos cartões decorativos.
7. O seletor Entrega/Retirada da Nova Rota deixa claro qual tipo está selecionado.
8. Os textos ficam sem abreviação ("Pend", "OK") e sem plural com "(s)" nas telas do gestor. "PAINEL DO GESTOR" deixa de vir em caixa alta, e o bloco "Ações Rápidas" sai do desktop.

**Fora do escopo:** o layout mobile do gestor, a não ser onde um componente compartilhado mudar (status e chips); as telas do motorista; e o significado das cores de status. `pendente` continua `warning`, `pulada` continua `warning` e `nao_executada` continua `error`.

**Anti-objetivos:** quebrar o e2e ou a regressão visual sem atualizar o baseline pelo CI; esconder do gestor uma ação que existe hoje; inventar dado que o banco não tem, como o horário previsto de chegada.

## Linha de paradas (o elemento de assinatura)

Cada rota do dia aparece como uma linha horizontal. Nela vão um ponto por parada real (`is_checkpoint !== false`), na ordem de `paradas.ordem`, o nome do motorista, a contagem "3 de 8", o selo de status da rota e a distância. Clicar na linha abre `/gestor/mapa-rota?id=<id>`.

| Estado da parada | Desenho do ponto                           |
| ---------------- | ------------------------------------------ |
| Concluída        | Ponto cheio, na cor `success`              |
| Em andamento     | Ponto com anel, na cor `info`              |
| Pendente         | Ponto vazado, em `gray400`, só a borda     |
| Pulada           | Ponto cheio, na cor `warning`. É a atenção |

- Cada ponto leva um `accessibilityLabel` com "Parada N, <estado>".
- Com mais de 24 paradas, a linha mostra as 24 primeiras e um "+N".

A Início desktop fica assim:

```
┌ cabeçalho: "Início" (Viga) · loja ──────────────── [Nova rota] ┐
│ Resumo do dia em uma frase (testID gestor-dashboard-stats):      │
│ "3 rotas em andamento, 2 pendentes, 1 concluída — 12 de 40       │
│  paradas feitas, 48,5 km" + "1 incidente aberto" (laranja, link) │
├ barra de filtros recolhida: [Filtros ▸] resumo dos ativos ───────┤
│ Motorista A  ●●●◐○○○○   3 de 8   Em andamento   12,4 km          │
│ Motorista B  ●●◆○○      2 de 5   Em andamento    8,1 km          │
└──────────────────────────────────────────────────────────────────┘
```

Sem rota, a Início mostra o `EmptyState` com o botão "Criar rota", que leva a `/gestor/nova-entrega`.

## Decisões do agente

- **Previsão de chegada:** não entra, porque o banco não guarda esse dado.
- **Motorista no filtro:** os motoristas viram chips que quebram linha (`FilterChip`) no lugar da lista vertical. O filtro abre recolhido.
- **Status de incidente:** aberto, em análise, resolvido e fechado continuam com rótulos próprios, mas passam a ser desenhados pelo mesmo `StatusBadge` suave.
- **Motorista inativo:** a cor é `gray600`, não `error`. Estar inativo não é erro.
- **Retirada:** continua laranja (`warning`), a mesma cor dos pinos de retirada no mapa. A cor é do tipo de parada, não decoração.
- **Ações destrutivas:** as ações `type: 'danger'` do `DataTable` passam para um menu "⋯" por linha. As demais seguem visíveis. Clicar na linha chama `onRowPress`.
- **Cartões de número:** saem do desktop da Início e continuam no mobile. Nos Incidentes, os cartões ficam com fundo neutro, e a cor vai só para o número.
