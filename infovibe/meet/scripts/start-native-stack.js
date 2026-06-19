const path = require('path');
const { spawn } = require('child_process');

const rootDir = path.join(__dirname, '..');
const children = new Set();
let shuttingDown = false;

function startProcess(command, args) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit'
  });
  children.add(child);
  child.on('exit', (code) => {
    children.delete(child);
    if (shuttingDown) return;
    shuttingDown = true;
    for (const runningChild of children) runningChild.kill();
    process.exit(code ?? 0);
  });
  child.on('error', (error) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.error(error.message);
    for (const runningChild of children) runningChild.kill();
    process.exit(1);
  });
  return child;
}

function stopAll() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill();
  process.exit(0);
}

process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);

startProcess(process.execPath, ['server.js']);
startProcess(process.execPath, [path.join(__dirname, 'run-livekit.js')]);
