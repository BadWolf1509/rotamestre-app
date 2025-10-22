# 🎯 MCPs Específicos por Projeto

Este guia explica como configurar MCPs diferentes para cada projeto, permitindo que:
- **rotamestre-app** use apenas seus próprios MCPs
- **v4-connect-app** use apenas seus próprios MCPs

## 🔧 Como Funciona

### Antes (Problema)

Todos os MCPs estavam configurados globalmente em:
```
C:\Users\welli\AppData\Roaming\Claude\claude_desktop_config.json
```

Resultado: **TODOS os 7 MCPs** carregavam sempre, independente do projeto:
- ❌ `mcp__v4-pricing__*` aparecia no rotamestre-app
- ❌ `mcp__rotamestre__*` aparecia no v4-connect-app

### Depois (Solução)

Cada projeto tem seus próprios MCPs configurados em:
```
rotamestre-app/.mcp.json          → 3 MCPs (rotamestre, rotamestre-git, filesystem-rotamestre)
v4-connect-app/.mcp.json          → 5 MCPs (v4-pricing, v4-postgres, v4-git, filesystem, Sentry)
```

E cada projeto habilita automaticamente seus MCPs em:
```
rotamestre-app/.claude/settings.local.json
v4-connect-app/.claude/settings.local.json
```

Resultado: **Cada projeto vê apenas seus próprios MCPs** ✅

---

## 📁 Arquivos Criados

### rotamestre-app

#### `.mcp.json`
```json
{
  "mcpServers": {
    "rotamestre": {
      "command": "node",
      "args": ["tools/mcp-server/src/index.js"],
      "env": {
        "SUPABASE_URL": "https://xezslsyxjivunmhhyxtd.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "..."
      }
    },
    "rotamestre-git": {
      "command": "node",
      "args": ["tools/mcp-git-rotamestre/src/index.js"]
    },
    "filesystem-rotamestre": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  }
}
```

#### `.claude/settings.local.json`
```json
{
  "enableAllProjectMcpServers": true,
  "permissions": { ... }
}
```

---

### v4-connect-app

#### `.mcp.json`
```json
{
  "mcpServers": {
    "Sentry": {
      "url": "https://mcp.sentry.dev/mcp/v4-company-06/javascript-nextjs"
    },
    "v4-pricing": {
      "command": "node",
      "args": ["mcp-server/index.js"],
      "env": {
        "SUPABASE_URL": "https://qrvoevkuqupiwzagvspr.supabase.co",
        "SUPABASE_KEY": "..."
      }
    },
    "v4-postgres": {
      "command": "node",
      "args": ["mcp-postgres-server/index.js", "postgresql://..."]
    },
    "v4-git": {
      "command": "node",
      "args": ["mcp-git-server/index.js"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  }
}
```

#### `.claude/settings.local.json`
```json
{
  "enableAllProjectMcpServers": true,
  "permissions": { ... }
}
```

---

## ✨ Como Funciona

### 1. Detecção Automática

Quando você abre um projeto no Claude Code, ele:
1. Verifica se existe `.mcp.json` na raiz do projeto
2. Verifica se `.claude/settings.local.json` tem `enableAllProjectMcpServers: true`
3. Habilita **apenas** os MCPs daquele projeto

### 2. Isolamento por Projeto

```
Projeto rotamestre-app:
✅ mcp__rotamestre__* (Database Supabase)
✅ mcp__rotamestre-git__* (Git operations)
✅ mcp__filesystem-rotamestre__* (Filesystem)
❌ mcp__v4-pricing__* (NÃO aparece)
❌ mcp__v4-postgres__* (NÃO aparece)

Projeto v4-connect-app:
✅ mcp__v4-pricing__* (Pricing calculations)
✅ mcp__v4-postgres__* (Database queries)
✅ mcp__v4-git__* (Git operations)
✅ mcp__filesystem__* (Filesystem)
✅ mcp__Sentry__* (Error tracking)
❌ mcp__rotamestre__* (NÃO aparece)
```

### 3. Alternância Automática

Basta **trocar de projeto** no Claude Code:
- Fechar rotamestre-app → Abrir v4-connect-app
- Os MCPs são carregados automaticamente baseado no `.mcp.json` do projeto

---

## 🔍 Verificar MCPs Ativos

No Claude Code, use o comando para listar tools disponíveis e veja os prefixos:

```
Trabalhando em rotamestre-app:
- mcp__rotamestre__listar_unidades
- mcp__rotamestre__listar_rotas
- mcp__rotamestre-git__git_status
- mcp__filesystem-rotamestre__read_file

Trabalhando em v4-connect-app:
- mcp__v4-pricing__calculate_quote_pricing
- mcp__v4-postgres__postgres_query
- mcp__v4-git__git_log
- mcp__filesystem__read_file
- mcp__Sentry__*
```

---

## 🚀 Benefícios

### Organização
✅ Cada projeto vê apenas seus MCPs relevantes
✅ Não há poluição de tools de outros projetos
✅ Fácil identificar qual MCP pertence a qual projeto

### Performance
✅ Menos MCPs rodando = menos overhead
✅ Inicialização mais rápida do Claude Code
✅ Menos memória utilizada

### Manutenção
✅ Configuração versionada no Git (`.mcp.json`)
✅ Time todo usa os mesmos MCPs
✅ Fácil adicionar/remover MCPs por projeto

---

## 🔒 Segurança

### ⚠️ Credenciais no `.mcp.json`

Os arquivos `.mcp.json` **NÃO devem** ser commitados com credenciais sensíveis.

**Opção 1: Usar .env (Recomendado)**

Remova a seção `env` do `.mcp.json` e crie `.env` na raiz do projeto:

```env
SUPABASE_URL=https://xezslsyxjivunmhhyxtd.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

O MCP Server carregará automaticamente do `.env`.

**Opção 2: Adicionar ao .gitignore**

Se precisar manter credenciais no `.mcp.json`:

```gitignore
.mcp.json
```

E compartilhe um template:

```bash
.mcp.json.example  # Commitar (sem credenciais)
.mcp.json          # Ignorar (com credenciais)
```

---

## 🧪 Testar a Configuração

### 1. Verificar arquivo de config

```bash
# rotamestre-app
cat .mcp.json
cat .claude/settings.local.json

# v4-connect-app
cat .mcp.json
cat .claude/settings.local.json
```

### 2. Reiniciar Claude Code

Feche e abra o Claude Code novamente para carregar os MCPs.

### 3. Listar MCPs disponíveis

No Claude Code, pergunte:
```
Quais MCPs estão disponíveis neste projeto?
```

---

## 📊 Resumo

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **MCPs globais** | 7 MCPs sempre ativos | 0 MCPs globais |
| **MCPs rotamestre** | Sempre ativos | Apenas em rotamestre-app |
| **MCPs v4-connect** | Sempre ativos | Apenas em v4-connect-app |
| **Configuração** | 1 arquivo global | 1 arquivo por projeto |
| **Isolamento** | ❌ Nenhum | ✅ Completo |
| **Performance** | Todos os MCPs rodando | Apenas MCPs necessários |

---

## 🎯 Próximos Passos

1. ✅ **rotamestre-app** configurado
2. ✅ **v4-connect-app** configurado
3. ⏳ Testar alternância entre projetos
4. ⏳ Validar que cada projeto vê apenas seus MCPs

---

**Data:** 2025-10-22
**Projetos:** rotamestre-app + v4-connect-app
**MCPs totais:** 8 (3 rotamestre + 5 v4-connect)
**Status:** ✅ Configuração completa
