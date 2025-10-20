# 🔧 MCP Git Rotamestre

Servidor MCP (Model Context Protocol) para operações Git no projeto Rotamestre.

## 📋 Descrição

Este MCP Server fornece ferramentas para interagir com o repositório Git do projeto Rotamestre diretamente através do Claude Desktop, permitindo consultar histórico, ver diffs, analisar contribuições e muito mais.

## ⚡ Instalação

### 1. Instalar Dependências

```bash
cd tools/mcp-git-rotamestre
npm install
```

### 2. Testar Localmente

```bash
npm start
```

## 🔌 Configuração no Claude Desktop

### Windows
Arquivo de configuração: `%APPDATA%\Claude\claude_desktop_config.json`

### macOS
Arquivo de configuração: `~/Library/Application Support/Claude/claude_desktop_config.json`

### Linux
Arquivo de configuração: `~/.config/Claude/claude_desktop_config.json`

---

### Adicionar ao arquivo de configuração:

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

**⚠️ Importante:**
- Ajuste o caminho completo para o seu sistema
- No Windows, use `\\` (barras invertidas duplas)
- No macOS/Linux, use `/` (barras normais)

Após configurar, **reinicie o Claude Desktop**.

---

## 🛠️ Tools Disponíveis

### 📊 Status e Informações Gerais

#### `git_status`
Mostra o status atual do repositório (arquivos modificados, staged, untracked).

**Exemplo:**
```
Use a tool git_status
```

#### `git_current_branch`
Mostra a branch atual e seu status.

**Exemplo:**
```
Use a tool git_current_branch
```

#### `git_stats`
Estatísticas gerais do repositório (commits, branches, contribuidores).

**Parâmetros:**
- `detailed` (boolean, opcional): Incluir estatísticas detalhadas por arquivo

**Exemplos:**
```
Use a tool git_stats
Use a tool git_stats com detailed: true
```

---

### 📜 Histórico de Commits

#### `git_log`
Mostra o histórico de commits.

**Parâmetros:**
- `limit` (number, opcional): Número de commits (padrão: 20)
- `author` (string, opcional): Filtrar por autor
- `since` (string, opcional): Commits desde data ("2024-01-01", "1 week ago")
- `file` (string, opcional): Apenas commits que modificaram este arquivo

**Exemplos:**
```
Use a tool git_log
Use a tool git_log com limit: 50
Use a tool git_log com author: "wellintonribeiro"
Use a tool git_log com since: "1 month ago"
Use a tool git_log com file: "app/+html.tsx"
```

#### `git_show`
Mostra detalhes completos de um commit específico.

**Parâmetros:**
- `commit` (string, obrigatório): Hash do commit (ou HEAD, HEAD~1, etc)

**Exemplos:**
```
Use a tool git_show com commit: "HEAD"
Use a tool git_show com commit: "c675844"
Use a tool git_show com commit: "HEAD~3"
```

#### `git_file_history`
Histórico completo de modificações de um arquivo.

**Parâmetros:**
- `file` (string, obrigatório): Caminho do arquivo
- `limit` (number, opcional): Número de commits (padrão: 50)

**Exemplos:**
```
Use a tool git_file_history com file: "package.json"
Use a tool git_file_history com file: "app/+html.tsx" e limit: 100
```

---

### 🔍 Diferenças e Comparações

#### `git_diff`
Mostra diferenças entre commits, branches ou working directory.

**Parâmetros:**
- `target` (string, opcional): Commit/branch para comparar
- `source` (string, opcional): Commit/branch base
- `file` (string, opcional): Arquivo específico
- `staged` (boolean, opcional): Apenas mudanças staged

**Exemplos:**
```
Use a tool git_diff
Use a tool git_diff com staged: true
Use a tool git_diff com file: "vercel.json"
Use a tool git_diff com source: "HEAD~1" e target: "HEAD"
Use a tool git_diff com source: "main" e target: "develop"
```

---

### 🌿 Branches e Tags

#### `git_branches`
Lista todas as branches (local e remoto).

**Parâmetros:**
- `remote` (boolean, opcional): Incluir branches remotas (padrão: false)

**Exemplos:**
```
Use a tool git_branches
Use a tool git_branches com remote: true
```

#### `git_tag_list`
Lista todas as tags do repositório.

**Parâmetros:**
- `pattern` (string, opcional): Filtrar por padrão (ex: "v1.*")

**Exemplos:**
```
Use a tool git_tag_list
Use a tool git_tag_list com pattern: "v1.*"
```

---

### 👥 Contribuidores e Autoria

#### `git_contributors`
Lista todos os contribuidores com estatísticas.

**Parâmetros:**
- `since` (string, opcional): Contar commits desde data/período

**Exemplos:**
```
Use a tool git_contributors
Use a tool git_contributors com since: "2024-01-01"
Use a tool git_contributors com since: "6 months ago"
```

#### `git_blame`
Mostra quem modificou cada linha de um arquivo.

**Parâmetros:**
- `file` (string, obrigatório): Caminho do arquivo
- `lines` (string, opcional): Range de linhas (ex: "10,20")

**Exemplos:**
```
Use a tool git_blame com file: "app/+html.tsx"
Use a tool git_blame com file: "vercel.json" e lines: "1,10"
```

---

### 🔎 Busca

#### `git_search_commits`
Busca commits por mensagem ou conteúdo.

**Parâmetros:**
- `query` (string, obrigatório): Termo de busca
- `in_message` (boolean, opcional): Buscar nas mensagens (padrão: true)
- `in_code` (boolean, opcional): Buscar no código (pickaxe)

**Exemplos:**
```
Use a tool git_search_commits com query: "favicon"
Use a tool git_search_commits com query: "SEO" e in_message: true
Use a tool git_search_commits com query: "buildCommand" e in_code: true
```

#### `git_recent_changes`
Arquivos modificados recentemente no projeto.

**Parâmetros:**
- `days` (number, opcional): Dias a considerar (padrão: 7)
- `limit` (number, opcional): Número de arquivos (padrão: 20)

**Exemplos:**
```
Use a tool git_recent_changes
Use a tool git_recent_changes com days: 30
Use a tool git_recent_changes com days: 7 e limit: 50
```

---

## 📚 Casos de Uso

### Revisar trabalho do dia
```
1. git_status
2. git_log com since: "today"
3. git_diff com staged: true
```

### Analisar arquivo específico
```
1. git_file_history com file: "app/+html.tsx"
2. git_blame com file: "app/+html.tsx"
3. git_diff com file: "app/+html.tsx"
```

### Preparar release notes
```
1. git_log com since: "v1.0.0"
2. git_contributors com since: "v1.0.0"
3. git_stats com detailed: true
```

### Investigar bug
```
1. git_search_commits com query: "fix: bug description"
2. git_show com commit: "hash-do-commit"
3. git_diff com source: "hash-antes" e target: "hash-depois"
```

### Revisar PR
```
1. git_branches com remote: true
2. git_diff com source: "main" e target: "feature-branch"
3. git_log com author: "developer-name"
```

---

## 🎯 Exemplos Práticos

### Ver últimos 10 commits do projeto
```
Use a tool git_log com limit: 10
```

### Ver o que mudou no último commit
```
Use a tool git_show com commit: "HEAD"
```

### Comparar branch atual com main
```
Use a tool git_diff com source: "main" e target: "HEAD"
```

### Ver quem modificou vercel.json
```
Use a tool git_blame com file: "vercel.json"
```

### Buscar commits sobre SEO
```
Use a tool git_search_commits com query: "SEO"
```

### Ver estatísticas do projeto
```
Use a tool git_stats com detailed: true
```

### Arquivos mais modificados esta semana
```
Use a tool git_recent_changes com days: 7
```

---

## 🚀 Desenvolvimento

### Estrutura do Projeto

```
mcp-git-rotamestre/
├── src/
│   └── index.js          # Servidor MCP principal
├── package.json          # Dependências
├── README.md            # Este arquivo
└── .gitignore           # Arquivos ignorados
```

### Adicionar Nova Tool

1. Adicione a definição em `ListToolsRequestSchema`:
```javascript
{
  name: 'nova_tool',
  description: 'Descrição da tool',
  inputSchema: {
    type: 'object',
    properties: {
      parametro: {
        type: 'string',
        description: 'Descrição do parâmetro'
      }
    },
    required: ['parametro']
  }
}
```

2. Implemente o handler em `CallToolRequestSchema`:
```javascript
case 'nova_tool': {
  const resultado = runGit(`comando ${args.parametro}`);
  result = `📋 Resultado:\n\n${resultado}`;
  break;
}
```

---

## 🔒 Segurança

- Este MCP apenas **lê** o repositório Git (read-only)
- Não executa comandos que modificam o histórico (commit, push, reset, etc)
- Todas as operações são locais (não fazem push/pull)

---

## 🐛 Troubleshooting

### Erro: "Git command failed"
**Causa:** Comando Git inválido ou repositório corrompido
**Solução:** Verifique se está em um repositório Git válido

### Erro: "Tool desconhecida"
**Causa:** Tentativa de usar tool que não existe
**Solução:** Consulte a lista de tools disponíveis neste README

### MCP não aparece no Claude Desktop
**Causa:** Configuração incorreta ou Claude não reiniciado
**Solução:**
1. Verifique o caminho no `claude_desktop_config.json`
2. Verifique se o arquivo tem sintaxe JSON válida
3. Reinicie o Claude Desktop completamente

### Output truncado
**Causa:** Buffer muito pequeno para comando com muita saída
**Solução:** Use parâmetros `limit` para reduzir a quantidade de dados

---

## 📖 Recursos

- **MCP Protocol:** https://modelcontextprotocol.io/
- **Git Documentation:** https://git-scm.com/doc
- **Claude Desktop:** https://claude.ai/download

---

## 🤝 Contribuindo

Para adicionar novas funcionalidades:

1. Edite `src/index.js`
2. Adicione a tool em `ListToolsRequestSchema`
3. Implemente o handler em `CallToolRequestSchema`
4. Atualize este README com exemplos
5. Teste a funcionalidade

---

## 📝 Changelog

### v1.0.0 (2025-10-20)
- ✨ Implementação inicial
- 🔧 13 tools Git disponíveis
- 📚 Documentação completa
- ✅ Testado no Claude Desktop

---

**Autor:** Rota Mestre
**Licença:** MIT
**Data:** 2025-10-20
