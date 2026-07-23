import { ZONE_IDS, type ZoneId } from '../../shared/game/mutation.js';
import type { SoundId } from './events';

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

type SoundOptions = {
  gameplayMuted: boolean;
  musicMuted: boolean;
};

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

export class ProceduralSound {
  private context: AudioContext | null = null;
  private chargeOsc: OscillatorNode | null = null;
  private chargeGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private gameplayGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicNodes: AudioNode[] = [];
  private musicTimers: number[] = [];
  private musicStopTimer: number | null = null;
  private musicStartTimer: number | null = null;
  private musicPhraseIndex = 0;

  constructor(private options: SoundOptions) {}

  setGameplayMuted(gameplayMuted: boolean) {
    this.options = { ...this.options, gameplayMuted };
    if (gameplayMuted) this.stopCharge();
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

  unlock() {
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) return;
    this.context ??= new AudioContextCtor();
    this.ensureOutputBuses();
    if (this.context.state === 'suspended') void this.context.resume();
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
      }, 2000);
    }
  }

  play(id: SoundId, zoneId?: ZoneId) {
    if (this.options.gameplayMuted) return;
    this.unlock();
    if (!this.context) return;
    if (id === 'charge-start') return this.startCharge();
    if (id === 'launch') return this.launch();
    if (id === 'land') return this.land(zoneId);
    if (id === 'fall') return this.fall();
    if (id === 'mutation') return this.ping(369.99, 0.16, 0.026);
    if (id === 'checkpoint') return this.checkpoint();
    return this.noise(0.035, 900, 0.014);
  }

  stopCharge() {
    this.chargeGain?.gain.cancelScheduledValues(0);
    this.chargeGain?.gain.setTargetAtTime(
      0.0001,
      this.context?.currentTime ?? 0,
      0.015
    );
    this.chargeOsc?.stop((this.context?.currentTime ?? 0) + 0.04);
    this.chargeOsc = null;
    this.chargeGain = null;
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
      this.musicGain.gain.setTargetAtTime(0.16, now, 0.35);
      if (this.musicTimers.length === 0) this.startBellLoop();
      return;
    }

    const now = this.context.currentTime;
    this.ensureOutputBuses();
    if (!this.musicGain) return;
    this.musicGain.gain.setValueAtTime(0.0001, now);
    this.musicGain.gain.exponentialRampToValueAtTime(0.16, now + 2.4);

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
    droneAGain.gain.setValueAtTime(0.055, now);
    droneA.connect(droneAGain).connect(filter);
    droneA.start(now);

    const droneB = this.context.createOscillator();
    const droneBGain = this.context.createGain();
    droneB.type = 'sine';
    droneB.frequency.setValueAtTime(220, now);
    droneBGain.gain.setValueAtTime(0.035, now);
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
    this.musicBell(first, now + 0.08, 0.055);
    this.musicBell(second, now + 1.72, 0.038);
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
    osc.start(startAt);
    osc.stop(startAt + 2.8);
    osc.addEventListener(
      'ended',
      () => {
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
    this.chargeGain.gain.exponentialRampToValueAtTime(0.025, now + 0.16);
    this.chargeOsc.connect(this.chargeGain).connect(this.gameplayOutput());
    this.chargeOsc.start(now);
  }

  private launch() {
    this.stopCharge();
    this.ping(220, 0.1, 0.028);
    window.setTimeout(() => this.ping(293.66, 0.09, 0.018), 34);
  }

  private land(zoneId?: ZoneId) {
    const zoneIndex = zoneId ? ZONE_IDS.indexOf(zoneId) : 0;
    if (zoneIndex >= ZONE_IDS.length * 0.66) return this.ping(440, 0.15, 0.02);
    if (zoneIndex >= ZONE_IDS.length * 0.33) return this.ping(329.63, 0.12, 0.022);
    return this.ping(164.81, 0.08, 0.026);
  }

  private fall() {
    this.noise(0.12, 260, 0.035);
    window.setTimeout(() => this.ping(146.83, 0.2, 0.022), 90);
  }

  private checkpoint() {
    this.ping(293.66, 0.18, 0.026);
    window.setTimeout(() => this.ping(440, 0.24, 0.022), 110);
  }

  private ping(frequency: number, duration: number, volume: number) {
    if (!this.context) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(this.gameplayOutput());
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private noise(duration: number, filterFrequency: number, volume: number) {
    if (!this.context) return;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(
      1,
      Math.max(1, sampleRate * duration),
      sampleRate
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1)
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = filterFrequency;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(this.gameplayOutput());
    source.start();
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
    this.masterGain.gain.setValueAtTime(0.72, now);
    this.gameplayGain = this.context.createGain();
    this.gameplayGain.gain.setValueAtTime(0.8, now);
    this.musicGain = this.context.createGain();
    this.musicGain.gain.setValueAtTime(0.0001, now);

    this.gameplayGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(compressor).connect(this.context.destination);
  }

  private gameplayOutput() {
    this.ensureOutputBuses();
    return this.gameplayGain ?? this.context!.destination;
  }
}
