import fs from 'fs';
import path from 'path';

// Cores para console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

// Banner
console.log(`${colors.cyan}╔════════════════════════════════════════════════╗${colors.reset}`);
console.log(`${colors.cyan}║   ${colors.bright}Copiar Assets para Public${colors.reset}${colors.cyan}                ║${colors.reset}`);
console.log(`${colors.cyan}╚════════════════════════════════════════════════╝${colors.reset}`);
console.log('');

const sourcePath = path.join(process.cwd(), 'assets', 'marketing');
const destPath = path.join(process.cwd(), 'public', 'assets', 'marketing');

console.log(`📂 Origem: ${colors.yellow}${sourcePath}${colors.reset}`);
console.log(`📂 Destino: ${colors.yellow}${destPath}${colors.reset}`);
console.log('');

// Função para copiar arquivo
function copyFile(source, dest) {
  const fileName = path.basename(source);
  try {
    fs.copyFileSync(source, dest);
    console.log(`   ${fileName}... ${colors.green}✅${colors.reset}`);
    return true;
  } catch (error) {
    console.log(`   ${fileName}... ${colors.red}❌ ${error.message}${colors.reset}`);
    return false;
  }
}

// Criar diretórios se não existirem
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`${colors.blue}📁 Criado diretório: ${dir}${colors.reset}`);
  }
}

try {
  // Verificar se o diretório de origem existe
  if (!fs.existsSync(sourcePath)) {
    console.log(`${colors.yellow}⚠️  Diretório de origem não existe: ${sourcePath}${colors.reset}`);
    console.log(`${colors.yellow}   Pulando cópia de assets de marketing...${colors.reset}`);
    process.exit(0);
  }

  // Criar diretório de destino
  ensureDirectoryExists(destPath);

  console.log(`${colors.cyan}🔄 Copiando arquivos...${colors.reset}`);
  console.log('');

  // Ler arquivos do diretório de origem
  const files = fs.readdirSync(sourcePath);
  let successCount = 0;
  let failCount = 0;

  // Copiar cada arquivo
  files.forEach(file => {
    const sourceFile = path.join(sourcePath, file);
    const destFile = path.join(destPath, file);

    // Apenas copiar arquivos (não diretórios)
    if (fs.statSync(sourceFile).isFile()) {
      if (copyFile(sourceFile, destFile)) {
        successCount++;
      } else {
        failCount++;
      }
    }
  });

  console.log('');
  console.log(`${colors.cyan}╔════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║  ${colors.bright}Resultado: ${colors.green}${successCount} OK${colors.reset} | ${colors.red}${failCount} erros${colors.reset}              ${colors.cyan}║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════╝${colors.reset}`);
  console.log('');

  if (failCount === 0) {
    console.log(`${colors.green}✅ Assets copiados com sucesso!${colors.reset}`);
    console.log('');
    console.log(`${colors.blue}📋 Arquivos copiados para public/assets/marketing/:${colors.reset}`);
    console.log('');

    files.forEach(file => {
      const sourceFile = path.join(sourcePath, file);
      if (fs.statSync(sourceFile).isFile()) {
        console.log(`   - ${file}`);
      }
    });

    console.log('');
  } else {
    console.log(`${colors.red}❌ Alguns arquivos não puderam ser copiados${colors.reset}`);
    process.exit(1);
  }

} catch (error) {
  console.error(`${colors.red}❌ Erro ao copiar assets: ${error.message}${colors.reset}`);
  process.exit(1);
}