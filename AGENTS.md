# Instruções para agentes — Rota Mestre App

Antes de iniciar qualquer tarefa:

1. Leia `docs/PROJECT_CONTEXT.md` por completo.
2. Execute `git status --short --branch`.
3. Consulte a fonte de verdade indicada no contexto antes de alterar versões,
   banco, builds, trilhas ou deploys.

## Limites do projeto

- Este repositório contém a plataforma web autenticada e os aplicativos móveis.
- O site institucional e as páginas legais públicas pertencem ao repositório
  irmão `D:\rota-mestre\lp-rotamestre`.
- Mudanças em coleta, retenção, compartilhamento ou exclusão de dados exigem
  revisão coordenada entre os dois projetos e as declarações das lojas.

## Regras operacionais

- Não versione nem exponha `.env`, credenciais do Play, chaves Apple, keystores,
  tokens ou listas nominais de usuários/testadores.
- Preserve `unidade_id`, RLS, o bucket privado `fotos-entrega` e a identidade
  `br.tec.rotamestre.app`.
- Para banco, leia `database/MIGRATIONS.md` e compare o histórico remoto antes
  de criar ou aplicar SQL.
- Para releases, siga `docs/GOOGLE_PLAY_DEPLOYMENT.md` ou
  `docs/APP_STORE_DEPLOYMENT.md`.
- Execute validação proporcional à mudança. O baseline completo é
  `npm run validate` seguido de `npm run build:web:clear`.
- Quando uma tarefa alterar estado externo, decisão arquitetural ou próxima
  prioridade, atualize `docs/PROJECT_CONTEXT.md` no mesmo trabalho.

Não replique neste arquivo versões ou estados voláteis; eles pertencem ao
contexto operacional e às fontes de verdade do projeto.
