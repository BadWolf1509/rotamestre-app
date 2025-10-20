#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERRO: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar definidos no .env');
  process.exit(1);
}

// Criar cliente Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Criar servidor MCP
const server = new Server(
  {
    name: 'mcp-rotamestre',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Listar todas as tools disponíveis
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'listar_unidades',
        description: 'Lista todas as unidades cadastradas no sistema',
        inputSchema: {
          type: 'object',
          properties: {
            ativa: {
              type: 'boolean',
              description: 'Filtrar apenas unidades ativas (opcional)',
            },
          },
        },
      },
      {
        name: 'listar_usuarios',
        description: 'Lista usuários do sistema (gestores e motoristas)',
        inputSchema: {
          type: 'object',
          properties: {
            papel: {
              type: 'string',
              enum: ['gestor', 'motorista'],
              description: 'Filtrar por papel (opcional)',
            },
            unidade_id: {
              type: 'string',
              description: 'Filtrar por unidade (UUID, opcional)',
            },
          },
        },
      },
      {
        name: 'listar_rotas',
        description: 'Lista rotas com filtros opcionais',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['pendente', 'em_andamento', 'concluida', 'cancelada'],
              description: 'Filtrar por status (opcional)',
            },
            motorista_id: {
              type: 'string',
              description: 'Filtrar por motorista (UUID, opcional)',
            },
            unidade_id: {
              type: 'string',
              description: 'Filtrar por unidade (UUID, opcional)',
            },
            data: {
              type: 'string',
              description: 'Filtrar por data (YYYY-MM-DD, opcional)',
            },
            limit: {
              type: 'number',
              description: 'Limite de resultados (padrão: 50)',
            },
          },
        },
      },
      {
        name: 'obter_rota_detalhada',
        description: 'Obtém detalhes completos de uma rota específica, incluindo paradas',
        inputSchema: {
          type: 'object',
          properties: {
            rota_id: {
              type: 'string',
              description: 'ID da rota (UUID)',
            },
          },
          required: ['rota_id'],
        },
      },
      {
        name: 'listar_paradas',
        description: 'Lista paradas de uma rota específica',
        inputSchema: {
          type: 'object',
          properties: {
            rota_id: {
              type: 'string',
              description: 'ID da rota (UUID)',
            },
          },
          required: ['rota_id'],
        },
      },
      {
        name: 'estatisticas_rota',
        description: 'Obtém estatísticas de uma rota (paradas concluídas, pendentes, progresso)',
        inputSchema: {
          type: 'object',
          properties: {
            rota_id: {
              type: 'string',
              description: 'ID da rota (UUID)',
            },
          },
          required: ['rota_id'],
        },
      },
      {
        name: 'rotas_ativas_motorista',
        description: 'Lista rotas ativas de um motorista específico',
        inputSchema: {
          type: 'object',
          properties: {
            motorista_id: {
              type: 'string',
              description: 'ID do motorista (UUID)',
            },
          },
          required: ['motorista_id'],
        },
      },
      {
        name: 'criar_unidade',
        description: 'Cria uma nova unidade no sistema',
        inputSchema: {
          type: 'object',
          properties: {
            nome: {
              type: 'string',
              description: 'Nome da unidade',
            },
            cidade: {
              type: 'string',
              description: 'Cidade da unidade',
            },
            cnpj: {
              type: 'string',
              description: 'CNPJ da unidade (formato: 12.345.678/0001-90)',
            },
            endereco: {
              type: 'string',
              description: 'Endereço completo (opcional)',
            },
            telefone: {
              type: 'string',
              description: 'Telefone (opcional)',
            },
            email: {
              type: 'string',
              description: 'Email (opcional)',
            },
          },
          required: ['nome', 'cidade', 'cnpj'],
        },
      },
      {
        name: 'criar_rota',
        description: 'Cria uma nova rota',
        inputSchema: {
          type: 'object',
          properties: {
            unidade_id: {
              type: 'string',
              description: 'ID da unidade (UUID)',
            },
            motorista_id: {
              type: 'string',
              description: 'ID do motorista (UUID, opcional)',
            },
            data: {
              type: 'string',
              description: 'Data da rota (YYYY-MM-DD, opcional - padrão: hoje)',
            },
            observacoes: {
              type: 'string',
              description: 'Observações sobre a rota (opcional)',
            },
          },
          required: ['unidade_id'],
        },
      },
      {
        name: 'adicionar_parada',
        description: 'Adiciona uma parada a uma rota',
        inputSchema: {
          type: 'object',
          properties: {
            rota_id: {
              type: 'string',
              description: 'ID da rota (UUID)',
            },
            tipo: {
              type: 'string',
              enum: ['entrega', 'retirada'],
              description: 'Tipo da parada',
            },
            endereco: {
              type: 'string',
              description: 'Endereço da parada',
            },
            latitude: {
              type: 'number',
              description: 'Latitude',
            },
            longitude: {
              type: 'number',
              description: 'Longitude',
            },
            ordem: {
              type: 'number',
              description: 'Ordem da parada na rota',
            },
            destinatario: {
              type: 'string',
              description: 'Nome do destinatário (opcional)',
            },
            telefone: {
              type: 'string',
              description: 'Telefone de contato (opcional)',
            },
            observacoes: {
              type: 'string',
              description: 'Observações (opcional)',
            },
          },
          required: ['rota_id', 'tipo', 'endereco', 'latitude', 'longitude', 'ordem'],
        },
      },
      {
        name: 'atualizar_status_rota',
        description: 'Atualiza o status de uma rota',
        inputSchema: {
          type: 'object',
          properties: {
            rota_id: {
              type: 'string',
              description: 'ID da rota (UUID)',
            },
            status: {
              type: 'string',
              enum: ['pendente', 'em_andamento', 'concluida', 'cancelada'],
              description: 'Novo status da rota',
            },
          },
          required: ['rota_id', 'status'],
        },
      },
      {
        name: 'atualizar_status_parada',
        description: 'Atualiza o status de uma parada',
        inputSchema: {
          type: 'object',
          properties: {
            parada_id: {
              type: 'string',
              description: 'ID da parada (UUID)',
            },
            status: {
              type: 'string',
              enum: ['pendente', 'concluida', 'pulada'],
              description: 'Novo status da parada',
            },
          },
          required: ['parada_id', 'status'],
        },
      },
      {
        name: 'listar_logs',
        description: 'Lista logs do sistema com filtros opcionais',
        inputSchema: {
          type: 'object',
          properties: {
            rota_id: {
              type: 'string',
              description: 'Filtrar por rota (UUID, opcional)',
            },
            usuario_id: {
              type: 'string',
              description: 'Filtrar por usuário (UUID, opcional)',
            },
            evento: {
              type: 'string',
              description: 'Filtrar por tipo de evento (opcional)',
            },
            limit: {
              type: 'number',
              description: 'Limite de resultados (padrão: 50)',
            },
          },
        },
      },
      {
        name: 'view_rotas_resumo',
        description: 'Retorna a view vw_rotas_resumo com resumo das rotas',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Limite de resultados (padrão: 50)',
            },
          },
        },
      },
      {
        name: 'view_performance_motoristas',
        description: 'Retorna a view vw_performance_motoristas com KPIs dos motoristas',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handler para executar as tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'listar_unidades': {
        let query = supabase.from('unidades').select('*');

        if (args.ativa !== undefined) {
          query = query.eq('ativa', args.ativa);
        }

        const { data, error } = await query.order('nome');

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'listar_usuarios': {
        let query = supabase.from('usuarios').select('*, unidades(nome, cidade)');

        if (args.papel) {
          query = query.eq('papel', args.papel);
        }

        if (args.unidade_id) {
          query = query.eq('unidade_id', args.unidade_id);
        }

        const { data, error } = await query.order('nome');

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'listar_rotas': {
        let query = supabase
          .from('rotas')
          .select('*, unidades(nome, cidade), usuarios(nome, email)');

        if (args.status) {
          query = query.eq('status', args.status);
        }

        if (args.motorista_id) {
          query = query.eq('motorista_id', args.motorista_id);
        }

        if (args.unidade_id) {
          query = query.eq('unidade_id', args.unidade_id);
        }

        if (args.data) {
          query = query.eq('data', args.data);
        }

        const limit = args.limit || 50;
        query = query.order('data', { ascending: false }).limit(limit);

        const { data, error } = await query;

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'obter_rota_detalhada': {
        const { data: rota, error: rotaError } = await supabase
          .from('rotas')
          .select('*, unidades(nome, cidade), usuarios(nome, email)')
          .eq('id', args.rota_id)
          .single();

        if (rotaError) throw rotaError;

        const { data: paradas, error: paradasError } = await supabase
          .from('paradas')
          .select('*')
          .eq('rota_id', args.rota_id)
          .order('ordem');

        if (paradasError) throw paradasError;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ ...rota, paradas }, null, 2),
            },
          ],
        };
      }

      case 'listar_paradas': {
        const { data, error } = await supabase
          .from('paradas')
          .select('*')
          .eq('rota_id', args.rota_id)
          .order('ordem');

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'estatisticas_rota': {
        const { data, error } = await supabase.rpc('estatisticas_rota', {
          rota_uuid: args.rota_id,
        });

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'rotas_ativas_motorista': {
        const { data, error } = await supabase.rpc('rotas_ativas_motorista', {
          motorista_uuid: args.motorista_id,
        });

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'criar_unidade': {
        const { data, error } = await supabase
          .from('unidades')
          .insert({
            nome: args.nome,
            cidade: args.cidade,
            cnpj: args.cnpj,
            endereco: args.endereco,
            telefone: args.telefone,
            email: args.email,
          })
          .select()
          .single();

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: `Unidade criada com sucesso!\n\n${JSON.stringify(data, null, 2)}`,
            },
          ],
        };
      }

      case 'criar_rota': {
        const { data, error } = await supabase
          .from('rotas')
          .insert({
            unidade_id: args.unidade_id,
            motorista_id: args.motorista_id,
            data: args.data,
            observacoes: args.observacoes,
          })
          .select()
          .single();

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: `Rota criada com sucesso!\n\n${JSON.stringify(data, null, 2)}`,
            },
          ],
        };
      }

      case 'adicionar_parada': {
        const { data, error } = await supabase
          .from('paradas')
          .insert({
            rota_id: args.rota_id,
            tipo: args.tipo,
            endereco: args.endereco,
            latitude: args.latitude,
            longitude: args.longitude,
            ordem: args.ordem,
            destinatario: args.destinatario,
            telefone: args.telefone,
            observacoes: args.observacoes,
          })
          .select()
          .single();

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: `Parada adicionada com sucesso!\n\n${JSON.stringify(data, null, 2)}`,
            },
          ],
        };
      }

      case 'atualizar_status_rota': {
        const updateData = { status: args.status };

        if (args.status === 'em_andamento') {
          updateData.iniciada_em = new Date().toISOString();
        } else if (args.status === 'concluida') {
          updateData.concluida_em = new Date().toISOString();
        }

        const { data, error } = await supabase
          .from('rotas')
          .update(updateData)
          .eq('id', args.rota_id)
          .select()
          .single();

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: `Status da rota atualizado para '${args.status}'!\n\n${JSON.stringify(data, null, 2)}`,
            },
          ],
        };
      }

      case 'atualizar_status_parada': {
        const updateData = { status: args.status };

        if (args.status === 'concluida') {
          updateData.concluida_em = new Date().toISOString();
        }

        const { data, error } = await supabase
          .from('paradas')
          .update(updateData)
          .eq('id', args.parada_id)
          .select()
          .single();

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: `Status da parada atualizado para '${args.status}'!\n\n${JSON.stringify(data, null, 2)}`,
            },
          ],
        };
      }

      case 'listar_logs': {
        let query = supabase.from('logs').select('*');

        if (args.rota_id) {
          query = query.eq('rota_id', args.rota_id);
        }

        if (args.usuario_id) {
          query = query.eq('usuario_id', args.usuario_id);
        }

        if (args.evento) {
          query = query.eq('evento', args.evento);
        }

        const limit = args.limit || 50;
        query = query.order('timestamp', { ascending: false }).limit(limit);

        const { data, error } = await query;

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'view_rotas_resumo': {
        const limit = args.limit || 50;
        const { data, error } = await supabase
          .from('vw_rotas_resumo')
          .select('*')
          .limit(limit);

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'view_performance_motoristas': {
        const { data, error } = await supabase
          .from('vw_performance_motoristas')
          .select('*');

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Tool desconhecida: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Erro ao executar ${name}: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Iniciar servidor
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP RotaMestre Server rodando em stdio');
}

main().catch((error) => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
