import Phaser from 'phaser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  InitGameResponse,
  RecordClearResponse,
  RecordFallResponse,
  RecordSummitResponse,
} from '../shared/api';
import {
  BOTTOM_ZONE_ID,
  createDailySeed,
  type Artifact,
  type FailureBucket,
  type GameSnapshot,
  type ZoneId,
} from '../shared/game/mutation';
import {
  chargePowerForHeldMs,
  chargeRatioForHeldMs,
  MOVEMENT_TUNING,
} from '../shared/game/movement.js';
import {
  fallZoneForRespawn,
  shouldEndRunAtY,
} from '../shared/game/progression.js';
import {
  generateDailyTower,
  nextZoneId,
  WORLD_HEIGHT,
  ZONES,
  zoneById,
  zoneForY,
  type Platform,
} from '../shared/game/tower';
import {
  ApiRequestError,
  createLocalSnapshot,
  newAttemptId,
  parseApiResponse,
} from './game/api';
import { TouchControls } from './game/TouchControls';
import type {
  ClearEventDetail,
  FallEventDetail,
  LandEventDetail,
  SummitEventDetail,
  ZoneEventDetail,
} from './game/events';
import { INITIAL_INPUT, resetSharedInput, type InputState } from './game/input';
import {
  cameraBottomPaddingForGameWidth,
  computeGameDimensions,
  gameWorldWidth,
  routeOffsetForGameWidth,
} from './game/layout';
import {
  applyLocalClear,
  applyLocalFall,
  applyLocalSummit,
  localClearMessage,
  localFallMessage,
} from './game/localSnapshot';
import { ProceduralSound } from './game/sound';
import { BADGE_DISPLAY, STATUS_TO_BADGE_CLASS } from './game/ui';

declare global {
  interface Window {
    fallstackInput: InputState;
    fallstackSnapshot?: GameSnapshot;
  }
}

const START_POS = { x: 240, y: WORLD_HEIGHT - 120 };

function checkpointForZone(zoneId: ZoneId): { x: number; y: number } {
  if (zoneId === BOTTOM_ZONE_ID) return START_POS;
  return { x: 240, y: zoneById(zoneId).yBottom - 60 };
}

type Theme = {
  skyTop: string;
  skyBot: string;
  stone: number;
  stoneDark: number;
  highlight: number;
  accent: number;
  platformEdge: number;
  label: string;
};

const THEMES: Record<ZoneId, Theme> = {
  orbital_scrapyard: {
    skyTop: '#091314',
    skyBot: '#4a1a24',
    stone: 0x7a2d36,
    stoneDark: 0x341018,
    highlight: 0xf2d7a0,
    accent: 0x62d0c4,
    platformEdge: 0x120608,
    label: 'Rust Orbit',
  },
  crater_foundry: {
    skyTop: '#170c14',
    skyBot: '#4c2026',
    stone: 0x9c503b,
    stoneDark: 0x39141a,
    highlight: 0xffb870,
    accent: 0x7ee0c6,
    platformEdge: 0x120608,
    label: 'Basalt Heat',
  },
  comet_reef: {
    skyTop: '#071923',
    skyBot: '#0f3d42',
    stone: 0x287668,
    stoneDark: 0x12332f,
    highlight: 0x9ee6c9,
    accent: 0xffd36a,
    platformEdge: 0x071613,
    label: 'Ice Coral',
  },
  nebula_vault: {
    skyTop: '#12091f',
    skyBot: '#3a1f55',
    stone: 0x6f5697,
    stoneDark: 0x211833,
    highlight: 0xdcc7ff,
    accent: 0xff6fbc,
    platformEdge: 0x0b0612,
    label: 'Ion Mist',
  },
  ring_citadel: {
    skyTop: '#070d18',
    skyBot: '#26334d',
    stone: 0xb18b45,
    stoneDark: 0x413421,
    highlight: 0xf1d17d,
    accent: 0x6ec6ff,
    platformEdge: 0x090d14,
    label: 'Halo Brass',
  },
  dwarf_garden: {
    skyTop: '#10130b',
    skyBot: '#354219',
    stone: 0x769a46,
    stoneDark: 0x263319,
    highlight: 0xd8f197,
    accent: 0xff7b55,
    platformEdge: 0x090c07,
    label: 'Redleaf Gravity',
  },
  pulsar_spine: {
    skyTop: '#060914',
    skyBot: '#122b5c',
    stone: 0x38666d,
    stoneDark: 0x182b33,
    highlight: 0x62d0c4,
    accent: 0xfff07a,
    platformEdge: 0x060a0d,
    label: 'Pulse Metal',
  },
  neutron_forge: {
    skyTop: '#07080f',
    skyBot: '#2f3448',
    stone: 0xa5afc2,
    stoneDark: 0x3a4055,
    highlight: 0xffffff,
    accent: 0x74f7ff,
    platformEdge: 0x090a10,
    label: 'White Iron',
  },
  black_hole_chapel: {
    skyTop: '#010104',
    skyBot: '#16051f',
    stone: 0x443052,
    stoneDark: 0x110816,
    highlight: 0xd8b6ff,
    accent: 0xffbe5c,
    platformEdge: 0x030104,
    label: 'Event Stone',
  },
  galaxy_reef: {
    skyTop: '#02091b',
    skyBot: '#193b6e',
    stone: 0x5d7fd6,
    stoneDark: 0x1d2b58,
    highlight: 0xbfd7ff,
    accent: 0xff88d0,
    platformEdge: 0x050915,
    label: 'Star Coral',
  },
  dying_star_garden: {
    skyTop: '#1e0705',
    skyBot: '#6a2218',
    stone: 0xc45d4f,
    stoneDark: 0x61222b,
    highlight: 0xffd49a,
    accent: 0x8df0ff,
    platformEdge: 0x15070b,
    label: 'Solar Ash',
  },
  event_horizon_crown: {
    skyTop: '#030006',
    skyBot: '#210017',
    stone: 0xbec7d8,
    stoneDark: 0x4b526b,
    highlight: 0xf6f0d4,
    accent: 0xff6f5f,
    platformEdge: 0x08020a,
    label: 'Crown Matter',
  },
};

function themeForZone(zoneId: ZoneId): Theme {
  return THEMES[zoneId];
}

function colorNumber(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

/* ======================================================
   PHASER SCENE
   ====================================================== */
class FallstackScene extends Phaser.Scene {
  private player?: Phaser.GameObjects.Rectangle & {
    body: Phaser.Physics.Arcade.Body;
  };
  private platforms?: Phaser.Physics.Arcade.StaticGroup;
  private artifactBodies?: Phaser.Physics.Arcade.StaticGroup;
  private graphics?: Phaser.GameObjects.Graphics;
  private bgGraphics?: Phaser.GameObjects.Graphics;
  private dynamicGraphics?: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  private space: Phaser.Input.Keyboard.Key | undefined;
  private facing: -1 | 1 = 1;
  private wasGrounded = false;
  private charging = false;
  private chargeStart = 0;
  private lastChargePercent = 0;
  private lastWallBonk = false;
  private currentZone: ZoneId = BOTTOM_ZONE_ID;
  private publishedZone: ZoneId = BOTTOM_ZONE_ID;
  private respawnZone: ZoneId = BOTTOM_ZONE_ID;
  private currentAttemptId = newAttemptId('attempt');
  private highestY = START_POS.y;
  private checkpointed = new Set<ZoneId>();
  private summitSent = false;
  private lastHelperTouchAt = -Infinity;
  private lastTouchedHelper = false;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    .matches;
  private towerSeed = createDailySeed().dailySeed;
  private towerPlatforms: Platform[] = generateDailyTower(this.towerSeed)
    .platforms;
  private chargeTime = 0;
  private currentRouteOffset = 0;
  private readonly platformScale = 1;

  // Visual enhancements
  private particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: number;
    alpha: number;
    size: number;
    life: number;
    maxLife: number;
    type: 'dust' | 'charge' | 'lantern' | 'ghost';
  }> = [];
  private stars: Array<{
    x: number;
    y: number;
    size: number;
    phase: number;
    speed: number;
  }> = [];

  create() {
    window.fallstackInput = window.fallstackInput ?? { ...INITIAL_INPUT };
    this.applyViewportLayout(false);
    this.physics.world.gravity.y = MOVEMENT_TUNING.gravityY;

    // Three graphics layers: background, static platforms/labels, dynamic animations
    this.bgGraphics = this.add.graphics();
    this.graphics = this.add.graphics();
    this.dynamicGraphics = this.add.graphics();

    this.bgGraphics.setDepth(0);
    this.graphics.setDepth(2);
    this.dynamicGraphics.setDepth(3);

    this.platforms = this.physics.add.staticGroup();
    this.rebuildPlatformBodies();

    // Player — Physics box is transparent. We draw the animated fox spirit on the dynamic layer.
    this.player = this.add.rectangle(
      this.layoutX(START_POS.x),
      START_POS.y,
      20,
      28,
      0xffffff,
      0
    ) as Phaser.GameObjects.Rectangle & {
      body: Phaser.Physics.Arcade.Body;
    };
    this.player.setDepth(4);
    this.physics.add.existing(this.player);
    this.player.body.setSize(20, 28);
    this.player.body.setCollideWorldBounds(true);
    this.player.body.setDragX(MOVEMENT_TUNING.groundDragX);
    this.player.body.setMaxVelocity(
      MOVEMENT_TUNING.initialMaxVelocityX,
      MOVEMENT_TUNING.maxVelocityY
    );
    this.physics.add.collider(
      this.player,
      this.platforms,
      this.onLand,
      undefined,
      this
    );

    this.artifactBodies = this.physics.add.staticGroup();
    this.physics.add.collider(
      this.player,
      this.artifactBodies,
      this.onArtifactTouch,
      undefined,
      this
    );

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.space = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );

    this.cameras.main.setZoom(1);

    this.scale.on('resize', () => {
      this.applyViewportLayout(true);
      this.rebuildPlatformBodies();
      this.drawWorld();
      this.rebuildArtifactBodies();
      this.snapCameraToPlayer();
    });

    // Seed stars in the upper sky zone (wider bounds for widescreen support)
    this.stars = [];
    for (let i = 0; i < 48; i++) {
      this.stars.push({
        x: -400 + Math.random() * 1280,
        y: Math.random() * 900,
        size: 0.8 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.5,
      });
    }

    this.refreshSnapshot(window.fallstackSnapshot);
    this.publishZone();
    this.snapCameraToPlayer();
  }

  override update(_time: number, deltaMs: number) {
    if (!this.player) return;
    const input = this.readInput();
    const body = this.player.body;
    const onFloor = body.blocked.down || body.touching.down;
    this.updateCurrentZone();
    this.highestY = Math.min(this.highestY, this.player.y);

    if (input.left) this.facing = -1;
    if (input.right) this.facing = 1;
    if (onFloor) {
      body.setAccelerationX(0);
      body.setVelocityX(
        input.left
          ? -MOVEMENT_TUNING.groundSpeed
          : input.right
            ? MOVEMENT_TUNING.groundSpeed
            : Phaser.Math.Linear(body.velocity.x, 0, 0.18)
      );
      this.lastWallBonk = false;
    } else {
      const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      body.setAccelerationX(steer * MOVEMENT_TUNING.airSteerAccelerationX);
      body.setMaxVelocity(
        MOVEMENT_TUNING.airMaxVelocityX,
        MOVEMENT_TUNING.maxVelocityY
      );
      if (
        (body.blocked.left || body.blocked.right) &&
        body.velocity.y > MOVEMENT_TUNING.wallBonkVelocityYThreshold
      )
        this.lastWallBonk = true;
    }

    if (onFloor && input.jump && !this.charging) {
      this.charging = true;
      this.chargeStart = this.time.now;
    }

    if (this.charging) {
      this.chargeTime = Math.max(0, this.time.now - this.chargeStart);
      const percent = chargeRatioForHeldMs(this.chargeTime);
      window.dispatchEvent(
        new CustomEvent('fallstack:charge', {
          detail: { percent: Math.round(percent * 100) },
        })
      );
    }

    if (this.charging && (!input.jump || !onFloor)) {
      const held = Math.max(0, this.time.now - this.chargeStart);
      const percent = chargeRatioForHeldMs(held);
      this.lastChargePercent = Math.round(percent * 100);
      if (onFloor && !input.jump) {
        body.setVelocity(
          this.facing *
            Phaser.Math.Linear(
              MOVEMENT_TUNING.minLaunchVelocityX,
              MOVEMENT_TUNING.maxLaunchVelocityX,
              percent
            ),
          Phaser.Math.Linear(
            MOVEMENT_TUNING.minLaunchVelocityY,
            MOVEMENT_TUNING.maxLaunchVelocityY,
            percent
          )
        );
        window.dispatchEvent(new CustomEvent('fallstack:launch'));
      }
      this.charging = false;
      this.chargeTime = 0;
      window.dispatchEvent(
        new CustomEvent('fallstack:charge', { detail: { percent: 0 } })
      );
    }

    if (!this.wasGrounded && onFloor) {
      window.dispatchEvent(
        new CustomEvent<LandEventDetail>('fallstack:land', {
          detail: { zoneId: this.currentZone },
        })
      );

      // Spawn land dust particles
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        this.particles.push({
          x: this.player.x + Math.cos(angle) * 4,
          y: this.player.y + 14,
          vx: Math.cos(angle) * (80 + Math.random() * 60),
          vy: -15 - Math.random() * 25,
          color: 0xe6d9bf,
          alpha: 0.7,
          size: 1.5 + Math.random() * 1.5,
          life: 400,
          maxLife: 400,
          type: 'dust',
        });
      }
    }
    this.wasGrounded = onFloor;

    this.checkProgress();
    this.checkFall();
    this.updateCamera(deltaMs);

    // Clear and draw all animations (particles, fox, swinging lanterns)
    if (this.dynamicGraphics) {
      this.dynamicGraphics.clear();
      this.drawDynamicElements(deltaMs);
    }
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

  private gameWidth() {
    return gameWorldWidth(this.cameras.main.width);
  }

  private routeOffsetX() {
    return this.currentRouteOffset;
  }

  private layoutX(x: number) {
    return x + this.routeOffsetX();
  }

  private layoutPlatform(platform: Platform): Platform {
    return {
      ...platform,
      x: this.layoutX(platform.x),
      width: platform.width * this.platformScale,
    };
  }

  private layoutArtifact(artifact: Artifact): Artifact {
    return {
      ...artifact,
      x: this.layoutX(artifact.x),
      width: artifact.width * this.platformScale,
    };
  }

  private applyViewportLayout(keepPlayerX: boolean) {
    const previousOffset = this.currentRouteOffset;
    const playerLogicalX =
      keepPlayerX && this.player ? this.player.x - previousOffset : null;
    const worldWidth = this.gameWidth();
    this.currentRouteOffset = routeOffsetForGameWidth(worldWidth);
    this.cameras.main.setBounds(0, 0, worldWidth, WORLD_HEIGHT);
    this.physics.world.setBounds(0, 0, worldWidth, WORLD_HEIGHT + 220);
    if (playerLogicalX !== null && this.player)
      this.player.setX(this.layoutX(playerLogicalX));
  }

  private cameraBottomPadding() {
    return cameraBottomPaddingForGameWidth(this.gameWidth());
  }

  private cameraTargetY(y: number) {
    const camH = this.cameras.main.height || 480;
    return Phaser.Math.Clamp(
      y - (camH - this.cameraBottomPadding()),
      0,
      WORLD_HEIGHT - camH
    );
  }

  private snapCameraToPlayer() {
    if (!this.player) return;
    this.cameras.main.scrollX = 0;
    this.cameras.main.scrollY = this.cameraTargetY(this.player.y);
  }

  private addPlatform(platform: Platform) {
    const layout = this.layoutPlatform(platform);
    const rect = this.add.rectangle(
      layout.x + layout.width / 2,
      layout.y + layout.height / 2,
      layout.width,
      layout.height,
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
      right: Boolean(
        window.fallstackInput?.right || this.cursors?.right?.isDown
      ),
      jump: Boolean(window.fallstackInput?.jump || this.space?.isDown),
    };
  }

  private onLand(_player: unknown, platformObject: unknown) {
    const object = platformObject as Phaser.GameObjects.GameObject;
    if (object.getData('platformId') === 'summit' && !this.summitSent) {
      this.summitSent = true;
      window.dispatchEvent(
        new CustomEvent<SummitEventDetail>('fallstack:summit', {
          detail: {
            attemptId: this.currentAttemptId,
            highestY: this.highestY,
          },
        })
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
    const zone = zoneById(this.respawnZone);
    const nextZone = nextZoneId(this.respawnZone);
    if (!nextZone) return;
    if (this.player.y < zone.yTop && !this.checkpointed.has(this.respawnZone)) {
      this.unlockZone(nextZone, this.respawnZone);
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
    if (!shouldEndRunAtY(this.player.y, this.respawnZone)) return;

    const failureBucket = this.classifyFailure();
    const zoneId = fallZoneForRespawn(this.respawnZone);
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
    if (this.lastTouchedHelper && this.time.now - this.lastHelperTouchAt < 4000)
      return 'helper_overuse';
    if (this.lastWallBonk) return 'wall_bonk';
    if (this.lastChargePercent > 82) return 'overjump';
    return 'short_jump';
  }

  private respawn() {
    if (!this.player) return;
    const checkpoint = checkpointForZone(this.respawnZone);
    this.player.setPosition(this.layoutX(checkpoint.x), checkpoint.y);
    this.player.body.setVelocity(0, 0);
    this.player.body.setAcceleration(0, 0);
    this.currentZone = this.respawnZone;
    this.publishZone();
    this.currentAttemptId = newAttemptId('attempt');
    this.highestY = checkpoint.y;
    this.charging = false;
    this.chargeTime = 0;
    this.lastHelperTouchAt = -Infinity;
    this.lastTouchedHelper = false;

    // Instantly snap camera scroll to the player spawn point
    this.snapCameraToPlayer();
  }

  private updateCamera(deltaMs: number) {
    if (!this.player) return;
    const targetY = this.cameraTargetY(this.player.y);

    if (this.reducedMotion) {
      this.cameras.main.scrollY = targetY;
    } else {
      const current = this.cameras.main.scrollY;
      this.cameras.main.scrollY = Phaser.Math.Linear(
        current,
        targetY,
        Math.min(1, deltaMs / 260)
      );
    }

    this.cameras.main.scrollX = 0;
  }

  private updateCurrentZone() {
    const zoneId = zoneForY(this.player?.y ?? START_POS.y).id;
    if (zoneId === this.currentZone) return;
    this.currentZone = zoneId;
    this.publishZone();
  }

  private publishZone() {
    if (this.publishedZone === this.currentZone) return;
    this.publishedZone = this.currentZone;
    window.dispatchEvent(
      new CustomEvent<ZoneEventDetail>('fallstack:zone', {
        detail: { zoneId: this.currentZone },
      })
    );
  }

  private drawWorld() {
    if (!this.graphics || !this.bgGraphics) return;
    this.bgGraphics.clear();
    this.graphics.clear();
    for (const label of this.labels) label.destroy();
    this.labels = [];

    const minX = 0;
    const drawW = this.gameWidth();
    const maxX = minX + drawW;

    for (const zone of ZONES) {
      const theme = themeForZone(zone.id);
      const top = colorNumber(theme.skyTop);
      const bottom = colorNumber(theme.skyBot);
      const height = zone.yBottom - zone.yTop;
      this.bgGraphics.fillGradientStyle(top, top, bottom, bottom, 1, 1, 1, 1);
      this.bgGraphics.fillRect(minX, zone.yTop, drawW, height);
      this.drawBiomeDetails(zone.id, zone.yTop, zone.yBottom, minX, maxX, drawW);
      if (zone.yTop > 0) {
        this.bgGraphics
          .lineStyle(1.5, theme.accent, 0.36)
          .lineBetween(minX + 12, zone.yTop, maxX - 12, zone.yTop);
      }
      this.addZoneLabel(
        this.layoutX(14),
        zone.yBottom - 1180,
        zone.name,
        theme.label
      );
    }

    this.bgGraphics
      .lineStyle(3, 0x0a0508, 0.55)
      .lineBetween(0, 0, 0, WORLD_HEIGHT);
    this.bgGraphics
      .lineStyle(3, 0x0a0508, 0.55)
      .lineBetween(drawW, 0, drawW, WORLD_HEIGHT);

    // 3. DRAW PLATFORMS
    for (const platform of this.towerPlatforms)
      this.drawPlatform(this.layoutPlatform(platform));

    // 4. DRAW ARTIFACTS AND LABELS
    const snapshot = window.fallstackSnapshot;
    if (!snapshot) return;
    for (const zone of snapshot.zones) {
      for (const artifact of zone.artifacts)
        this.drawArtifact(this.layoutArtifact(artifact));
    }
  }

  private drawBiomeDetails(
    zoneId: ZoneId,
    yTop: number,
    yBottom: number,
    minX: number,
    maxX: number,
    drawW: number
  ) {
    const theme = themeForZone(zoneId);
    const midY = yTop + (yBottom - yTop) * 0.52;
    const index = ZONES.findIndex((zone) => zone.id === zoneId);

    this.bgGraphics?.fillStyle(theme.platformEdge, 0.42);
    this.bgGraphics?.fillTriangle(
      minX,
      yBottom - 900,
      minX + drawW * (0.22 + (index % 3) * 0.08),
      midY,
      minX + drawW * 0.62,
      yBottom - 900
    );
    this.bgGraphics?.fillTriangle(
      minX + drawW * 0.38,
      yBottom - 720,
      minX + drawW * (0.72 - (index % 2) * 0.08),
      yTop + 820,
      maxX,
      yBottom - 720
    );
    this.bgGraphics?.fillStyle(theme.highlight, 0.11);
    this.bgGraphics?.fillCircle(minX + drawW * 0.74, yBottom - 620, 46);
    this.bgGraphics?.fillStyle(theme.platformEdge, 0.72);
    this.bgGraphics?.fillCircle(minX + drawW * 0.74 + 18, yBottom - 628, 40);
    this.bgGraphics?.lineStyle(3, theme.accent, 0.2);
    this.bgGraphics?.strokeEllipse(
      minX + drawW * 0.74,
      yBottom - 620,
      142,
      28
    );
    this.bgGraphics?.fillStyle(theme.accent, 0.24);
    for (let i = 0; i < 5; i += 1) {
      const chipX = minX + drawW * (0.16 + i * 0.16);
      const chipY = yBottom - 760 + (i % 2) * 130;
      this.bgGraphics?.fillRect(chipX, chipY, 18 + (i % 3) * 10, 4);
    }

    if (index % 4 === 0) {
      this.bgGraphics?.lineStyle(2, theme.accent, 0.18);
      for (let i = 0; i < 5; i += 1) {
        const x = minX + 30 + i * (drawW / 5);
        this.bgGraphics?.lineBetween(x, yTop, x + 80, yBottom);
      }
    } else if (index % 4 === 1) {
      this.bgGraphics?.fillStyle(theme.highlight, 0.16);
      for (let i = 0; i < 4; i += 1) {
        this.bgGraphics?.fillEllipse(
          minX + drawW * (0.18 + i * 0.21),
          yTop + 980 + i * 260,
          72 + i * 12,
          18
        );
      }
    } else if (index % 4 === 2) {
      this.bgGraphics?.fillStyle(theme.accent, 0.16);
      this.bgGraphics?.fillCircle(minX + drawW * 0.72, yTop + 1260, 62);
      this.bgGraphics?.fillStyle(theme.platformEdge, 0.7);
      this.bgGraphics?.fillCircle(minX + drawW * 0.72 + 22, yTop + 1248, 54);
    } else {
      this.bgGraphics?.lineStyle(3, theme.highlight, 0.14);
      this.bgGraphics?.lineBetween(minX + 60, midY, maxX - 60, midY - 260);
      this.bgGraphics?.lineBetween(minX + 80, midY + 180, maxX - 120, midY + 60);
    }
  }

  private drawPlatform(platform: Platform) {
    const y = platform.y;
    const zoneId = zoneForY(y).id;
    const theme = themeForZone(zoneId);
    const zoneIndex = ZONES.findIndex((zone) => zone.id === zoneId);
    const stoneColor = theme.stone;
    const darkColor = theme.stoneDark;
    const edgeColor = theme.platformEdge;
    const highlightColor = theme.highlight;

    // Check if checkpoint to draw Torii Gate
    const isCheckpoint = platform.id.includes('checkpoint');
    if (isCheckpoint) {
      const cx = platform.x + platform.width / 2;
      const postW = 8;
      const postH = 46;

      // Platform base
      this.graphics
        ?.fillStyle(0x1b262f, 1)
        .fillRoundedRect(
          platform.x,
          platform.y + 4,
          platform.width,
          platform.height,
          5
        );
      this.graphics
        ?.fillStyle(darkColor, 1)
        .fillRoundedRect(
          platform.x,
          platform.y + 1,
          platform.width,
          platform.height,
          5
        );
      this.graphics
        ?.fillStyle(stoneColor, 1)
        .fillRoundedRect(
          platform.x,
          platform.y,
          platform.width,
          platform.height - 2,
          4
        );

      // Torii columns
      this.graphics?.fillStyle(theme.platformEdge, 1);
      this.graphics?.fillRect(
        cx - platform.width * 0.32 - 1,
        platform.y - postH,
        postW + 2,
        postH
      );
      this.graphics?.fillRect(
        cx + platform.width * 0.32 - postW - 1,
        platform.y - postH,
        postW + 2,
        postH
      );

      this.graphics?.fillStyle(theme.accent, 1);
      this.graphics?.fillRect(
        cx - platform.width * 0.32,
        platform.y - postH,
        postW,
        postH
      );
      this.graphics?.fillRect(
        cx + platform.width * 0.32 - postW,
        platform.y - postH,
        postW,
        postH
      );

      // Column bases
      this.graphics?.fillStyle(0x1b262f, 1);
      this.graphics?.fillRect(
        cx - platform.width * 0.32 - 1,
        platform.y - 4,
        postW + 2,
        4
      );
      this.graphics?.fillRect(
        cx + platform.width * 0.32 - postW - 1,
        platform.y - 4,
        postW + 2,
        4
      );

      // Shimaki crossbeam
      this.graphics?.fillStyle(theme.platformEdge, 1);
      this.graphics?.fillRect(
        cx - platform.width * 0.36,
        platform.y - postH + 10,
        platform.width * 0.72,
        6
      );
      this.graphics?.fillStyle(theme.accent, 1);
      this.graphics?.fillRect(
        cx - platform.width * 0.36,
        platform.y - postH + 9,
        platform.width * 0.72,
        6
      );

      // Kasagi lintel
      this.graphics?.fillStyle(0x1b262f, 1);
      this.graphics?.fillRoundedRect(
        cx - platform.width * 0.44,
        platform.y - postH - 12,
        platform.width * 0.88,
        5,
        2
      );
      this.graphics?.fillStyle(theme.accent, 1);
      this.graphics?.fillRoundedRect(
        cx - platform.width * 0.42,
        platform.y - postH - 8,
        platform.width * 0.84,
        9,
        3
      );

      // Center wood stamp nameboard
      this.graphics?.fillStyle(0x1b262f, 1);
      this.graphics?.fillRect(cx - 8, platform.y - postH - 1, 16, 11);
      this.graphics?.fillStyle(theme.highlight, 1);
      this.graphics?.strokeRect(cx - 7, platform.y - postH, 14, 9);

      this.addInlineLabel(
        cx - 11,
        platform.y - postH - 24,
        'GATE',
        9,
        theme.skyBot
      );
      return;
    }

    if (platform.kind === 'summit') {
      // Summit platform — glowing golden celestial arch/temple roof design
      this.graphics
        ?.fillStyle(theme.platformEdge, 1)
        .fillRoundedRect(
          platform.x,
          platform.y + 4,
          platform.width,
          platform.height,
          5
        );
      this.graphics
        ?.fillStyle(theme.stone, 1)
        .fillRoundedRect(
          platform.x,
          platform.y,
          platform.width,
          platform.height - 2,
          5
        );
      this.graphics
        ?.fillStyle(0xffffff, 0.45)
        .fillRect(platform.x + 4, platform.y + 3, platform.width - 8, 3);

      this.graphics
        ?.fillStyle(theme.highlight, 0.55)
        .fillEllipse(platform.x + platform.width / 2, platform.y - 20, 20, 20);
      this.addInlineLabel(
        platform.x + platform.width / 2 - 18,
        platform.y - 25,
        'SUMMIT',
        10,
        '#ffffff'
      );
      return;
    }

    // Shadow depth
    this.graphics
      ?.fillStyle(edgeColor, 0.9)
      .fillRoundedRect(
        platform.x,
        platform.y + 4,
        platform.width,
        platform.height,
        5
      );
    // Ledge faces
    this.graphics
      ?.fillStyle(darkColor, 1)
      .fillRoundedRect(
        platform.x,
        platform.y + 1,
        platform.width,
        platform.height,
        5
      );
    this.graphics
      ?.fillStyle(stoneColor, 1)
      .fillRoundedRect(
        platform.x,
        platform.y,
        platform.width,
        platform.height - 2,
        4
      );
    // Highlights
    this.graphics
      ?.fillStyle(highlightColor, 0.22)
      .fillRect(platform.x + 5, platform.y + 2, platform.width - 10, 2);

    // Sub-theme specific decorative platform detailing
    if (zoneIndex % 6 === 0) {
      this.graphics?.lineStyle(1.2, darkColor, 0.35);
      if (platform.width > 40)
        this.graphics?.lineBetween(
          platform.x + 20,
          platform.y + 1,
          platform.x + 20,
          platform.y + platform.height - 3
        );
      if (platform.width > 80)
        this.graphics?.lineBetween(
          platform.x + 60,
          platform.y + 1,
          platform.x + 60,
          platform.y + platform.height - 3
        );
      this.graphics?.fillStyle(theme.accent, 0.7);
      if (platform.width > 30)
        this.graphics?.fillEllipse(platform.x + 12, platform.y, 6, 2.5);
    } else if (zoneIndex % 6 === 1) {
      this.graphics?.fillStyle(theme.highlight, 0.7);
      if (platform.width > 30)
        this.graphics?.fillCircle(platform.x + 15, platform.y + 8, 3.5);
      if (platform.width > 60)
        this.graphics?.fillCircle(
          platform.x + platform.width - 15,
          platform.y + 8,
          3
        );
      this.graphics?.lineStyle(1, theme.highlight, 0.45);
      this.graphics?.lineBetween(
        platform.x + 10,
        platform.y + 4,
        platform.x + 24,
        platform.y + 12
      );
    } else if (zoneIndex % 6 === 2) {
      this.graphics?.lineStyle(1, highlightColor, 0.25);
      this.graphics?.lineBetween(
        platform.x + 10,
        platform.y + 2,
        platform.x + platform.width - 10,
        platform.y + platform.height - 4
      );
      this.graphics?.lineBetween(
        platform.x + platform.width - 15,
        platform.y + 2,
        platform.x + 15,
        platform.y + platform.height - 4
      );
    } else if (zoneIndex % 6 === 3) {
      this.graphics?.lineStyle(1, darkColor, 0.6);
      this.graphics?.lineBetween(
        platform.x + 4,
        platform.y + platform.height / 2,
        platform.x + platform.width - 4,
        platform.y + platform.height / 2
      );
      this.graphics?.fillStyle(theme.platformEdge, 0.75);
      this.graphics?.fillCircle(platform.x + 4, platform.y + 4, 1.2);
      this.graphics?.fillCircle(
        platform.x + platform.width - 4,
        platform.y + 4,
        1.2
      );
      this.graphics?.fillCircle(
        platform.x + 4,
        platform.y + platform.height - 6,
        1.2
      );
      this.graphics?.fillCircle(
        platform.x + platform.width - 4,
        platform.y + platform.height - 6,
        1.2
      );
    } else if (zoneIndex % 6 === 4) {
      this.graphics?.fillStyle(highlightColor, 0.18);
      this.graphics?.beginPath();
      const px = platform.x + platform.width / 2;
      const py = platform.y + platform.height / 2 - 1;
      this.graphics?.moveTo(px - 10, py);
      this.graphics?.lineTo(px, py - 4);
      this.graphics?.lineTo(px + 10, py);
      this.graphics?.lineTo(px, py + 4);
      this.graphics?.closePath();
      this.graphics?.fill();
    } else {
      this.graphics?.fillStyle(highlightColor, 0.35);
      this.graphics?.fillRect(
        platform.x + 4,
        platform.y + 3,
        platform.width - 8,
        1.5
      );
      this.graphics?.fillRect(
        platform.x + 4,
        platform.y + platform.height - 6,
        platform.width - 8,
        1.5
      );
    }
  }

  private drawArtifact(artifact: Artifact) {
    const zone = zoneForY(artifact.y);
    const th = themeForZone(zone.id);

    if (artifact.type === 'lantern_trail') {
      this.graphics?.lineStyle(2, th.accent, 0.6).beginPath();
      this.graphics?.arc(
        artifact.x + 60,
        artifact.y + 10,
        72,
        Math.PI * 1.08,
        Math.PI * 1.82
      );
      this.graphics?.strokePath();
      this.addInlineLabel(
        artifact.x - 22,
        artifact.y - 32,
        artifact.label,
        10,
        th.skyBot
      );
      return;
    }

    if (artifact.type === 'corpse_stack') {
      const colors = [th.stoneDark, th.stone, th.highlight];
      for (let i = 2; i >= 0; i -= 1) {
        this.graphics
          ?.fillStyle(colors[i]!, 1)
          .fillRoundedRect(
            artifact.x + i * 4,
            artifact.y + i * 5,
            artifact.width - i * 8,
            10,
            3
          );
        this.graphics
          ?.fillStyle(0xf6f0d4, 0.24)
          .fillRect(
            artifact.x + i * 4 + 4,
            artifact.y + i * 5 + 1,
            artifact.width - i * 8 - 8,
            2
          );
      }
      this.addArtifactLabel(
        artifact.x + artifact.width / 2,
        artifact.y - 6,
        artifact.label
      );
      return;
    }

    if (artifact.type === 'mercy_nail') {
      this.graphics
        ?.fillStyle(th.stoneDark, 1)
        .fillRoundedRect(artifact.x, artifact.y, 10, artifact.height, 2);
      this.graphics
        ?.fillStyle(th.accent, 1)
        .fillRoundedRect(
          artifact.x + 8,
          artifact.y - 2,
          artifact.width - 8,
          artifact.height + 4,
          3
        );
      this.graphics
        ?.lineStyle(1, th.highlight, 0.85)
        .strokeRect(
          artifact.x + 11,
          artifact.y,
          artifact.width - 14,
          artifact.height
        );
      this.graphics
        ?.lineStyle(1.2, 0xe8fff5, 0.9)
        .lineBetween(
          artifact.x + 10,
          artifact.y + artifact.height / 2,
          artifact.x + 3,
          artifact.y + artifact.height / 2
        );
      this.addArtifactLabel(
        artifact.x + artifact.width / 2,
        artifact.y - 6,
        artifact.label
      );
      return;
    }

    if (artifact.type === 'ghost_platform') {
      this.graphics
        ?.lineStyle(1.8, th.accent, 0.8)
        .strokeRoundedRect(
          artifact.x,
          artifact.y,
          artifact.width,
          artifact.height,
          6
        );
      this.graphics
        ?.fillStyle(th.accent, 0.2)
        .fillRoundedRect(
          artifact.x,
          artifact.y,
          artifact.width,
          artifact.height,
          6
        );

      this.graphics?.fillStyle(0xe8fff5, 0.75);
      for (let i = 0; i < 3; i++) {
        this.graphics?.fillCircle(
          artifact.x + 12 + i * ((artifact.width - 24) / 2),
          artifact.y + artifact.height / 2,
          2
        );
      }
      this.addArtifactLabel(
        artifact.x + artifact.width / 2,
        artifact.y - 6,
        artifact.label
      );
      return;
    }

    if (artifact.type === 'cursed_brick') {
      this.addArtifactLabel(
        artifact.x + artifact.width / 2,
        artifact.y - 6,
        artifact.label
      );
      return;
    }
  }

  private drawDynamicElements(deltaMs: number) {
    if (!this.dynamicGraphics || !this.player) return;
    const g = this.dynamicGraphics;
    const time = this.time.now;

    // 1. UPDATE AND DRAW PARTICLES
    const activeParticles = [];
    for (const p of this.particles) {
      p.life -= deltaMs;
      if (p.life > 0) {
        p.x += p.vx * (deltaMs / 1000);
        p.y += p.vy * (deltaMs / 1000);

        if (p.type === 'dust') {
          p.vy += 45 * (deltaMs / 1000); // float down/drift slightly
          p.vx *= 0.93;
        } else if (p.type === 'charge') {
          const dx = this.player.x - p.x;
          const dy = this.player.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 6) {
            p.vx += (dx / dist) * 720 * (deltaMs / 1000);
            p.vy += (dy / dist) * 720 * (deltaMs / 1000);
          } else {
            p.life = 0; // consumed on touch
          }
        } else if (p.type === 'lantern') {
          p.vy -= 18 * (deltaMs / 1000);
          p.vx += Math.sin(time / 200 + p.y) * 0.45;
        } else if (p.type === 'ghost') {
          p.vy -= 15 * (deltaMs / 1000);
          p.vx += Math.sin(time / 300 + p.y) * 0.65;
        }

        const currentAlpha = (p.life / p.maxLife) * p.alpha;
        g.fillStyle(p.color, currentAlpha);
        g.fillCircle(p.x, p.y, p.size);
        activeParticles.push(p);
      }
    }
    this.particles = activeParticles;

    // 2. SPAWN RUN DUST PARTICLES
    const body = this.player.body;
    const onFloor = body.blocked.down || body.touching.down;
    const vx = body.velocity.x;
    if (onFloor && Math.abs(vx) > 30) {
      if (Math.random() < 0.28) {
        this.particles.push({
          x: this.player.x - this.facing * 5 + (Math.random() * 6 - 3),
          y: this.player.y + 14,
          vx: -this.facing * (50 + Math.random() * 60),
          vy: -15 - Math.random() * 30,
          color: 0xf1c96b,
          alpha: 0.65,
          size: 1.2 + Math.random() * 1.6,
          life: 300,
          maxLife: 300,
          type: 'dust',
        });
      }
    }

    // SPAWN CHARGING FOXFIRE
    if (this.charging) {
      const power = chargePowerForHeldMs(this.chargeTime);
      if (Math.random() < 0.42 + power * 0.45) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 24 + Math.random() * 32;
        const px = this.player.x + Math.cos(angle) * radius;
        const py = this.player.y + Math.sin(angle) * radius;
        this.particles.push({
          x: px,
          y: py,
          vx: -Math.cos(angle) * 75,
          vy: -Math.sin(angle) * 75,
          color: Math.random() < 0.6 ? 0xff6f5f : 0x62d0c4,
          alpha: 0.8,
          size: 1.5 + Math.random() * 2.0,
          life: 450,
          maxLife: 450,
          type: 'charge',
        });
      }
    }

    const zone = ZONES.find((z) => z.id === this.currentZone);
    if (zone && zone.id !== BOTTOM_ZONE_ID) {
      if (Math.random() < 0.05) {
        const cam = this.cameras.main;
        const px = cam.scrollX + Math.random() * this.gameWidth();
        const py = cam.scrollY + cam.height - Math.random() * 160;
        const theme = themeForZone(zone.id);
        const zoneIndex = ZONES.findIndex((candidate) => candidate.id === zone.id);
        this.particles.push({
          x: px,
          y: py,
          vx: Math.random() * 24 - 12,
          vy: -25 - Math.random() * 35,
          color: zoneIndex % 2 === 0 ? theme.highlight : theme.accent,
          alpha: 0.45,
          size: 1.0 + Math.random() * 1.5,
          life: 2000,
          maxLife: 2000,
          type: zoneIndex % 2 === 0 ? 'lantern' : 'ghost',
        });
      }
    }

    // 3. DRAW DYNAMIC SWINGING CHECKPOINT LANTERNS
    this.drawCheckpointLanterns(g);

    // 4. DRAW DYNAMIC WOBBLING CURSED BRICKS
    this.drawWobblingCursedBricks(g);

    // 5. DRAW DYNAMIC TWINKLING STARS
    g.fillStyle(0xffffff, 0.7);
    for (const star of this.stars) {
      const alpha =
        0.35 + Math.sin((time / 300) * star.speed + star.phase) * 0.35;
      g.fillStyle(0xffffff, alpha);
      g.fillPoint(star.x, star.y, star.size);
    }

    // 6. DRAW FOX-SPIRIT PLAYER
    this.drawFoxSpirit(g);
  }

  private drawFoxSpirit(g: Phaser.GameObjects.Graphics) {
    if (!this.player) return;
    const cx = this.player.x;
    const cy = this.player.y;
    const onFloor =
      this.player.body.blocked.down || this.player.body.touching.down;
    const vy = this.player.body.velocity.y;
    const time = this.time.now;

    // Squash & Stretch
    let squashX = 1;
    let squashY = 1;
    if (this.charging) {
      const power = chargePowerForHeldMs(this.chargeTime);
      squashY = 1 - power * 0.28;
      squashX = 1 + power * 0.22;
    } else if (!onFloor) {
      const stretch = Phaser.Math.Clamp(Math.abs(vy) / 1200, 0, 0.26);
      squashY = 1 + stretch;
      squashX = 1 - stretch * 0.5;
    }

    // Charge glow rings
    if (this.charging) {
      const power = chargePowerForHeldMs(this.chargeTime);
      g.fillStyle(0xff6f5f, 0.15 + power * 0.35);
      g.fillCircle(cx, cy + 2 * squashY, (14 + power * 10) * squashX);

      g.lineStyle(1.5, 0x62d0c4, 0.3 + power * 0.5);
      g.strokeCircle(cx, cy + 2 * squashY, (14 + power * 10) * squashX);
    }

    // Ears
    g.fillStyle(0xf6f0d4, 1);
    g.fillTriangle(
      cx - 9 * squashX,
      cy - 8 * squashY,
      cx - 4 * squashX,
      cy - 19 * squashY,
      cx - 1 * squashX,
      cy - 8 * squashY
    );
    g.fillStyle(0xff6f5f, 0.85);
    g.fillTriangle(
      cx - 7 * squashX,
      cy - 9 * squashY,
      cx - 4 * squashX,
      cy - 16 * squashY,
      cx - 3 * squashX,
      cy - 9 * squashY
    );

    g.fillStyle(0xf6f0d4, 1);
    g.fillTriangle(
      cx + 9 * squashX,
      cy - 8 * squashY,
      cx + 4 * squashX,
      cy - 19 * squashY,
      cx + 1 * squashX,
      cy - 8 * squashY
    );
    g.fillStyle(0xff6f5f, 0.85);
    g.fillTriangle(
      cx + 7 * squashX,
      cy - 9 * squashY,
      cx + 4 * squashX,
      cy - 16 * squashY,
      cx + 3 * squashX,
      cy - 9 * squashY
    );

    // Fluffy waving tail
    const tailWave = Math.sin(time / 140) * 3.5;
    const tx = cx - this.facing * (9 + tailWave * 0.2) * squashX;
    const ty = cy + (5 + tailWave * 0.6) * squashY;

    g.fillStyle(0xf6f0d4, 1);
    g.fillEllipse(tx, ty, 6 * squashX, 8 * squashY);
    g.fillStyle(0xff6f5f, 1);
    g.fillEllipse(
      tx - this.facing * 3 * squashX,
      ty + 1 * squashY,
      3 * squashX,
      4 * squashY
    );

    // Body
    g.fillStyle(0xf6f0d4, 1);
    g.fillEllipse(cx, cy + 2 * squashY, 10 * squashX, 12 * squashY);

    // Blush cheeks
    g.fillStyle(0xff6f5f, 0.38);
    g.fillCircle(cx - 6 * squashX, cy + 4 * squashY, 2.2 * squashX);
    g.fillCircle(cx + 6 * squashX, cy + 4 * squashY, 2.2 * squashX);

    // Eyes
    g.fillStyle(0x33291f, 1);
    const eyeOffset = this.facing * 2 * squashX;
    const isBlinking = Math.floor(time / 2800) % 10 === 0;

    if (isBlinking) {
      g.lineStyle(1.5, 0x33291f, 1);
      g.lineBetween(
        cx - 5.5 * squashX + eyeOffset,
        cy + 0.5 * squashY,
        cx - 2.5 * squashX + eyeOffset,
        cy + 0.5 * squashY
      );
      g.lineBetween(
        cx + 2.5 * squashX + eyeOffset,
        cy + 0.5 * squashY,
        cx + 5.5 * squashX + eyeOffset,
        cy + 0.5 * squashY
      );
    } else {
      g.fillCircle(
        cx - 4 * squashX + eyeOffset,
        cy + 0.5 * squashY,
        1.8 * squashX
      );
      g.fillCircle(
        cx + 4 * squashX + eyeOffset,
        cy + 0.5 * squashY,
        1.8 * squashX
      );
    }
  }

  private drawCheckpointLanterns(g: Phaser.GameObjects.Graphics) {
    const swingAngle = Math.sin(this.time.now / 380) * 0.16;
    for (const platform of this.towerPlatforms) {
      const layout = this.layoutPlatform(platform);
      const isCheckpoint = layout.id.includes('checkpoint');
      if (isCheckpoint) {
        const cx = layout.x + layout.width / 2;
        const postH = 46;
        const leftHangerX = cx - layout.width * 0.32;
        const rightHangerX = cx + layout.width * 0.32;
        const hangerY = layout.y - postH + 6;
        this.drawSingleLantern(g, leftHangerX, hangerY, swingAngle);
        this.drawSingleLantern(g, rightHangerX, hangerY, -swingAngle);
      }
    }
  }

  private drawSingleLantern(
    g: Phaser.GameObjects.Graphics,
    hx: number,
    hy: number,
    angle: number
  ) {
    const len = 12;
    const lx = hx + Math.sin(angle) * len;
    const ly = hy + Math.cos(angle) * len;

    // Cord
    g.lineStyle(1.2, 0x071923, 0.85);
    g.lineBetween(hx, hy, lx, ly);

    // Glow
    g.fillStyle(0x62d0c4, 0.28);
    g.fillCircle(lx, ly, 10);

    // Wood cap
    g.fillStyle(0x071923, 1);
    g.fillRect(lx - 4, ly - 7, 8, 2);

    // Warm glow paper body
    g.fillStyle(0xe8fff5, 1);
    g.fillRoundedRect(lx - 4, ly - 5, 8, 10, 2);
    g.fillStyle(0x62d0c4, 0.62);
    g.fillRoundedRect(lx - 3, ly - 4, 6, 8, 1.5);

    // Red tassel
    g.lineStyle(1.5, 0xff6f5f, 0.9);
    g.lineBetween(lx, ly + 5, lx + Math.sin(angle * 1.5) * 5, ly + 9);
  }

  private drawWobblingCursedBricks(g: Phaser.GameObjects.Graphics) {
    const snapshot = window.fallstackSnapshot;
    if (!snapshot) return;
    const time = this.time.now;

    for (const zone of snapshot.zones) {
      for (const artifact of zone.artifacts) {
        if (artifact.type === 'cursed_brick') {
          const layout = this.layoutArtifact(artifact);
          // Touching check
          let isStanding = false;
          if (this.player) {
            const px = this.player.x;
            const py = this.player.y + 14;
            if (
              py >= layout.y - 4 &&
              py <= layout.y + 4 &&
              px >= layout.x - 2 &&
              px <= layout.x + layout.width + 2
            ) {
              isStanding = true;
            }
          }

          const amp = isStanding ? 2.2 : 0.6;
          const freq = isStanding ? 50 : 220;
          const wobble = Math.sin(time / freq) * amp;

          // Shadow
          g.fillStyle(0x120608, 0.9).fillRoundedRect(
            layout.x + wobble,
            layout.y + 3,
            layout.width,
            layout.height,
            4
          );

          // Brick
          g.fillStyle(0x6a1b2e, 1).fillRoundedRect(
            layout.x + wobble,
            layout.y,
            layout.width,
            layout.height - 2,
            4
          );

          // Cracks
          g.lineStyle(1.2, 0x0a0508, 0.8);
          g.lineBetween(
            layout.x + 8 + wobble,
            layout.y + 2,
            layout.x + 15 + wobble,
            layout.y + layout.height - 3
          );
          g.lineBetween(
            layout.x + 24 + wobble,
            layout.y + 1,
            layout.x + 20 + wobble,
            layout.y + layout.height - 2
          );

          // Moss clumps on top
          g.fillStyle(0x62d0c4, 0.75);
          g.fillEllipse(layout.x + 10 + wobble, layout.y, 4, 1.5);
          g.fillEllipse(layout.x + 28 + wobble, layout.y, 6, 2);
        }
      }
    }
  }

  private addZoneLabel(
    x: number,
    y: number,
    name: string,
    statusLabel: string
  ) {
    const label = this.add.text(x, y, `${name} · ${statusLabel}`, {
      fontFamily: '"Shippori Mincho", serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#9ee6c9',
    });
    label.setDepth(1);
    label.setAlpha(0.58);
    this.labels.push(label);
  }

  private addArtifactLabel(centerX: number, y: number, text: string) {
    const labelWidth = 148;
    const clampedX = Phaser.Math.Clamp(
      centerX,
      labelWidth / 2 + 6,
      this.gameWidth() - labelWidth / 2 - 6
    );
    const label = this.add.text(clampedX, y, text, {
      fontFamily: '"Zen Maru Gothic", sans-serif',
      fontSize: '11px',
      fontStyle: '700',
      color: '#120608',
      backgroundColor: 'rgba(232, 255, 245, 0.94)',
      padding: { left: 6, right: 6, top: 3, bottom: 3 },
      wordWrap: { width: labelWidth, useAdvancedWrap: true },
    });
    label.setOrigin(0.5, 1);
    label.setDepth(4);
    this.labels.push(label);
  }

  private addInlineLabel(
    x: number,
    y: number,
    text: string,
    size: number,
    color: string
  ) {
    const label = this.add.text(x, y, text, {
      fontFamily: '"Zen Maru Gothic", sans-serif',
      fontSize: `${size}px`,
      color,
    });
    label.setDepth(3);
    this.labels.push(label);
  }

  private rebuildArtifactBodies() {
    this.artifactBodies?.clear(true, true);
    const snapshot = window.fallstackSnapshot;
    if (!snapshot || !this.artifactBodies) return;
    for (const artifact of snapshot.zones.flatMap((zone) => zone.artifacts)) {
      if (!artifact.solid) continue;
      const layout = this.layoutArtifact(artifact);
      const rect = this.add.rectangle(
        layout.x + layout.width / 2,
        layout.y + layout.height / 2,
        layout.width,
        layout.height,
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
export function GameApp() {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [message, setMessage] = useState('');
  const [charge, setCharge] = useState(0);
  const [currentZoneId, setCurrentZoneId] = useState<ZoneId>(BOTTOM_ZONE_ID);
  const [sharedAvailable, setSharedAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [summitOpen, setSummitOpen] = useState(false);
  const [gameplayMuted, setGameplayMuted] = useState(
    () =>
      localStorage.getItem('fallstack:gameplay-muted') === 'true' ||
      localStorage.getItem('fallstack:muted') === 'true'
  );
  const [musicMuted, setMusicMuted] = useState(
    () => localStorage.getItem('fallstack:music-muted') === 'true'
  );
  const [sessionStats, setSessionStats] = useState({
    falls: 0,
    clears: 0,
    summits: 0,
  });
  const [mutationVisible, setMutationVisible] = useState(false);
  const [checkpointVisible, setCheckpointVisible] = useState(false);
  const [checkpointText, setCheckpointText] = useState({ title: '', sub: '' });
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<FallstackScene | null>(null);
  const soundRef = useRef<ProceduralSound | null>(
    new ProceduralSound({ gameplayMuted, musicMuted })
  );
  const resultCloseRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const mutationTimerRef = useRef<number | null>(null);
  const checkpointTimerRef = useRef<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  const showMutation = useCallback((text: string) => {
    setMessage(text);
    setMutationVisible(true);
    if (mutationTimerRef.current) window.clearTimeout(mutationTimerRef.current);
    mutationTimerRef.current = window.setTimeout(
      () => setMutationVisible(false),
      3800
    );
  }, []);

  const showCheckpoint = useCallback((title: string, sub: string) => {
    setCheckpointText({ title, sub });
    setCheckpointVisible(true);
    if (checkpointTimerRef.current)
      window.clearTimeout(checkpointTimerRef.current);
    checkpointTimerRef.current = window.setTimeout(
      () => setCheckpointVisible(false),
      3400
    );
  }, []);

  const loadSharedState = useCallback(
    async (successMessage: string | null = '14 falls made this foothold.') => {
      const res = await fetch('/api/init-game');
      const data = await parseApiResponse<InitGameResponse>(res);
      setSharedAvailable(true);
      window.fallstackSnapshot = data.snapshot;
      setSnapshot(data.snapshot);
      if (successMessage) showMutation(successMessage);
    },
    [showMutation]
  );

  const stats = useMemo(() => {
    if (!snapshot) return { falls: 37, clears: 0, summits: 0 };
    return {
      falls: snapshot.totalFalls,
      clears: snapshot.totalClears,
      summits: snapshot.totalSummits,
    };
  }, [snapshot]);

  const currentZoneInfo = useMemo(() => {
    if (!snapshot?.zones?.length)
      return { name: zoneById(BOTTOM_ZONE_ID).name, statusLabel: 'Quiet' };
    return (
      snapshot.zones.find((zone) => zone.id === currentZoneId) ??
      snapshot.zones[0] ?? { name: zoneById(BOTTOM_ZONE_ID).name, statusLabel: 'Quiet' }
    );
  }, [currentZoneId, snapshot]);

  useEffect(() => {
    resetSharedInput();
    let cancelled = false;
    const init = async () => {
      try {
        if (cancelled) return;
        await loadSharedState();
      } catch (error) {
        console.error('init-game failed', error);
        const localSnapshot = createLocalSnapshot();
        setSharedAvailable(false);
        window.fallstackSnapshot = localSnapshot;
        setSnapshot(localSnapshot);
        showMutation(
          'The mountain remembers locally. Shared marks are delayed.'
        );
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
    localStorage.setItem('fallstack:gameplay-muted', String(gameplayMuted));
    soundRef.current?.setGameplayMuted(gameplayMuted);
  }, [gameplayMuted]);

  useEffect(() => {
    localStorage.setItem('fallstack:music-muted', String(musicMuted));
    soundRef.current?.setMusicMuted(musicMuted);
  }, [musicMuted]);

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
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
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

  // Boot Phaser once, then keep it pinned to the real container size.
  useEffect(() => {
    if (gameRef.current) return;
    let frameId: number | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const resizeGame = () => {
      const container = document.getElementById('game-canvas');
      if (!container || !gameRef.current) return;
      const { containerW, containerH, gameW, gameH } =
        computeGameDimensions(container.getBoundingClientRect());
      if (containerW === 0 || containerH === 0) return;
      gameRef.current.scale.resize(gameW, gameH);
    };

    const initGame = () => {
      const container = document.getElementById('game-canvas');
      if (!container) return;
      const { containerW, containerH, gameW, gameH } =
        computeGameDimensions(container.getBoundingClientRect());

      // Wait until browser layout has completed and container has dimensions
      if (containerW === 0 || containerH === 0) {
        frameId = requestAnimationFrame(initGame);
        return;
      }

      const scene = new FallstackScene('FallstackScene');
      sceneRef.current = scene;
      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: 'game-canvas',
        backgroundColor: '#1b262f',
        width: gameW,
        height: gameH,
        scale: {
          mode: Phaser.Scale.NONE,
          autoCenter: Phaser.Scale.NO_CENTER,
          width: gameW,
          height: gameH,
        },
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { y: MOVEMENT_TUNING.gravityY, x: 0 },
            debug: false,
          },
        },
        render: {
          antialias: false,
          pixelArt: true,
          roundPixels: true,
        },
        scene,
      });
      gameRef.current = game;

      const styleCanvas = () => {
        const canvas = container.querySelector('canvas');
        if (canvas) {
          canvas.style.imageRendering = 'pixelated';
          canvas.style.width = '100%';
          canvas.style.height = '100%';
        }
      };

      frameId = requestAnimationFrame(() => {
        resizeGame();
        styleCanvas();
      });
      resizeObserver = new ResizeObserver(() => {
        if (frameId) cancelAnimationFrame(frameId);
        frameId = requestAnimationFrame(() => {
          resizeGame();
          styleCanvas();
        });
      });
      resizeObserver.observe(container);
      document.fonts?.ready.then(() => resizeGame()).catch(() => {});
    };

    initGame();

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
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
    if (!snapshot || !sharedAvailable) return;

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
  }, [loadSharedState, sharedAvailable, snapshot]);

  useEffect(() => {
    sceneRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  const postFall = useCallback(
    async (detail: FallEventDetail) => {
      if (!snapshot) return;
      setSessionStats((current) => ({
        ...current,
        falls: current.falls + 1,
      }));
      soundRef.current?.play('fall');

      if (!sharedAvailable) {
        const nextSnapshot = applyLocalFall(snapshot, detail);
        setSnapshot(nextSnapshot);
        showMutation(localFallMessage(nextSnapshot, detail));
        soundRef.current?.play('mutation');
        return;
      }

      try {
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
    [loadSharedState, sharedAvailable, showMutation, snapshot]
  );

  const postClear = useCallback(
    async (detail: ClearEventDetail) => {
      if (!snapshot) return;
      setSessionStats((current) => ({
        ...current,
        clears: current.clears + 1,
      }));
      soundRef.current?.play('checkpoint');

      if (!sharedAvailable) {
        const nextSnapshot = applyLocalClear(snapshot, detail);
        setSnapshot(nextSnapshot);
        const message = localClearMessage(nextSnapshot, detail);
        showCheckpoint(message, '');
        return;
      }

      try {
        const res = await fetch('/api/record-clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...detail,
            dailySeed: snapshot.dailySeed,
            timestamp: Date.now(),
          }),
        });
        const data = await parseApiResponse<RecordClearResponse>(res);
        setSnapshot(data.snapshot);
        showCheckpoint(data.message, '');
      } catch (error) {
        console.error('record-clear failed', error);
        if (error instanceof ApiRequestError && error.status === 409) {
          await loadSharedState('A new tower took over. Fresh stones loaded.');
          return;
        }
        showMutation('The checkpoint did not hold.');
      }
    },
    [loadSharedState, sharedAvailable, showCheckpoint, showMutation, snapshot]
  );

  const postSummit = useCallback(
    async (detail: SummitEventDetail) => {
      if (!snapshot) return;
      setSessionStats((current) => ({
        ...current,
        summits: current.summits + 1,
      }));
      soundRef.current?.play('checkpoint');

      if (!sharedAvailable) {
        setSnapshot(applyLocalSummit(snapshot, detail));
        showMutation('The summit remembers you locally.');
        setSummitOpen(true);
        return;
      }

      try {
        const res = await fetch('/api/record-summit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...detail,
            dailySeed: snapshot.dailySeed,
            timestamp: Date.now(),
          }),
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
    [loadSharedState, sharedAvailable, showMutation, snapshot]
  );

  useEffect(() => {
    const onCharge = (event: Event) => {
      const detail = (event as CustomEvent<{ percent: number }>).detail;
      if (detail.percent <= 0) soundRef.current?.stopCharge();
      if (detail.percent <= 35 && detail.percent > 0)
        soundRef.current?.play('charge-start');
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
    const onZone = (event: Event) => {
      const detail = (event as CustomEvent<ZoneEventDetail>).detail;
      setCurrentZoneId(detail.zoneId);
    };
    window.addEventListener('fallstack:charge', onCharge);
    window.addEventListener('fallstack:land', onLand);
    window.addEventListener('fallstack:launch', onLaunch);
    window.addEventListener('fallstack:fall', onFall);
    window.addEventListener('fallstack:clear', onClear);
    window.addEventListener('fallstack:summit', onSummit);
    window.addEventListener('fallstack:zone', onZone);
    return () => {
      window.removeEventListener('fallstack:charge', onCharge);
      window.removeEventListener('fallstack:land', onLand);
      window.removeEventListener('fallstack:launch', onLaunch);
      window.removeEventListener('fallstack:fall', onFall);
      window.removeEventListener('fallstack:clear', onClear);
      window.removeEventListener('fallstack:summit', onSummit);
      window.removeEventListener('fallstack:zone', onZone);
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
            <span className="hanko" aria-hidden="true">
              登
            </span>
            <span>Fallstack</span>
          </div>
          <div className="topbar-headline">
            <b>{stats.falls}</b> failed climbs today
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
            onClick={() => setGameplayMuted((value) => !value)}
            aria-pressed={gameplayMuted}
          >
            {gameplayMuted ? 'SFX Off' : 'SFX On'}
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={() => setMusicMuted((value) => !value)}
            aria-pressed={musicMuted}
          >
            {musicMuted ? 'Music Off' : 'Music On'}
          </button>
        </div>
      </header>

      {/* ── GAME VIEWPORT ── */}
      <section className="tower-wrap" aria-label="Fallstack tower">
        <div id="game-canvas" />

        {/* Zone tag — top left overlay */}
        <div
          className="hud-overlay zone-tag"
          role="status"
          aria-label={`Current zone: ${currentZoneInfo.name}, ${currentZoneInfo.statusLabel}`}
        >
          {currentZoneInfo.name}
          <span className={`zone-badge ${zoneBadgeClass}`}>
            {BADGE_DISPLAY[currentZoneInfo.statusLabel] ??
              currentZoneInfo.statusLabel}
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
          {checkpointText.sub && (
            <div className="checkpoint-sub">{checkpointText.sub}</div>
          )}
        </div>

        {/* Charge bar */}
        <div
          className="charge-bar"
          aria-label={`Jump charge ${charge}%`}
          aria-valuenow={charge}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
        >
          <span
            className="charge-fill"
            style={{ transform: `scaleX(${charge / 100})` }}
          />
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
        <div
          className="result-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Daily result"
        >
          <div className="result-card">
            <p className="eyebrow">
              <span className="hanko" aria-hidden="true">
                登
              </span>
              Daily result
            </p>
            <h2>{snapshot?.result.towerName ?? 'The Cursed Stack'}</h2>
            <p className="result-seed">
              Seed {snapshot?.result.seedLabel ?? 'today'}
            </p>
            <dl className="result-rows">
              <div className="result-row">
                <dt>Summit</dt>
                <dd>
                  {snapshot?.result.summitStatus ?? 'Unclaimed'}
                  {snapshot?.result.firstSummitUsername
                    ? ` · ${snapshot.result.firstSummitUsername}`
                    : ''}
                </dd>
              </div>
              <div className="result-row">
                <dt>Worst memory</dt>
                <dd>
                  {snapshot?.result.mostCursedZone ?? 'Lower Ruins'} ·{' '}
                  {snapshot?.result.mostCursedStatus ?? 'Haunted'}
                </dd>
              </div>
              <div className="result-row">
                <dt>Useful scar</dt>
                <dd>
                  {snapshot?.result.mostUsefulArtifact ??
                    'Corpse Stack · Lower Ruins'}
                </dd>
              </div>
              <div className="result-row">
                <dt>Best stabilizer</dt>
                <dd>
                  {snapshot?.result.bestStabilizerUsername ?? 'No one yet.'}
                </dd>
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
                  {sessionStats.falls} falls · {sessionStats.clears} clears ·{' '}
                  {sessionStats.summits} summits
                </dd>
              </div>
            </dl>
            <p className="tomorrow-hook">
              {snapshot?.result.tomorrowHook ??
                "Tomorrow, today's worst ledge comes back as a relic."}
            </p>
            <button
              ref={resultCloseRef}
              type="button"
              className="result-close-btn"
              onClick={() => setSummitOpen(false)}
            >
              Keep climbing
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
