#!/usr/bin/env node

/**
 * Script de verificação de setup de CI/CD
 * Valida que todos os arquivos e configurações necessários estão presentes
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_FILES = [
  '.github/workflows/test.yml',
  '.github/workflows/quality.yml',
  '.github/CONTRIBUTING.md',
  '.github/SETUP_CODECOV.md',
  '.github/BRANCH_PROTECTION.md',
  '.github/pull_request_template.md',
  '.github/ISSUE_TEMPLATE/bug_report.md',
  '.github/ISSUE_TEMPLATE/feature_request.md',
  '.github/dependabot.yml',
  '.codecov.yml',
  'jest.config.js',
  'jest.setup.js',
];

const COVERAGE_THRESHOLDS = {
  branches: 70,
  functions: 70,
  lines: 80,
  statements: 80,
};

console.log('🔍 Verificando setup de CI/CD...\n');

let hasErrors = false;

// 1. Verificar arquivos obrigatórios
console.log('📁 Verificando arquivos...');
REQUIRED_FILES.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - AUSENTE`);
    hasErrors = true;
  }
});

// 2. Verificar jest.config.js
console.log('\n⚙️  Verificando configuração do Jest...');
try {
  const jestConfig = require('../jest.config.js');

  // Verificar coverage thresholds
  if (jestConfig.coverageThreshold?.global) {
    const thresholds = jestConfig.coverageThreshold.global;
    Object.keys(COVERAGE_THRESHOLDS).forEach(key => {
      if (thresholds[key] >= COVERAGE_THRESHOLDS[key]) {
        console.log(`  ✅ Coverage threshold ${key}: ${thresholds[key]}%`);
      } else {
        console.log(`  ⚠️  Coverage threshold ${key}: ${thresholds[key]}% (recomendado: ${COVERAGE_THRESHOLDS[key]}%)`);
      }
    });
  } else {
    console.log('  ❌ Coverage thresholds não configurados');
    hasErrors = true;
  }

  // Verificar reporters
  if (jestConfig.reporters) {
    const hasJestJunit = jestConfig.reporters.some(r =>
      Array.isArray(r) && r[0] === 'jest-junit'
    );
    if (hasJestJunit) {
      console.log('  ✅ Reporter jest-junit configurado');
    } else {
      console.log('  ❌ Reporter jest-junit não encontrado');
      hasErrors = true;
    }
  }

  // Verificar coverage reporters
  if (jestConfig.coverageReporters?.includes('lcov')) {
    console.log('  ✅ Coverage reporter lcov configurado');
  } else {
    console.log('  ❌ Coverage reporter lcov não encontrado');
    hasErrors = true;
  }
} catch (error) {
  console.log(`  ❌ Erro ao ler jest.config.js: ${error.message}`);
  hasErrors = true;
}

// 3. Verificar package.json
console.log('\n📦 Verificando package.json...');
try {
  const packageJson = require('../package.json');

  // Verificar scripts
  const requiredScripts = ['test', 'type-check'];
  requiredScripts.forEach(script => {
    if (packageJson.scripts?.[script]) {
      console.log(`  ✅ Script "${script}" configurado`);
    } else {
      console.log(`  ❌ Script "${script}" ausente`);
      hasErrors = true;
    }
  });

  // Verificar dependências
  const requiredDevDeps = ['jest', 'jest-expo', 'jest-junit'];
  requiredDevDeps.forEach(dep => {
    if (packageJson.devDependencies?.[dep]) {
      console.log(`  ✅ Dependência "${dep}" instalada`);
    } else {
      console.log(`  ❌ Dependência "${dep}" não encontrada`);
      hasErrors = true;
    }
  });
} catch (error) {
  console.log(`  ❌ Erro ao ler package.json: ${error.message}`);
  hasErrors = true;
}

// 4. Verificar .codecov.yml
console.log('\n📊 Verificando .codecov.yml...');
try {
  const codecovConfig = fs.readFileSync(path.join(__dirname, '..', '.codecov.yml'), 'utf8');
  if (codecovConfig.includes('target: 80%')) {
    console.log('  ✅ Target de cobertura 80% configurado');
  }
  if (codecovConfig.includes('flags:')) {
    console.log('  ✅ Flags configuradas');
  }
  if (codecovConfig.includes('ignore:')) {
    console.log('  ✅ Arquivos ignorados configurados');
  }
} catch (error) {
  console.log(`  ❌ Erro ao ler .codecov.yml: ${error.message}`);
  hasErrors = true;
}

// 5. Verificar workflows
console.log('\n🔄 Verificando workflows...');
try {
  const testWorkflow = fs.readFileSync(
    path.join(__dirname, '..', '.github/workflows/test.yml'),
    'utf8'
  );

  if (testWorkflow.includes('codecov/codecov-action')) {
    console.log('  ✅ Upload para Codecov configurado');
  } else {
    console.log('  ❌ Upload para Codecov não encontrado');
    hasErrors = true;
  }

  if (testWorkflow.includes('CODECOV_TOKEN')) {
    console.log('  ✅ CODECOV_TOKEN referenciado no workflow');
  } else {
    console.log('  ⚠️  CODECOV_TOKEN não encontrado (precisa ser adicionado aos secrets)');
  }

  const qualityWorkflow = fs.readFileSync(
    path.join(__dirname, '..', '.github/workflows/quality.yml'),
    'utf8'
  );

  if (qualityWorkflow.includes('type-check')) {
    console.log('  ✅ Type check no workflow de qualidade');
  }
} catch (error) {
  console.log(`  ❌ Erro ao ler workflows: ${error.message}`);
  hasErrors = true;
}

// Resultado final
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ Setup incompleto! Corrija os erros acima.');
  process.exit(1);
} else {
  console.log('✅ Setup de CI/CD completo e validado!');
  console.log('\n📋 Próximos passos:');
  console.log('  1. Configure o token CODECOV_TOKEN nos secrets do GitHub');
  console.log('  2. Configure Branch Protection Rules (veja .github/BRANCH_PROTECTION.md)');
  console.log('  3. Faça um push para testar os workflows');
  process.exit(0);
}
