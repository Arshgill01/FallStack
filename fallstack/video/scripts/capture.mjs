import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const videoDir = path.resolve(scriptDir, '..');
const gameDir = path.resolve(videoDir, '..');
const captureDir = path.join(videoDir, 'public', 'generated', 'capture');
const port = 8097;

await rm(captureDir, { recursive: true, force: true });
await mkdir(captureDir, { recursive: true });
await run('npm', ['run', 'build'], gameDir);

const server = spawn(
  'python3',
  ['-m', 'http.server', String(port), '-d', path.join(gameDir, 'dist', 'client')],
  { cwd: gameDir, stdio: ['ignore', 'pipe', 'pipe'] }
);

let serverError = '';
server.stderr.on('data', (chunk) => {
  serverError += String(chunk);
});

try {
  await waitForServer(`http://127.0.0.1:${port}/game.html`);
  await run(
    'node',
    [
      path.join(gameDir, 'scripts', 'qa', 'full-playthrough.mjs'),
      '--url',
      `http://127.0.0.1:${port}/game.html`,
      '--output',
      captureDir,
      '--width',
      '1280',
      '--height',
      '720',
      '--video',
      'true',
      '--board-only',
      'true',
      '--intro-fall',
      'true',
      '--retries',
      '40',
      '--max-jumps',
      '1200',
      '--require-summit',
      'true',
    ],
    gameDir
  );
} finally {
  server.kill('SIGTERM');
  await new Promise((resolve) => server.once('exit', resolve));
}

if (serverError && !serverError.includes('GET /game.html')) {
  process.stderr.write(serverError);
}

async function waitForServer(url) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The short retry loop handles normal server startup.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}
