import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(scriptDir, '..', 'public', 'generated');
const source = path.join(outputDir, 'forest-walk-by-eugenio-mininni.mp3');
const output = path.join(outputDir, 'fallstack-score.wav');
const sourceUrl = 'https://assets.mixkit.co/music/607/607.mp3';
const expectedSha256 = 'a26472673d06e47655b5d93ea7917a420a2b095e68bdc988c0a3dc255b249747';

await mkdir(outputDir, { recursive: true });

if (!(await hasExpectedHash(source))) {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Music download failed with HTTP ${response.status}`);
  await writeFile(source, Buffer.from(await response.arrayBuffer()));
}

if (!(await hasExpectedHash(source))) {
  throw new Error('Downloaded music does not match the reviewed Mixkit source');
}

await exec('ffmpeg', [
  '-y',
  '-loglevel',
  'error',
  '-ss',
  '48',
  '-t',
  '58',
  '-i',
  source,
  '-af',
  'loudnorm=I=-16:TP=-1.5:LRA=9,afade=t=in:st=0:d=1.4,afade=t=out:st=56:d=2',
  '-ar',
  '48000',
  '-ac',
  '2',
  '-c:a',
  'pcm_s16le',
  output,
]);

process.stdout.write(`${output}\n`);

async function hasExpectedHash(file) {
  try {
    const bytes = await readFile(file);
    return createHash('sha256').update(bytes).digest('hex') === expectedSha256;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}
