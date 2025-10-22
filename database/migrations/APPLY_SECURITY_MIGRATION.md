# 🔒 Aplicar Migration de Segurança

Este guia explica como aplicar a migration `20251022000000_fix_security_warnings.sql` que corrige os avisos de segurança detectados pelo Supabase Database Linter.

## ⚠️ Avisos Corrigidos

Esta migration corrige os seguintes problemas:

1. **Function Search Path Mutable** (8 funções) - CRÍTICO
   - `get_user_unidade`
   - `get_user_role`
   - `log_parada_conclusao`
   - `rotas_ativas_motorista`
   - `update_updated_at_column`
   - `estatisticas_rota`
   - `log_rota_status_change`
   - `calcular_distancia`

2. **Extension in Public Schema** (postgis) - INFORMATIVO
   - Adiciona comentário explicativo (não quebra compatibilidade)

## 📋 Passo a Passo

### Opção 1: Supabase Dashboard (Recomendado)

1. **Abra o Supabase Dashboard**
   - URL: https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd

2. **Navegue para SQL Editor**
   - Menu lateral: `Database` → `SQL Editor`
   - Ou acesse diretamente: https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/sql

3. **Abra o arquivo de migration**
   - Arquivo: `database/migrations/20251022000000_fix_security_warnings.sql`
   - Copie **TODO** o conteúdo (incluindo comentários)

4. **Cole no SQL Editor**
   - Clique em `New Query`
   - Cole todo o conteúdo copiado

5. **Execute a migration**
   - Clique em `Run` (ou pressione Ctrl/Cmd + Enter)
   - Aguarde a execução (deve levar ~5 segundos)

6. **Verifique a saída**
   - Você deve ver mensagens de sucesso para cada função
   - A última mensagem deve ser algo como:
     ```
     NOTICE:  Funções com search_path definido: 8
     ```

### Opção 2: CLI (Avançado)

Se você tiver `psql` instalado:

```bash
# Windows
type database\migrations\20251022000000_fix_security_warnings.sql | psql "postgresql://postgres.xezslsyxjivunmhhyxtd:[SUA_SENHA]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

# Linux/Mac
cat database/migrations/20251022000000_fix_security_warnings.sql | psql "postgresql://postgres.xezslsyxjivunmhhyxtd:[SUA_SENHA]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
```

Substitua `[SUA_SENHA]` pela senha do database (variável `SUPABASE_DB_PASSWORD` no `.env`).

## ✅ Validação

Após aplicar a migration:

1. **Execute o Database Linter novamente**
   - Dashboard → `Database` → `Database Linter`
   - Clique em `Run Linter`

2. **Verifique os resultados**
   - Os 8 avisos de `function_search_path_mutable` devem ter desaparecido
   - O aviso `extension_in_public` ainda aparecerá (esperado e seguro)

3. **Teste as funções**
   ```sql
   -- Teste 1: Verificar search_path nas funções
   SELECT
     p.proname AS function_name,
     p.proconfig AS search_path_config
   FROM pg_proc p
   JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE n.nspname = 'public'
     AND p.proname IN (
       'get_user_unidade',
       'get_user_role',
       'log_parada_conclusao',
       'rotas_ativas_motorista',
       'update_updated_at_column',
       'estatisticas_rota',
       'log_rota_status_change',
       'calcular_distancia'
     )
   ORDER BY p.proname;
   ```

   Todas as funções devem ter `search_path_config` = `{search_path=public}`

## 🔄 Rollback (se necessário)

Caso precise reverter a migration:

```sql
-- Reverter é simples: apenas remova o SET search_path
-- Exemplo para get_user_unidade:

CREATE OR REPLACE FUNCTION public.get_user_unidade(user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
-- Remover esta linha: SET search_path = public
AS $$
BEGIN
  RETURN (SELECT unidade_id FROM public.usuarios WHERE id = user_id);
END;
$$;

-- Repita para as outras 7 funções
```

## 📊 Impacto

**Antes:**
- ⚠️ 8 funções vulneráveis a search path hijacking
- ⚠️ Risco de segurança se usuário malicioso criar schemas/funções com nomes conflitantes

**Depois:**
- ✅ 8 funções com search_path fixo em `public`
- ✅ Proteção contra ataques de injeção de schema
- ✅ Conformidade com melhores práticas de segurança

## 🔗 Referências

- [Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter)
- [Function Search Path Mutable](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- [PostgreSQL SECURITY DEFINER Functions](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)
- [Search Path Vulnerabilities](https://www.postgresql.org/docs/current/ddl-schemas.html#DDL-SCHEMAS-PATH)

---

**Data:** 2025-10-22
**Arquivo:** `database/migrations/20251022000000_fix_security_warnings.sql`
**Status:** ⏳ Aguardando aplicação manual
