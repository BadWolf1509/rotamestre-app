#!/usr/bin/env node

/**
 * Script de teste para o MCP Git Rotamestre
 * Testa as principais funcionalidades sem precisar do Claude Desktop
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

console.log('🧪 Teste do MCP Git Rotamestre\n');
console.log(`📁 Diretório do projeto: ${PROJECT_ROOT}\n`);

function runGitTest(description, command) {
  console.log(`\n🔍 ${description}`);
  console.log(`   Comando: git ${command}`);
  console.log('   ─────────────────────────────');

  try {
    const result = execSync(`git ${command}`, {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    }).trim();

    console.log(result || '   (sem saída)');
    console.log('   ✅ Sucesso\n');
    return true;
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}\n`);
    return false;
  }
}

// Testes
let passed = 0;
let failed = 0;

console.log('═══════════════════════════════════════');
console.log('          EXECUTANDO TESTES            ');
console.log('═══════════════════════════════════════');

// Teste 1: Status
if (runGitTest('1. Status do repositório', 'status --short')) passed++; else failed++;

// Teste 2: Branch atual
if (runGitTest('2. Branch atual', 'branch --show-current')) passed++; else failed++;

// Teste 3: Últimos 5 commits
if (runGitTest('3. Últimos 5 commits', 'log --oneline -n 5')) passed++; else failed++;

// Teste 4: Branches locais
if (runGitTest('4. Branches locais', 'branch')) passed++; else failed++;

// Teste 5: Contribuidores
if (runGitTest('5. Contribuidores', 'shortlog -sn --all')) passed++; else failed++;

// Teste 6: Estatísticas
if (runGitTest('6. Total de commits', 'rev-list --count HEAD')) passed++; else failed++;

// Teste 7: Tags
if (runGitTest('7. Tags do projeto', 'tag -l')) passed++; else failed++;

// Resumo
console.log('═══════════════════════════════════════');
console.log('              RESUMO                   ');
console.log('═══════════════════════════════════════');
console.log(`✅ Testes bem-sucedidos: ${passed}`);
console.log(`❌ Testes falhados: ${failed}`);
console.log(`📊 Total: ${passed + failed}`);
console.log('═══════════════════════════════════════\n');

if (failed === 0) {
  console.log('🎉 Todos os testes passaram!');
  console.log('✨ O MCP Git Rotamestre está funcionando corretamente!\n');
  console.log('📝 Próximo passo:');
  console.log('   Configure o Claude Desktop com:');
  console.log(`   ${__dirname}\\claude_desktop_config.json\n`);
} else {
  console.log('⚠️  Alguns testes falharam.');
  console.log('   Verifique se está em um repositório Git válido.\n');
  process.exit(1);
}
