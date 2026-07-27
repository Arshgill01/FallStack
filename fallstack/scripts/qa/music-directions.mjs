import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const outputDir = path.resolve(
  process.argv[2] ?? 'docs/qa/final-pass/music-directions'
);
const sampleRate = 48_000;
const durationSeconds = 48;
const frameCount = sampleRate * durationSeconds;

const directions = [
  {
    id: 'a-mended-lantern',
    title: 'Mended Lantern',
    structure: 'Sparse, episodic Dorian plucks over repaired cloth and stone.',
    instrumentation:
      'Low sine drones, thread-brush noise, wooden plucks, and restrained bells.',
    tradeoff:
      'Warmest and least tiring; its biome contrast is intentionally subtle.',
    score: {
      productFit: 5,
      coziness: 5,
      cursedTactileIdentity: 4,
      longSessionFatigue: 5,
      gameplayClarity: 5,
      biomeCoherence: 4,
      runtimeCost: 5,
    },
    render: renderMendedLantern,
  },
  {
    id: 'b-crooked-procession',
    title: 'Crooked Procession',
    structure:
      'A five-beat mechanical procession that sheds weight while climbing.',
    instrumentation:
      'Wood knocks, muted wire plucks, rope pulses, and crooked metal partials.',
    tradeoff:
      'Strongest vertical identity and zone contrast; the pulse has the highest fatigue risk.',
    score: {
      productFit: 5,
      coziness: 3,
      cursedTactileIdentity: 5,
      longSessionFatigue: 3,
      gameplayClarity: 4,
      biomeCoherence: 5,
      runtimeCost: 4,
    },
    render: renderCrookedProcession,
  },
  {
    id: 'c-breathing-reliquary',
    title: 'Breathing Reliquary',
    structure:
      'Pulse-free overlapping breaths and slowly changing harmonic chambers.',
    instrumentation:
      'Air bands, soft organ partials, distant glass, and low architectural resonance.',
    tradeoff:
      'Most spacious under repeated play; least explicit rhythmic climb momentum.',
    score: {
      productFit: 4,
      coziness: 5,
      cursedTactileIdentity: 5,
      longSessionFatigue: 5,
      gameplayClarity: 5,
      biomeCoherence: 4,
      runtimeCost: 4,
    },
    render: renderBreathingReliquary,
  },
];

await mkdir(outputDir, { recursive: true });
const temporaryDir = await mkdtemp(
  path.join(os.tmpdir(), 'fallstack-music-directions-')
);

try {
  const reports = [];
  for (const direction of directions) {
    const mix = createMix();
    const events = [];
    direction.render(mix, events);
    applyCrossEcho(mix, direction.id === 'b-crooked-procession' ? 0.13 : 0.2);
    const pcm = finishMix(mix);
    const wavPath = path.join(temporaryDir, `${direction.id}.wav`);
    const audioPath = path.join(outputDir, `${direction.id}.webm`);
    const spectrumPath = path.join(outputDir, `${direction.id}-spectrum.png`);
    const wavBytes = encodeWav(pcm.left, pcm.right);
    await writeFile(wavPath, wavBytes);
    await execFileAsync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-i',
      wavPath,
      '-c:a',
      'libopus',
      '-b:a',
      '160k',
      '-vbr',
      'on',
      audioPath,
    ]);
    await execFileAsync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-i',
      audioPath,
      '-lavfi',
      'showspectrumpic=s=1200x600:legend=1:color=fiery:scale=log',
      spectrumPath,
    ]);

    const probe = await probeAudio(audioPath);
    const loudness = await measureLoudness(audioPath);
    const audioBytes = await readFile(audioPath);
    const artifactStat = await stat(audioPath);
    assert.equal(probe.sampleRate, sampleRate);
    assert.equal(probe.channels, 2);
    assert.ok(probe.durationSeconds >= durationSeconds - 0.05);
    assert.ok(probe.durationSeconds <= durationSeconds + 0.1);
    assert.ok(
      loudness.truePeakDbfs < -3,
      `${direction.title} stays below clipping`
    );
    assert.ok(
      pcm.metrics.maxAdjacentDelta < 0.15,
      `${direction.title} has no discontinuity-sized sample jump`
    );
    assert.ok(
      artifactStat.size > 100_000,
      `${direction.title} preview is non-empty`
    );

    reports.push({
      id: direction.id,
      title: direction.title,
      structure: direction.structure,
      instrumentation: direction.instrumentation,
      tradeoff: direction.tradeoff,
      provisionalDesignIntentScore: direction.score,
      scoreNotice:
        'Authoring assessment only; human listening approval remains required.',
      artifact: path.relative(process.cwd(), audioPath),
      spectrum: path.relative(process.cwd(), spectrumPath),
      signalSha256: createHash('sha256').update(wavBytes).digest('hex'),
      encodedArtifactSha256: createHash('sha256')
        .update(audioBytes)
        .digest('hex'),
      byteLength: artifactStat.size,
      stream: probe,
      loudness,
      pcm: pcm.metrics,
      timeline: {
        lowerRuins: { startSeconds: 0, endSeconds: 16 },
        bellShaft: { startSeconds: 16, endSeconds: 32 },
        moonRoof: { startSeconds: 32, endSeconds: 48 },
      },
      events,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/qa/music-directions.mjs',
    sampleRate,
    durationSeconds,
    provenance: {
      source:
        'Original deterministic synthesis authored for Fallstack from mathematical oscillators and seeded noise.',
      externalAssets: [],
      licence: 'Repository BSD-3-Clause',
      productionStatus:
        'Concept previews only. None is selected or shipped by this checkpoint.',
    },
    reviewOrder: directions.map((direction) => direction.id),
    directions: reports,
  };
  await writeFile(
    path.join(outputDir, 'music-directions.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        completed: true,
        outputDir,
        directions: reports.map((direction) => ({
          id: direction.id,
          title: direction.title,
          durationSeconds: direction.stream.durationSeconds,
          integratedLufs: direction.loudness.integratedLufs,
          loudnessRangeLu: direction.loudness.loudnessRangeLu,
          truePeakDbfs: direction.loudness.truePeakDbfs,
          byteLength: direction.byteLength,
        })),
      },
      null,
      2
    )}\n`
  );
} finally {
  await rm(temporaryDir, { recursive: true, force: true });
}

function renderMendedLantern(mix, events) {
  addDroneChord(mix, 0, 16.4, [110, 164.81], 0.033, 0.08);
  addBreath(mix, 0.2, 5.8, 0.013, -0.35, 0xa11ce);
  addBreath(mix, 8.4, 5.2, 0.011, 0.4, 0xa11cf);
  const lowerNotes = [220, 261.63, 293.66, 246.94, 329.63];
  [1.1, 4.8, 8.2, 11.7, 14.3].forEach((start, index) => {
    addPluck(mix, start, lowerNotes[index], 0.08, index % 2 ? 0.3 : -0.25);
  });
  events.push(
    sectionEvent('lower-ruins', 0, 'thread, stone, and sparse plucks')
  );

  addBell(mix, 15.55, 146.83, 0.08, -0.15, 4.4);
  addDroneChord(mix, 15.6, 16.8, [98, 146.83, 220], 0.027, 0.11);
  [17.2, 21.1, 25.9, 29.4].forEach((start, index) => {
    const notes = [293.66, 349.23, 329.63, 440];
    addBell(mix, start, notes[index], 0.068, index % 2 ? 0.42 : -0.42, 3.2);
    addKnock(mix, start - 0.18, 0.025, index % 2 ? -0.3 : 0.3, 0xb311 + index);
  });
  addBreath(mix, 23.2, 6.4, 0.009, 0.2, 0xb312);
  events.push(
    sectionEvent('bell-shaft', 16, 'rope knocks and open bell intervals')
  );

  addBell(mix, 31.55, 220, 0.075, 0.1, 4.8);
  addDroneChord(mix, 31.5, 16.5, [146.83, 220, 293.66], 0.023, 0.15);
  addBreath(mix, 32, 7.2, 0.012, -0.5, 0xc441);
  addBreath(mix, 40, 6.5, 0.01, 0.5, 0xc442);
  [
    [33.4, 440, -0.42],
    [37.6, 523.25, 0.38],
    [42.1, 659.25, -0.15],
    [46.1, 493.88, 0.32],
  ].forEach(([start, frequency, pan]) => {
    addBell(mix, start, frequency, 0.045, pan, 4.8);
  });
  events.push(
    sectionEvent('moon-roof', 32, 'open fifths, air, and distant glass')
  );
}

function renderCrookedProcession(mix, events) {
  const roots = [82.41, 98, 123.47];
  const noteSets = [
    [164.81, 196, 220, 146.83, 246.94],
    [196, 233.08, 261.63, 174.61, 293.66],
    [246.94, 293.66, 329.63, 220, 369.99],
  ];
  for (let section = 0; section < 3; section += 1) {
    const sectionStart = section * 16;
    const density = section === 2 ? 2 : 1;
    addDroneChord(
      mix,
      sectionStart,
      16.2,
      [roots[section], roots[section] * 1.5],
      section === 1 ? 0.028 : 0.024,
      0.18
    );
    for (let beat = 0; beat < 20; beat += density) {
      const start = sectionStart + beat * 0.8;
      const position = beat % 5;
      const accent = position === 0 ? 0.052 : position === 3 ? 0.036 : 0.022;
      addKnock(
        mix,
        start,
        accent,
        position % 2 ? -0.28 : 0.28,
        0xd000 + section * 100 + beat
      );
      if (position === 0 || position === 2 || position === 4) {
        const note = noteSets[section][(beat + position) % 5];
        addPluck(
          mix,
          start + 0.12,
          note,
          section === 1 ? 0.07 : 0.052,
          position === 2 ? 0.38 : -0.32
        );
      }
      if (section === 1 && position === 4) {
        addBell(mix, start + 0.2, roots[section] * 3, 0.042, 0.4, 2.2);
      }
      if (section === 2 && position === 0) {
        addBell(mix, start + 0.25, roots[section] * 4, 0.038, -0.35, 3.4);
      }
    }
    events.push(
      sectionEvent(
        ['lower-ruins', 'bell-shaft', 'moon-roof'][section],
        sectionStart,
        [
          'five-beat wood and wire procession',
          'rope pulse with crooked metal answers',
          'half-density procession with high roof bells',
        ][section]
      )
    );
  }
}

function renderBreathingReliquary(mix, events) {
  const chambers = [
    {
      start: 0,
      frequencies: [73.42, 110, 146.83, 220],
      breaths: [0.2, 7.4, 13.1],
      glass: [
        [5.8, 293.66, -0.4],
        [12.2, 246.94, 0.35],
      ],
    },
    {
      start: 15.2,
      frequencies: [65.41, 98, 130.81, 196],
      breaths: [16.1, 22.8, 28.3],
      glass: [
        [19.6, 392, 0.4],
        [27.1, 349.23, -0.35],
      ],
    },
    {
      start: 31.2,
      frequencies: [110, 164.81, 220, 329.63],
      breaths: [32.1, 38.5, 44.2],
      glass: [
        [35.2, 523.25, -0.35],
        [43, 659.25, 0.4],
      ],
    },
  ];
  chambers.forEach((chamber, section) => {
    addDroneChord(
      mix,
      chamber.start,
      section === 0 ? 17.2 : 16.8,
      chamber.frequencies,
      0.018,
      0.24
    );
    chamber.breaths.forEach((start, index) => {
      addBreath(
        mix,
        start,
        5.3,
        0.013,
        index % 2 ? 0.48 : -0.48,
        0xe000 + section * 100 + index
      );
    });
    chamber.glass.forEach(([start, frequency, pan]) => {
      addBell(mix, start, frequency, 0.036, pan, 5.2);
    });
  });
  addTone(mix, {
    start: 14.9,
    duration: 4.2,
    frequency: 49,
    amplitude: 0.032,
    attack: 1.1,
    release: 2,
    pan: -0.1,
    tremoloHz: 0.17,
    tremoloDepth: 0.2,
  });
  addTone(mix, {
    start: 30.9,
    duration: 4.5,
    frequency: 55,
    amplitude: 0.03,
    attack: 1.2,
    release: 2.2,
    pan: 0.1,
    tremoloHz: 0.13,
    tremoloDepth: 0.22,
  });
  events.push(
    sectionEvent('lower-ruins', 0, 'low stone chamber and cloth breaths')
  );
  events.push(
    sectionEvent(
      'bell-shaft',
      16,
      'darker suspended chamber with distant glass'
    )
  );
  events.push(sectionEvent('moon-roof', 32, 'open high chamber and wider air'));
}

function createMix() {
  return {
    left: new Float32Array(frameCount),
    right: new Float32Array(frameCount),
  };
}

function addDroneChord(mix, start, duration, frequencies, amplitude, width) {
  frequencies.forEach((frequency, index) => {
    const position =
      frequencies.length === 1
        ? 0
        : (index / (frequencies.length - 1) - 0.5) * width * 2;
    addTone(mix, {
      start,
      duration,
      frequency,
      amplitude: amplitude / Math.sqrt(frequencies.length),
      attack: 1.4,
      release: 2.1,
      pan: position,
      tremoloHz: 0.045 + index * 0.017,
      tremoloDepth: 0.16,
      phase: index * 0.7,
    });
  });
}

function addPluck(mix, start, frequency, amplitude, pan) {
  [
    [1, 1, 1.6],
    [2, 0.32, 1.05],
    [3.01, 0.18, 0.72],
  ].forEach(([ratio, scale, duration]) => {
    addTone(mix, {
      start,
      duration,
      frequency: frequency * ratio,
      amplitude: amplitude * scale,
      attack: 0.008,
      release: duration * 0.92,
      pan,
    });
  });
}

function addBell(mix, start, frequency, amplitude, pan, duration) {
  [
    [1, 1, 1],
    [2.01, 0.34, 0.74],
    [2.76, 0.18, 0.5],
    [4.08, 0.09, 0.34],
  ].forEach(([ratio, scale, durationScale], index) => {
    addTone(mix, {
      start,
      duration: duration * durationScale,
      frequency: frequency * ratio,
      amplitude: amplitude * scale,
      attack: 0.018 + index * 0.004,
      release: duration * durationScale * 0.94,
      pan: clamp(pan + (index - 1.5) * 0.04, -1, 1),
    });
  });
}

function addKnock(mix, start, amplitude, pan, seed) {
  addNoise(mix, {
    start,
    duration: 0.12,
    amplitude,
    attack: 0.002,
    release: 0.105,
    pan,
    seed,
    color: 'low',
    smoothing: 0.82,
  });
  addTone(mix, {
    start,
    duration: 0.18,
    frequency: 82,
    amplitude: amplitude * 0.5,
    attack: 0.004,
    release: 0.16,
    pan,
  });
}

function addBreath(mix, start, duration, amplitude, pan, seed) {
  addNoise(mix, {
    start,
    duration,
    amplitude,
    attack: Math.min(1.5, duration * 0.35),
    release: Math.min(1.8, duration * 0.42),
    pan,
    seed,
    color: 'band',
    smoothing: 0.955,
    tremoloHz: 0.11,
    tremoloDepth: 0.35,
  });
}

function addTone(
  mix,
  {
    start,
    duration,
    frequency,
    amplitude,
    attack,
    release,
    pan,
    tremoloHz = 0,
    tremoloDepth = 0,
    phase = 0,
  }
) {
  const startFrame = Math.max(0, Math.floor(start * sampleRate));
  const endFrame = Math.min(
    frameCount,
    Math.ceil((start + duration) * sampleRate)
  );
  const [leftGain, rightGain] = panGains(pan);
  const phaseStep = (Math.PI * 2 * frequency) / sampleRate;
  let oscillatorPhase = phase;
  for (let frame = startFrame; frame < endFrame; frame += 1) {
    const localTime = (frame - startFrame) / sampleRate;
    const envelope = shapedEnvelope(localTime, duration, attack, release);
    const tremolo =
      1 -
      tremoloDepth * 0.5 +
      tremoloDepth *
        0.5 *
        Math.sin(Math.PI * 2 * tremoloHz * localTime + phase);
    const sample = Math.sin(oscillatorPhase) * amplitude * envelope * tremolo;
    mix.left[frame] += sample * leftGain;
    mix.right[frame] += sample * rightGain;
    oscillatorPhase += phaseStep;
  }
}

function addNoise(
  mix,
  {
    start,
    duration,
    amplitude,
    attack,
    release,
    pan,
    seed,
    color,
    smoothing,
    tremoloHz = 0,
    tremoloDepth = 0,
  }
) {
  const random = mulberry32(seed);
  const startFrame = Math.max(0, Math.floor(start * sampleRate));
  const endFrame = Math.min(
    frameCount,
    Math.ceil((start + duration) * sampleRate)
  );
  const [leftGain, rightGain] = panGains(pan);
  let low = 0;
  let slower = 0;
  for (let frame = startFrame; frame < endFrame; frame += 1) {
    const localTime = (frame - startFrame) / sampleRate;
    const white = random() * 2 - 1;
    low = smoothing * low + (1 - smoothing) * white;
    slower = 0.992 * slower + 0.008 * low;
    const colored =
      color === 'low' ? low : color === 'high' ? white - low : low - slower;
    const envelope = shapedEnvelope(localTime, duration, attack, release);
    const tremolo =
      1 -
      tremoloDepth * 0.5 +
      tremoloDepth * 0.5 * Math.sin(Math.PI * 2 * tremoloHz * localTime);
    const sample = colored * amplitude * envelope * tremolo * 3.2;
    mix.left[frame] += sample * leftGain;
    mix.right[frame] += sample * rightGain;
  }
}

function applyCrossEcho(mix, amount) {
  const delayFrames = Math.round(sampleRate * 0.173);
  for (let frame = delayFrames; frame < frameCount; frame += 1) {
    const previousLeft = mix.left[frame - delayFrames];
    const previousRight = mix.right[frame - delayFrames];
    mix.left[frame] += previousRight * amount;
    mix.right[frame] += previousLeft * amount;
  }
}

function finishMix(mix) {
  let peak = 0;
  let squareSum = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const fadeIn = clamp(frame / (sampleRate * 0.45), 0, 1);
    const fadeOut = clamp((frameCount - frame) / (sampleRate * 0.8), 0, 1);
    const fade = smoothStep(Math.min(fadeIn, fadeOut));
    mix.left[frame] *= fade;
    mix.right[frame] *= fade;
    peak = Math.max(
      peak,
      Math.abs(mix.left[frame]),
      Math.abs(mix.right[frame])
    );
  }
  const targetPeak = 0.34;
  const scale = peak > 0 ? targetPeak / peak : 1;
  peak = 0;
  let maxAdjacentDelta = 0;
  let previousLeft = 0;
  let previousRight = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    mix.left[frame] = Math.tanh(mix.left[frame] * scale);
    mix.right[frame] = Math.tanh(mix.right[frame] * scale);
    peak = Math.max(
      peak,
      Math.abs(mix.left[frame]),
      Math.abs(mix.right[frame])
    );
    maxAdjacentDelta = Math.max(
      maxAdjacentDelta,
      Math.abs(mix.left[frame] - previousLeft),
      Math.abs(mix.right[frame] - previousRight)
    );
    previousLeft = mix.left[frame];
    previousRight = mix.right[frame];
    squareSum +=
      mix.left[frame] * mix.left[frame] + mix.right[frame] * mix.right[frame];
  }
  return {
    left: mix.left,
    right: mix.right,
    metrics: {
      peak: round(peak, 6),
      rms: round(Math.sqrt(squareSum / (frameCount * 2)), 6),
      normalizationScale: round(scale, 6),
      maxAdjacentDelta: round(maxAdjacentDelta, 6),
    },
  };
}

function encodeWav(left, right) {
  const bytesPerSample = 2;
  const channelCount = 2;
  const dataSize = frameCount * channelCount * bytesPerSample;
  const buffer = Buffer.allocUnsafe(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channelCount * bytesPerSample, 28);
  buffer.writeUInt16LE(channelCount * bytesPerSample, 32);
  buffer.writeUInt16LE(bytesPerSample * 8, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    buffer.writeInt16LE(floatToInt16(left[frame]), offset);
    buffer.writeInt16LE(floatToInt16(right[frame]), offset + 2);
    offset += 4;
  }
  return buffer;
}

async function probeAudio(audioPath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration:stream=codec_name,codec_type,sample_rate,channels',
    '-of',
    'json',
    audioPath,
  ]);
  const probe = JSON.parse(stdout);
  const stream = probe.streams?.find(
    (candidate) => candidate.codec_type === 'audio'
  );
  assert.ok(stream, `${audioPath} contains an audio stream`);
  return {
    codec: stream.codec_name,
    sampleRate: Number(stream.sample_rate),
    channels: Number(stream.channels),
    durationSeconds: round(Number(probe.format.duration), 3),
  };
}

async function measureLoudness(audioPath) {
  const { stderr } = await execFileAsync(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostats',
      '-i',
      audioPath,
      '-af',
      'ebur128=peak=true',
      '-f',
      'null',
      '-',
    ],
    { maxBuffer: 10 * 1024 * 1024 }
  );
  return {
    integratedLufs: lastMetric(stderr, /I:\s+(-?\d+(?:\.\d+)?) LUFS/g),
    loudnessRangeLu: lastMetric(stderr, /LRA:\s+(-?\d+(?:\.\d+)?) LU/g),
    truePeakDbfs: lastMetric(stderr, /Peak:\s+(-?\d+(?:\.\d+)?) dBFS/g),
  };
}

function lastMetric(output, pattern) {
  const matches = [...output.matchAll(pattern)];
  assert.ok(matches.length > 0, `FFmpeg metric ${pattern} is present`);
  return Number(matches.at(-1)[1]);
}

function shapedEnvelope(time, duration, attack, release) {
  const attackLevel = attack > 0 ? clamp(time / attack, 0, 1) : 1;
  const releaseLevel =
    release > 0 ? clamp((duration - time) / release, 0, 1) : 1;
  return smoothStep(Math.min(attackLevel, releaseLevel));
}

function panGains(pan) {
  const angle = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(angle), Math.sin(angle)];
}

function floatToInt16(value) {
  return Math.round(clamp(value, -1, 1) * 32_767);
}

function sectionEvent(zone, startSeconds, intent) {
  return { zone, startSeconds, intent };
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function smoothStep(value) {
  return value * value * (3 - 2 * value);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value, digits) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
