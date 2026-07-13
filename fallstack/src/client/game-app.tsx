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
  type GameSnapshot,
  type ZoneId,
} from '../shared/game/mutation';
import {
  chargePowerForHeldMs,
  chargeRatioForHeldMs,
  launchVelocityForChargeRatio,
  MOVEMENT_TUNING,
} from '../shared/game/movement.js';
import {
  fallZoneForRespawn,
  shouldEndRunAtY,
} from '../shared/game/progression.js';
import { resolveFallObservation } from '../shared/game/mutation-events.js';
import type { MutationReceipt } from '../shared/game/mutation-receipts.js';
import type {
  BoardSnapshot,
  MutationBeat,
} from '../shared/game/board.js';
import {
  generateDailyTower,
  nextZoneId,
  WORLD_HEIGHT,
  WORLD_WIDTH,
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
import {
  artifactUseWindowMs,
  canCollideWithArtifact,
} from './game/artifact-mechanics';
import type {
  ClearEventDetail,
  FallEventDetail,
  LandEventDetail,
  SummitEventDetail,
  ZoneEventDetail,
} from './game/events';
import { INITIAL_INPUT, resetSharedInput, type InputState } from './game/input';
import {
  clampedArtifactLabelCenter,
  RELIQUARY_COLORS,
  reliquaryZoneFor,
  reliquaryZoneName,
} from './game/art-direction';
import {
  cameraBottomPaddingForGameWidth,
  computeGameDimensions,
  gameWorldWidth,
  routeOffsetForGameWidth,
} from './game/layout';
import { renderReliquaryArtifact } from './game/renderArtifacts';
import { renderReliquaryPlayer } from './game/renderPlayer';
import {
  renderReliquaryBackdrop,
  renderReliquaryPlatform,
} from './game/renderTower';
import {
  applyLocalClear,
  applyLocalFall,
  applyLocalSummit,
  localClearMessage,
  localFallMessage,
  openingMutationMessage,
} from './game/localSnapshot';
import { ProceduralSound } from './game/sound';
import { mutationReceiptPresentation } from './game/receipt';
import {
  latestRemoteBeat,
  reconciliationDecision,
} from './game/reconciliation';
import { deriveTowerMemory } from './game/tower-memory';
import { BADGE_DISPLAY, STATUS_TO_BADGE_CLASS } from './game/ui';

declare global {
  interface Window {
    fallstackInput: InputState;
    fallstackSnapshot?: GameSnapshot;
  }
}

const START_POS = { x: 240, y: WORLD_HEIGHT - 88 };

function isBoardSnapshot(
  snapshot: GameSnapshot | undefined
): snapshot is BoardSnapshot {
  return (
    snapshot !== undefined &&
    'boardId' in snapshot &&
    typeof snapshot.boardId === 'string' &&
    'revision' in snapshot &&
    typeof snapshot.revision === 'number'
  );
}

function checkpointForZone(zoneId: ZoneId): { x: number; y: number } {
  if (zoneId === BOTTOM_ZONE_ID) return START_POS;
  return { x: 240, y: zoneById(zoneId).yBottom - 60 };
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
  private lastLaunchDirection: -1 | 0 | 1 = 0;
  private lastPlatformId: string | null = 'start';
  private lastHelperArtifactId: string | null = null;
  private wallBonkPlatformId: string | null = null;
  private lastWallBounceAt = -Infinity;
  private currentZone: ZoneId = BOTTOM_ZONE_ID;
  private publishedZone: ZoneId = BOTTOM_ZONE_ID;
  private respawnZone: ZoneId = BOTTOM_ZONE_ID;
  private currentAttemptId = newAttemptId('attempt');
  private highestY = START_POS.y;
  private checkpointed = new Set<ZoneId>();
  private summitSent = false;
  private lastHelperTouchAt = -Infinity;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    .matches;
  private towerSeed = createDailySeed().dailySeed;
  private towerPlatforms: Platform[] = generateDailyTower(this.towerSeed)
    .platforms;
  private chargeTime = 0;
  private publishedChargePercent = -1;
  private stableFrameCount = 0;
  private controlsReady = false;
  private currentRouteOffset = 0;
  private readonly platformScale = 1;
  private mutationHighlight: {
    receipt: MutationReceipt;
    snapshot: GameSnapshot;
    until: number;
  } | null = null;
  private expiredArtifactIds = new Set<string>();
  private artifactTimers = new Map<
    string,
    {
      type: 'ghost_platform' | 'cursed_brick';
      collapseAt: number;
      attemptId: string;
    }
  >();

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
      this.shouldCollideWithArtifact,
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

    this.refreshSnapshot(window.fallstackSnapshot);
    this.publishZone();
    this.snapCameraToPlayer();
  }

  override update(_time: number, deltaMs: number) {
    if (!this.player) return;
    if (!this.controlsReady) {
      this.stableFrameCount = deltaMs <= 34 ? this.stableFrameCount + 1 : 0;
      const settled =
        this.player.body.blocked.down || this.player.body.touching.down;
      if (this.dynamicGraphics) {
        this.dynamicGraphics.clear();
        this.drawDynamicElements(deltaMs);
      }
      if (this.stableFrameCount >= 4 && settled) {
        this.controlsReady = true;
        window.dispatchEvent(new CustomEvent('fallstack:ready'));
      }
      return;
    }
    const input = this.readInput();
    const body = this.player.body;
    const onFloor = body.blocked.down || body.touching.down;
    this.updateCurrentZone();
    this.highestY = Math.min(this.highestY, this.player.y);

    if (input.left) this.facing = -1;
    if (input.right) this.facing = 1;
    body.setGravityY(0);
    if (onFloor) {
      body.setAccelerationX(0);
      body.setDragX(MOVEMENT_TUNING.groundDragX);
      body.setMaxVelocity(
        MOVEMENT_TUNING.initialMaxVelocityX,
        MOVEMENT_TUNING.maxVelocityY
      );
      body.setVelocityX(
        input.left
          ? -(this.charging
              ? MOVEMENT_TUNING.chargingGroundSpeed
              : MOVEMENT_TUNING.groundSpeed)
          : input.right
            ? this.charging
              ? MOVEMENT_TUNING.chargingGroundSpeed
              : MOVEMENT_TUNING.groundSpeed
            : Phaser.Math.Linear(body.velocity.x, 0, 0.32)
      );
      this.wallBonkPlatformId = null;
    } else {
      const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      body.setAccelerationX(steer * MOVEMENT_TUNING.airSteerAccelerationX);
      body.setMaxVelocity(
        MOVEMENT_TUNING.airMaxVelocityX,
        MOVEMENT_TUNING.maxVelocityY
      );
      this.tryWallBounce(body, input);
      if (
        (body.blocked.left || body.blocked.right) &&
        body.velocity.y > MOVEMENT_TUNING.wallBonkVelocityYThreshold
      )
        this.wallBonkPlatformId = this.lastPlatformId;
    }

    if (onFloor && input.jump && !this.charging) {
      this.charging = true;
      this.chargeStart = this.time.now;
    }

    if (this.charging) {
      this.chargeTime = Math.max(0, this.time.now - this.chargeStart);
      const percent = chargeRatioForHeldMs(this.chargeTime);
      const roundedPercent = Math.round(percent * 10) * 10;
      if (roundedPercent !== this.publishedChargePercent) {
        this.publishedChargePercent = roundedPercent;
        window.dispatchEvent(
          new CustomEvent('fallstack:charge', {
            detail: { percent: roundedPercent },
          })
        );
      }
    }

    if (this.charging && (!input.jump || !onFloor)) {
      const held = Math.max(0, this.time.now - this.chargeStart);
      const percent = chargeRatioForHeldMs(held);
      this.lastChargePercent = Math.round(percent * 100);
      if (onFloor && !input.jump) {
        const launch = launchVelocityForChargeRatio(percent);
        this.lastLaunchDirection = this.facing;
        body.setVelocity(this.facing * launch.x, launch.y);
        window.dispatchEvent(new CustomEvent('fallstack:launch'));
      }
      this.charging = false;
      this.chargeTime = 0;
      this.publishedChargePercent = 0;
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

  showMutationReceipt(receipt: MutationReceipt, snapshot: GameSnapshot) {
    if (!receipt.accepted || !receipt.siteId) return;
    this.mutationHighlight = {
      receipt,
      snapshot,
      until: this.time.now + 5_200,
    };
  }

  isSafeToReconcile(): boolean {
    if (!this.player) return false;
    const body = this.player.body;
    const onFloor = body.blocked.down || body.touching.down;
    const checkpoint = checkpointForZone(this.respawnZone);
    const atRespawn =
      Math.abs(this.player.y - checkpoint.y) <= 2 &&
      Math.abs(body.velocity.x) <= 1 &&
      Math.abs(body.velocity.y) <= 1;
    return onFloor || atRespawn;
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
    const activeZoneIds = this.activeZoneIds();
    for (const platform of this.towerPlatforms) {
      if (activeZoneIds.has(platform.zoneId)) this.addPlatform(platform);
    }
  }

  private activeZoneIds(): Set<ZoneId> {
    const index = ZONES.findIndex((zone) => zone.id === this.currentZone);
    const from = Math.max(0, index - 1);
    return new Set(ZONES.slice(from, index + 2).map((zone) => zone.id));
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
    const platformId = object.getData('platformId');
    if (typeof platformId === 'string') this.lastPlatformId = platformId;
    if (platformId === 'summit' && !this.summitSent) {
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
    const type = object.getData('artifactType') as Artifact['type'];
    const artifactId = object.getData('artifactId');
    if (type === 'corpse_stack' || type === 'mercy_nail') {
      if (typeof artifactId === 'string') {
        this.lastHelperArtifactId = artifactId;
        this.lastHelperTouchAt = this.time.now;
      }
    }
    if (
      typeof artifactId === 'string' &&
      (type === 'ghost_platform' || type === 'cursed_brick')
    )
      this.startArtifactTimer(artifactId, type);
  }

  private shouldCollideWithArtifact(
    playerObject: unknown,
    artifactObject: unknown
  ): boolean {
    const player = playerObject as Phaser.GameObjects.Rectangle & {
      body: Phaser.Physics.Arcade.Body;
    };
    const artifact = artifactObject as Phaser.GameObjects.Rectangle & {
      body: Phaser.Physics.Arcade.StaticBody;
    };
    const type = artifact.getData('artifactType') as Artifact['type'];
    const artifactId = artifact.getData('artifactId');
    if (
      typeof artifactId === 'string' &&
      this.expiredArtifactIds.has(artifactId)
    )
      return false;
    return canCollideWithArtifact({
      type,
      playerVelocityY: player.body.velocity.y,
      playerBottom: player.body.bottom,
      artifactTop: artifact.body.top,
    });
  }

  private startArtifactTimer(
    artifactId: string,
    type: 'ghost_platform' | 'cursed_brick'
  ) {
    if (this.artifactTimers.has(artifactId)) return;
    const duration = artifactUseWindowMs(type);
    if (duration === null) return;
    const attemptId = this.currentAttemptId;
    this.artifactTimers.set(artifactId, {
      type,
      collapseAt: this.time.now + duration,
      attemptId,
    });
    this.time.delayedCall(duration, () => {
      const timer = this.artifactTimers.get(artifactId);
      if (!timer || timer.attemptId !== this.currentAttemptId) return;
      this.artifactTimers.delete(artifactId);
      this.expiredArtifactIds.add(artifactId);
      this.drawWorld();
      this.rebuildArtifactBodies();
    });
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

    const respawnZoneId = fallZoneForRespawn(this.respawnZone);
    window.dispatchEvent(
      new CustomEvent<FallEventDetail>('fallstack:fall', {
        detail: {
          attemptId: this.currentAttemptId,
          respawnZoneId,
          fallX: Phaser.Math.Clamp(
            this.player.x - this.routeOffsetX(),
            0,
            WORLD_WIDTH
          ),
          fallY: this.player.y,
          highestY: this.highestY,
          lastPlatformId: this.lastPlatformId,
          lastHelperArtifactId:
            this.time.now - this.lastHelperTouchAt < 4000
              ? this.lastHelperArtifactId
              : null,
          wallBonkPlatformId: this.wallBonkPlatformId,
          launchChargePercent: this.lastChargePercent,
          launchDirection: this.lastLaunchDirection,
        },
      })
    );
    this.respawn();
  }

  private respawn() {
    if (!this.player) return;
    const checkpoint = checkpointForZone(this.respawnZone);
    this.player.setPosition(this.layoutX(checkpoint.x), checkpoint.y);
    this.player.body.setVelocity(0, 0);
    this.player.body.setAcceleration(0, 0);
    this.player.body.setGravityY(0);
    this.currentZone = this.respawnZone;
    this.publishZone();
    this.currentAttemptId = newAttemptId('attempt');
    this.highestY = checkpoint.y;
    this.charging = false;
    this.chargeTime = 0;
    this.publishedChargePercent = 0;
    this.lastHelperTouchAt = -Infinity;
    this.lastHelperArtifactId = null;
    this.wallBonkPlatformId = null;
    this.lastLaunchDirection = 0;
    this.lastPlatformId =
      this.respawnZone === BOTTOM_ZONE_ID ? 'start' : null;
    this.artifactTimers.clear();
    this.expiredArtifactIds.clear();
    this.drawWorld();
    this.rebuildArtifactBodies();

    // Instantly snap camera scroll to the player spawn point
    this.snapCameraToPlayer();
  }

  private tryWallBounce(body: Phaser.Physics.Arcade.Body, input: InputState) {
    const now = this.time.now;
    if (now - this.lastWallBounceAt < MOVEMENT_TUNING.wallBounceCooldownMs)
      return;

    const hitLeft = body.blocked.left || body.touching.left;
    const hitRight = body.blocked.right || body.touching.right;
    const intoLeft =
      hitLeft &&
      (input.left ||
        this.facing === -1 ||
        body.velocity.x <= -MOVEMENT_TUNING.wallBounceMinVelocityX);
    const intoRight =
      hitRight &&
      (input.right ||
        this.facing === 1 ||
        body.velocity.x >= MOVEMENT_TUNING.wallBounceMinVelocityX);
    const direction = intoLeft ? 1 : intoRight ? -1 : 0;
    if (direction === 0) return;

    body.setVelocityX(direction * MOVEMENT_TUNING.wallBounceVelocityX);
    body.setVelocityY(
      Math.min(body.velocity.y, MOVEMENT_TUNING.wallBounceLiftVelocityY)
    );
    this.facing = direction as -1 | 1;
    this.wallBonkPlatformId = this.lastPlatformId;
    this.lastWallBounceAt = now;
    window.dispatchEvent(
      new CustomEvent('fallstack:land', {
        detail: { zoneId: this.currentZone },
      })
    );

    for (let i = 0; i < 10; i += 1) {
      this.particles.push({
        x: this.player?.x ?? 0,
        y: (this.player?.y ?? 0) + (Math.random() * 18 - 9),
        vx: -direction * (90 + Math.random() * 110),
        vy: -50 + Math.random() * 90,
        color: 0xffd36a,
        alpha: 0.75,
        size: 1.3 + Math.random() * 2,
        life: 360,
        maxLife: 360,
        type: 'dust',
      });
    }
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
        Math.min(1, deltaMs / 120)
      );
    }

    this.cameras.main.scrollX = 0;
  }

  private updateCurrentZone() {
    const zoneId = zoneForY(this.player?.y ?? START_POS.y).id;
    if (zoneId === this.currentZone) return;
    this.currentZone = zoneId;
    this.rebuildPlatformBodies();
    this.drawWorld();
    this.rebuildArtifactBodies();
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

    const drawW = this.gameWidth();

    const activeZoneIds = this.activeZoneIds();
    const activeZones = ZONES.filter((zone) => activeZoneIds.has(zone.id));

    for (const zone of activeZones) {
      renderReliquaryBackdrop(this.bgGraphics, {
        zoneTop: zone.yTop,
        zoneBottom: zone.yBottom,
        gameWidth: drawW,
        routeOffset: this.currentRouteOffset,
        zone: reliquaryZoneFor(zone.id),
      });
      this.addZoneLabel(
        this.layoutX(42),
        zone.yBottom - 1180,
        reliquaryZoneName(zone.id),
        window.fallstackSnapshot?.zones.find((item) => item.id === zone.id)
          ?.statusLabel ?? 'Untouched'
      );
    }

    // 3. DRAW PLATFORMS
    for (const platform of this.towerPlatforms) {
      if (activeZoneIds.has(platform.zoneId))
        this.drawPlatform(this.layoutPlatform(platform));
    }

    // 4. DRAW ARTIFACTS AND LABELS
    const snapshot = window.fallstackSnapshot;
    if (!snapshot) return;
    for (const zone of snapshot.zones) {
      if (!activeZoneIds.has(zone.id)) continue;
      for (const artifact of zone.artifacts) {
        if (this.expiredArtifactIds.has(artifact.id)) continue;
        this.drawArtifact(this.layoutArtifact(artifact));
      }
    }
  }

  private drawPlatform(platform: Platform) {
    if (!this.graphics) return;
    renderReliquaryPlatform(this.graphics, platform);
  }

  private drawArtifact(artifact: Artifact) {
    if (!this.graphics) return;
    renderReliquaryArtifact(this.graphics, artifact, {
      reducedMotion: this.reducedMotion,
      timeMs: this.time.now,
      addLabel: (centerX, y, text) =>
        this.addArtifactLabel(centerX, y, text),
    });
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
    if (!this.reducedMotion && onFloor && Math.abs(vx) > 30) {
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
    if (!this.reducedMotion && this.charging) {
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
    if (!this.reducedMotion && zone && zone.id !== BOTTOM_ZONE_ID) {
      if (Math.random() < 0.05) {
        const cam = this.cameras.main;
        const px = cam.scrollX + Math.random() * this.gameWidth();
        const py = cam.scrollY + cam.height - Math.random() * 160;
        const zoneIndex = ZONES.findIndex(
          (candidate) => candidate.id === zone.id
        );
        this.particles.push({
          x: px,
          y: py,
          vx: Math.random() * 24 - 12,
          vy: -25 - Math.random() * 35,
          color:
            zoneIndex % 2 === 0
              ? RELIQUARY_COLORS.gold
              : RELIQUARY_COLORS.ghost,
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

    // 5. DRAW TEMPORARY-ARTIFACT WARNING MARKS
    this.drawArtifactTimers(g);

    // 6. DRAW THE EXACT SITE NAMED BY THE LATEST MUTATION RECEIPT
    this.drawMutationHighlight(g);

    // 7. DRAW PLAYER
    this.drawPlayer(g);
  }

  private drawArtifactTimers(g: Phaser.GameObjects.Graphics) {
    const snapshot = window.fallstackSnapshot;
    if (!snapshot) return;
    const artifacts = snapshot.zones.flatMap((zone) => zone.artifacts);

    for (const [artifactId, timer] of this.artifactTimers) {
      const artifact = artifacts.find((candidate) => candidate.id === artifactId);
      if (!artifact) continue;
      const layout = this.layoutArtifact(artifact);
      const duration = artifactUseWindowMs(timer.type) ?? 1;
      const remaining = this.reducedMotion
        ? 3
        : Phaser.Math.Clamp(
            Math.ceil(((timer.collapseAt - this.time.now) / duration) * 3),
            1,
            3
          );

      for (let index = 0; index < 3; index += 1) {
        const x = layout.x + layout.width / 2 + (index - 1) * 10;
        const active = index < remaining;
        if (timer.type === 'ghost_platform') {
          g.lineStyle(1.5, RELIQUARY_COLORS.ghost, active ? 1 : 0.3)
            .strokeCircle(x, layout.y - 9, 3);
        } else {
          g.fillStyle(
            RELIQUARY_COLORS.persimmon,
            active ? 1 : 0.28
          ).fillTriangle(
            x - 4,
            layout.y - 13,
            x + 4,
            layout.y - 13,
            x,
            layout.y - 6
          );
        }
      }
    }
  }

  private drawMutationHighlight(g: Phaser.GameObjects.Graphics) {
    const highlight = this.mutationHighlight;
    if (!highlight) return;
    if (this.time.now >= highlight.until) {
      this.mutationHighlight = null;
      return;
    }

    const site = highlight.snapshot.sites.find(
      (candidate) => candidate.id === highlight.receipt.siteId
    );
    if (!site) return;
    const slot =
      highlight.receipt.bucket === 'short_jump'
        ? site.helperSlot
        : highlight.receipt.bucket === 'wall_bonk' ||
            highlight.receipt.bucket === 'successful_clear'
          ? site.ghostSlot
          : site.hazardSlot;
    const x = this.layoutX(slot.x);
    const pulse = this.reducedMotion
      ? 0.92
      : 0.72 + Math.sin(this.time.now / 120) * 0.2;

    g.lineStyle(3, RELIQUARY_COLORS.persimmon, pulse).strokeRect(
      x - 6,
      slot.y - 6,
      slot.width + 12,
      slot.height + 12
    );
    g.lineStyle(1, RELIQUARY_COLORS.washi, pulse).strokeRect(
      x - 10,
      slot.y - 10,
      slot.width + 20,
      slot.height + 20
    );
    g.fillStyle(RELIQUARY_COLORS.persimmon, pulse).fillTriangle(
      x - 13,
      slot.y + slot.height / 2,
      x - 3,
      slot.y + slot.height / 2 - 5,
      x - 3,
      slot.y + slot.height / 2 + 5
    );
  }

  private drawPlayer(g: Phaser.GameObjects.Graphics) {
    if (!this.player) return;
    renderReliquaryPlayer(g, {
      x: this.player.x,
      y: this.player.y,
      facing: this.facing,
      charging: this.charging,
      grounded: this.player.body.blocked.down || this.player.body.touching.down,
      velocityY: this.player.body.velocity.y,
      chargeRatio: chargePowerForHeldMs(this.chargeTime),
      reducedMotion: this.reducedMotion,
    });
  }

  private drawCheckpointLanterns(g: Phaser.GameObjects.Graphics) {
    const swingAngle = this.reducedMotion
      ? 0
      : Math.sin(this.time.now / 380) * 0.16;
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
    g.lineStyle(1.2, RELIQUARY_COLORS.ink, 0.85);
    g.lineBetween(hx, hy, lx, ly);

    // Glow
    g.fillStyle(RELIQUARY_COLORS.gold, 0.2);
    g.fillCircle(lx, ly, 10);

    // Wood cap
    g.fillStyle(RELIQUARY_COLORS.indigoDeep, 1);
    g.fillRect(lx - 4, ly - 7, 8, 2);

    // Warm glow paper body
    g.fillStyle(RELIQUARY_COLORS.washi, 1);
    g.fillRoundedRect(lx - 4, ly - 5, 8, 10, 2);
    g.fillStyle(RELIQUARY_COLORS.gold, 0.62);
    g.fillRoundedRect(lx - 3, ly - 4, 6, 8, 1.5);

    // Red tassel
    g.lineStyle(1.5, RELIQUARY_COLORS.persimmon, 0.9);
    g.lineBetween(lx, ly + 5, lx + Math.sin(angle * 1.5) * 5, ly + 9);
  }

  private drawWobblingCursedBricks(g: Phaser.GameObjects.Graphics) {
    const snapshot = window.fallstackSnapshot;
    if (!snapshot) return;
    const time = this.time.now;

    for (const zone of snapshot.zones) {
      for (const artifact of zone.artifacts) {
        if (artifact.type === 'cursed_brick') {
          if (this.expiredArtifactIds.has(artifact.id)) continue;
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

          const warning = this.artifactTimers.has(artifact.id);
          const amp = this.reducedMotion
            ? 0
            : warning || isStanding
              ? 2.2
              : 0.6;
          const freq = warning || isStanding ? 50 : 220;
          const wobble = Math.sin(time / freq) * amp;

          // Shadow
          g.fillStyle(RELIQUARY_COLORS.ink, 0.9).fillRoundedRect(
            layout.x + wobble,
            layout.y + 3,
            layout.width,
            layout.height,
            4
          );

          // Brick
          g.fillStyle(RELIQUARY_COLORS.burgundy, 1).fillRoundedRect(
            layout.x + wobble,
            layout.y,
            layout.width,
            layout.height - 2,
            4
          );

          // Cracks
          g.lineStyle(1.2, RELIQUARY_COLORS.ink, 0.8);
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

          // Damage beads make the curse legible without relying on color.
          g.fillStyle(RELIQUARY_COLORS.danger, 0.82);
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
      color: '#d9b45c',
      backgroundColor: 'rgba(23, 20, 38, 0.86)',
      padding: { left: 6, right: 6, top: 3, bottom: 3 },
    });
    label.setDepth(1);
    label.setAlpha(0.78);
    this.labels.push(label);
  }

  private addArtifactLabel(centerX: number, y: number, text: string) {
    const labelWidth = 148;
    const clampedX = clampedArtifactLabelCenter(
      centerX,
      this.gameWidth(),
      labelWidth
    );
    this.graphics
      ?.lineStyle(2, 0xd9b45c, 0.9)
      .lineBetween(centerX, y - 2, centerX, y + 10);
    this.graphics?.fillStyle(0x180d18, 1).fillCircle(centerX, y - 2, 2.5);
    const label = this.add.text(clampedX, y, text, {
      fontFamily: '"Zen Maru Gothic", sans-serif',
      fontSize: '11px',
      fontStyle: '700',
      color: '#180d18',
      backgroundColor: 'rgba(244, 239, 226, 0.97)',
      padding: { left: 7, right: 7, top: 4, bottom: 4 },
      wordWrap: { width: labelWidth, useAdvancedWrap: true },
    });
    label.setOrigin(0.5, 1);
    label.setDepth(4);
    this.labels.push(label);
  }

  private rebuildArtifactBodies() {
    this.artifactBodies?.clear(true, true);
    const snapshot = window.fallstackSnapshot;
    if (!snapshot || !this.artifactBodies) return;
    const activeZoneIds = this.activeZoneIds();
    for (const artifact of snapshot.zones.flatMap((zone) => zone.artifacts)) {
      if (!activeZoneIds.has(artifact.zoneId)) continue;
      if (!artifact.solid) continue;
      if (this.expiredArtifactIds.has(artifact.id)) continue;
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
      rect.setData('artifactId', artifact.id);
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
  const [mutationReceipt, setMutationReceipt] =
    useState<MutationReceipt | null>(null);
  const [charge, setCharge] = useState(0);
  const [currentZoneId, setCurrentZoneId] = useState<ZoneId>(BOTTOM_ZONE_ID);
  const [sharedAvailable, setSharedAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sceneReady, setSceneReady] = useState(false);
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
  const [remoteBeat, setRemoteBeat] = useState<MutationBeat | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<FallstackScene | null>(null);
  const soundRef = useRef<ProceduralSound | null>(
    new ProceduralSound({ gameplayMuted, musicMuted })
  );
  const resultDialogRef = useRef<HTMLDivElement | null>(null);
  const resultCloseRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const chargeRef = useRef(0);
  const mutationTimerRef = useRef<number | null>(null);
  const checkpointTimerRef = useRef<number | null>(null);
  const remoteBeatTimerRef = useRef<number | null>(null);
  const pendingBoardSnapshotRef = useRef<{
    snapshot: BoardSnapshot;
    beat: MutationBeat | null;
  } | null>(null);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  const showMutation = useCallback(
    (text: string, receipt: MutationReceipt | null = null) => {
      setMessage(text);
      setMutationReceipt(receipt);
      setMutationVisible(true);
      if (mutationTimerRef.current)
        window.clearTimeout(mutationTimerRef.current);
      mutationTimerRef.current = window.setTimeout(
        () => setMutationVisible(false),
        receipt ? 5_200 : 3_800
      );
    },
    []
  );

  const showRemoteBeat = useCallback((beat: MutationBeat | null) => {
    if (!beat) return;
    setRemoteBeat(beat);
    if (remoteBeatTimerRef.current)
      window.clearTimeout(remoteBeatTimerRef.current);
    remoteBeatTimerRef.current = window.setTimeout(
      () => setRemoteBeat(null),
      3_800
    );
  }, []);

  const applyBoardSnapshot = useCallback(
    (next: BoardSnapshot, beat: MutationBeat | null = null) => {
      const current = window.fallstackSnapshot;
      if (!isBoardSnapshot(current)) {
        window.fallstackSnapshot = next;
        setSnapshot(next);
        showRemoteBeat(beat);
        return;
      }
      const boardChanged = current.boardId !== next.boardId;
      const decision = reconciliationDecision(
        current.revision,
        next.revision,
        sceneRef.current?.isSafeToReconcile() ?? false,
        boardChanged
      );
      if (decision === 'ignore') return;
      if (decision === 'defer') {
        const pending = pendingBoardSnapshotRef.current;
        if (
          pending?.snapshot.boardId === next.boardId &&
          pending.snapshot.revision >= next.revision
        )
          return;
        pendingBoardSnapshotRef.current = { snapshot: next, beat };
        return;
      }
      window.fallstackSnapshot = next;
      setSnapshot(next);
      showRemoteBeat(beat);
    },
    [showRemoteBeat]
  );

  const showApiErrorReceipt = useCallback(
    (error: unknown): boolean => {
      if (!(error instanceof ApiRequestError) || !error.data.receipt)
        return false;
      if (error.data.snapshot) applyBoardSnapshot(error.data.snapshot);
      showMutation(error.message, error.data.receipt);
      return true;
    },
    [applyBoardSnapshot, showMutation]
  );

  const reconcileRemoteSnapshot = useCallback(
    (next: BoardSnapshot) => {
      const current = window.fallstackSnapshot;
      if (!isBoardSnapshot(current)) {
        applyBoardSnapshot(next);
        return;
      }
      const beat =
        current.boardId === next.boardId
          ? latestRemoteBeat(current.revision, next)
          : null;
      applyBoardSnapshot(next, beat);
    },
    [applyBoardSnapshot]
  );

  const applyPendingBoardSnapshot = useCallback(() => {
    const pending = pendingBoardSnapshotRef.current;
    const current = window.fallstackSnapshot;
    if (!pending || !isBoardSnapshot(current)) return;
    const boardChanged = current.boardId !== pending.snapshot.boardId;
    const decision = reconciliationDecision(
      current.revision,
      pending.snapshot.revision,
      sceneRef.current?.isSafeToReconcile() ?? false,
      boardChanged
    );
    if (decision === 'defer') return;
    pendingBoardSnapshotRef.current = null;
    if (decision === 'ignore') return;
    window.fallstackSnapshot = pending.snapshot;
    setSnapshot(pending.snapshot);
    showRemoteBeat(pending.beat);
  }, [showRemoteBeat]);

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
    async (successMessage?: string | null) => {
      const res = await fetch('/api/init-game');
      const data = await parseApiResponse<InitGameResponse>(res);
      setSharedAvailable(true);
      window.fallstackSnapshot = data.snapshot;
      setSnapshot(data.snapshot);
      if (successMessage === undefined) {
        showMutation(openingMutationMessage(data.snapshot, true));
      } else if (successMessage) {
        showMutation(successMessage);
      }
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

  const receiptPresentation = useMemo(
    () =>
      mutationReceipt
        ? mutationReceiptPresentation(mutationReceipt)
        : null,
    [mutationReceipt]
  );

  const towerMemory = useMemo(
    () => (snapshot ? deriveTowerMemory(snapshot) : null),
    [snapshot]
  );

  const currentZoneInfo = useMemo(() => {
    if (!snapshot?.zones?.length)
      return { name: reliquaryZoneName(BOTTOM_ZONE_ID), statusLabel: 'Quiet' };
    const segment =
      snapshot.zones.find((zone) => zone.id === currentZoneId) ??
      snapshot.zones[0] ?? {
        name: zoneById(BOTTOM_ZONE_ID).name,
        statusLabel: 'Quiet',
      };
    return { ...segment, name: reliquaryZoneName(currentZoneId) };
  }, [currentZoneId, snapshot]);

  useEffect(() => {
    const onReady = () => setSceneReady(true);
    window.addEventListener('fallstack:ready', onReady);
    return () => window.removeEventListener('fallstack:ready', onReady);
  }, []);

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
        showMutation(openingMutationMessage(localSnapshot, false));
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
    window.setTimeout(() => {
      resultDialogRef.current?.scrollTo({ top: 0 });
      resultDialogRef.current?.focus({ preventScroll: true });
    }, 0);
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
      const { containerW, containerH, gameW, gameH } = computeGameDimensions(
        container.getBoundingClientRect()
      );
      if (containerW === 0 || containerH === 0) return;
      gameRef.current.scale.resize(gameW, gameH);
    };

    const initGame = () => {
      const container = document.getElementById('game-canvas');
      if (!container) return;
      const { containerW, containerH, gameW, gameH } = computeGameDimensions(
        container.getBoundingClientRect()
      );

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
      void (async () => {
        try {
          const res = await fetch('/api/init-game');
          const data = await parseApiResponse<InitGameResponse>(res);
          reconcileRemoteSnapshot(data.snapshot);
        } catch (error) {
          console.error('shared refresh failed', error);
        }
      })();
    };

    const intervalId = window.setInterval(refreshQuietly, 15_000);
    document.addEventListener('visibilitychange', refreshQuietly);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshQuietly);
    };
  }, [reconcileRemoteSnapshot, sharedAvailable, snapshot]);

  useEffect(() => {
    const apply = () =>
      window.requestAnimationFrame(applyPendingBoardSnapshot);
    window.addEventListener('fallstack:land', apply);
    window.addEventListener('fallstack:ready', apply);
    return () => {
      window.removeEventListener('fallstack:land', apply);
      window.removeEventListener('fallstack:ready', apply);
    };
  }, [applyPendingBoardSnapshot]);

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
        const resolution = resolveFallObservation(detail, snapshot);
        if (!resolution.ok) {
          showMutation(resolution.message);
          return;
        }
        const resolvedDetail = {
          attemptId: detail.attemptId,
          zoneId: resolution.value.zoneId,
          siteId: resolution.value.siteId,
          siteName: resolution.value.siteName,
          failureBucket: resolution.value.bucket,
          chargePercent: detail.launchChargePercent,
          highestY: detail.highestY,
        };
        const nextSnapshot = applyLocalFall(snapshot, resolvedDetail);
        setSnapshot(nextSnapshot);
        showMutation(localFallMessage(nextSnapshot, resolvedDetail));
        soundRef.current?.play('mutation');
        return;
      }

      if (!isBoardSnapshot(snapshot)) {
        showMutation('Shared board identity is unavailable.');
        return;
      }

      try {
        const res = await fetch('/api/record-fall', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...detail,
            eventId: `fall:${detail.attemptId}`,
            boardId: snapshot.boardId,
            boardRevision: snapshot.revision,
            timestamp: Date.now(),
          }),
        });
        const data = await parseApiResponse<RecordFallResponse>(res);
        applyBoardSnapshot(data.snapshot);
        sceneRef.current?.showMutationReceipt(data.receipt, data.snapshot);
        showMutation(data.message, data.receipt);
        if (data.counted) soundRef.current?.play('mutation');
      } catch (error) {
        console.error('record-fall failed', error);
        if (showApiErrorReceipt(error)) return;
        showMutation('Your fall was noticed. The tower did not answer.');
      }
    },
    [
      applyBoardSnapshot,
      sharedAvailable,
      showApiErrorReceipt,
      showMutation,
      snapshot,
    ]
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

      if (!isBoardSnapshot(snapshot)) {
        showMutation('Shared board identity is unavailable.');
        return;
      }

      try {
        const res = await fetch('/api/record-clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...detail,
            eventId: `clear:${detail.attemptId}:${detail.zoneId}`,
            boardId: snapshot.boardId,
            boardRevision: snapshot.revision,
            timestamp: Date.now(),
          }),
        });
        const data = await parseApiResponse<RecordClearResponse>(res);
        applyBoardSnapshot(data.snapshot);
        showCheckpoint(data.message, '');
      } catch (error) {
        console.error('record-clear failed', error);
        if (showApiErrorReceipt(error)) return;
        showMutation('The checkpoint did not hold.');
      }
    },
    [
      sharedAvailable,
      applyBoardSnapshot,
      showApiErrorReceipt,
      showCheckpoint,
      showMutation,
      snapshot,
    ]
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

      if (!isBoardSnapshot(snapshot)) {
        showMutation('Shared board identity is unavailable.');
        return;
      }

      try {
        const res = await fetch('/api/record-summit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...detail,
            eventId: `summit:${detail.attemptId}`,
            boardId: snapshot.boardId,
            boardRevision: snapshot.revision,
            timestamp: Date.now(),
          }),
        });
        const data = await parseApiResponse<RecordSummitResponse>(res);
        applyBoardSnapshot(data.snapshot);
        showMutation(data.message);
        setSummitOpen(true);
      } catch (error) {
        console.error('record-summit failed', error);
        if (showApiErrorReceipt(error)) return;
        showMutation('The summit went quiet.');
      }
    },
    [
      applyBoardSnapshot,
      sharedAvailable,
      showApiErrorReceipt,
      showMutation,
      snapshot,
    ]
  );

  useEffect(() => {
    const onCharge = (event: Event) => {
      const detail = (event as CustomEvent<{ percent: number }>).detail;
      if (detail.percent <= 0) soundRef.current?.stopCharge();
      if (chargeRef.current === 0 && detail.percent > 0)
        soundRef.current?.play('charge-start');
      chargeRef.current = detail.percent;
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
            Memory
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={() => setMusicMuted(muted => !muted)}
            aria-pressed={musicMuted}
            aria-label={musicMuted ? 'Turn music on' : 'Turn music off'}
          >
            Music {musicMuted ? 'Off' : 'On'}
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={() => setGameplayMuted(muted => !muted)}
            aria-pressed={gameplayMuted}
            aria-label={gameplayMuted ? 'Turn sound effects on' : 'Turn sound effects off'}
          >
            SFX {gameplayMuted ? 'Off' : 'On'}
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
          className={`hud-overlay mutation-banner${mutationReceipt ? ' receipt' : ''}${mutationVisible ? ' visible' : ''}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {mutationReceipt && receiptPresentation ? (
            <>
              <div className="receipt-stamp">
                <span>{receiptPresentation.acceptedLabel}</span>
                <span>{receiptPresentation.revisionLabel}</span>
              </div>
              <div className="receipt-proof">
                <span className="receipt-site">
                  {receiptPresentation.siteLabel}
                  <small>{receiptPresentation.bucketLabel}</small>
                </span>
                <strong>{receiptPresentation.counterLabel}</strong>
              </div>
              <div className="receipt-copy">{mutationReceipt.copy}</div>
            </>
          ) : loading ? (
            "Loading today's tower…"
          ) : (
            message
          )}
        </div>

        {remoteBeat && (
          <div
            className={`hud-overlay remote-beat${mutationReceipt && mutationVisible ? ' below-receipt' : ''}`}
            role="status"
            aria-live="polite"
          >
            <span>REMOTE · BOARD r{remoteBeat.revision}</span>
            {remoteBeat.copy}
          </div>
        )}

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
        {(loading || !sceneReady) && (
          <div className="loading-overlay" aria-hidden="true">
            <div className="loading-text">
              {loading ? 'Reading the mountain…' : 'Calibrating the jump…'}
            </div>
          </div>
        )}
      </section>

      {/* ── TOUCH CONTROLS ── */}
      <TouchControls disabled={summitOpen || !sceneReady} charge={charge} />

      {/* ── RESULT CARD ── */}
      {summitOpen ? (
        <div
          className="result-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Tower Memory"
        >
          <div
            ref={resultDialogRef}
            className="result-card tower-memory-card"
            tabIndex={-1}
          >
            <div className="tower-memory-scroll">
              <header className="tower-memory-header">
              <p className="eyebrow">
                <span className="hanko" aria-hidden="true">
                  登
                </span>
                Live daily board
              </p>
              <div className="tower-memory-scope">
                <span>{towerMemory?.scopeLabel ?? 'This community'}</span>
                <span>{towerMemory?.revisionLabel ?? 'BOARD'}</span>
              </div>
              <h2>Tower Memory</h2>
              <p className="tower-memory-intro">
                One community shaped this route. Read it from summit to spawn.
              </p>
              </header>

              <section
                className="tower-memory-board"
                aria-label="Community-authored tower route"
              >
              <div className="tower-memory-summit">
                <span>Summit</span>
                {towerMemory?.summitCopy ?? 'The summit is still unclaimed.'}
              </div>
              <ol className="tower-memory-route">
                {towerMemory?.zones.map((zone) => (
                  <li
                    key={zone.zoneId}
                    className={`tower-memory-zone tone-${zone.tone}${zone.latest ? ' latest' : ''}`}
                  >
                    <span className="tower-memory-node" aria-hidden="true" />
                    <div className="tower-memory-zone-copy">
                      <div className="tower-memory-zone-heading">
                        <strong>{zone.zoneName}</strong>
                        <span>{zone.statusLabel}</span>
                      </div>
                      {zone.siteName ? (
                        <div className="tower-memory-site">
                          <b>{zone.siteName}</b>
                          {zone.latest ? <em>Latest change</em> : null}
                        </div>
                      ) : null}
                      <p>{zone.detail}</p>
                      {zone.artifactLabel ? (
                        <span className="tower-memory-artifact">
                          {zone.artifactLabel}
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
              </section>

              {towerMemory?.recentBeats.length ? (
                <section className="tower-memory-beats" aria-label="Latest shared changes">
                  <h3>Latest shared changes</h3>
                  <ol>
                    {towerMemory.recentBeats.map((beat) => (
                      <li key={`${beat.revision}:${beat.siteId}`}>
                        <span>r{beat.revision}</span>
                        {beat.copy}
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}

              {towerMemory?.achievements.length ? (
                <dl className="tower-memory-achievements">
                  {towerMemory.achievements.map((achievement) => (
                    <div key={achievement.label}>
                      <dt>{achievement.label}</dt>
                      <dd>{achievement.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              <p className="tower-memory-session">
                Your session · {sessionStats.falls} falls · {sessionStats.clears}{' '}
                clears · {sessionStats.summits} summits
              </p>
              <p className="tomorrow-hook tower-memory-rollover">
                {towerMemory?.rolloverCopy ??
                  'This board seals at 00:00 UTC. A fresh community tower opens next.'}
              </p>
            </div>
            <button
              ref={resultCloseRef}
              type="button"
              className="result-close-btn"
              onClick={() => setSummitOpen(false)}
            >
              Return to the climb
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
