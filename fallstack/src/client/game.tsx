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
  ApiErrorResponse,
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
import {
  generateDailyTower,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ZONES,
  zoneForY,
  type Platform,
} from '../shared/game/tower';

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

// Badge display names — dry, compact, mildly cursed
const BADGE_DISPLAY: Record<string, string> = {
  Quiet: 'Untouched',
  Haunted: 'Restless',
  Cursed: 'Overgrown',
  Reinforced: 'Well-Trodden',
  Stabilized: 'Blessed',
};

const STATUS_TO_BADGE_CLASS: Record<string, string> = {
  Quiet: 'badge-quiet',
  Haunted: 'badge-haunted',
  Cursed: 'badge-cursed',
  Reinforced: 'badge-reinforced',
  Stabilized: 'badge-stabilized',
  // also handle the label variants
  Untouched: 'badge-quiet',
  Restless: 'badge-haunted',
  Overgrown: 'badge-cursed',
  'Well-Trodden': 'badge-reinforced',
  Blessed: 'badge-stabilized',
};

class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

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

async function parseApiResponse<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T | ApiErrorResponse;
  if (!res.ok) {
    const message = (data as ApiErrorResponse).message ?? 'The tower did not answer.';
    throw new ApiRequestError(message, res.status);
  }
  return data as T;
}

/* ======================================================
   PROCEDURAL SOUND
   ====================================================== */
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

/* ======================================================
   THEME PALETTE — mirrors mockup(3) themes exactly
   ====================================================== */
const THEMES = {
  lower_ruins: {
    skyTop: '#c9a876',
    skyBot: '#e9d9ae',
    stone: 0xa9906c,
    stoneDark: 0x7d6a4c,
    highlight: 0xf3ead9,
    accent: 0xc1502f,
    platformEdge: 0x5f5138,
  },
  bell_shaft: {
    skyTop: '#24303d',
    skyBot: '#3c4f5e',
    stone: 0x5c6b74,
    stoneDark: 0x3a444c,
    highlight: 0x8fa6b4,
    accent: 0xe0b25a,
    platformEdge: 0x28313a,
  },
  moon_roof: {
    skyTop: '#121322',
    skyBot: '#2b2f45',
    stone: 0xd8d2bd,
    stoneDark: 0xa49d84,
    highlight: 0xefead8,
    accent: 0xb9a0e0,
    platformEdge: 0x7d7561,
  },
};

type ThemeKey = keyof typeof THEMES;

function zoneTheme(zoneId: ZoneId): ThemeKey {
  if (zoneId === 'bell_shaft') return 'bell_shaft';
  if (zoneId === 'moon_roof') return 'moon_roof';
  return 'lower_ruins';
}

/* ======================================================
   PHASER SCENE
   ====================================================== */
class FallstackScene extends Phaser.Scene {
  private player?: Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body };
  private platforms?: Phaser.Physics.Arcade.StaticGroup;
  private artifactBodies?: Phaser.Physics.Arcade.StaticGroup;
  private graphics?: Phaser.GameObjects.Graphics;
  private bgGraphics?: Phaser.GameObjects.Graphics;
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
  private towerSeed = createDailySeed().dailySeed;
  private towerPlatforms: Platform[] = generateDailyTower(this.towerSeed).platforms;
  private chargeTime = 0;

  create() {
    window.fallstackInput = window.fallstackInput ?? { ...INITIAL_INPUT };
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT + 220);
    this.physics.world.gravity.y = 1550;

    // Two graphics layers: background (drawn behind platforms) and foreground (labels etc.)
    this.bgGraphics = this.add.graphics();
    this.graphics = this.add.graphics();
    this.bgGraphics.setDepth(0);
    this.graphics.setDepth(2);

    this.platforms = this.physics.add.staticGroup();
    this.rebuildPlatformBodies();

    // Player — small rounded figure
    this.player = this.add.rectangle(START_POS.x, START_POS.y, 20, 28, 0xf3ead9) as Phaser.GameObjects.Rectangle & {
      body: Phaser.Physics.Arcade.Body;
    };
    this.player.setDepth(4);
    this.physics.add.existing(this.player);
    this.player.body.setSize(20, 28);
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

    if (this.charging) {
      this.chargeTime = Math.max(0, this.time.now - this.chargeStart);
      const percent = Phaser.Math.Clamp(0.32 + (this.chargeTime / 900) * 0.68, 0.32, 1);
      window.dispatchEvent(
        new CustomEvent('fallstack:charge', { detail: { percent: Math.round(percent * 100) } })
      );
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
      this.chargeTime = 0;
      window.dispatchEvent(
        new CustomEvent('fallstack:charge', { detail: { percent: 0 } })
      );
    }

    if (!this.wasGrounded && onFloor) {
      window.dispatchEvent(new CustomEvent<LandEventDetail>('fallstack:land', { detail: { zoneId: this.currentZone } }));
    }
    this.wasGrounded = onFloor;

    this.checkProgress();
    this.checkFall();
    this.updateCamera(deltaMs);
    this.drawPlayer();
  }

  refreshSnapshot(snapshot?: GameSnapshot) {
    if (snapshot) window.fallstackSnapshot = snapshot;
    if (snapshot?.dailySeed && snapshot.dailySeed !== this.towerSeed) {
      this.towerSeed = snapshot.dailySeed;
      this.towerPlatforms = generateDailyTower(snapshot.dailySeed).platforms;
      this.rebuildPlatformBodies();
    }
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

  private rebuildPlatformBodies() {
    this.platforms?.clear(true, true);
    for (const platform of this.towerPlatforms) this.addPlatform(platform);
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
    this.chargeTime = 0;
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
    if (!this.graphics || !this.bgGraphics) return;
    this.bgGraphics.clear();
    this.graphics.clear();
    for (const label of this.labels) label.destroy();
    this.labels = [];

    // Background sky gradient (approximate with 3 bands)
    this.bgGraphics.fillStyle(0xe9d9ae, 1).fillRect(0, 1620, WORLD_WIDTH, 2220 - 1620); // lower ruins sky
    this.bgGraphics.fillStyle(0x3c4f5e, 1).fillRect(0, 900, WORLD_WIDTH, 1620 - 900);  // bell shaft sky
    this.bgGraphics.fillStyle(0x2b2f45, 1).fillRect(0, 0, WORLD_WIDTH, 900);           // moon roof sky

    // Zone boundary lines — subtle dividers
    this.bgGraphics.lineStyle(1, 0x5f5138, 0.3).lineBetween(20, 1620, WORLD_WIDTH - 20, 1620);
    this.bgGraphics.lineStyle(1, 0x4c6070, 0.3).lineBetween(20, 900, WORLD_WIDTH - 20, 900);

    // Distant mountain silhouette in lower ruins
    this.bgGraphics.fillStyle(0x8a9770, 0.35);
    this.bgGraphics.fillTriangle(0, 1900, 160, 1720, 280, 1900);
    this.bgGraphics.fillTriangle(200, 1900, 380, 1680, 480, 1900);

    // Bell shaft lantern dots
    this.bgGraphics.fillStyle(0xe0b25a, 0.28);
    for (let i = 0; i < 4; i++) {
      const lx = 60 + i * 110;
      const ly = 950 + (i % 2) * 30;
      this.bgGraphics.fillEllipse(lx, ly, 14, 18);
    }

    // Moon in moon_roof zone
    this.bgGraphics.fillStyle(0xefe7cf, 0.85);
    this.bgGraphics.fillCircle(340, 280, 38);
    // Stars
    this.bgGraphics.fillStyle(0xffffff, 0.6);
    const starPositions = [[60, 180], [140, 320], [240, 150], [380, 420], [90, 520], [310, 680], [430, 200]];
    for (const [sx, sy] of starPositions) {
      this.bgGraphics.fillRect(sx, sy, 2, 2);
    }

    // Draw all platforms
    for (const platform of this.towerPlatforms) this.drawPlatform(platform);

    // Draw artifacts and zone labels
    const snapshot = window.fallstackSnapshot;
    if (!snapshot) return;
    for (const zone of snapshot.zones) {
      const zoneData = ZONES.find((candidate) => candidate.id === zone.id);
      if (zoneData) {
        // Zone name label — positioned in the zone's sky band
        const labelY = zoneData.yTop + 18;
        this.addZoneLabel(14, labelY, zone.name, zone.statusLabel);
      }
      for (const artifact of zone.artifacts) this.drawArtifact(artifact);
    }
  }

  private drawPlatform(platform: Platform) {
    const zone = zoneForY(platform.y);
    const th = THEMES[zoneTheme(zone.id)];

    if (platform.kind === 'summit') {
      // Summit platform — glowing persimmon
      this.graphics?.fillStyle(0x9c3e23, 1).fillRoundedRect(platform.x, platform.y + 3, platform.width, platform.height, 5);
      this.graphics?.fillStyle(0xc1502f, 1).fillRoundedRect(platform.x, platform.y, platform.width, platform.height - 2, 5);
      this.graphics?.fillStyle(0xf3ead9, 0.3).fillRect(platform.x + 4, platform.y + 3, platform.width - 8, 3);
      // "summit" label
      this.addInlineLabel(platform.x + platform.width / 2 - 18, platform.y - 18, 'summit', 10, '#c1502f');
      return;
    }

    // Shadow / depth
    this.graphics?.fillStyle(th.platformEdge, 0.9).fillRoundedRect(platform.x, platform.y + 4, platform.width, platform.height, 5);
    // Main face
    this.graphics?.fillStyle(th.stoneDark, 1).fillRoundedRect(platform.x, platform.y + 1, platform.width, platform.height, 5);
    this.graphics?.fillStyle(th.stone, 1).fillRoundedRect(platform.x, platform.y, platform.width, platform.height - 2, 4);
    // Highlight streak
    this.graphics?.fillStyle(th.highlight, 0.22).fillRect(platform.x + 5, platform.y + 2, platform.width - 10, 2);
  }

  private drawArtifact(artifact: Artifact) {
    if (artifact.type === 'lantern_trail') {
      // Dashed arc showing a successful route
      this.graphics?.lineStyle(2, 0xd97934, 0.55).beginPath();
      this.graphics?.arc(artifact.x + 60, artifact.y + 10, 72, Math.PI * 1.08, Math.PI * 1.82);
      this.graphics?.strokePath();
      this.addInlineLabel(artifact.x - 22, artifact.y - 32, artifact.label, 10, '#9c6226');
      return;
    }

    if (artifact.type === 'corpse_stack') {
      // Stacked worn steps — chunky, layered
      const colors = [0xa07040, 0xc7ac7c, 0xd4bc8c];
      for (let i = 2; i >= 0; i -= 1) {
        this.graphics?.fillStyle(colors[i], 1).fillRoundedRect(
          artifact.x + i * 4, artifact.y + i * 5,
          artifact.width - i * 8, 10, 3
        );
      }
      this.graphics?.fillStyle(0xf3ead9, 0.25).fillRect(artifact.x + 8, artifact.y, artifact.width - 16, 2);
    } else if (artifact.type === 'mercy_nail') {
      // Small peg — narrow, visually distinct
      this.graphics?.fillStyle(0x2f4f5f, 1).fillRoundedRect(artifact.x, artifact.y, artifact.width, artifact.height, 7);
      this.graphics?.fillStyle(0xe0b25a, 1).fillCircle(artifact.x + artifact.width - 8, artifact.y + artifact.height / 2, 4);
      this.graphics?.fillStyle(0x8ab4c8, 0.4).fillRect(artifact.x + 4, artifact.y + 3, artifact.width - 18, 3);
    } else if (artifact.type === 'ghost_platform') {
      // Translucent, dashed outline
      this.graphics?.lineStyle(2, 0x6090a8, 0.65).strokeRoundedRect(artifact.x, artifact.y, artifact.width, artifact.height, 8);
      this.graphics?.fillStyle(0x9eb7c8, 0.22).fillRoundedRect(artifact.x, artifact.y, artifact.width, artifact.height, 8);
      // Glow dots
      this.graphics?.fillStyle(0xb9d8e0, 0.5);
      for (let i = 0; i < 3; i++) {
        this.graphics?.fillCircle(artifact.x + 14 + i * 16, artifact.y + artifact.height / 2, 2);
      }
    } else {
      // Cursed brick — cracked, dangerous looking
      this.graphics?.fillStyle(0x6b3028, 1).fillRoundedRect(artifact.x, artifact.y + 3, artifact.width, artifact.height, 4);
      this.graphics?.fillStyle(0x8e2f27, 1).fillRoundedRect(artifact.x, artifact.y, artifact.width, artifact.height - 2, 4);
      // Crack lines
      this.graphics?.lineStyle(1, 0x2a1410, 0.7)
        .lineBetween(artifact.x + 10, artifact.y + 3, artifact.x + 22, artifact.y + artifact.height - 3);
      this.graphics?.lineStyle(1, 0x2a1410, 0.5)
        .lineBetween(artifact.x + 30, artifact.y + 2, artifact.x + 24, artifact.y + artifact.height - 2);
    }

    this.addArtifactLabel(artifact.x, artifact.y - 30, artifact.label);
  }

  private addZoneLabel(x: number, y: number, name: string, statusLabel: string) {
    // Zone name text, small, stamped feel
    const label = this.add.text(x, y, `${name} · ${statusLabel}`, {
      fontFamily: '"Shippori Mincho", serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#c8b89a',
      alpha: 0.7,
    });
    label.setDepth(1);
    label.setAlpha(0.7);
    this.labels.push(label);
  }

  private addArtifactLabel(x: number, y: number, text: string) {
    const clampedX = Phaser.Math.Clamp(x, 4, WORLD_WIDTH - 160);
    const label = this.add.text(clampedX, y, text, {
      fontFamily: '"Zen Maru Gothic", sans-serif',
      fontSize: '9.5px',
      fontStyle: '700',
      color: '#5c4a35',
      backgroundColor: 'rgba(242, 233, 216, 0.9)',
      padding: { left: 5, right: 5, top: 2, bottom: 2 },
    });
    label.setDepth(3);
    this.labels.push(label);
  }

  private addInlineLabel(x: number, y: number, text: string, size: number, color: string) {
    const label = this.add.text(x, y, text, {
      fontFamily: '"Zen Maru Gothic", sans-serif',
      fontSize: `${size}px`,
      color,
    });
    label.setDepth(3);
    this.labels.push(label);
  }

  private drawPlayer() {
    if (!this.player) return;
    // Player is a rectangle — we tint it based on state
    const isCharging = this.charging;
    if (isCharging) {
      const power = Math.min(this.chargeTime, 900) / 900;
      // Red-orange tint while charging
      const r = Math.round(243 - power * 80);
      const g = Math.round(234 - power * 120);
      const b = Math.round(217 - power * 100);
      this.player.setFillStyle(Phaser.Display.Color.GetColor(r, g, b));
    } else {
      this.player.setFillStyle(0xf3ead9);
    }
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

/* ======================================================
   REACT — GAME APP
   ====================================================== */
function GameApp() {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [message, setMessage] = useState('');
  const [charge, setCharge] = useState(0);
  const [loading, setLoading] = useState(true);
  const [summitOpen, setSummitOpen] = useState(false);
  const [muted, setMuted] = useState(() => localStorage.getItem('fallstack:muted') === 'true');
  const [sessionStats, setSessionStats] = useState({ falls: 0, clears: 0, summits: 0 });
  const [mutationVisible, setMutationVisible] = useState(false);
  const [checkpointVisible, setCheckpointVisible] = useState(false);
  const [checkpointText, setCheckpointText] = useState({ title: '', sub: '' });
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<FallstackScene | null>(null);
  const soundRef = useRef<ProceduralSound | null>(new ProceduralSound(muted));
  const resultCloseRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const mutationTimerRef = useRef<number | null>(null);
  const checkpointTimerRef = useRef<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  const showMutation = useCallback((text: string) => {
    setMessage(text);
    setMutationVisible(true);
    if (mutationTimerRef.current) window.clearTimeout(mutationTimerRef.current);
    mutationTimerRef.current = window.setTimeout(() => setMutationVisible(false), 3800);
  }, []);

  const showCheckpoint = useCallback((title: string, sub: string) => {
    setCheckpointText({ title, sub });
    setCheckpointVisible(true);
    if (checkpointTimerRef.current) window.clearTimeout(checkpointTimerRef.current);
    checkpointTimerRef.current = window.setTimeout(() => setCheckpointVisible(false), 3400);
  }, []);

  const loadSharedState = useCallback(async (successMessage: string | null = '14 falls made this foothold.') => {
    const res = await fetch('/api/init-game');
    const data = await parseApiResponse<InitGameResponse>(res);
    window.fallstackSnapshot = data.snapshot;
    setSnapshot(data.snapshot);
    if (successMessage) showMutation(successMessage);
  }, [showMutation]);

  const stats = useMemo(() => {
    if (!snapshot) return { falls: 37, clears: 0, summits: 0 };
    return {
      falls: snapshot.totalFalls,
      clears: snapshot.totalClears,
      summits: snapshot.totalSummits,
    };
  }, [snapshot]);

  const currentZoneInfo = useMemo(() => {
    if (!snapshot?.zones?.length) return { name: 'Lower Ruins', statusLabel: 'Untouched' };
    return snapshot.zones[0];
  }, [snapshot]);

  useEffect(() => {
    window.fallstackInput = { ...INITIAL_INPUT };
    let cancelled = false;
    const init = async () => {
      try {
        if (cancelled) return;
        await loadSharedState();
      } catch (error) {
        console.error('init-game failed', error);
        const localSnapshot = createLocalSnapshot();
        window.fallstackSnapshot = localSnapshot;
        setSnapshot(localSnapshot);
        showMutation('The mountain remembers locally. Shared marks are delayed.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [loadSharedState, showMutation]);

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
      if (event.key === 'Tab') {
        event.preventDefault();
        resultCloseRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previousFocusRef.current?.focus();
    };
  }, [summitOpen]);

  // Boot Phaser — CRISP CANVAS: use NONE scale mode to avoid CSS stretching blurriness
  useEffect(() => {
    if (gameRef.current) return;
    const container = document.getElementById('game-canvas');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const viewH = Math.round(containerRect.height);
    const dpr = window.devicePixelRatio || 1;

    const scene = new FallstackScene('FallstackScene');
    sceneRef.current = scene;
    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game-canvas',
      backgroundColor: '#1b262f',
      // Use NONE so Phaser doesn't add any CSS that blurs the canvas.
      // We size it explicitly to the container at the device pixel ratio.
      width: WORLD_WIDTH,
      height: viewH > 0 ? viewH : 560,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: WORLD_WIDTH,
        height: viewH > 0 ? viewH : 560,
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 1550, x: 0 },
          debug: false,
        },
      },
      render: {
        antialias: false,
        pixelArt: false,
        roundPixels: true,
      },
      scene,
    });

    // Apply crisp rendering to the canvas element after Phaser creates it
    window.requestAnimationFrame(() => {
      const canvas = container.querySelector('canvas');
      if (canvas) {
        canvas.style.imageRendering = 'auto';
      }
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
    if (!snapshot) return;

    const refreshQuietly = () => {
      if (document.visibilityState !== 'visible') return;
      void loadSharedState(null).catch((error) => {
        console.error('shared refresh failed', error);
      });
    };

    const intervalId = window.setInterval(refreshQuietly, 45_000);
    document.addEventListener('visibilitychange', refreshQuietly);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshQuietly);
    };
  }, [loadSharedState, snapshot]);

  useEffect(() => {
    sceneRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  const postFall = useCallback(
    async (detail: FallEventDetail) => {
      if (!snapshot) return;
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
        const data = await parseApiResponse<RecordFallResponse>(res);
        setSnapshot(data.snapshot);
        showMutation(data.message);
        if (data.counted) soundRef.current?.play('mutation');
      } catch (error) {
        console.error('record-fall failed', error);
        if (error instanceof ApiRequestError && error.status === 409) {
          await loadSharedState('A new tower took over. Fresh stones loaded.');
          return;
        }
        showMutation('Your fall was noticed. The tower did not answer.');
      }
    },
    [loadSharedState, showMutation, snapshot]
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
        const data = await parseApiResponse<RecordClearResponse>(res);
        setSnapshot(data.snapshot);
        showCheckpoint(data.message, '');
        showMutation(data.message);
      } catch (error) {
        console.error('record-clear failed', error);
        if (error instanceof ApiRequestError && error.status === 409) {
          await loadSharedState('A new tower took over. Fresh stones loaded.');
          return;
        }
        showMutation('The checkpoint did not hold.');
      }
    },
    [loadSharedState, showCheckpoint, showMutation, snapshot]
  );

  const postSummit = useCallback(
    async (detail: SummitEventDetail) => {
      if (!snapshot) return;
      try {
        setSessionStats((current) => ({ ...current, summits: current.summits + 1 }));
        soundRef.current?.play('checkpoint');
        const res = await fetch('/api/record-summit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...detail, dailySeed: snapshot.dailySeed, timestamp: Date.now() }),
        });
        const data = await parseApiResponse<RecordSummitResponse>(res);
        setSnapshot(data.snapshot);
        showMutation(data.message);
        setSummitOpen(true);
      } catch (error) {
        console.error('record-summit failed', error);
        if (error instanceof ApiRequestError && error.status === 409) {
          await loadSharedState('A new tower took over. Fresh stones loaded.');
          return;
        }
        showMutation('The summit went quiet.');
      }
    },
    [loadSharedState, showMutation, snapshot]
  );

  useEffect(() => {
    const onCharge = (event: Event) => {
      const detail = (event as CustomEvent<{ percent: number }>).detail;
      if (detail.percent <= 35 && detail.percent > 0) soundRef.current?.play('charge-start');
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

  // Derive zone status badge class from snapshot
  const zoneBadgeClass = useMemo(() => {
    const label = currentZoneInfo.statusLabel ?? 'Untouched';
    return STATUS_TO_BADGE_CLASS[label] ?? 'badge-quiet';
  }, [currentZoneInfo.statusLabel]);

  return (
    <main className="game-shell">
      {/* ── TOP BAR ── */}
      <header className="topbar">
        {/* Hanko stamp + wordmark */}
        <div className="topbar-brand">
          <div className="eyebrow">
            <span className="hanko" aria-hidden="true">登</span>
            <span>Fallstack</span>
          </div>
          <div className="topbar-headline">
            <b>{stats.falls}</b>{' '}
            {snapshot?.headline
              ? snapshot.headline.replace(/^Today's tower has \d+ failed climbs in it\.$/, '')
              : 'travelers slipped on this mountain today.'}
          </div>
        </div>

        {/* Stats cluster */}
        <dl className="stats-cluster" aria-label="Community climb stats">
          <div className="stat-cell">
            <dt className="stat-label">Falls</dt>
            <dd className="stat-value">{stats.falls}</dd>
          </div>
          <div className="stat-cell">
            <dt className="stat-label">Clears</dt>
            <dd className="stat-value">{stats.clears}</dd>
          </div>
          <div className="stat-cell">
            <dt className="stat-label">Tops</dt>
            <dd className="stat-value">{stats.summits}</dd>
          </div>
        </dl>

        {/* Action buttons */}
        <div className="topbar-actions" aria-label="Game controls">
          <button
            type="button"
            className="action-btn"
            onClick={() => setSummitOpen(true)}
            disabled={!snapshot}
          >
            Result
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={() => setMuted((value) => !value)}
            aria-pressed={muted}
          >
            {muted ? '🔇 Mute' : '🔊 Sound'}
          </button>
        </div>
      </header>

      {/* ── GAME VIEWPORT ── */}
      <section className="tower-wrap" aria-label="Fallstack tower">
        <div id="game-canvas" />

        {/* Zone tag — top left overlay */}
        <div className="hud-overlay zone-tag" role="status" aria-label="Current zone">
          {currentZoneInfo.name}
          <span className={`zone-badge ${zoneBadgeClass}`}>
            {BADGE_DISPLAY[currentZoneInfo.statusLabel] ?? currentZoneInfo.statusLabel}
          </span>
        </div>

        {/* Controls hint */}
        <div className="hud-overlay controls-hint" aria-hidden="true">
          Arrows move · Hold Space · Release to leap
        </div>

        {/* Mutation banner */}
        <div
          className={`hud-overlay mutation-banner${mutationVisible ? ' visible' : ''}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {loading ? "Loading today's tower…" : message}
        </div>

        {/* Checkpoint banner */}
        <div
          className={`hud-overlay checkpoint-banner${checkpointVisible ? ' visible' : ''}`}
          role="status"
          aria-live="polite"
        >
          <div className="checkpoint-title">{checkpointText.title}</div>
          {checkpointText.sub && <div className="checkpoint-sub">{checkpointText.sub}</div>}
        </div>

        {/* Charge bar */}
        <div className="charge-bar" aria-label={`Jump charge ${charge}%`} aria-valuenow={charge} aria-valuemin={0} aria-valuemax={100} role="progressbar">
          <span className="charge-fill" style={{ width: `${charge}%` }} />
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="loading-overlay" aria-hidden="true">
            <div className="loading-text">Reading the mountain…</div>
          </div>
        )}
      </section>

      {/* ── TOUCH CONTROLS ── */}
      <TouchControls disabled={summitOpen} charge={charge} />

      {/* ── RESULT CARD ── */}
      {summitOpen ? (
        <div className="result-backdrop" role="dialog" aria-modal="true" aria-label="Daily result">
          <div className="result-card">
            <p className="eyebrow">
              <span className="hanko" aria-hidden="true">登</span>
              Daily result
            </p>
            <h2>{snapshot?.result.towerName ?? 'The Cursed Stack'}</h2>
            <p className="result-seed">Seed {snapshot?.result.seedLabel ?? 'today'}</p>
            <dl className="result-rows">
              <div className="result-row">
                <dt>Summit</dt>
                <dd>
                  {snapshot?.result.summitStatus ?? 'Unclaimed'}
                  {snapshot?.result.firstSummitUsername ? ` · ${snapshot.result.firstSummitUsername}` : ''}
                </dd>
              </div>
              <div className="result-row">
                <dt>Worst memory</dt>
                <dd>
                  {snapshot?.result.mostCursedZone ?? 'Lower Ruins'} · {snapshot?.result.mostCursedStatus ?? 'Haunted'}
                </dd>
              </div>
              <div className="result-row">
                <dt>Useful scar</dt>
                <dd>{snapshot?.result.mostUsefulArtifact ?? 'Corpse Stack · Lower Ruins'}</dd>
              </div>
              <div className="result-row">
                <dt>Best stabilizer</dt>
                <dd>{snapshot?.result.bestStabilizerUsername ?? 'No one yet.'}</dd>
              </div>
              <div className="result-row">
                <dt>Highest climber</dt>
                <dd>
                  {snapshot?.result.highestClimberUsername
                    ? `${snapshot.result.highestClimberUsername} · ${snapshot.result.highestClimberZone}`
                    : 'The roof is still quiet.'}
                </dd>
              </div>
              <div className="result-row">
                <dt>Your session</dt>
                <dd>
                  {sessionStats.falls} falls · {sessionStats.clears} clears · {sessionStats.summits} summits
                </dd>
              </div>
            </dl>
            <p className="tomorrow-hook">
              {snapshot?.result.tomorrowHook ?? "Tomorrow, today's worst ledge comes back as a relic."}
            </p>
            <button ref={resultCloseRef} type="button" className="result-close-btn" onClick={() => setSummitOpen(false)}>
              Keep climbing
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

/* ======================================================
   TOUCH CONTROLS COMPONENT
   ====================================================== */
function TouchControls({ disabled, charge }: { disabled: boolean; charge: number }) {
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
      <button type="button" className="ctrl-btn" aria-label="Move left" disabled={disabled} {...bind('left')}>
        ◀
      </button>
      <button type="button" className="jump-btn" aria-label="Hold to charge jump" disabled={disabled} {...bind('jump')}>
        <span className="jump-charge-fill" style={{ width: `${charge}%` }} />
        <span className="jump-btn-label">Hold · Space</span>
      </button>
      <button type="button" className="ctrl-btn" aria-label="Move right" disabled={disabled} {...bind('right')}>
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
