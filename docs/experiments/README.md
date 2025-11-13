# Dashboard Experiments (Arquivo de Referência)

Estes arquivos eram rotas auxiliares (`app/gestor/dashboard-*.tsx`) usadas para depurar loops de renderização e validar hooks responsivos. Para manter o bundle limpo e o app alinhado às diretrizes de UI, eles foram movidos para `docs/experiments`.

## Estrutura

| Arquivo | Propósito |
| --- | --- |
| `dashboard-debug.tsx` | Visualizar, em tempo real, o estado de hooks-chave e disparar eventos controlados. |
| `dashboard-isolated.tsx` | Renderizar apenas o layout do dashboard sem dados, útil para testar responsividade. |
| `dashboard-progressive.tsx` | Ativar hooks em níveis (useUser → useResponsive → useDashboardData) e detectar loops. |
| `dashboard-test.tsx` | Mock simplificado do dashboard para validar componentes desacoplados. |

## Como usar novamente

1. Copie o arquivo desejado de `docs/experiments` para `app/gestor/`.
2. Rode `npm run lint` para garantir que o arquivo segue os padrões atuais.
3. Acesse a rota correspondente (`/gestor/<nome-do-arquivo-s/`.tsx sem a extensão).

> **Importante:** Esses arquivos não devem ir para produção. Use-os apenas durante depuração local e remova-os antes de gerar builds oficiais.
