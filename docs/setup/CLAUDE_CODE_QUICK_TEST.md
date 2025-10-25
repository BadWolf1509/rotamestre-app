# 🚀 Claude Code MCP - Guia Rápido de Teste

## ⚡ Teste Rápido (30 segundos)

### 1. Verificar MCPs
```bash
cd C:\Users\welli\rotamestre-app
claude mcp list
```

**Resultado esperado:**
```
Available MCP servers:
  • rotamestre
  • rotamestre-git
  • filesystem-rotamestre
```

---

### 2. Iniciar Claude Code
```bash
claude
```

Dentro do Claude Code:
```
> /mcp
```

**Resultado esperado:**
```
⎿ MCP Server Status ⎿
⎿ • rotamestre: connected ✅
⎿ • rotamestre-git: connected ✅
⎿ • filesystem-rotamestre: connected ✅
```

---

### 3. Testar Ferramentas

**Teste 1 - Git:**
```
mostre o status do git
```

**Teste 2 - Database:**
```
liste as unidades cadastradas no sistema
```

**Teste 3 - Filesystem:**
```
liste os arquivos da raiz do projeto
```

---

## 🐛 Se Algo Não Funcionar

### ❌ MCPs não aparecem?
```bash
# Ver conteúdo do .mcp.json
cat .mcp.json

# Deve ter caminhos como: C:\Users\welli\...
```

### ❌ "Cannot find module"?
```bash
# Instalar dependências
cd tools/mcp-server && npm install
cd ../mcp-git-rotamestre && npm install
```

### ❌ "Connection failed"?
```bash
# Testar servidor individualmente
claude mcp get rotamestre-git
```

---

## 📝 Instalar Configuração Global (Opcional)

Para usar MCPs em **qualquer projeto**:

```bash
# Método 1: Script automático
tools\scripts\setup\install-claude-code-mcp.bat

# Método 2: Manual
copy docs\setup\claude-code-global-config.json C:\Users\welli\.claude.json
```

---

## ✅ Validação Completa

Veja o documento completo com todos os testes:
📄 `docs/setup/CLAUDE_CODE_MCP_VALIDATION.md`

---

## 🆘 Ajuda

Se tudo falhar:
1. Verificar se Node.js está instalado: `node --version`
2. Verificar se Claude Code está atualizado: `claude --version`
3. Ver logs detalhados: `claude --verbose`
4. Consultar documentação: `docs/setup/CLAUDE_CODE_MCP_VALIDATION.md`

---

**Duração do teste:** ~30 segundos  
**Última atualização:** 2025-10-25
