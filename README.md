# RotaMestre App

<p align="center">
  <img src="assets/logo/rotamestre-logo-horizontal.png" alt="RotaMestre Logo" width="400">
</p>

<p align="center">
  <strong>Entregas e retiradas na ordem certa — sempre.</strong>
</p>

Sistema mobile de gestão de rotas e entregas com otimização inteligente.

## Tecnologias

- **React Native** com **Expo**
- **Expo Router** para navegação
- **TypeScript**
- **Supabase** para backend e autenticação
- **Google Maps API** para geocoding e otimização de rotas

## Estrutura do Projeto

```
rotamestre-app/
├── app/                              # Estrutura do Expo Router
│   ├── (auth)/                       # Fluxo de autenticação
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   │
│   ├── (gestor)/                     # Telas do gestor de unidade
│   │   ├── dashboard.tsx
│   │   ├── nova-entrega.tsx
│   │   ├── historico.tsx
│   │   └── motoristas.tsx
│   │
│   ├── (motorista)/                  # Telas do motorista
│   │   ├── rota.tsx
│   │   ├── checkpoints.tsx
│   │   ├── historico.tsx
│   │   └── resumo.tsx
│   │
│   ├── index.tsx                     # Tela inicial
│   └── _layout.tsx                   # Layout raiz
│
├── components/                       # Componentes reutilizáveis
├── lib/                              # Integrações e SDKs
│   ├── google.ts                     # Google Maps API
│   ├── supabase.ts                   # Supabase client
│   └── auth.ts                       # Autenticação
│
├── types/                            # Tipos TypeScript
│   ├── rota.ts
│   ├── endereco.ts
│   ├── usuario.ts
│   └── unidade.ts
│
├── assets/                           # Recursos visuais
│   ├── logo/                         # Logotipos
│   ├── icon/                         # Ícones do app
│   ├── splash/                       # Splash screens
│   └── mockups/                      # Mockups e promoção
│
├── database/                         # Schema do banco de dados
│   └── schema.sql                    # Schema Supabase/PostgreSQL
│
├── supabase/                         # Configuração Supabase
│   └── migrations/                   # Migrations do banco
│
└── mcp-rotamestre/                   # MCP Server para Supabase
    ├── src/
    │   └── index.js                  # Servidor MCP com 16 tools
    └── README.md                     # Documentação do MCP
```

## Configuração

1. Clone o repositório:
```bash
git clone https://github.com/BadWolf1509/rotamestre-app.git
cd rotamestre-app
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
Crie um arquivo `.env` baseado no `.env.example`:
```
EXPO_PUBLIC_SUPABASE_URL=sua_url_do_supabase
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_do_supabase
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=sua_chave_do_google_maps
```

4. Inicie o servidor de desenvolvimento:
```bash
npm start
```

## Funcionalidades

### Gestor de Unidade
- Dashboard com visão geral das rotas
- Criação de novas rotas de entrega/retirada
- Gestão de motoristas
- Histórico de rotas

### Motorista
- Visualização de rota otimizada
- Lista de checkpoints (entregas/retiradas)
- Marcação de conclusão de paradas
- Histórico de rotas realizadas
- Resumo de distância e tempo

## Scripts Disponíveis

- `npm start` - Inicia o servidor de desenvolvimento
- `npm run android` - Roda no emulador Android
- `npm run ios` - Roda no emulador iOS (apenas macOS)
- `npm run web` - Roda no navegador

## Banco de Dados

O projeto utiliza Supabase (PostgreSQL) com schema completo incluindo:

- **5 Tabelas**: unidades, usuarios, rotas, paradas, logs
- **Triggers Automáticos**: Atualização de timestamps e logging de eventos
- **Funções Úteis**: Cálculo de distâncias (Haversine), estatísticas de rotas
- **2 Views**: Resumo de rotas e performance de motoristas

Para mais detalhes, veja [database/schema.sql](database/schema.sql) ou [supabase/migrations/](supabase/migrations/).

## MCP Server

O projeto inclui um servidor MCP (Model Context Protocol) para interagir com o banco de dados Supabase via Claude Desktop.

**16 ferramentas disponíveis:**
- Consultas: listar_unidades, listar_usuarios, listar_rotas, etc.
- Criação: criar_unidade, criar_rota, adicionar_parada
- Atualizações: atualizar_status_rota, atualizar_status_parada
- Views e funções do banco de dados

Para configurar, veja [mcp-rotamestre/README.md](mcp-rotamestre/README.md).

## Assets e Identidade Visual

Todos os recursos visuais estão em [assets/](assets/):
- Logos e ícones
- Splash screens
- Mockups e materiais promocionais

Veja [assets/README.md](assets/README.md) para diretrizes de uso.

## Licença

MIT
