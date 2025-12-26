const fs = require('fs');
const path = require('path');

const pkgPath = path.join(process.cwd(), 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const current = Number(pkg.androidVersionCode);
if (!Number.isInteger(current)) {
  console.error('androidVersionCode missing or invalid in package.json');
  process.exit(1);
}

const next = current + 1;
pkg.androidVersionCode = next;

fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`androidVersionCode bumped: ${current} -> ${next}`);
