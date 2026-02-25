const { spawnSync } = require('child_process');
const fs = require('fs');
const r = spawnSync('node', ['node_modules/vite/bin/vite.js', 'build'], {
  encoding: 'utf8',
  timeout: 120000,
  cwd: __dirname,
});
const output = `EXIT: ${r.status}\nSTDOUT:\n${r.stdout || '(empty)'}\nSTDERR:\n${r.stderr || '(empty)'}`;
fs.writeFileSync('build_result.txt', output, 'utf8');
console.log('Build result written to build_result.txt');
