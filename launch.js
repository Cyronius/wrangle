// Launcher script that clears ELECTRON_RUN_AS_NODE before starting Electron
delete process.env.ELECTRON_RUN_AS_NODE;

const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const cmd = args[0] || 'dev';

const child = spawn('npx', ['electron-vite', cmd], {
  stdio: 'inherit',
  shell: true,
  env: process.env
});

child.on('close', (code) => {
  process.exit(code);
});
