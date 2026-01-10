const { spawnSync } = require('child_process');

const env = { ...process.env, VISUAL_REGRESSION: '1' };
const isUpdate = process.argv.includes('--update');
const publicOnly = process.argv.includes('--public-only');
const includeAll = process.argv.includes('--all');

// Determine which tests to run:
// - --all: Run all visual tests (@visual)
// - --public-only: Run only public tests (@visual.*@public)
// - --update: Run only public tests (default for CI safety - no auth required)
// - default: Run all visual tests (@visual)
let grepPattern = '@visual';
if (publicOnly || (isUpdate && !includeAll)) {
  grepPattern = '@visual.*@public';
}

const args = ['playwright', 'test', '--grep', grepPattern];

if (isUpdate) {
  args.push('--update-snapshots');
}

console.log(`Running visual tests with pattern: ${grepPattern}`);
console.log(`Command: npx ${args.join(' ')}`);

const result = spawnSync('npx', args, {
  stdio: 'inherit',
  env,
  shell: true,
});

process.exit(result.status ?? 1);
