import type { ZoneId } from '../../shared/game/mutation.js';
import type {
  ArtifactCollapseEventDetail,
  LandingMaterial,
  LandingSurface,
  SoundId,
  WallBonkEventDetail,
} from './events';

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

type SoundOptions = {
  gameplayMuted: boolean;
  musicMuted: boolean;
};

export const AUDIO_LEVELS = {
  master: 0.86,
  gameplay: 0.95,
  music: 0.34,
  musicStart: 0.26,
  musicDroneA: 0.065,
  musicDroneB: 0.04,
  musicBellPrimary: 0.12,
  musicBellSecondary: 0.085,
  charge: 0.052,
  launchSnap: 0.075,
  launchBody: 0.055,
  landNoise: 0.07,
  landResonance: 0.052,
  wallBonkNoise: 0.085,
  wallBonkRing: 0.065,
  fallNoise: 0.072,
  fallTone: 0.052,
  mutationStamp: 0.095,
  checkpointLatch: 0.078,
  checkpointBell: 0.056,
  summitBell: 0.06,
} as const;

export const MUSIC_START_DELAY_MS = 80;

export type AudioDiagnostics = {
  contextState: string;
  musicActive: boolean;
  musicStartPending: boolean;
  outputPeak: number;
  outputRms: number;
};

export type AudioCaptureApi = {
  start: () => Promise<void>;
  stop: () => Promise<Blob>;
};

export type SoundPlaybackDetail = {
  zoneId?: ZoneId;
  chargePercent?: number;
  material?: LandingMaterial;
  surface?: LandingSurface;
  impactSpeed?: number;
  side?: WallBonkEventDetail['side'];
  artifactType?: ArtifactCollapseEventDetail['type'];
};

export type LandingProfile = {
  weight: number;
  noiseDuration: number;
  noiseFilterFrequency: number;
  noiseVolume: number;
  resonanceFrequency: number;
  resonanceDuration: number;
  resonanceVolume: number;
};

const LANDING_MATERIALS: Record<
  LandingMaterial,
  {
    noiseFilterFrequency: number;
    resonanceFrequency: number;
    resonanceDuration: number;
    noiseScale: number;
    resonanceScale: number;
  }
> = {
  stone: {
    noiseFilterFrequency: 540,
    resonanceFrequency: 112,
    resonanceDuration: 0.11,
    noiseScale: 1,
    resonanceScale: 1,
  },
  metal: {
    noiseFilterFrequency: 1_650,
    resonanceFrequency: 286,
    resonanceDuration: 0.17,
    noiseScale: 0.72,
    resonanceScale: 0.92,
  },
  moon: {
    noiseFilterFrequency: 880,
    resonanceFrequency: 174,
    resonanceDuration: 0.15,
    noiseScale: 0.78,
    resonanceScale: 0.82,
  },
  obstacle: {
    noiseFilterFrequency: 1_100,
    resonanceFrequency: 196,
    resonanceDuration: 0.09,
    noiseScale: 0.82,
    resonanceScale: 0.7,
  },
  summit: {
    noiseFilterFrequency: 1_250,
    resonanceFrequency: 220,
    resonanceDuration: 0.2,
    noiseScale: 0.62,
    resonanceScale: 0.78,
  },
  corpse: {
    noiseFilterFrequency: 360,
    resonanceFrequency: 92,
    resonanceDuration: 0.08,
    noiseScale: 0.66,
    resonanceScale: 0.58,
  },
  mercy: {
    noiseFilterFrequency: 1_350,
    resonanceFrequency: 246,
    resonanceDuration: 0.13,
    noiseScale: 0.55,
    resonanceScale: 0.72,
  },
  ghost: {
    noiseFilterFrequency: 2_400,
    resonanceFrequency: 392,
    resonanceDuration: 0.2,
    noiseScale: 0.45,
    resonanceScale: 0.52,
  },
  cursed: {
    noiseFilterFrequency: 1_900,
    resonanceFrequency: 138,
    resonanceDuration: 0.12,
    noiseScale: 0.9,
    resonanceScale: 0.84,
  },
};

export function landingProfile(input: {
  material: LandingMaterial;
  surface: LandingSurface;
  impactSpeed: number;
}): LandingProfile {
  const material = LANDING_MATERIALS[input.material];
  const weight = clamp((input.impactSpeed - 90) / 960, 0.16, 1);
  const checkpointScale = input.surface === 'checkpoint' ? 0.82 : 1;
  return {
    weight,
    noiseDuration: 0.035 + weight * 0.075,
    noiseFilterFrequency: material.noiseFilterFrequency,
    noiseVolume:
      AUDIO_LEVELS.landNoise *
      material.noiseScale *
      (0.42 + weight * 0.58) *
      checkpointScale,
    resonanceFrequency: material.resonanceFrequency,
    resonanceDuration: material.resonanceDuration + weight * 0.045,
    resonanceVolume:
      AUDIO_LEVELS.landResonance *
      material.resonanceScale *
      (0.38 + weight * 0.62) *
      checkpointScale,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function shouldResumeAudioContext(state: string): boolean {
  return state !== 'running' && state !== 'closed';
}

export function resolveGameplayMuted(
  gameplayPreference: string | null,
  legacyPreference: string | null
): boolean {
  if (gameplayPreference !== null) return gameplayPreference === 'true';
  return legacyPreference === 'true';
}

export function shouldScheduleMusicStart(input: {
  musicMuted: boolean;
  musicNodeCount: number;
  startPending: boolean;
}): boolean {
  return (
    !input.musicMuted &&
    input.musicNodeCount === 0 &&
    !input.startPending
  );
}

const MUSIC_PHRASE = [293.66, 440, 369.99, 329.63, 246.94, 293.66, 220, 246.94] as const;

type MusicBellVoice = {
  oscillator: OscillatorNode;
  filter: BiquadFilterNode;
  gain: GainNode;
};

export class ProceduralSound {
  private context: AudioContext | null = null;
  private chargeOsc: OscillatorNode | null = null;
  private chargeGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private gameplayGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private outputSamples: Uint8Array<ArrayBuffer> | null = null;
  private outputPrimed = false;
  private captureDestination: MediaStreamAudioDestinationNode | null = null;
  private captureRecorder: MediaRecorder | null = null;
  private captureChunks: Blob[] = [];
  private gameplayTimers = new Set<number>();
  private musicNodes: AudioNode[] = [];
  private musicBellVoices = new Set<MusicBellVoice>();
  private musicTimers: number[] = [];
  private musicStopTimer: number | null = null;
  private musicStartTimer: number | null = null;
  private musicPhraseIndex = 0;
  private noiseState = 0x6d2b79f5;

  constructor(private options: SoundOptions) {}

  setGameplayMuted(gameplayMuted: boolean) {
    this.options = { ...this.options, gameplayMuted };
    this.setGameplayBusMuted(gameplayMuted);
    if (gameplayMuted) {
      this.clearGameplayTimers();
      this.stopCharge();
    }
  }

  setMusicMuted(musicMuted: boolean) {
    this.options = { ...this.options, musicMuted };
    if (musicMuted) {
      if (this.musicStartTimer !== null)
        window.clearTimeout(this.musicStartTimer);
      this.musicStartTimer = null;
      this.stopMusic();
    }
    if (!musicMuted && this.context) this.unlock();
  }

  previewGameplay() {
    if (this.options.gameplayMuted) return;
    this.unlock();
    this.ping(523.25, 0.14, AUDIO_LEVELS.checkpointBell);
  }

  getDiagnostics(): AudioDiagnostics {
    const samples = this.outputSamples;
    if (!this.outputAnalyser || !samples) {
      return {
        contextState: this.context?.state ?? 'uninitialized',
        musicActive: this.musicNodes.length > 0,
        musicStartPending: this.musicStartTimer !== null,
        outputPeak: 0,
        outputRms: 0,
      };
    }

    this.outputAnalyser.getByteTimeDomainData(samples);
    let peak = 0;
    let squareSum = 0;
    for (const sample of samples) {
      const centered = (sample - 128) / 128;
      peak = Math.max(peak, Math.abs(centered));
      squareSum += centered * centered;
    }

    return {
      contextState: this.context?.state ?? 'uninitialized',
      musicActive: this.musicNodes.length > 0,
      musicStartPending: this.musicStartTimer !== null,
      outputPeak: Number(peak.toFixed(4)),
      outputRms: Number(Math.sqrt(squareSum / samples.length).toFixed(4)),
    };
  }

  async startCapture(): Promise<void> {
    if (this.captureRecorder?.state === 'recording')
      throw new Error('Audio capture is already running.');
    if (typeof MediaRecorder === 'undefined')
      throw new Error('MediaRecorder is unavailable in this browser.');

    this.unlock();
    if (!this.context || !this.outputAnalyser)
      throw new Error('Web Audio is unavailable in this browser.');
    if (shouldResumeAudioContext(this.context.state))
      await this.context.resume();
    if (this.context.state !== 'running')
      throw new Error(`AudioContext is ${this.context.state}.`);

    const destination = this.context.createMediaStreamDestination();
    this.outputAnalyser.connect(destination);
    const mimeType = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
    ].find((candidate) => MediaRecorder.isTypeSupported(candidate));
    const recorder = new MediaRecorder(
      destination.stream,
      mimeType ? { mimeType } : undefined
    );

    this.captureDestination = destination;
    this.captureRecorder = recorder;
    this.captureChunks = [];
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) this.captureChunks.push(event.data);
    });
    recorder.start();
  }

  async stopCapture(): Promise<Blob> {
    const recorder = this.captureRecorder;
    const destination = this.captureDestination;
    if (!recorder || !destination || recorder.state === 'inactive')
      throw new Error('Audio capture is not running.');

    const stopped = new Promise<void>((resolve, reject) => {
      recorder.addEventListener('stop', () => resolve(), { once: true });
      recorder.addEventListener(
        'error',
        (event) => reject(new Error(event.error.message)),
        { once: true }
      );
    });
    recorder.stop();
    await stopped;

    try {
      this.outputAnalyser?.disconnect(destination);
    } catch {
      // The AudioContext may already have replaced its output graph.
    }
    for (const track of destination.stream.getTracks()) track.stop();

    const blob = new Blob(this.captureChunks, {
      type: recorder.mimeType || this.captureChunks[0]?.type || 'audio/webm',
    });
    this.captureDestination = null;
    this.captureRecorder = null;
    this.captureChunks = [];
    return blob;
  }

  unlock() {
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) return;
    if (!this.context || this.context.state === 'closed') {
      this.resetClosedContextState();
      this.context = new AudioContextCtor();
      this.masterGain = null;
      this.gameplayGain = null;
      this.musicGain = null;
      this.outputAnalyser = null;
      this.outputSamples = null;
      this.outputPrimed = false;
      this.musicNodes = [];
      this.musicBellVoices.clear();
    }
    this.ensureOutputBuses();
    this.primeOutput();
    if (shouldResumeAudioContext(this.context.state))
      void this.context.resume().catch(() => undefined);
    if (
      shouldScheduleMusicStart({
        musicMuted: this.options.musicMuted,
        musicNodeCount: this.musicNodes.length,
        startPending: this.musicStartTimer !== null,
      })
    ) {
      this.musicStartTimer = window.setTimeout(() => {
        this.musicStartTimer = null;
        this.startMusic();
      }, MUSIC_START_DELAY_MS);
    }
  }

  play(id: SoundId, detail: SoundPlaybackDetail = {}) {
    if (this.options.gameplayMuted) return;
    this.unlock();
    if (!this.context) return;
    if (id === 'charge-start') return this.startCharge();
    if (id === 'launch') return this.launch(detail.chargePercent);
    if (id === 'land') return this.land(detail);
    if (id === 'wall-bonk') return this.wallBonk(detail);
    if (id === 'artifact-collapse') return this.artifactCollapse(detail);
    if (id === 'fall') return this.fall();
    if (id === 'mutation') return this.mutationStamp();
    if (id === 'checkpoint') return this.checkpoint();
    if (id === 'summit') return this.summit();
    return this.noise(0.026, 1_600, 0.038, 'bandpass', 1.4);
  }

  stopCharge() {
    const oscillator = this.chargeOsc;
    const gain = this.chargeGain;
    this.chargeOsc = null;
    this.chargeGain = null;
    if (!this.context || this.context.state === 'closed') return;
    gain?.gain.cancelScheduledValues(0);
    gain?.gain.setTargetAtTime(
      0.0001,
      this.context.currentTime,
      0.015
    );
    try {
      oscillator?.stop(this.context.currentTime + 0.04);
    } catch {
      // The source may already have ended during a context interruption.
    }
  }

  private startMusic() {
    if (!this.context || this.options.musicMuted) return;
    if (this.musicStopTimer !== null) {
      window.clearTimeout(this.musicStopTimer);
      this.musicStopTimer = null;
    }

    if (this.musicGain && this.musicNodes.length > 0) {
      const now = this.context.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setTargetAtTime(AUDIO_LEVELS.music, now, 0.18);
      if (this.musicTimers.length === 0) this.startBellLoop();
      return;
    }

    const now = this.context.currentTime;
    this.ensureOutputBuses();
    if (!this.musicGain) return;
    this.musicGain.gain.setValueAtTime(AUDIO_LEVELS.musicStart, now);
    this.musicGain.gain.exponentialRampToValueAtTime(
      AUDIO_LEVELS.music,
      now + 0.5
    );

    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(680, now);
    filter.Q.setValueAtTime(0.45, now);
    filter.connect(this.musicGain);
    this.musicNodes.push(filter);

    const droneA = this.context.createOscillator();
    const droneAGain = this.context.createGain();
    droneA.type = 'triangle';
    droneA.frequency.setValueAtTime(146.83, now);
    droneAGain.gain.setValueAtTime(AUDIO_LEVELS.musicDroneA, now);
    droneA.connect(droneAGain).connect(filter);
    droneA.start(now);

    const droneB = this.context.createOscillator();
    const droneBGain = this.context.createGain();
    droneB.type = 'sine';
    droneB.frequency.setValueAtTime(220, now);
    droneBGain.gain.setValueAtTime(AUDIO_LEVELS.musicDroneB, now);
    droneB.connect(droneBGain).connect(filter);
    droneB.start(now);

    const pulse = this.context.createOscillator();
    const pulseGain = this.context.createGain();
    pulse.type = 'sine';
    pulse.frequency.setValueAtTime(0.045, now);
    pulseGain.gain.setValueAtTime(55, now);
    pulse.connect(pulseGain).connect(filter.frequency);
    pulse.start(now);

    this.musicNodes.push(
      droneA,
      droneAGain,
      droneB,
      droneBGain,
      pulse,
      pulseGain
    );
    this.startBellLoop();
  }

  private stopMusic() {
    if (!this.context) return;
    if (this.musicStopTimer !== null) window.clearTimeout(this.musicStopTimer);
    const now = this.context.currentTime;
    this.musicGain?.gain.cancelScheduledValues(now);
    this.musicGain?.gain.setTargetAtTime(0.0001, now, 0.12);
    this.stopMusicBellVoices(now + 0.14);
    for (const timer of this.musicTimers) window.clearInterval(timer);
    this.musicTimers = [];
    this.musicStopTimer = window.setTimeout(() => {
      this.musicStopTimer = null;
      if (!this.options.musicMuted) return this.startMusic();
      for (const node of this.musicNodes) {
        (node as Partial<AudioScheduledSourceNode>).stop?.();
        node.disconnect();
      }
      this.musicNodes = [];
    }, 420);
  }

  private startBellLoop() {
    this.playMusicBell();
    const timer = window.setInterval(() => this.playMusicBell(), 4400);
    this.musicTimers.push(timer);
  }

  private playMusicBell() {
    if (!this.context || !this.musicGain || this.options.musicMuted) return;
    const now = this.context.currentTime;
    const first = MUSIC_PHRASE[this.musicPhraseIndex % MUSIC_PHRASE.length]!;
    const second = MUSIC_PHRASE[(this.musicPhraseIndex + 1) % MUSIC_PHRASE.length]!;
    this.musicPhraseIndex = (this.musicPhraseIndex + 2) % MUSIC_PHRASE.length;
    this.musicBell(first, now + 0.08, AUDIO_LEVELS.musicBellPrimary);
    this.musicBell(second, now + 1.72, AUDIO_LEVELS.musicBellSecondary);
  }

  private musicBell(frequency: number, startAt: number, volume: number) {
    if (!this.context || !this.musicGain) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, startAt);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, startAt);
    filter.Q.setValueAtTime(0.7, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 2.6);
    osc.connect(filter).connect(gain).connect(this.musicGain);
    const voice = { oscillator: osc, filter, gain };
    this.musicBellVoices.add(voice);
    osc.start(startAt);
    osc.stop(startAt + 2.8);
    osc.addEventListener(
      'ended',
      () => {
        this.musicBellVoices.delete(voice);
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      },
      { once: true }
    );
  }

  private startCharge() {
    if (!this.context || this.chargeOsc) return;
    const now = this.context.currentTime;
    this.chargeOsc = this.context.createOscillator();
    this.chargeGain = this.context.createGain();
    this.chargeOsc.type = 'triangle';
    this.chargeOsc.frequency.setValueAtTime(130, now);
    this.chargeOsc.frequency.exponentialRampToValueAtTime(330, now + 0.9);
    this.chargeGain.gain.setValueAtTime(0.0001, now);
    this.chargeGain.gain.exponentialRampToValueAtTime(
      AUDIO_LEVELS.charge,
      now + 0.16
    );
    this.chargeOsc.connect(this.chargeGain).connect(this.gameplayOutput());
    this.chargeOsc.start(now);
  }

  private launch(chargePercent = 42) {
    this.stopCharge();
    const strength = clamp(chargePercent / 100, 0.42, 1);
    this.noise(
      0.035 + strength * 0.025,
      1_450 + strength * 1_050,
      AUDIO_LEVELS.launchSnap * (0.72 + strength * 0.28),
      'bandpass',
      1.8
    );
    this.tone(
      92 + strength * 72,
      0.075 + strength * 0.04,
      AUDIO_LEVELS.launchBody * (0.78 + strength * 0.22),
      'triangle',
      0.002
    );
    this.scheduleGameplay(
      () =>
        this.noise(
          0.028,
          780 + strength * 260,
          AUDIO_LEVELS.launchSnap * 0.34,
          'lowpass'
        ),
      28
    );
  }

  private land(detail: SoundPlaybackDetail) {
    const profile = landingProfile({
      material: detail.material ?? 'stone',
      surface: detail.surface ?? 'route',
      impactSpeed: detail.impactSpeed ?? 420,
    });
    this.noise(
      profile.noiseDuration,
      profile.noiseFilterFrequency,
      profile.noiseVolume,
      detail.material === 'ghost' ? 'highpass' : 'lowpass',
      detail.material === 'metal' ? 2.4 : 0.8
    );
    this.tone(
      profile.resonanceFrequency,
      profile.resonanceDuration,
      profile.resonanceVolume,
      detail.material === 'metal' || detail.material === 'mercy'
        ? 'triangle'
        : 'sine',
      0.002
    );
  }

  private wallBonk(detail: SoundPlaybackDetail) {
    const impact = clamp((detail.impactSpeed ?? 210) / 500, 0.3, 1);
    this.noise(
      0.04 + impact * 0.025,
      1_750,
      AUDIO_LEVELS.wallBonkNoise * (0.68 + impact * 0.32),
      'bandpass',
      3.2
    );
    this.tone(
      detail.side === 'left' ? 468 : 514,
      0.07 + impact * 0.035,
      AUDIO_LEVELS.wallBonkRing * (0.75 + impact * 0.25),
      'triangle',
      0.001
    );
  }

  private artifactCollapse(detail: SoundPlaybackDetail) {
    if (detail.artifactType === 'ghost_platform') {
      this.noise(0.14, 2_800, 0.05, 'highpass', 0.7);
      this.tone(392, 0.18, 0.035, 'sine', 0.008);
      return;
    }
    this.noise(0.11, 1_450, 0.09, 'bandpass', 2.2);
    this.tone(126, 0.12, 0.06, 'triangle', 0.001);
    this.scheduleGameplay(
      () => this.noise(0.045, 2_100, 0.05, 'bandpass', 2.8),
      54
    );
  }

  private fall() {
    this.noise(0.18, 760, AUDIO_LEVELS.fallNoise, 'bandpass', 0.65);
    this.scheduleGameplay(
      () => this.tone(86, 0.19, AUDIO_LEVELS.fallTone, 'triangle', 0.004),
      105
    );
  }

  private mutationStamp() {
    this.noise(0.045, 620, AUDIO_LEVELS.mutationStamp, 'lowpass', 0.9);
    this.tone(104, 0.085, 0.06, 'triangle', 0.001);
    this.scheduleGameplay(
      () => this.noise(0.024, 1_900, 0.03, 'bandpass', 2.4),
      72
    );
  }

  private checkpoint() {
    this.noise(0.055, 920, AUDIO_LEVELS.checkpointLatch, 'bandpass', 2.6);
    this.tone(246.94, 0.22, AUDIO_LEVELS.checkpointBell, 'triangle', 0.006);
    this.scheduleGameplay(
      () => this.tone(369.99, 0.28, 0.045, 'sine', 0.008),
      135
    );
  }

  private summit() {
    this.noise(0.09, 2_600, 0.04, 'highpass', 0.8);
    for (const [index, frequency] of [220, 329.63, 493.88].entries()) {
      this.scheduleGameplay(
        () =>
          this.tone(
            frequency,
            0.48 - index * 0.06,
            AUDIO_LEVELS.summitBell * (1 - index * 0.12),
            index === 0 ? 'triangle' : 'sine',
            0.012
          ),
        index * 145
      );
    }
  }

  private ping(frequency: number, duration: number, volume: number) {
    this.tone(frequency, duration, volume, 'sine', 0.001);
  }

  private tone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    attack: number
  ) {
    if (
      !this.context ||
      this.context.state === 'closed' ||
      this.options.gameplayMuted
    )
      return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, volume),
      now + Math.max(0.001, attack)
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(this.gameplayOutput());
    osc.start(now);
    osc.stop(now + duration + 0.02);
    osc.addEventListener(
      'ended',
      () => {
        osc.disconnect();
        gain.disconnect();
      },
      { once: true }
    );
  }

  private noise(
    duration: number,
    filterFrequency: number,
    volume: number,
    filterType: BiquadFilterType = 'lowpass',
    filterQ = 0.7
  ) {
    if (
      !this.context ||
      this.context.state === 'closed' ||
      this.options.gameplayMuted
    )
      return;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(
      1,
      Math.max(1, sampleRate * duration),
      sampleRate
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1)
      data[i] = this.nextNoiseSample() * (1 - i / data.length);
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = filterType;
    filter.frequency.value = filterFrequency;
    filter.Q.value = filterQ;
    gain.gain.setValueAtTime(
      Math.max(0.0002, volume),
      this.context.currentTime
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      this.context.currentTime + duration
    );
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(this.gameplayOutput());
    source.start();
    source.addEventListener(
      'ended',
      () => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
      },
      { once: true }
    );
  }

  private nextNoiseSample() {
    this.noiseState = (this.noiseState * 1_664_525 + 1_013_904_223) >>> 0;
    return (this.noiseState / 0xffffffff) * 2 - 1;
  }

  private ensureOutputBuses() {
    if (!this.context || this.masterGain) return;
    const now = this.context.currentTime;
    const compressor = this.context.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-22, now);
    compressor.knee.setValueAtTime(18, now);
    compressor.ratio.setValueAtTime(3, now);
    compressor.attack.setValueAtTime(0.012, now);
    compressor.release.setValueAtTime(0.24, now);

    this.masterGain = this.context.createGain();
    this.masterGain.gain.setValueAtTime(AUDIO_LEVELS.master, now);
    this.gameplayGain = this.context.createGain();
    this.gameplayGain.gain.setValueAtTime(
      this.options.gameplayMuted ? 0.0001 : AUDIO_LEVELS.gameplay,
      now
    );
    this.musicGain = this.context.createGain();
    this.musicGain.gain.setValueAtTime(0.0001, now);
    this.outputAnalyser = this.context.createAnalyser();
    this.outputAnalyser.fftSize = 256;
    this.outputAnalyser.smoothingTimeConstant = 0.35;
    this.outputSamples = new Uint8Array(this.outputAnalyser.fftSize);

    this.gameplayGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain
      .connect(compressor)
      .connect(this.outputAnalyser)
      .connect(this.context.destination);
  }

  private primeOutput() {
    if (!this.context || this.outputPrimed) return;
    const source = this.context.createBufferSource();
    source.buffer = this.context.createBuffer(1, 1, this.context.sampleRate);
    source.connect(this.masterGain ?? this.context.destination);
    source.start();
    source.addEventListener(
      'ended',
      () => source.disconnect(),
      { once: true }
    );
    this.outputPrimed = true;
  }

  private gameplayOutput() {
    this.ensureOutputBuses();
    return this.gameplayGain ?? this.context!.destination;
  }

  private scheduleGameplay(callback: () => void, delayMs: number) {
    const timer = window.setTimeout(() => {
      this.gameplayTimers.delete(timer);
      if (!this.options.gameplayMuted) callback();
    }, delayMs);
    this.gameplayTimers.add(timer);
  }

  private clearGameplayTimers() {
    for (const timer of this.gameplayTimers) window.clearTimeout(timer);
    this.gameplayTimers.clear();
  }

  private setGameplayBusMuted(muted: boolean) {
    if (!this.context || !this.gameplayGain || this.context.state === 'closed')
      return;
    const now = this.context.currentTime;
    this.gameplayGain.gain.cancelScheduledValues(now);
    this.gameplayGain.gain.setTargetAtTime(
      muted ? 0.0001 : AUDIO_LEVELS.gameplay,
      now,
      0.008
    );
  }

  private stopMusicBellVoices(stopAt: number) {
    for (const voice of this.musicBellVoices) {
      try {
        voice.oscillator.stop(stopAt);
      } catch {
        // A repeated mute can encounter a source already scheduled to stop.
      }
    }
  }

  private resetClosedContextState() {
    if (this.musicStartTimer !== null)
      window.clearTimeout(this.musicStartTimer);
    if (this.musicStopTimer !== null) window.clearTimeout(this.musicStopTimer);
    for (const timer of this.musicTimers) window.clearInterval(timer);
    this.clearGameplayTimers();
    this.musicStartTimer = null;
    this.musicStopTimer = null;
    this.musicTimers = [];
    this.musicNodes = [];
    this.musicBellVoices.clear();
    this.chargeOsc = null;
    this.chargeGain = null;
  }
}
