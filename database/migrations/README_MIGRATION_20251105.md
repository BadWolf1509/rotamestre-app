# Migration: Add is_checkpoint Column

**Data:** 2025-11-05
**Arquivo:** `20251105000000_add_is_checkpoint_to_paradas.sql`

## Objetivo

Adicionar coluna `is_checkpoint` na tabela `paradas` para diferenciar:
- **Entregas/Coletas reais** (`is_checkpoint = true`) - contam como paradas
- **Pontos base** (`is_checkpoint = false`) - saída e chegada na unidade

## Problema Resolvido

**Antes:**
- Rota com 3 entregas mostrava "5 paradas" (3 entregas + 2 base)
- Progresso confuso: 3/5 = 60% (deveria ser 3/3 = 100%)
- UX ruim para motorista

**Depois:**
- Rota com 3 entregas mostra "3 entregas"
- Progresso correto: 3/3 = 100%
- UX clara e motivadora

## Como Executar

### Opção 1: Via Supabase Dashboard (Recomendado)

1. Acesse o Supabase Dashboard: https://xezslsyxjivunmhhyxtd.supabase.co
2. Faça login com suas credenciais
3. No menu lateral, clique em **SQL Editor**
4. Clique em **New Query**
5. Copie e cole o conteúdo completo do arquivo `20251105000000_add_is_checkpoint_to_paradas.sql`
6. Clique em **Run** (ou pressione Ctrl+Enter)
7. Verifique se apareceu a mensagem de sucesso

### Opção 2: Via psql (Terminal)

```bash
# Conectar ao banco
psql "postgresql://postgres.xezslsyxjivunmhhyxtd:hpjhgjh5xSE0FPLy@aws-1-sa-east-1.pooler.supabase.com:6543/postgres"

# Executar migration
\i database/migrations/20251105000000_add_is_checkpoint_to_paradas.sql
```

### Opção 3: Via npx supabase (Supabase CLI)

```bash
# Se você tiver o Supabase CLI instalado
npx supabase db push
```

## Verificação Pós-Migration

Execute esta query no SQL Editor para verificar:

```sql
SELECT
  is_checkpoint,
  COUNT(*) as total,
  COUNT(CASE WHEN observacoes IN ('Ponto de partida', 'Ponto de chegada') THEN 1 END) as base_points
FROM paradas
GROUP BY is_checkpoint;
```

**Resultado esperado:**
- `is_checkpoint = false`: Todos devem ser pontos base
- `is_checkpoint = true`: Nenhum deve ser ponto base

## Arquivos Modificados

1. ✅ **database/migrations/20251105000000_add_is_checkpoint_to_paradas.sql**
   - Adiciona coluna `is_checkpoint`
   - Atualiza paradas existentes
   - Cria índice para performance

2. ✅ **app/gestor/nova-entrega.tsx** (linhas 499, 516, 533)
   - Define `is_checkpoint: false` para base (partida/chegada)
   - Define `is_checkpoint: true` para entregas reais
   - Atualiza mensagem de sucesso

3. ✅ **app/gestor/historico.tsx** (linha 97)
   - Adiciona filtro `.eq('is_checkpoint', true)`
   - Conta apenas entregas reais

4. ✅ **app/gestor/dashboard/_hooks/useDashboardData.ts** (linha 81)
   - Adiciona filtro `.eq('is_checkpoint', true)`
   - Dashboard mostra contagem correta

## Rollback (se necessário)

Se precisar reverter a migration:

```sql
-- Remover índice
DROP INDEX IF EXISTS idx_paradas_is_checkpoint;

-- Remover coluna
ALTER TABLE paradas DROP COLUMN is_checkpoint;
```

## Compatibilidade

- ✅ **Backward Compatible**: Rotas antigas continuam funcionando
- ✅ **Novas rotas**: Usarão o novo sistema automaticamente
- ⚠️ **Queries antigas**: Queries que não filtram por `is_checkpoint` verão todas as paradas (incluindo base)

## Impacto

- **UX Motorista**: 🚀 Muito melhor (contagem clara de entregas)
- **Analytics**: 📊 Dados mais precisos
- **Compliance**: ✅ Rastreabilidade completa (Lei 13.103/2015)
- **Performance**: 🔥 Índice adicionado para otimização

## Dúvidas?

Leia a análise completa no histórico do Claude Code ou consulte:
- [nova-entrega.tsx:499-533](../app/gestor/nova-entrega.tsx#L499-L533)
- [historico.tsx:97](../app/gestor/historico.tsx#L97)
- [useDashboardData.ts:81](../app/gestor/dashboard/_hooks/useDashboardData.ts#L81)
