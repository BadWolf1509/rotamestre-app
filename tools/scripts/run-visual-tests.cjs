const { spawnSync } = require('child_process');

const env = { ...process.env, VISUAL_REGRESSION: '1' };
const args = ['playwright', 'test', '--grep', '@visual'];

if (process.argv.includes('--update')) {
  args.push('--update-snapshots');
}

const result = spawnSync('npx', args, {
  stdio: 'inherit',
  env,
  shell: true,
});

process.exit(result.status ?? 1);
