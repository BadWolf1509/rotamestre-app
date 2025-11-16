#!/usr/bin/env node

/**
 * Script para gerar relatório de cobertura e identificar prioridades
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('📊 Gerando relatório de cobertura...\n');

// Executar testes com cobertura
try {
  execSync('npm test -- --coverage --coverageReporters=json-summary --silent', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
} catch (error) {
  console.log('\n⚠️  Alguns testes falharam, mas continuando com o relatório...\n');
}

// Ler dados de cobertura
const coveragePath = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');

if (!fs.existsSync(coveragePath)) {
  console.error('❌ Arquivo de cobertura não encontrado!');
  process.exit(1);
}

const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));

// Analisar cobertura
const files = Object.entries(coverage)
  .filter(([file]) => file !== 'total')
  .map(([file, data]) => ({
    file: file.replace(process.cwd() + path.sep, ''),
    statements: data.statements.pct,
    branches: data.branches.pct,
    functions: data.functions.pct,
    lines: data.lines.pct,
    avg: (data.statements.pct + data.branches.pct + data.functions.pct + data.lines.pct) / 4
  }))
  .sort((a, b) => a.avg - b.avg);

// Classificar arquivos
const noCoverage = files.filter(f => f.avg === 0);
const lowCoverage = files.filter(f => f.avg > 0 && f.avg < 30);
const mediumCoverage = files.filter(f => f.avg >= 30 && f.avg < 70);
const goodCoverage = files.filter(f => f.avg >= 70);

const total = coverage.total;

console.log('═'.repeat(80));
console.log('📈 RESUMO DE COBERTURA');
console.log('═'.repeat(80));
console.log(`
Statements: ${total.statements.pct}%
Branches:   ${total.branches.pct}%
Functions:  ${total.functions.pct}%
Lines:      ${total.lines.pct}%
`);

console.log('═'.repeat(80));
console.log('🔴 ARQUIVOS SEM COBERTURA (0%) - ' + noCoverage.length + ' arquivos');
console.log('═'.repeat(80));

// Identificar arquivos críticos sem cobertura (normalizar paths para funcionar no Windows)
const criticalFiles = noCoverage.filter(f => {
  const normalizedFile = f.file.replace(/\\/g, '/');
  return normalizedFile.includes('/lib/') ||
    normalizedFile.includes('/services/') ||
    normalizedFile.includes('/context/') ||
    (normalizedFile.includes('/hooks/') && !normalizedFile.includes('/__tests__/'));
});

if (criticalFiles.length > 0) {
  console.log('\n🚨 CRÍTICOS (lib, services, context, hooks):');
  criticalFiles.slice(0, 15).forEach(f => {
    console.log(`  - ${f.file}`);
  });
}

const componentFiles = noCoverage.filter(f => {
  const normalizedFile = f.file.replace(/\\/g, '/');
  return normalizedFile.includes('/components/') &&
    !normalizedFile.includes('/__tests__/') &&
    !normalizedFile.includes('/desktop/') &&
    !normalizedFile.includes('/mobile/');
});

if (componentFiles.length > 0) {
  console.log('\n⚠️  COMPONENTES IMPORTANTES:');
  componentFiles.slice(0, 10).forEach(f => {
    console.log(`  - ${f.file}`);
  });
}

console.log('\n═'.repeat(80));
console.log('🟡 COBERTURA PARCIAL (30-70%) - ' + mediumCoverage.length + ' arquivos');
console.log('═'.repeat(80));

if (mediumCoverage.length > 0) {
  mediumCoverage.slice(0, 10).forEach(f => {
    console.log(`  - ${f.file} - ${f.avg.toFixed(1)}%`);
  });
}

console.log('\n═'.repeat(80));
console.log('✅ BOA COBERTURA (>70%) - ' + goodCoverage.length + ' arquivos');
console.log('═'.repeat(80));

if (goodCoverage.length > 0) {
  goodCoverage.slice(-10).forEach(f => {
    console.log(`  - ${f.file} - ${f.avg.toFixed(1)}%`);
  });
}

console.log('\n═'.repeat(80));
console.log('📋 PRIORIDADES SUGERIDAS');
console.log('═'.repeat(80));

console.log('\n1. Quick Wins (arquivos parcialmente cobertos):');
const quickWins = mediumCoverage
  .filter(f => {
    const normalizedFile = f.file.replace(/\\/g, '/');
    return f.avg >= 40 && (
      normalizedFile.includes('/lib/') ||
      normalizedFile.includes('/hooks/') ||
      normalizedFile.includes('/utils/')
    );
  })
  .slice(0, 5);

quickWins.forEach((f, i) => {
  console.log(`   ${i + 1}. ${f.file} (${f.avg.toFixed(1)}% → meta: 80%)`);
});

console.log('\n2. Arquivos Críticos (lógica de negócio):');
const criticalPriorities = criticalFiles
  .slice(0, 5);

criticalPriorities.forEach((f, i) => {
  console.log(`   ${i + 1}. ${f.file} (0% → meta: 50%)`);
});

console.log('\n3. Componentes Principais:');
const componentPriorities = componentFiles
  .filter(f => {
    const normalizedFile = f.file.replace(/\\/g, '/');
    return normalizedFile.includes('Mapa') ||
      normalizedFile.includes('Navigation') ||
      normalizedFile.includes('Optimiz');
  })
  .slice(0, 5);

componentPriorities.forEach((f, i) => {
  console.log(`   ${i + 1}. ${f.file} (0% → meta: 40%)`);
});

console.log('\n═'.repeat(80));
console.log('💡 PRÓXIMOS PASSOS');
console.log('═'.repeat(80));
console.log(`
1. Revisar o plano completo em: .github/COVERAGE_IMPROVEMENT_PLAN.md
2. Começar pelos Quick Wins para ganho rápido de cobertura
3. Usar este script para acompanhar progresso: npm run coverage-report
4. Atualizar thresholds em jest.config.js conforme progresso

Meta Atual: ${total.lines.pct}%
Meta Fase 1 (1 semana): 40%
Meta Fase 2 (1 mês): 60%
Meta Final: 70-80%
`);

console.log('═'.repeat(80));
