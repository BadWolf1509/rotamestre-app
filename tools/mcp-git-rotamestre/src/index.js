#!/usr/bin/env node

/**
 * MCP Git Server para Rotamestre
 * Fornece ferramentas para interagir com o repositório Git do projeto
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Diretório raiz do projeto (3 níveis acima: src -> mcp-git-rotamestre -> tools -> root)
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

/**
 * Executa comando Git
 * @param {string} command - Comando git sem o prefixo 'git'
 * @returns {string} - Output do comando
 */
function runGit(command) {
  try {
    return execSync(`git ${command}`, {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    }).trim();
  } catch (error) {
    throw new Error(`Git command failed: ${error.message}`);
  }
}

// Criar servidor MCP
const server = new Server(
  {
    name: 'mcp-git-rotamestre',
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
        name: 'git_status',
        description: 'Mostra o status atual do repositório Git (arquivos modificados, staged, untracked)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'git_log',
        description: 'Mostra o histórico de commits',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Número máximo de commits a exibir (padrão: 20)',
            },
            author: {
              type: 'string',
              description: 'Filtrar commits por autor (opcional)',
            },
            since: {
              type: 'string',
              description: 'Mostrar commits desde data/período (ex: "2024-01-01", "1 week ago")',
            },
            file: {
              type: 'string',
              description: 'Mostrar apenas commits que modificaram este arquivo',
            },
          },
        },
      },
      {
        name: 'git_show',
        description: 'Mostra detalhes completos de um commit específico',
        inputSchema: {
          type: 'object',
          properties: {
            commit: {
              type: 'string',
              description: 'Hash do commit (pode ser hash parcial, HEAD, HEAD~1, etc)',
            },
          },
          required: ['commit'],
        },
      },
      {
        name: 'git_diff',
        description: 'Mostra diferenças entre commits, branches ou working directory',
        inputSchema: {
          type: 'object',
          properties: {
            target: {
              type: 'string',
              description: 'Commit/branch para comparar (opcional, padrão: working directory vs HEAD)',
            },
            source: {
              type: 'string',
              description: 'Commit/branch base (opcional, padrão: HEAD)',
            },
            file: {
              type: 'string',
              description: 'Arquivo específico para ver diff (opcional)',
            },
            staged: {
              type: 'boolean',
              description: 'Mostrar apenas mudanças staged (git diff --cached)',
            },
          },
        },
      },
      {
        name: 'git_branches',
        description: 'Lista todas as branches (local e remoto)',
        inputSchema: {
          type: 'object',
          properties: {
            remote: {
              type: 'boolean',
              description: 'Incluir branches remotas (padrão: false)',
            },
          },
        },
      },
      {
        name: 'git_blame',
        description: 'Mostra quem modificou cada linha de um arquivo',
        inputSchema: {
          type: 'object',
          properties: {
            file: {
              type: 'string',
              description: 'Caminho do arquivo',
            },
            lines: {
              type: 'string',
              description: 'Range de linhas (ex: "10,20" para linhas 10-20)',
            },
          },
          required: ['file'],
        },
      },
      {
        name: 'git_contributors',
        description: 'Lista todos os contribuidores do projeto com estatísticas',
        inputSchema: {
          type: 'object',
          properties: {
            since: {
              type: 'string',
              description: 'Contar commits desde data/período (ex: "2024-01-01", "1 month ago")',
            },
          },
        },
      },
      {
        name: 'git_file_history',
        description: 'Mostra o histórico completo de modificações de um arquivo',
        inputSchema: {
          type: 'object',
          properties: {
            file: {
              type: 'string',
              description: 'Caminho do arquivo',
            },
            limit: {
              type: 'number',
              description: 'Número máximo de commits (padrão: 50)',
            },
          },
          required: ['file'],
        },
      },
      {
        name: 'git_search_commits',
        description: 'Busca commits por mensagem ou conteúdo',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Termo de busca',
            },
            in_message: {
              type: 'boolean',
              description: 'Buscar nas mensagens de commit (padrão: true)',
            },
            in_code: {
              type: 'boolean',
              description: 'Buscar no código (pickaxe search)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'git_stats',
        description: 'Estatísticas gerais do repositório',
        inputSchema: {
          type: 'object',
          properties: {
            detailed: {
              type: 'boolean',
              description: 'Incluir estatísticas detalhadas por arquivo (padrão: false)',
            },
          },
        },
      },
      {
        name: 'git_recent_changes',
        description: 'Arquivos modificados recentemente no projeto',
        inputSchema: {
          type: 'object',
          properties: {
            days: {
              type: 'number',
              description: 'Número de dias a considerar (padrão: 7)',
            },
            limit: {
              type: 'number',
              description: 'Número máximo de arquivos (padrão: 20)',
            },
          },
        },
      },
      {
        name: 'git_tag_list',
        description: 'Lista todas as tags do repositório',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Filtrar tags por padrão (ex: "v1.*")',
            },
          },
        },
      },
      {
        name: 'git_current_branch',
        description: 'Mostra a branch atual',
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
    let result;

    switch (name) {
      case 'git_status': {
        const status = runGit('status --porcelain -b');
        const statusLong = runGit('status');

        result = `📊 Status do Repositório\n\n${statusLong}\n\n📋 Resumo:\n${status || 'Working tree clean'}`;
        break;
      }

      case 'git_log': {
        const limit = args.limit || 20;
        let command = `log --oneline --decorate --graph -n ${limit}`;

        if (args.author) {
          command += ` --author="${args.author}"`;
        }

        if (args.since) {
          command += ` --since="${args.since}"`;
        }

        if (args.file) {
          command += ` -- "${args.file}"`;
        }

        const log = runGit(command);
        const detailedLog = runGit(command.replace('--oneline --decorate --graph', '--format="%h | %an | %ar | %s"'));

        result = `📜 Histórico de Commits (últimos ${limit})\n\n${log}\n\n📊 Detalhado:\n${detailedLog}`;
        break;
      }

      case 'git_show': {
        const commit = args.commit || 'HEAD';
        const show = runGit(`show ${commit} --stat`);

        result = `🔍 Detalhes do Commit: ${commit}\n\n${show}`;
        break;
      }

      case 'git_diff': {
        let command = 'diff';

        if (args.staged) {
          command += ' --cached';
        }

        if (args.source && args.target) {
          command += ` ${args.source}..${args.target}`;
        } else if (args.target) {
          command += ` ${args.target}`;
        }

        if (args.file) {
          command += ` -- "${args.file}"`;
        }

        const diff = runGit(command);

        if (!diff) {
          result = '✅ Nenhuma diferença encontrada';
        } else {
          const statCommand = command.replace('diff', 'diff --stat');
          const stat = runGit(statCommand);
          result = `📝 Diferenças\n\n📊 Resumo:\n${stat}\n\n🔍 Detalhes:\n${diff}`;
        }
        break;
      }

      case 'git_branches': {
        const local = runGit('branch -v');
        let result_text = `🌿 Branches Locais:\n\n${local}`;

        if (args.remote) {
          const remote = runGit('branch -r -v');
          result_text += `\n\n🌍 Branches Remotas:\n\n${remote}`;
        }

        result = result_text;
        break;
      }

      case 'git_blame': {
        let command = `blame "${args.file}"`;

        if (args.lines) {
          command += ` -L ${args.lines}`;
        }

        const blame = runGit(command);
        result = `👤 Autoria: ${args.file}\n\n${blame}`;
        break;
      }

      case 'git_contributors': {
        let command = 'shortlog -sn --all';

        if (args.since) {
          command += ` --since="${args.since}"`;
        }

        const contributors = runGit(command);
        const total = runGit(`rev-list --count --all ${args.since ? `--since="${args.since}"` : ''}`);

        result = `👥 Contribuidores do Projeto\n\n📊 Total de commits: ${total}\n\n${contributors}`;
        break;
      }

      case 'git_file_history': {
        const limit = args.limit || 50;
        const history = runGit(`log --follow --oneline -n ${limit} -- "${args.file}"`);

        if (!history) {
          result = `⚠️ Arquivo não encontrado ou sem histórico: ${args.file}`;
        } else {
          result = `📁 Histórico: ${args.file}\n\n${history}`;
        }
        break;
      }

      case 'git_search_commits': {
        const inMessage = args.in_message !== false;
        let results = [];

        if (inMessage) {
          try {
            const search = runGit(`log --grep="${args.query}" --oneline --all`);
            if (search) {
              results.push(`📝 Encontrado nas mensagens:\n${search}`);
            }
          } catch (e) {
            // Nenhum resultado
          }
        }

        if (args.in_code) {
          try {
            const pickaxe = runGit(`log -S"${args.query}" --oneline --all`);
            if (pickaxe) {
              results.push(`💻 Encontrado no código:\n${pickaxe}`);
            }
          } catch (e) {
            // Nenhum resultado
          }
        }

        result = results.length > 0
          ? `🔎 Resultados da busca: "${args.query}"\n\n${results.join('\n\n')}`
          : `❌ Nenhum resultado encontrado para: "${args.query}"`;
        break;
      }

      case 'git_stats': {
        const commits = runGit('rev-list --count --all');
        const branches = runGit('branch -a | wc -l');
        const contributors = runGit('shortlog -sn --all | wc -l');
        const firstCommit = runGit('log --reverse --oneline | head -1');
        const lastCommit = runGit('log -1 --oneline');

        let stats = `📊 Estatísticas do Repositório\n\n`;
        stats += `📦 Total de commits: ${commits}\n`;
        stats += `🌿 Total de branches: ${branches.trim()}\n`;
        stats += `👥 Contribuidores: ${contributors.trim()}\n`;
        stats += `🎬 Primeiro commit: ${firstCommit}\n`;
        stats += `🎯 Último commit: ${lastCommit}\n`;

        if (args.detailed) {
          const fileStats = runGit('log --pretty=format: --name-only | sort | uniq -c | sort -rg | head -20');
          stats += `\n📁 Arquivos mais modificados:\n${fileStats}`;
        }

        result = stats;
        break;
      }

      case 'git_recent_changes': {
        const days = args.days || 7;
        const limit = args.limit || 20;

        const files = runGit(`log --since="${days} days ago" --name-only --pretty=format: | sort | uniq -c | sort -rg | head -${limit}`);

        result = `🕐 Arquivos modificados nos últimos ${days} dias\n\n${files}`;
        break;
      }

      case 'git_tag_list': {
        let command = 'tag -l';

        if (args.pattern) {
          command += ` "${args.pattern}"`;
        }

        command += ' --sort=-v:refname';

        const tags = runGit(command);

        if (!tags) {
          result = '🏷️ Nenhuma tag encontrada';
        } else {
          const count = tags.split('\n').length;
          result = `🏷️ Tags do Projeto (${count} encontradas)\n\n${tags}`;
        }
        break;
      }

      case 'git_current_branch': {
        const branch = runGit('branch --show-current');
        const upstream = runGit('rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "sem upstream"');
        const status = runGit('status -sb');

        result = `🌿 Branch Atual: ${branch}\n📡 Upstream: ${upstream}\n\n${status}`;
        break;
      }

      default:
        throw new Error(`Tool desconhecida: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Erro ao executar ${name}:\n${error.message}`,
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
  console.error('🚀 MCP Git Rotamestre Server rodando em stdio');
  console.error(`📁 Diretório do projeto: ${PROJECT_ROOT}`);
}

main().catch((error) => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});
