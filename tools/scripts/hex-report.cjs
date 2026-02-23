const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_PATH = path.join(ROOT, 'docs', 'design-system-hex-report.md');
const TARGETS = ['app', 'src', 'App.tsx'];
const INCLUDE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx']);
const IGNORE_DIRS = new Set([
  '.expo',
  '.git',
  'android',
  'build',
  'coverage',
  'dist',
  'ios',
  'node_modules',
  'test-results',
  'tokens',
  'e2e-report',
]);

const HEX_PATTERN = /#(?:[0-9a-fA-F]{3,8})\b/g;

function shouldIgnoreDir(name) {
  return IGNORE_DIRS.has(name) || name.startsWith('.');
}

function shouldIncludeFile(filePath) {
  const ext = path.extname(filePath);
  if (!INCLUDE_EXT.has(ext)) return false;
  const rel = path.relative(ROOT, filePath);
  if (rel.includes(`${path.sep}__tests__${path.sep}`)) return false;
  if (rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) return false;
  return true;
}

function walkDir(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldIgnoreDir(entry.name)) return;
      walkDir(entryPath, files);
    } else if (entry.isFile()) {
      if (shouldIncludeFile(entryPath)) {
        files.push(entryPath);
      }
    }
  });
  return files;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const matches = [];

  lines.forEach((line, index) => {
    let match;
    HEX_PATTERN.lastIndex = 0;
    while ((match = HEX_PATTERN.exec(line))) {
      const matchIndex = match.index ?? 0;
      if (matchIndex > 0 && line[matchIndex - 1] === '&') {
        continue;
      }
      matches.push({
        line: index + 1,
        value: match[0],
      });
    }
  });

  return matches;
}

function formatFindings(findings) {
  if (findings.length === 0) {
    return ['No hex colors found in scanned files.'];
  }

  return findings.map(({ file, matches }) => {
    const lineInfo = matches
      .map((match) => `L${match.line} ${match.value}`)
      .join(', ');
    return `- \`${file}\`: ${lineInfo}`;
  });
}

function main() {
  const files = [];
  TARGETS.forEach((target) => {
    const targetPath = path.join(ROOT, target);
    if (!fs.existsSync(targetPath)) return;
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      walkDir(targetPath, files);
    } else if (stat.isFile() && shouldIncludeFile(targetPath)) {
      files.push(targetPath);
    }
  });

  const findings = [];
  let totalMatches = 0;

  files.forEach((filePath) => {
    const matches = scanFile(filePath);
    if (matches.length > 0) {
      const rel = path.relative(ROOT, filePath).split(path.sep).join('/');
      findings.push({ file: rel, matches });
      totalMatches += matches.length;
    }
  });

  findings.sort((a, b) => a.file.localeCompare(b.file));

  const reportLines = [
    '# Hex Color Report',
    '',
    '## Scope',
    '',
    '- Paths: `app/`, `src/`, `App.tsx`',
    '- Pattern: `#RGB`, `#RRGGBB`, `#RRGGBBAA`',
    '- Excludes: `__tests__`, `node_modules/`, `tokens/`, `dist/`, `build/`, `coverage/`',
    '',
    '## Summary',
    '',
    `- Files with hex colors: ${findings.length}`,
    `- Total hex occurrences: ${totalMatches}`,
    '',
    '## Findings',
    '',
    ...formatFindings(findings),
    '',
    '## Notes',
    '',
    '- Some files are allowlisted in `eslint.config.js` while migration is in progress.',
  ];

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${reportLines.join('\n')}\n`, 'utf-8');

  console.log(`Hex report written to ${path.relative(ROOT, OUTPUT_PATH)}`);
}

main();
