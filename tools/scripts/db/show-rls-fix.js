#!/usr/bin/env node

/**
 * Script para exibir e facilitar a aplicação da correção RLS via Dashboard
 */

import { exec } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRef = 'xezslsyxjivunmhhyxtd';
const sqlEditorUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`;

async function showRLSFix() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║     Correção RLS - Aplicação via Dashboard    ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  // Ler SQL de correção
  const sqlPath = join(__dirname, '..', '..', '..', 'database', 'migrations', '20251020000000_fix_rls_recursion.sql');
  const sql = readFileSync(sqlPath, 'utf8');

  console.log('📄 SQL de Correção Carregado\n');
  console.log(`   Arquivo: database/migrations/20251020000000_fix_rls_recursion.sql`);
  console.log(`   Tamanho: ${sql.length} caracteres`);
  console.log(`   Linhas: ${sql.split('\n').length}\n`);

  console.log('╔════════════════════════════════════════════════╗');
  console.log('║            📋 INSTRUÇÕES                       ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  console.log('1️⃣  ABRIR SQL EDITOR\n');
  console.log(`   ${sqlEditorUrl}\n`);
  console.log('   Seu navegador será aberto automaticamente em 3 segundos...\n');

  console.log('2️⃣  COPIAR O SQL\n');
  console.log('   O arquivo SQL está em:');
  console.log(`   ${sqlPath}\n`);
  console.log('   Abra o arquivo e copie TODO o conteúdo (Ctrl+A, Ctrl+C)\n');

  console.log('3️⃣  COLAR E EXECUTAR\n');
  console.log('   - Cole o SQL no editor do Supabase (Ctrl+V)');
  console.log('   - Clique no botão "Run" (▶️) no canto superior direito');
  console.log('   - Aguarde a mensagem de sucesso\n');

  console.log('4️⃣  VERIFICAR RESULTADO\n');
  console.log('   Você deve ver mensagens de sucesso para:');
  console.log('   ✅ Políticas antigas removidas');
  console.log('   ✅ Funções helper criadas');
  console.log('   ✅ Novas políticas criadas\n');

  console.log('5️⃣  TESTAR LOGIN\n');
  console.log('   Após executar, teste o login em:');
  console.log('   https://app.rotamestre.tec.br/auth/login\n');
  console.log('   Use uma conta de gestor e uma de motorista da sua unidade.');
  console.log('   (Credenciais não ficam neste repositório — ele é público.)\n');

  console.log('╔════════════════════════════════════════════════╗');
  console.log('║         📊 RESUMO DAS ALTERAÇÕES              ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  console.log('❌ Serão REMOVIDAS (12 políticas recursivas):');
  console.log('   - 3 políticas problemáticas em usuarios');
  console.log('   - 2 políticas problemáticas em unidades');
  console.log('   - 6 políticas problemáticas em rotas');
  console.log('   - 1 política problemática em paradas\n');

  console.log('✅ Serão CRIADAS (13 itens):');
  console.log('   - 2 funções helper seguras');
  console.log('   - 5 políticas seguras para usuarios');
  console.log('   - 1 política segura para unidades');
  console.log('   - 6 políticas seguras para rotas\n');

  console.log('═══════════════════════════════════════════════\n');

  // Aguardar 3 segundos e abrir navegador
  console.log('⏳ Abrindo navegador em 3 segundos...\n');

  setTimeout(() => {
    // Abrir navegador (funciona no Windows)
    exec(`start ${sqlEditorUrl}`, (error) => {
      if (error) {
        console.log('⚠️  Não foi possível abrir o navegador automaticamente.');
        console.log(`   Acesse manualmente: ${sqlEditorUrl}\n`);
      } else {
        console.log('✅ Navegador aberto!\n');
      }

      console.log('📁 Abrir arquivo SQL com:');
      console.log(`   code "${sqlPath}"`);
      console.log('   ou');
      console.log(`   notepad "${sqlPath}"\n`);

      console.log('══════════════════════════════════════════════════');
      console.log('Aguardando você aplicar a correção...');
      console.log('Pressione Ctrl+C para sair quando terminar.');
      console.log('══════════════════════════════════════════════════\n');
    });
  }, 3000);
}

showRLSFix();
