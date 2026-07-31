import { execFileSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { devvit } from '@devvit/start/vite';

const buildCommit =
  process.env.FALLSTACK_BUILD_COMMIT?.trim() ||
  gitOutput(['rev-parse', '--short=12', 'HEAD']) ||
  'unknown';
const buildId = `${buildCommit}${
  gitOutput(['status', '--porcelain', '--untracked-files=no']) ? '-dirty' : ''
}`;

export default defineConfig({
  plugins: [react(), tailwind(), devvit()],
  define: {
    'import.meta.env.FALLSTACK_BUILD_ID': JSON.stringify(buildId),
  },
});

function gitOutput(args: string[]): string {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}
