# 🚀 Guia de Instalação Rápida - MCP Git Rotamestre

## ✅ Passo a Passo

### 1️⃣ Instalar Dependências

```bash
cd tools/mcp-git-rotamestre
npm install
```

**Resultado esperado:** `added 91 packages`

---

### 2️⃣ Testar Funcionamento

```bash
node test-mcp.js
```

**Resultado esperado:**
```
🎉 Todos os testes passaram!
✨ O MCP Git Rotamestre está funcionando corretamente!
```

---

### 3️⃣ Configurar Claude Desktop

#### **Windows**

1. **Abrir arquivo de configuração:**
   - Pressione `Win + R`
   - Digite: `%APPDATA%\Claude`
   - Abra ou crie o arquivo `claude_desktop_config.json`

2. **Adicionar configuração:**

```json
{
  "mcpServers": {
    "git-rotamestre": {
      "command": "node",
      "args": [
        "C:\\Users\\welli\\rotamestre-app\\tools\\mcp-git-rotamestre\\src\\index.js"
      ]
    }
  }
}
```

⚠️ **Importante:** Ajuste o caminho para o seu sistema!

#### **macOS**

1. **Abrir arquivo de configuração:**
```bash
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

2. **Adicionar configuração:**

```json
{
  "mcpServers": {
    "git-rotamestre": {
      "command": "node",
      "args": [
        "/Users/seu-usuario/rotamestre-app/tools/mcp-git-rotamestre/src/index.js"
      ]
    }
  }
}
```

#### **Linux**

1. **Abrir arquivo de configuração:**
```bash
nano ~/.config/Claude/claude_desktop_config.json
```

2. **Adicionar configuração:**

```json
{
  "mcpServers": {
    "git-rotamestre": {
      "command": "node",
      "args": [
        "/home/seu-usuario/rotamestre-app/tools/mcp-git-rotamestre/src/index.js"
      ]
    }
  }
}
```

---

### 4️⃣ Reiniciar Claude Desktop

1. **Fechar completamente o Claude Desktop**
   - Windows: Fechar na bandeja do sistema
   - macOS: `Cmd + Q`
   - Linux: `killall claude`

2. **Abrir novamente**

---

### 5️⃣ Verificar Instalação

No Claude Desktop, pergunte:

```
Quais MCPs estão disponíveis?
```

ou

```
Use a tool git_status
```

**Resultado esperado:**
- MCP `git-rotamestre` aparece na lista
- Comando `git_status` retorna o status do repositório

---

## 🎯 Comandos de Teste

Teste as principais funcionalidades:

```
Use a tool git_status
Use a tool git_log com limit: 5
Use a tool git_current_branch
Use a tool git_contributors
Use a tool git_stats
```

---

## 🐛 Troubleshooting

### ❌ MCP não aparece no Claude Desktop

**Solução:**
1. Verifique se o caminho no `claude_desktop_config.json` está correto
2. Verifique se o arquivo JSON tem sintaxe válida
3. Reinicie o Claude Desktop completamente
4. Verifique os logs: `%APPDATA%\Claude\logs` (Windows)

### ❌ Erro: "Git command failed"

**Solução:**
1. Verifique se está em um repositório Git válido
2. Execute `node test-mcp.js` para diagnosticar
3. Verifique se o Git está instalado: `git --version`

### ❌ Erro: "Tool desconhecida"

**Solução:**
1. Consulte a lista de tools em `README.md`
2. Verifique se digitou o nome corretamente
3. Reinicie o Claude Desktop

---

## 📚 Próximos Passos

1. **Leia a documentação completa:** `README.md`
2. **Explore as 13 tools disponíveis**
3. **Personalize para seu workflow**

---

## 🔗 Links Úteis

- **README completo:** [README.md](./README.md)
- **Configuração de exemplo:** [claude_desktop_config.json](./claude_desktop_config.json)
- **MCP Protocol:** https://modelcontextprotocol.io/
- **Claude Desktop:** https://claude.ai/download

---

## ✨ Dicas

### Múltiplos MCPs

Se você já tem outros MCPs, adicione o `git-rotamestre` à lista existente:

```json
{
  "mcpServers": {
    "rotamestre": {
      "command": "node",
      "args": ["..."]
    },
    "git-rotamestre": {
      "command": "node",
      "args": ["C:\\Users\\welli\\rotamestre-app\\tools\\mcp-git-rotamestre\\src\\index.js"]
    },
    "outro-mcp": {
      "command": "...",
      "args": ["..."]
    }
  }
}
```

### Atalhos

Adicione ao seu `package.json` (raiz do projeto):

```json
{
  "scripts": {
    "mcp:git": "node tools/mcp-git-rotamestre/src/index.js",
    "mcp:git:test": "node tools/mcp-git-rotamestre/test-mcp.js"
  }
}
```

Então rode:
```bash
npm run mcp:git:test
```

---

**Data:** 2025-10-20
**Versão:** 1.0.0
**Status:** ✅ Pronto para uso
