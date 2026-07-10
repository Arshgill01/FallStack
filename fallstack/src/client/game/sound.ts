import type { ZoneId } from '../../shared/game/mutation';
import type { SoundId } from './events';

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export class ProceduralSound {
  private context: AudioContext | null = null;
  private chargeOsc: OscillatorNode | null = null;
  private chargeGain: GainNode | null = null;

  constructor(private muted: boolean) {}

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) this.stopCharge();
    if (muted) void this.context?.suspend();
    if (!muted) void this.context?.resume();
  }

  unlock() {
    if (this.muted) return;
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) return;
    this.context ??= new AudioContextCtor();
    if (this.context.state === 'suspended') void this.context.resume();
  }

  play(id: SoundId, zoneId?: ZoneId) {
    if (this.muted) return;
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
    if (zoneId === 'bell_shaft') return this.ping(760, 0.12, 0.022);
    if (zoneId === 'moon_roof') return this.ping(980, 0.18, 0.018);
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
