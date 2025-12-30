const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const REPORT_PATH = path.join(ROOT, 'docs', 'design-system-hex-report.md');
const ALLOWLIST = new Set(['src/utils/styles.base.ts']);

function readReport() {
  if (!fs.existsSync(REPORT_PATH)) {
    throw new Error('Hex report not found. Run `npm run report:hex` first.');
  }

  return fs.readFileSync(REPORT_PATH, 'utf-8');
}

function parseFindings(report) {
  const lines = report.split(/\r?\n/);
  const findings = [];
  let inFindings = false;

  for (const line of lines) {
    if (line.startsWith('## Findings')) {
      inFindings = true;
      continue;
    }

    if (!inFindings) {
      continue;
    }

    if (line.startsWith('## ')) {
      break;
    }

    const match = line.match(/^- `([^`]+)`/);
    if (match) {
      findings.push(match[1]);
    }
  }

  return findings;
}

function main() {
  let report;
  try {
    report = readReport();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const findings = parseFindings(report);
  const unexpected = findings.filter((file) => !ALLOWLIST.has(file));

  if (unexpected.length > 0) {
    console.error('Unexpected hex usage outside allowlist:');
    unexpected.forEach((file) => {
      console.error(`- ${file}`);
    });
    console.error('Update tokens or extend allowlist once approved.');
    process.exit(1);
  }

  console.log('Design system hex report verified.');
}

main();
