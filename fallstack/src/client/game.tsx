import './index.css';

import Phaser from 'phaser';
import {
  StrictMode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
} from 'react';
import { createRoot } from 'react-dom/client';
import type {
  InitGameResponse,
  RecordClearRequest,
  RecordClearResponse,
  RecordFallRequest,
  RecordFallResponse,
  RecordSummitResponse,
} from '../shared/api';
import {
  createDailySeed,
  createInitialAchievements,
  createSeededCounters,
  deriveSnapshot,
  SEEDED_TOTAL_FALLS,
  type Artifact,
  type FailureBucket,
  type GameSnapshot,
  type ZoneId,
} from '../shared/game/mutation';
import { PLATFORMS, WORLD_HEIGHT, WORLD_WIDTH, ZONES, zoneForY, type Platform } from '../shared/game/tower';

type InputState = {
  left: boolean;
  right: boolean;
  jump: boolean;
};

type FallEventDetail = Omit<RecordFallRequest, 'dailySeed' | 'timestamp'>;
type ClearEventDetail = Omit<RecordClearRequest, 'dailySeed' | 'timestamp'>;
type SummitEventDetail = { attemptId: string };
type LandEventDetail = { zoneId: ZoneId };
type SoundId = 'charge-start' | 'launch' | 'land' | 'fall' | 'mutation' | 'checkpoint' | 'ui';

declare global {
  interface Window {
    fallstackInput: InputState;
    fallstackSnapshot?: GameSnapshot;
    webkitAudioContext?: typeof AudioContext;
  }
}

const INITIAL_INPUT: InputState = { left: false, right: false, jump: false };
const START_POS = { x: 112, y: 2128 };
const CHECKPOINTS: Record<ZoneId, { x: number; y: number }> = {
  lower_ruins: START_POS,
  bell_shaft: { x: 112, y: 1548 },
  moon_roof: { x: 350, y: 942 },
};

function createLocalSnapshot() {
  const seed = createDailySeed();
  return deriveSnapshot({
    ...seed,
    counters: createSeededCounters(),
    totalFalls: SEEDED_TOTAL_FALLS,
    totalClears: 0,
    totalSummits: 0,
    achievements: createInitialAchievements(),
  });
}

function setSharedInput(key: keyof InputState, value: boolean) {
  window.fallstackInput = { ...(window.fallstackInput ?? INITIAL_INPUT), [key]: value };
}

function newAttemptId(prefix: string) {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

class ProceduralSound {
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
    this.chargeGain?.gain.setTargetAtTime(0.0001, this.context?.currentTime ?? 0, 0.015);
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
    const buffer = this.context.createBuffer(1, Math.max(1, sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
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

class FallstackScene extends Phaser.Scene {
  private player?: Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body };
  private platforms?: Phaser.Physics.Arcade.StaticGroup;
  private artifactBodies?: Phaser.Physics.Arcade.StaticGroup;
  private graphics?: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  private space: Phaser.Input.Keyboard.Key | undefined;
  private facing: -1 | 1 = 1;
  private wasGrounded = false;
  private charging = false;
  private chargeStart = 0;
  private lastChargePercent = 0;
  private lastWallBonk = false;
  private currentZone: ZoneId = 'lower_ruins';
  private respawnZone: ZoneId = 'lower_ruins';
  private currentAttemptId = newAttemptId('attempt');
  private highestY = START_POS.y;
  private checkpointed = new Set<ZoneId>();
  private summitSent = false;
  private lastHelperTouchAt = -Infinity;
  private lastTouchedHelper = false;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  create() {
    window.fallstackInput = window.fallstackInput ?? { ...INITIAL_INPUT };
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT + 220);
    this.physics.world.gravity.y = 1550;

    this.graphics = this.add.graphics();
    this.platforms = this.physics.add.staticGroup();
    for (const platform of PLATFORMS) this.addPlatform(platform);

    this.player = this.add.rectangle(START_POS.x, START_POS.y, 24, 34, 0x2a2118) as Phaser.GameObjects.Rectangle & {
      body: Phaser.Physics.Arcade.Body;
    };
    this.physics.add.existing(this.player);
    this.player.body.setSize(24, 34);
    this.player.body.setCollideWorldBounds(true);
    this.player.body.setDragX(850);
    this.player.body.setMaxVelocity(420, 1300);
    this.physics.add.collider(this.player, this.platforms, this.onLand, undefined, this);

    this.artifactBodies = this.physics.add.staticGroup();
    this.physics.add.collider(this.player, this.artifactBodies, this.onArtifactTouch, undefined, this);

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.space = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.12, 0, 84);
    this.cameras.main.setZoom(1);

    this.refreshSnapshot(window.fallstackSnapshot);
  }

  override update(_time: number, deltaMs: number) {
    if (!this.player) return;
    const input = this.readInput();
    const body = this.player.body;
    const onFloor = body.blocked.down || body.touching.down;
    this.currentZone = zoneForY(this.player.y).id;
    this.highestY = Math.min(this.highestY, this.player.y);

    if (input.left) this.facing = -1;
    if (input.right) this.facing = 1;

    if (onFloor) {
      body.setAccelerationX(0);
      body.setVelocityX(input.left ? -155 : input.right ? 155 : Phaser.Math.Linear(body.velocity.x, 0, 0.18));
      this.lastWallBonk = false;
    } else {
      const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      body.setAccelerationX(steer * 620);
      body.setMaxVelocity(390, 1300);
      if ((body.blocked.left || body.blocked.right) && body.velocity.y > -720) this.lastWallBonk = true;
    }

    if (onFloor && input.jump && !this.charging) {
      this.charging = true;
      this.chargeStart = this.time.now;
    }

    if (this.charging && (!input.jump || !onFloor)) {
      const held = Math.max(0, this.time.now - this.chargeStart);
      const percent = Phaser.Math.Clamp(0.32 + (held / 900) * 0.68, 0.32, 1);
      this.lastChargePercent = Math.round(percent * 100);
      if (onFloor && !input.jump) {
        body.setVelocity(this.facing * Phaser.Math.Linear(170, 400, percent), Phaser.Math.Linear(-560, -1000, percent));
        window.dispatchEvent(new CustomEvent('fallstack:launch'));
      }
      this.charging = false;
      window.dispatchEvent(
        new CustomEvent('fallstack:charge', { detail: { percent: Math.round(percent * 100) } })
      );
    }

    if (this.charging) {
      const percent = Phaser.Math.Clamp(0.32 + ((this.time.now - this.chargeStart) / 900) * 0.68, 0.32, 1);
      window.dispatchEvent(
        new CustomEvent('fallstack:charge', { detail: { percent: Math.round(percent * 100) } })
      );
    }

    if (!this.wasGrounded && onFloor) {
      window.dispatchEvent(new CustomEvent<LandEventDetail>('fallstack:land', { detail: { zoneId: this.currentZone } }));
    }
    this.wasGrounded = onFloor;

    this.checkProgress();
    this.checkFall();
    this.updateCamera(deltaMs);
  }

  refreshSnapshot(snapshot?: GameSnapshot) {
    if (snapshot) window.fallstackSnapshot = snapshot;
    this.drawWorld();
    this.rebuildArtifactBodies();
  }

  setReducedMotion(reducedMotion: boolean) {
    this.reducedMotion = reducedMotion;
  }

  private addPlatform(platform: Platform) {
    const rect = this.add.rectangle(
      platform.x + platform.width / 2,
      platform.y + platform.height / 2,
      platform.width,
      platform.height,
      0xffffff,
      0
    );
    rect.setData('platformId', platform.id);
    rect.setData('kind', platform.kind);
    this.platforms?.add(rect);
  }

  private readInput(): InputState {
    return {
      left: Boolean(window.fallstackInput?.left || this.cursors?.left?.isDown),
      right: Boolean(window.fallstackInput?.right || this.cursors?.right?.isDown),
      jump: Boolean(window.fallstackInput?.jump || this.space?.isDown),
    };
  }

  private onLand(_player: unknown, platformObject: unknown) {
    const object = platformObject as Phaser.GameObjects.GameObject;
    if (object.getData('platformId') === 'summit' && !this.summitSent) {
      this.summitSent = true;
      window.dispatchEvent(
        new CustomEvent<SummitEventDetail>('fallstack:summit', { detail: { attemptId: this.currentAttemptId } })
      );
    }
  }

  private onArtifactTouch(_player: unknown, artifactObject: unknown) {
    const object = artifactObject as Phaser.GameObjects.GameObject;
    const type = object.getData('artifactType');
    this.lastTouchedHelper = type === 'corpse_stack' || type === 'mercy_nail';
    if (this.lastTouchedHelper) this.lastHelperTouchAt = this.time.now;
  }

  private checkProgress() {
    if (!this.player) return;
    if (this.respawnZone === 'lower_ruins' && this.player.y < 1620 && !this.checkpointed.has('lower_ruins')) {
      this.unlockZone('bell_shaft', 'lower_ruins');
    }
    if (this.respawnZone === 'bell_shaft' && this.player.y < 900 && !this.checkpointed.has('bell_shaft')) {
      this.unlockZone('moon_roof', 'bell_shaft');
    }
  }

  private unlockZone(nextZone: ZoneId, clearedZone: ZoneId) {
    this.respawnZone = nextZone;
    this.checkpointed.add(clearedZone);
    window.dispatchEvent(
      new CustomEvent<ClearEventDetail>('fallstack:clear', {
        detail: {
          attemptId: this.currentAttemptId,
          zoneId: clearedZone,
          highestY: this.highestY,
        },
      })
    );
  }

  private checkFall() {
    if (!this.player) return;
    const recovery = ZONES.find((zone) => zone.id === this.currentZone)?.recoveryY ?? WORLD_HEIGHT + 120;
    if (this.player.y < recovery) return;

    const failureBucket = this.classifyFailure();
    const zoneId = this.currentZone;
    window.dispatchEvent(
      new CustomEvent<FallEventDetail>('fallstack:fall', {
        detail: {
          attemptId: this.currentAttemptId,
          zoneId,
          failureBucket,
          chargePercent: this.lastChargePercent,
          highestY: this.highestY,
        },
      })
    );
    this.respawn();
  }

  private classifyFailure(): FailureBucket {
    if (this.lastTouchedHelper && this.time.now - this.lastHelperTouchAt < 4000) return 'helper_overuse';
    if (this.lastWallBonk) return 'wall_bonk';
    if (this.lastChargePercent > 82) return 'overjump';
    return 'short_jump';
  }

  private respawn() {
    if (!this.player) return;
    const checkpoint = CHECKPOINTS[this.respawnZone];
    this.player.setPosition(checkpoint.x, checkpoint.y);
    this.player.body.setVelocity(0, 0);
    this.player.body.setAcceleration(0, 0);
    this.currentZone = this.respawnZone;
    this.currentAttemptId = newAttemptId('attempt');
    this.highestY = checkpoint.y;
    this.charging = false;
    this.lastHelperTouchAt = -Infinity;
    this.lastTouchedHelper = false;
  }

  private updateCamera(deltaMs: number) {
    if (!this.player) return;
    const targetY = Phaser.Math.Clamp(this.player.y - 120, 0, WORLD_HEIGHT);
    if (this.reducedMotion) {
      this.cameras.main.scrollY = targetY;
      return;
    }
    const current = this.cameras.main.scrollY;
    this.cameras.main.scrollY = Phaser.Math.Linear(current, targetY, Math.min(1, deltaMs / 260));
  }

  private drawWorld() {
    if (!this.graphics) return;
    this.graphics.clear();
    for (const label of this.labels) label.destroy();
    this.labels = [];

    this.graphics.fillStyle(0xf7efe0, 1).fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.drawZoneBand(260, 900, 0xb8c7d7, 0x516073);
    this.drawZoneBand(900, 1620, 0xc4b8a0, 0x4c5768);
    this.drawZoneBand(1620, 2220, 0xd8b58a, 0x65432f);

    for (const platform of PLATFORMS) this.drawPlatform(platform);

    const snapshot = window.fallstackSnapshot;
    if (!snapshot) return;
    for (const zone of snapshot.zones) {
      this.addLabel(18, (ZONES.find((candidate) => candidate.id === zone.id)?.yTop ?? 0) + 22, `${zone.name} · ${zone.statusLabel}`, 13, '#2a2118');
      for (const artifact of zone.artifacts) this.drawArtifact(artifact);
    }
  }

  private drawZoneBand(yTop: number, yBottom: number, fill: number, line: number) {
    this.graphics?.fillStyle(fill, 0.42).fillRect(0, yTop, WORLD_WIDTH, yBottom - yTop);
    this.graphics?.lineStyle(2, line, 0.22).lineBetween(24, yTop, WORLD_WIDTH - 24, yTop);
  }

  private drawPlatform(platform: Platform) {
    const colors: Record<Platform['kind'], number> = {
      stone: 0x72503a,
      metal: 0x43536a,
      moon: 0x5f6878,
      summit: 0x9b412d,
    };
    this.graphics?.fillStyle(colors[platform.kind], 1).fillRoundedRect(platform.x, platform.y, platform.width, platform.height, 5);
    this.graphics?.fillStyle(0xf7efe0, 0.18).fillRect(platform.x + 4, platform.y + 4, platform.width - 8, 3);
  }

  private drawArtifact(artifact: Artifact) {
    if (artifact.type === 'lantern_trail') {
      this.graphics?.lineStyle(3, 0xd97934, 0.52).beginPath();
      this.graphics?.arc(artifact.x + 60, artifact.y + 10, 72, Math.PI * 1.08, Math.PI * 1.82);
      this.graphics?.strokePath();
      this.addLabel(artifact.x - 22, artifact.y - 28, artifact.label, 11, '#5c3a22');
      return;
    }

    if (artifact.type === 'corpse_stack') {
      this.graphics?.fillStyle(0x8c5835, 1);
      for (let i = 0; i < 3; i += 1) {
        this.graphics?.fillRoundedRect(artifact.x + i * 8, artifact.y + i * 7, artifact.width - i * 16, 10, 3);
      }
    } else if (artifact.type === 'mercy_nail') {
      this.graphics?.fillStyle(0x2f4f5f, 1).fillRoundedRect(artifact.x, artifact.y, artifact.width, artifact.height, 7);
      this.graphics?.fillStyle(0xd97934, 1).fillCircle(artifact.x + artifact.width - 8, artifact.y + artifact.height / 2, 4);
    } else if (artifact.type === 'ghost_platform') {
      this.graphics?.lineStyle(2, 0x405f78, 0.75).strokeRoundedRect(artifact.x, artifact.y, artifact.width, artifact.height, 8);
      this.graphics?.fillStyle(0x9eb7c8, 0.28).fillRoundedRect(artifact.x, artifact.y, artifact.width, artifact.height, 8);
    } else {
      this.graphics?.fillStyle(0x8e2f27, 1).fillRoundedRect(artifact.x, artifact.y, artifact.width, artifact.height, 4);
      this.graphics?.lineStyle(2, 0x2a2118, 0.5).lineBetween(artifact.x + 10, artifact.y + 4, artifact.x + 34, artifact.y + artifact.height - 4);
    }
    this.addLabel(artifact.x - 18, artifact.y - 28, artifact.label, 11, '#2a2118');
  }

  private addLabel(x: number, y: number, text: string, size: number, color: string) {
    const labelX = Phaser.Math.Clamp(x, 8, WORLD_WIDTH - 220);
    const wrapWidth = Math.min(210, WORLD_WIDTH - labelX - 12);
    const label = this.add.text(x, y, text, {
      fontFamily: 'Georgia, serif',
      fontSize: `${size}px`,
      color,
      backgroundColor: 'rgba(247, 239, 224, 0.76)',
      padding: { left: 5, right: 5, top: 3, bottom: 3 },
      wordWrap: { width: wrapWidth },
    });
    label.setX(labelX);
    label.setDepth(3);
    this.labels.push(label);
  }

  private rebuildArtifactBodies() {
    this.artifactBodies?.clear(true, true);
    const snapshot = window.fallstackSnapshot;
    if (!snapshot || !this.artifactBodies) return;
    for (const artifact of snapshot.zones.flatMap((zone) => zone.artifacts)) {
      if (!artifact.solid) continue;
      const rect = this.add.rectangle(
        artifact.x + artifact.width / 2,
        artifact.y + artifact.height / 2,
        artifact.width,
        artifact.height,
        0xffffff,
        0
      );
      rect.setData('artifactType', artifact.type);
      this.artifactBodies.add(rect);
    }
  }
}

function GameApp() {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [message, setMessage] = useState('The tower is waking.');
  const [charge, setCharge] = useState(0);
  const [loading, setLoading] = useState(true);
  const [summitOpen, setSummitOpen] = useState(false);
  const [muted, setMuted] = useState(() => localStorage.getItem('fallstack:muted') === 'true');
  const [sessionStats, setSessionStats] = useState({ falls: 0, clears: 0, summits: 0 });
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<FallstackScene | null>(null);
  const soundRef = useRef<ProceduralSound | null>(new ProceduralSound(muted));
  const resultCloseRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  const stats = useMemo(() => {
    if (!snapshot) return { falls: 37, clears: 0, summits: 0 };
    return {
      falls: snapshot.totalFalls,
      clears: snapshot.totalClears,
      summits: snapshot.totalSummits,
    };
  }, [snapshot]);

  useEffect(() => {
    window.fallstackInput = { ...INITIAL_INPUT };
    let cancelled = false;
    const init = async () => {
      try {
        const res = await fetch('/api/init-game');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as InitGameResponse;
        if (cancelled) return;
        window.fallstackSnapshot = data.snapshot;
        setSnapshot(data.snapshot);
        setMessage('14 falls made this foothold.');
      } catch (error) {
        console.error('init-game failed', error);
        const localSnapshot = createLocalSnapshot();
        window.fallstackSnapshot = localSnapshot;
        setSnapshot(localSnapshot);
        setMessage('The mountain remembers locally. Shared marks are delayed.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('fallstack:muted', String(muted));
    soundRef.current?.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReducedMotion(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const unlock = () => soundRef.current?.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    if (!summitOpen) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.setTimeout(() => resultCloseRef.current?.focus(), 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSummitOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previousFocusRef.current?.focus();
    };
  }, [summitOpen]);

  useEffect(() => {
    if (gameRef.current) return;
    const scene = new FallstackScene('FallstackScene');
    sceneRef.current = scene;
    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game-canvas',
      backgroundColor: '#f7efe0',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: WORLD_WIDTH,
        height: 720,
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 1550, x: 0 },
          debug: false,
        },
      },
      scene,
    });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!snapshot) return;
    window.fallstackSnapshot = snapshot;
    sceneRef.current?.refreshSnapshot(snapshot);
  }, [snapshot]);

  useEffect(() => {
    sceneRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  const postFall = useCallback(
    async (detail: FallEventDetail) => {
      if (!snapshot) return;
      setMessage('Your fall is being counted.');
      try {
        setSessionStats((current) => ({ ...current, falls: current.falls + 1 }));
        soundRef.current?.play('fall');
        const res = await fetch('/api/record-fall', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...detail,
            dailySeed: snapshot.dailySeed,
            timestamp: Date.now(),
          }),
        });
        const data = (await res.json()) as RecordFallResponse;
        setSnapshot(data.snapshot);
        setMessage(data.message);
        if (data.counted) soundRef.current?.play('mutation');
      } catch (error) {
        console.error('record-fall failed', error);
        setMessage('Your fall was noticed. The tower did not answer.');
      }
    },
    [snapshot]
  );

  const postClear = useCallback(
    async (detail: ClearEventDetail) => {
      if (!snapshot) return;
      try {
        setSessionStats((current) => ({ ...current, clears: current.clears + 1 }));
        soundRef.current?.play('checkpoint');
        const res = await fetch('/api/record-clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...detail, dailySeed: snapshot.dailySeed, timestamp: Date.now() }),
        });
        const data = (await res.json()) as RecordClearResponse;
        setSnapshot(data.snapshot);
        setMessage(data.message);
      } catch (error) {
        console.error('record-clear failed', error);
        setMessage('The checkpoint did not hold.');
      }
    },
    [snapshot]
  );

  const postSummit = useCallback(async (detail: SummitEventDetail) => {
    if (!snapshot) return;
    try {
      setSessionStats((current) => ({ ...current, summits: current.summits + 1 }));
      soundRef.current?.play('checkpoint');
      const res = await fetch('/api/record-summit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...detail, dailySeed: snapshot.dailySeed, timestamp: Date.now() }),
      });
      const data = (await res.json()) as RecordSummitResponse;
      setSnapshot(data.snapshot);
      setMessage(data.message);
      setSummitOpen(true);
    } catch (error) {
      console.error('record-summit failed', error);
      setMessage('The summit went quiet.');
    }
  }, [snapshot]);

  useEffect(() => {
    const onCharge = (event: Event) => {
      const detail = (event as CustomEvent<{ percent: number }>).detail;
      if (detail.percent <= 35) soundRef.current?.play('charge-start');
      setCharge(detail.percent);
    };
    const onLand = (event: Event) => {
      const detail = (event as CustomEvent<LandEventDetail>).detail;
      setCharge(0);
      soundRef.current?.play('land', detail.zoneId);
    };
    const onLaunch = () => {
      soundRef.current?.play('launch');
    };
    const onFall = (event: Event) => {
      const detail = (event as CustomEvent<FallEventDetail>).detail;
      void postFall(detail);
    };
    const onClear = (event: Event) => {
      const detail = (event as CustomEvent<ClearEventDetail>).detail;
      void postClear(detail);
    };
    const onSummit = (event: Event) => {
      const detail = (event as CustomEvent<SummitEventDetail>).detail;
      void postSummit(detail);
    };
    window.addEventListener('fallstack:charge', onCharge);
    window.addEventListener('fallstack:land', onLand);
    window.addEventListener('fallstack:launch', onLaunch);
    window.addEventListener('fallstack:fall', onFall);
    window.addEventListener('fallstack:clear', onClear);
    window.addEventListener('fallstack:summit', onSummit);
    return () => {
      window.removeEventListener('fallstack:charge', onCharge);
      window.removeEventListener('fallstack:land', onLand);
      window.removeEventListener('fallstack:launch', onLaunch);
      window.removeEventListener('fallstack:fall', onFall);
      window.removeEventListener('fallstack:clear', onClear);
      window.removeEventListener('fallstack:summit', onSummit);
    };
  }, [postClear, postFall, postSummit]);

  return (
    <main className="game-shell">
      <section className="hud" aria-live="polite">
        <div>
          <p className="eyebrow">Fallstack</p>
          <h1>{snapshot?.headline ?? "Today's tower has 37 failed climbs in it."}</h1>
          <p className="hint">Arrows move · Hold Space · Release to leap</p>
        </div>
        <div className="hud-actions" aria-label="Game actions">
          <button type="button" onClick={() => setSummitOpen(true)} disabled={!snapshot}>
            Result
          </button>
          <button type="button" onClick={() => setMuted((value) => !value)} aria-pressed={muted}>
            {muted ? 'Sound off' : 'Sound on'}
          </button>
        </div>
        <dl className="stats">
          <div>
            <dt>Falls</dt>
            <dd>{stats.falls}</dd>
          </div>
          <div>
            <dt>Clears</dt>
            <dd>{stats.clears}</dd>
          </div>
          <div>
            <dt>Summits</dt>
            <dd>{stats.summits}</dd>
          </div>
        </dl>
      </section>

      <section className="tower-wrap" aria-label="Fallstack tower">
        <div id="game-canvas" />
        {loading ? <div className="banner">Loading today's tower.</div> : <div className="banner">{message}</div>}
        <div className="charge" aria-label="Jump charge">
          <span style={{ width: `${charge}%` }} />
        </div>
      </section>

      <TouchControls disabled={summitOpen} />

      {summitOpen ? (
        <section className="result-backdrop" role="dialog" aria-modal="true" aria-label="Daily result">
          <div className="result-card">
            <p className="eyebrow">Daily result</p>
            <h2>{snapshot?.result.towerName ?? 'The Cursed Stack'}</h2>
            <p className="result-seed">Seed {snapshot?.result.seedLabel ?? 'today'}</p>
            <dl className="result-rows">
              <div>
                <dt>Summit</dt>
                <dd>
                  {snapshot?.result.summitStatus ?? 'Summit Unclaimed'}
                  {snapshot?.result.firstSummitUsername ? ` · ${snapshot.result.firstSummitUsername}` : ''}
                </dd>
              </div>
              <div>
                <dt>Worst memory</dt>
                <dd>
                  {snapshot?.result.mostCursedZone ?? 'Lower Ruins'} · {snapshot?.result.mostCursedStatus ?? 'Haunted'}
                </dd>
              </div>
              <div>
                <dt>Useful scar</dt>
                <dd>{snapshot?.result.mostUsefulArtifact ?? 'Corpse Stack · Lower Ruins'}</dd>
              </div>
              <div>
                <dt>Best stabilizer</dt>
                <dd>{snapshot?.result.bestStabilizerUsername ?? 'No one yet.'}</dd>
              </div>
              <div>
                <dt>Highest climber</dt>
                <dd>
                  {snapshot?.result.highestClimberUsername
                    ? `${snapshot.result.highestClimberUsername} · ${snapshot.result.highestClimberZone}`
                    : 'The roof is still quiet.'}
                </dd>
              </div>
              <div>
                <dt>Your session</dt>
                <dd>
                  {sessionStats.falls} falls · {sessionStats.clears} clears · {sessionStats.summits} summits
                </dd>
              </div>
            </dl>
            <p className="tomorrow-hook">{snapshot?.result.tomorrowHook ?? "Tomorrow, today's worst ledge comes back as a relic."}</p>
            <button ref={resultCloseRef} type="button" onClick={() => setSummitOpen(false)}>
              Keep climbing
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function TouchControls({ disabled }: { disabled: boolean }) {
  useEffect(() => {
    if (!disabled) return;
    window.fallstackInput = { ...INITIAL_INPUT };
  }, [disabled]);

  const set = (key: keyof InputState, value: boolean) => {
    if (disabled) return;
    setSharedInput(key, value);
  };

  const bind = (key: keyof InputState) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      set(key, true);
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      set(key, false);
    },
    onPointerCancel: () => set(key, false),
    onPointerLeave: () => set(key, false),
    onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      set(key, true);
    },
    onKeyUp: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      set(key, false);
    },
  });

  return (
    <nav className="touch-controls" aria-label="Climb controls">
      <button type="button" aria-label="Move left" disabled={disabled} {...bind('left')}>
        ◀
      </button>
      <button type="button" className="jump-button" aria-label="Hold to charge jump" disabled={disabled} {...bind('jump')}>
        Jump
      </button>
      <button type="button" aria-label="Move right" disabled={disabled} {...bind('right')}>
        ▶
      </button>
    </nav>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameApp />
  </StrictMode>
);
