# MCP RotaMestre

Servidor MCP (Model Context Protocol) para interagir com o banco de dados Supabase do RotaMestre.

## Instalação

1. Instale as dependências:

```bash
cd mcp-rotamestre
npm install
```

2. Configure as variáveis de ambiente:

Copie o arquivo `.env.example` para `.env` e preencha com suas credenciais do Supabase:

```bash
cp .env.example .env
```

Edite o arquivo `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=seu-service-role-key-aqui
```

> **Importante:** Você encontra o Service Role Key no Dashboard do Supabase em:
> Settings → API → Project API keys → service_role (secret)

## Configuração no Claude Desktop

Adicione ao arquivo de configuração do Claude Desktop (`claude_desktop_config.json`):

### Windows
Arquivo: `%APPDATA%\Claude\claude_desktop_config.json`

### macOS
Arquivo: `~/Library/Application Support/Claude/claude_desktop_config.json`

### Configuração

```json
{
  "mcpServers": {
    "rotamestre": {
      "command": "node",
      "args": [
        "C:\\Users\\welli\\rotamestre-app\\mcp-rotamestre\\src\\index.js"
      ],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "seu-service-role-key-aqui"
      }
    }
  }
}
```

Após configurar, reinicie o Claude Desktop.

## Tools Disponíveis

### Consultas

- **listar_unidades** - Lista todas as unidades
- **listar_usuarios** - Lista usuários (gestores/motoristas)
- **listar_rotas** - Lista rotas com filtros
- **obter_rota_detalhada** - Detalhes completos de uma rota
- **listar_paradas** - Lista paradas de uma rota
- **listar_logs** - Lista logs do sistema

### Funções do Banco

- **estatisticas_rota** - Estatísticas de progresso de uma rota
- **rotas_ativas_motorista** - Rotas ativas de um motorista

### Views

- **view_rotas_resumo** - Resumo de rotas (dashboard)
- **view_performance_motoristas** - KPIs de motoristas

### Criação

- **criar_unidade** - Cria nova unidade
- **criar_rota** - Cria nova rota
- **adicionar_parada** - Adiciona parada a uma rota

### Atualizações

- **atualizar_status_rota** - Atualiza status da rota
- **atualizar_status_parada** - Atualiza status de parada

## Exemplos de Uso

### Listar unidades ativas

```
Use a tool listar_unidades com ativa: true
```

### Obter detalhes de uma rota

```
Use a tool obter_rota_detalhada com rota_id: "uuid-da-rota"
```

### Criar uma nova unidade

```
Use a tool criar_unidade com:
- nome: "Unidade São Paulo"
- cidade: "São Paulo"
- cnpj: "12.345.678/0001-90"
```

### Ver performance dos motoristas

```
Use a tool view_performance_motoristas
```

## Desenvolvimento

Para rodar em modo de desenvolvimento:

```bash
npm start
```

## Estrutura do Projeto

```
mcp-rotamestre/
├── src/
│   └── index.js          # Servidor MCP principal
├── .env                  # Credenciais (não versionar!)
├── .env.example          # Exemplo de credenciais
├── package.json          # Dependências
└── README.md            # Este arquivo
```

## Segurança

- **NUNCA** commite o arquivo `.env` com credenciais
- Use sempre o `SUPABASE_SERVICE_ROLE_KEY` (não a chave anon)
- O Service Role Key tem acesso total ao banco

## Suporte

Para problemas ou dúvidas, consulte a documentação:
- [Supabase Docs](https://supabase.com/docs)
- [MCP Protocol](https://modelcontextprotocol.io/)
