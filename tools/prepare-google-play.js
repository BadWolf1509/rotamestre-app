#!/usr/bin/env node

/**
 * Script para preparar o app para publicação na Google Play Store
 * Uso: node tools/prepare-google-play.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.cyan}${colors.bold}═══ ${msg} ═══${colors.reset}\n`)
};

// Checklist de preparação
class GooglePlayPreparer {
  constructor() {
    this.checks = [];
    this.errors = [];
    this.warnings = [];
  }

  // 1. Verificar configuração do app.config.js
  checkAppConfig() {
    log.header('Verificando Configuração do App');

    const configPath = path.join(process.cwd(), 'app.config.js');
    if (!fs.existsSync(configPath)) {
      this.errors.push('app.config.js não encontrado');
      return;
    }

    // Importar config
    const config = require(configPath)({ config: {} });

    // Verificações obrigatórias
    const checks = [
      { field: 'name', value: config.name, required: true },
      { field: 'slug', value: config.slug, required: true },
      { field: 'version', value: config.version, required: true },
      { field: 'android.package', value: config.android?.package, required: true },
      { field: 'android.versionCode', value: config.android?.versionCode, required: true },
      { field: 'android.permissions', value: config.android?.permissions, required: true },
      { field: 'icon', value: config.icon, required: true },
      { field: 'android.adaptiveIcon', value: config.android?.adaptiveIcon, required: true }
    ];

    checks.forEach(check => {
      if (check.required && !check.value) {
        this.errors.push(`${check.field} não configurado`);
        log.error(`${check.field} não configurado`);
      } else if (check.value) {
        this.checks.push(`${check.field}: ${JSON.stringify(check.value)}`);
        log.success(`${check.field} configurado`);
      }
    });

    // Avisos
    if (!config.android?.config?.googleMaps?.apiKey && !process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) {
      this.warnings.push('Google Maps API Key não configurada');
      log.warning('Google Maps API Key não configurada');
    }
  }

  // 2. Verificar assets obrigatórios
  checkAssets() {
    log.header('Verificando Assets');

    const requiredAssets = [
      { path: 'assets/icon.png', desc: 'Ícone do app (1024x1024)' },
      { path: 'assets/adaptive-icon.png', desc: 'Ícone adaptativo Android' },
      { path: 'assets/splash.png', desc: 'Tela de splash' }
    ];

    requiredAssets.forEach(asset => {
      const fullPath = path.join(process.cwd(), asset.path);
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        log.success(`${asset.desc}: ${(stats.size / 1024).toFixed(2)} KB`);
        this.checks.push(`${asset.desc} presente`);
      } else {
        this.errors.push(`${asset.desc} não encontrado em ${asset.path}`);
        log.error(`${asset.desc} não encontrado`);
      }
    });
  }

  // 3. Verificar dependências
  checkDependencies() {
    log.header('Verificando Dependências');

    try {
      // Verificar EAS CLI
      try {
        const easVersion = execSync('eas --version', { encoding: 'utf8' }).trim();
        log.success(`EAS CLI instalado: ${easVersion}`);
        this.checks.push(`EAS CLI: ${easVersion}`);
      } catch {
        this.warnings.push('EAS CLI não instalado (npm install -g eas-cli)');
        log.warning('EAS CLI não instalado - execute: npm install -g eas-cli');
      }

      // Verificar login Expo
      try {
        const whoami = execSync('eas whoami', { encoding: 'utf8' }).trim();
        log.success(`Logado como: ${whoami}`);
        this.checks.push(`Expo account: ${whoami}`);
      } catch {
        this.warnings.push('Não está logado no Expo (eas login)');
        log.warning('Não está logado no Expo - execute: eas login');
      }
    } catch {
      log.error('Erro verificando dependências');
    }
  }

  // 4. Verificar arquivo EAS
  checkEASConfig() {
    log.header('Verificando Configuração EAS');

    const easPath = path.join(process.cwd(), 'eas.json');
    if (!fs.existsSync(easPath)) {
      log.warning('eas.json não encontrado - será criado no primeiro build');
      this.warnings.push('eas.json não configurado');

      // Sugerir configuração
      const suggestedConfig = {
        cli: {
          version: ">= 3.0.0"
        },
        build: {
          development: {
            developmentClient: true,
            distribution: "internal"
          },
          preview: {
            distribution: "internal",
            android: {
              buildType: "apk"
            }
          },
          production: {
            android: {
              buildType: "app-bundle"
            }
          }
        },
        submit: {
          production: {
            android: {
              track: "production"
            }
          }
        }
      };

      log.info('Configuração sugerida para eas.json:');
      console.log(JSON.stringify(suggestedConfig, null, 2));
    } else {
      const easConfig = JSON.parse(fs.readFileSync(easPath, 'utf8'));

      if (easConfig.build?.production?.android) {
        log.success('Perfil de produção Android configurado');
        this.checks.push('EAS configurado para produção');
      } else {
        this.warnings.push('Perfil de produção Android não configurado em eas.json');
        log.warning('Perfil de produção Android não configurado');
      }
    }
  }

  // 5. Verificar variáveis de ambiente
  checkEnvironment() {
    log.header('Verificando Variáveis de Ambiente');

    const requiredEnvVars = [
      'EXPO_PUBLIC_SUPABASE_URL',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'
    ];

    requiredEnvVars.forEach(envVar => {
      if (process.env[envVar]) {
        log.success(`${envVar} configurada`);
        this.checks.push(`${envVar} presente`);
      } else {
        this.warnings.push(`${envVar} não configurada`);
        log.warning(`${envVar} não configurada`);
      }
    });

    // Verificar .env
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      log.info('.env arquivo presente (não esqueça de configurar em EAS)');
    } else {
      log.warning('.env não encontrado');
    }
  }

  // 6. Incrementar versionCode
  incrementVersionCode() {
    log.header('Incrementando Version Code');

    const configPath = path.join(process.cwd(), 'app.config.js');
    const configContent = fs.readFileSync(configPath, 'utf8');

    // Encontrar versionCode atual
    const versionCodeMatch = configContent.match(/versionCode:\s*(\d+)/);
    if (versionCodeMatch) {
      const currentVersionCode = parseInt(versionCodeMatch[1]);
      const newVersionCode = currentVersionCode + 1;

      // Atualizar versionCode
      const newContent = configContent.replace(
        /versionCode:\s*\d+/,
        `versionCode: ${newVersionCode}`
      );

      fs.writeFileSync(configPath, newContent);
      log.success(`Version Code atualizado: ${currentVersionCode} → ${newVersionCode}`);
      this.checks.push(`Version Code: ${newVersionCode}`);
    } else {
      this.errors.push('Version Code não encontrado no app.config.js');
      log.error('Version Code não encontrado');
    }
  }

  // Gerar relatório final
  generateReport() {
    log.header('RELATÓRIO FINAL');

    if (this.errors.length > 0) {
      console.log(`\n${colors.red}${colors.bold}ERROS CRÍTICOS (devem ser corrigidos):${colors.reset}`);
      this.errors.forEach(error => console.log(`  ${colors.red}✗${colors.reset} ${error}`));
    }

    if (this.warnings.length > 0) {
      console.log(`\n${colors.yellow}${colors.bold}AVISOS (recomendado corrigir):${colors.reset}`);
      this.warnings.forEach(warning => console.log(`  ${colors.yellow}⚠${colors.reset} ${warning}`));
    }

    if (this.checks.length > 0) {
      console.log(`\n${colors.green}${colors.bold}VERIFICAÇÕES OK:${colors.reset}`);
      this.checks.forEach(check => console.log(`  ${colors.green}✓${colors.reset} ${check}`));
    }

    // Status final
    console.log('\n' + '═'.repeat(50));
    if (this.errors.length === 0) {
      console.log(`${colors.green}${colors.bold}✅ APP PRONTO PARA BUILD DE PRODUÇÃO!${colors.reset}`);
      console.log(`\n${colors.cyan}Próximos passos:${colors.reset}`);
      console.log('1. Execute: eas build --platform android --profile production');
      console.log('2. Aguarde o build (15-30 minutos)');
      console.log('3. Baixe o AAB gerado');
      console.log('4. Faça upload no Google Play Console');
    } else {
      console.log(`${colors.red}${colors.bold}❌ APP NÃO ESTÁ PRONTO - CORRIJA OS ERROS ACIMA${colors.reset}`);
    }
  }

  // Executar todas as verificações
  async run() {
    console.log(`${colors.cyan}${colors.bold}`);
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║     🚀 PREPARAÇÃO PARA GOOGLE PLAY STORE      ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log(colors.reset);

    this.checkAppConfig();
    this.checkAssets();
    this.checkDependencies();
    this.checkEASConfig();
    this.checkEnvironment();

    // Perguntar se deseja incrementar versionCode
    if (this.errors.length === 0) {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      readline.question('\nDeseja incrementar o versionCode? (s/n): ', (answer) => {
        if (answer.toLowerCase() === 's') {
          this.incrementVersionCode();
        }

        this.generateReport();
        readline.close();
        process.exit(this.errors.length > 0 ? 1 : 0);
      });
    } else {
      this.generateReport();
      process.exit(1);
    }
  }
}

// Executar
const preparer = new GooglePlayPreparer();
preparer.run();