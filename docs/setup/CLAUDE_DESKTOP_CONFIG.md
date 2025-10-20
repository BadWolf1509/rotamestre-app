# 🔌 Configuração dos MCPs no Claude Desktop

## 📍 Localização do Arquivo de Configuração

### Windows
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Caminho completo:**
```
C:\Users\welli\AppData\Roaming\Claude\claude_desktop_config.json
```

### Como Abrir
1. Pressione `Win + R`
2. Digite: `%APPDATA%\Claude`
3. Abra ou crie o arquivo `claude_desktop_config.json`

---

## ✅ Configuração Completa (3 MCPs)

Copie e cole esta configuração **completa** no arquivo:

```json
{
  "mcpServers": {
    "rotamestre-db": {
      "command": "node",
      "args": [
        "C:\\Users\\welli\\rotamestre-app\\tools\\mcp-server\\src\\index.js"
      ],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "seu-service-role-key-aqui"
      }
    },
    "rotamestre-git": {
      "command": "node",
      "args": [
        "C:\\Users\\welli\\rotamestre-app\\tools\\mcp-git-rotamestre\\src\\index.js"
      ]
    },
    "filesystem-rotamestre": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "C:\\Users\\welli\\rotamestre-app"
      ]
    }
  }
}
```

---

## 🔑 Obter Service Role Key

1. Acesse: https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/settings/api
2. Procure por **Project API keys**
3. Copie o valor de **service_role** (secret)
4. Cole no lugar de `"seu-service-role-key-aqui"`

---

## ⚠️ Erros Comuns

### ❌ Erro: "Cannot find module 'C:\Users\welli\rotamestre-app\mcp-rotamestre\src\index.js'"

**Causa:** Caminho incorreto (faltando `tools/` ou usando nome antigo)

**Solução:** Use exatamente os caminhos acima:
- `tools/mcp-server/src/index.js` (Database)
- `tools/mcp-git-rotamestre/src/index.js` (Git)

### ❌ Erro: "SUPABASE_URL não definido"

**Causa:** Faltando configuração de ambiente no MCP Database

**Solução:** Adicione o bloco `"env"` com as credenciais do Supabase

### ❌ MCP não aparece no Claude Desktop

**Solução:**
1. Verifique se o arquivo JSON está válido (sem vírgulas extras)
2. Feche **completamente** o Claude Desktop
3. Abra novamente

---

## 🧪 Testar os MCPs

### Testar MCP Git
```bash
npm run mcp:git:test
```

**Resultado esperado:**
```
🎉 Todos os testes passaram!
✨ O MCP Git Rotamestre está funcionando corretamente!
```

### Testar MCP Database
```bash
cd tools/mcp-server
node test-connection.js
```

**Resultado esperado:**
```
✅ Conexão com Supabase estabelecida!
```

---

## 📋 Verificar no Claude Desktop

Após configurar e reiniciar o Claude Desktop, teste:

### MCP Git
```
Use a tool git_status
Use a tool git_log com limit: 5
```

### MCP Database
```
Use a tool listar_unidades
Use a tool listar_rotas com limit: 10
```

### MCP Filesystem
```
Use a tool read_file com path: "package.json"
Use a tool list_directory com path: "."
```

---

## 📊 MCPs Disponíveis

### 🔧 rotamestre-git (13 tools)
Operações Git no repositório do projeto.

- `git_status` - Status do repositório
- `git_log` - Histórico de commits
- `git_diff` - Diferenças entre commits
- `git_blame` - Autoria de linhas
- `git_contributors` - Lista de contribuidores
- `git_branches` - Branches locais/remotas
- `git_show` - Detalhes de commit
- `git_file_history` - Histórico de arquivo
- `git_search_commits` - Buscar commits
- `git_recent_changes` - Arquivos modificados
- `git_stats` - Estatísticas do repo
- `git_tag_list` - Listar tags
- `git_current_branch` - Branch atual

### 🗄️ rotamestre-db (14 tools)
Operações no banco de dados Supabase.

- `listar_unidades` - Lista unidades
- `listar_usuarios` - Lista usuários
- `listar_rotas` - Lista rotas
- `obter_rota_detalhada` - Detalhes de rota
- `listar_paradas` - Paradas de rota
- `listar_logs` - Logs do sistema
- `estatisticas_rota` - Stats de rota
- `rotas_ativas_motorista` - Rotas do motorista
- `view_rotas_resumo` - Resumo de rotas
- `view_performance_motoristas` - Performance
- `criar_unidade` - Criar unidade
- `criar_rota` - Criar rota
- `adicionar_parada` - Adicionar parada
- `atualizar_status_rota` - Atualizar status

### 📁 filesystem-rotamestre (10+ tools)
Operações no sistema de arquivos do projeto.

- `read_file` - Ler conteúdo de arquivo
- `read_multiple_files` - Ler múltiplos arquivos
- `write_file` - Criar/sobrescrever arquivo
- `edit_file` - Editar arquivo (substituições)
- `create_directory` - Criar diretório
- `list_directory` - Listar arquivos/pastas
- `directory_tree` - Árvore de diretórios (JSON)
- `move_file` - Mover/renomear arquivo
- `search_files` - Buscar arquivos por nome
- `get_file_info` - Metadados do arquivo
- `list_allowed_directories` - Diretórios permitidos

---

## 🔒 Segurança

### ⚠️ IMPORTANTE: Service Role Key

- **NÃO** commite o arquivo de configuração com a Service Role Key
- **NÃO** compartilhe a Service Role Key
- Esta chave tem acesso **completo** ao banco de dados

### Arquivo Seguro (.env)

Como alternativa, você pode criar um `.env` em `tools/mcp-server/`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-chave-aqui
```

E simplificar a configuração:

```json
{
  "mcpServers": {
    "rotamestre-db": {
      "command": "node",
      "args": [
        "C:\\Users\\welli\\rotamestre-app\\tools\\mcp-server\\src\\index.js"
      ]
    }
  }
}
```

O MCP Server lerá automaticamente o `.env`.

---

## 🚀 Próximos Passos

1. **Copie a configuração acima** para o arquivo do Claude Desktop
2. **Adicione sua Service Role Key** do Supabase
3. **Reinicie o Claude Desktop** completamente
4. **Teste os MCPs** com os comandos acima

---

**Data:** 2025-10-20
**MCPs:** rotamestre-git (v1.0.0) + rotamestre-db (v1.0.0) + filesystem-rotamestre
**Total de Tools:** 37+ (13 Git + 14 Database + 10+ Filesystem)
**Status:** ✅ Pronto para uso
