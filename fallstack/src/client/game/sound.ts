import { ZONE_IDS, type ZoneId } from '../../shared/game/mutation';
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

export class ProceduralSound {
  private context: AudioContext | null = null;
  private chargeOsc: OscillatorNode | null = null;
  private chargeGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicNodes: AudioNode[] = [];
  private musicTimers: number[] = [];
  private musicStopTimer: number | null = null;

  constructor(private options: SoundOptions) {}

  setGameplayMuted(gameplayMuted: boolean) {
    this.options = { ...this.options, gameplayMuted };
    if (gameplayMuted) this.stopCharge();
  }

  setMusicMuted(musicMuted: boolean) {
    this.options = { ...this.options, musicMuted };
    if (musicMuted) this.stopMusic();
    if (!musicMuted && this.context) this.startMusic();
  }

  unlock() {
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) return;
    this.context ??= new AudioContextCtor();
    if (this.context.state === 'suspended') void this.context.resume();
    if (!this.options.musicMuted) this.startMusic();
  }

  play(id: SoundId, zoneId?: ZoneId) {
    if (this.options.gameplayMuted) return;
    this.unlock();
    if (!this.context) return;
    if (id === 'charge-start') return this.startCharge();
    if (id === 'launch') return this.launch();
    if (id === 'land') return this.land(zoneId);
    if (id === 'fall') return this.fall();
    if (id === 'mutation') return this.ping(620, 0.12, 0.035);
    if (id === 'checkpoint') return this.checkpoint();
    return this.noise(0.025, 1400, 0.018);
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

    if (this.musicGain) {
      const now = this.context.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setTargetAtTime(0.045, now, 0.18);
      if (this.musicTimers.length === 0) this.startBellLoop();
      return;
    }

    const now = this.context.currentTime;
    this.musicGain = this.context.createGain();
    this.musicGain.gain.setValueAtTime(0.0001, now);
    this.musicGain.gain.exponentialRampToValueAtTime(0.045, now + 1.8);
    this.musicGain.connect(this.context.destination);

    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(760, now);
    filter.Q.setValueAtTime(0.72, now);
    filter.connect(this.musicGain);
    this.musicNodes.push(filter);

    const droneA = this.context.createOscillator();
    const droneAGain = this.context.createGain();
    droneA.type = 'sine';
    droneA.frequency.setValueAtTime(55, now);
    droneAGain.gain.setValueAtTime(0.24, now);
    droneA.connect(droneAGain).connect(filter);
    droneA.start(now);

    const droneB = this.context.createOscillator();
    const droneBGain = this.context.createGain();
    droneB.type = 'triangle';
    droneB.frequency.setValueAtTime(82.41, now);
    droneBGain.gain.setValueAtTime(0.085, now);
    droneB.connect(droneBGain).connect(filter);
    droneB.start(now);

    const pulse = this.context.createOscillator();
    const pulseGain = this.context.createGain();
    pulse.type = 'sine';
    pulse.frequency.setValueAtTime(0.07, now);
    pulseGain.gain.setValueAtTime(35, now);
    pulse.connect(pulseGain).connect(filter.frequency);
    pulse.start(now);

    this.musicNodes.push(droneA, droneAGain, droneB, droneBGain, pulse, pulseGain);
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
      this.musicGain?.disconnect();
      this.musicGain = null;
    }, 420);
  }

  private startBellLoop() {
    this.playMusicBell();
    const timer = window.setInterval(() => this.playMusicBell(), 3600);
    this.musicTimers.push(timer);
  }

  private playMusicBell() {
    if (!this.context || !this.musicGain || this.options.musicMuted) return;
    const scale = [220, 246.94, 293.66, 329.63, 392, 440];
    const now = this.context.currentTime;
    const root = scale[Math.floor(Math.random() * scale.length)]!;
    this.musicBell(root, now + 0.08, 0.028);
    this.musicBell(root * 1.5, now + 0.72, 0.016);
    if (Math.random() > 0.45) this.musicBell(root * 2, now + 1.38, 0.012);
  }

  private musicBell(frequency: number, startAt: number, volume: number) {
    if (!this.context || !this.musicGain) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, startAt);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(frequency * 2, startAt);
    filter.Q.setValueAtTime(8, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.8);
    osc.connect(filter).connect(gain).connect(this.musicGain);
    osc.start(startAt);
    osc.stop(startAt + 2);
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
    this.chargeOsc.type = 'sine';
    this.chargeOsc.frequency.setValueAtTime(170, now);
    this.chargeOsc.frequency.exponentialRampToValueAtTime(520, now + 0.9);
    this.chargeGain.gain.setValueAtTime(0.0001, now);
    this.chargeGain.gain.exponentialRampToValueAtTime(0.035, now + 0.12);
    this.chargeOsc.connect(this.chargeGain).connect(this.context.destination);
    this.chargeOsc.start(now);
  }

  private launch() {
    this.stopCharge();
    this.noise(0.05, 900, 0.04);
    this.ping(240, 0.08, 0.03);
  }

  private land(zoneId?: ZoneId) {
    const zoneIndex = zoneId ? ZONE_IDS.indexOf(zoneId) : 0;
    if (zoneIndex >= ZONE_IDS.length * 0.66)
      return this.ping(980, 0.18, 0.018);
    if (zoneIndex >= ZONE_IDS.length * 0.33)
      return this.ping(760, 0.12, 0.022);
    return this.noise(0.06, 260, 0.035);
  }

  private fall() {
    this.noise(0.09, 180, 0.05);
    window.setTimeout(() => this.ping(520, 0.16, 0.026), 120);
  }

  private checkpoint() {
    this.ping(420, 0.16, 0.026);
    window.setTimeout(() => this.ping(630, 0.18, 0.024), 80);
  }

  private ping(frequency: number, duration: number, volume: number) {
    if (!this.context) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(this.context.destination);
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
    source.connect(filter).connect(gain).connect(this.context.destination);
    source.start();
  }
}
