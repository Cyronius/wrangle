#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const path = require('path');

const electronPath = require('electron');
const appPath = path.join(__dirname, '..', 'out', 'main', 'index.js');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, [appPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
  windowsHide: false
});

child.on('close', (code) => {
  process.exitCode = code;
});
