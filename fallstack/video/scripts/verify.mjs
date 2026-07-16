import { execFile } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const videoDir = path.resolve(scriptDir, '..');
const video = path.join(videoDir, 'output', 'fallstack-pitch.mp4');
const framesDir = path.join(videoDir, 'output', 'verification-frames');
const { stdout } = await exec('ffprobe', [
  '-v',
  'error',
  '-show_streams',
  '-show_format',
  '-of',
  'json',
  video,
]);
const probe = JSON.parse(stdout);
const videoStream = probe.streams.find((stream) => stream.codec_type === 'video');
const audioStream = probe.streams.find((stream) => stream.codec_type === 'audio');
const duration = Number(probe.format.duration);

assert(videoStream?.codec_name === 'h264', 'video codec is H.264');
assert(videoStream?.width === 1920 && videoStream?.height === 1080, 'video is 1920×1080');
assert(videoStream?.r_frame_rate === '30/1', 'video is 30 fps');
assert(audioStream?.codec_name === 'aac', 'audio codec is AAC');
assert(duration >= 57.9 && duration <= 58.1, `duration is 58 seconds (found ${duration})`);

await rm(framesDir, { recursive: true, force: true });
await mkdir(framesDir, { recursive: true });
const frameTimes = [1, 8, 15, 23, 31, 39, 46, 52, 57];
for (let index = 0; index < frameTimes.length; index += 1) {
  await exec('ffmpeg', [
    '-y',
    '-ss',
    String(frameTimes[index]),
    '-i',
    video,
    '-frames:v',
    '1',
    '-vf',
    'scale=640:-1',
    path.join(framesDir, `frame-${String(index + 1).padStart(2, '0')}.png`),
  ]);
}
await exec('ffmpeg', [
  '-y',
  '-framerate',
  '1',
  '-i',
  path.join(framesDir, 'frame-%02d.png'),
  '-frames:v',
  '1',
  '-vf',
  'tile=3x3:padding=8:margin=8:color=0x171426',
  path.join(videoDir, 'output', 'contact-sheet.png'),
]);
const blackCheck = await exec('ffmpeg', [
  '-hide_banner',
  '-i',
  video,
  '-vf',
  'blackdetect=d=0.12:pix_th=0.02',
  '-an',
  '-f',
  'null',
  '-',
]).catch((error) => ({ stderr: error.stderr ?? '' }));
const blackFrames = String(blackCheck.stderr).match(/black_start:/g)?.length ?? 0;
assert(blackFrames === 0, `no black runs detected (found ${blackFrames})`);

const result = {
  video,
  duration,
  dimensions: `${videoStream.width}x${videoStream.height}`,
  frameRate: videoStream.r_frame_rate,
  videoCodec: videoStream.codec_name,
  audioCodec: audioStream.codec_name,
  blackRuns: blackFrames,
  contactSheet: path.join(videoDir, 'output', 'contact-sheet.png'),
};
await writeFile(
  path.join(videoDir, 'output', 'verification.json'),
  `${JSON.stringify(result, null, 2)}\n`
);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

function assert(condition, message) {
  if (!condition) throw new Error(`Verification failed: ${message}`);
}
