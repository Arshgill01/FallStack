import Phaser from 'phaser';
import {
  connectRealtime,
  disconnectRealtime,
  navigateTo,
} from '@devvit/web/client';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  InitGameResponse,
  RecordClearResponse,
  RecordFallResponse,
  RecordSummitResponse,
  PlayerResume,
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
  PLAYER_COLLISION_SIZE,
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
  isBoardRevisionMessage,
  isNewerBoardRevision,
  realtimeChannelForBoard,
} from '../shared/realtime.js';
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
import { canCollideWithPlatform } from './game/platform-mechanics';
import type {
  ArtifactCollapseEventDetail,
  ClearEventDetail,
  FallEventDetail,
  LandEventDetail,
  LandingMaterial,
  LandingSurface,
  LaunchEventDetail,
  SoundId,
  SummitEventDetail,
  WallBonkEventDetail,
  ZoneEventDetail,
} from './game/events';
import { INITIAL_INPUT, resetSharedInput, type InputState } from './game/input';
import {
  clampedArtifactLabelCenter,
  inWorldArtifactLabel,
  PLAYER_CEREMONY_DURATION_MS,
  RELIQUARY_COLORS,
  playerVisualState,
  reliquaryZoneFor,
  reliquaryZoneName,
  shouldShowArtifactLabels,
  type PlayerCeremonyState,
} from './game/art-direction';
import {
  CAMERA_AIR_LOOKAHEAD,
  cameraBottomPaddingForViewport,
  cameraScrollForWorldViewStart,
  cameraScrollXForPlayer,
  cameraVerticalLookahead,
  chooseHudNoticePlacement,
  chooseHudNoticeSide,
  computeGameDimensions,
  gameWorldWidth,
  MOBILE_GAME_BREAKPOINT,
  physicsBoundsForViewport,
  routeOffsetForGameWidth,
  type HudNoticePlacement,
  type HudNoticeSide,
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
import {
  ProceduralSound,
  resolveGameplayMuted,
  type AudioCaptureApi,
  type AudioDiagnostics,
  type SoundPlaybackDetail,
} from './game/sound';
import { mutationReceiptPresentation } from './game/receipt';
import { fetchChangedBoardSnapshot } from './game/board-sync';
import {
  latestRemoteBeat,
  reconciliationDecision,
} from './game/reconciliation';
import { deriveTowerMemory, towerResultCopy } from './game/tower-memory';
import { zoneEffectPresentation } from './game/ui';
import {
  checkpointedZonesBefore,
  readDeviceResume,
  writeDeviceResume,
} from './game/resume';

declare global {
  interface Window {
    fallstackInput: InputState;
    fallstackSnapshot?: GameSnapshot;
    fallstackBuildId: string;
    fallstackAudioDiagnostics?: () => AudioDiagnostics;
    fallstackAudioCapture?: AudioCaptureApi;
    fallstackAudioPreview?: (id: SoundId, detail?: SoundPlaybackDetail) => void;
    fallstackAudioStopPreview?: () => void;
  }
}

const START_POS = { x: 240, y: WORLD_HEIGHT - 88 };
const BUILD_ID = import.meta.env.FALLSTACK_BUILD_ID;
window.fallstackBuildId = BUILD_ID;
const MOBILE_NOTICE_TOP_OFFSET = 54;
const MOBILE_NOTICE_BOTTOM_OFFSET = 12;
const MOBILE_NOTICE_SIDE_OFFSET = 36;
const NOTICE_PLAY_CLEARANCE = 10;

function isBoardSnapshot(
  snapshot: GameSnapshot | null | undefined
): snapshot is BoardSnapshot {
  return (
    snapshot != null &&
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

function artifactLandingMaterial(type: Artifact['type']): LandingMaterial {
  if (type === 'corpse_stack') return 'corpse';
  if (type === 'mercy_nail') return 'mercy';
  if (type === 'ghost_platform') return 'ghost';
  return 'cursed';
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to selection copy for restricted webviews.
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}

/* ======================================================
   PHASER SCENE
   ====================================================== */
class FallstackScene extends Phaser.Scene {
  private renderScale = 1;
  private currentWorldWidth = WORLD_WIDTH;
  private currentViewportWidth = 0;
  private currentViewportHeight = 0;
  private currentLayoutRenderScale = 0;
  private viewportLayoutPending = false;
  private player?: Phaser.GameObjects.Rectangle & {
    body: Phaser.Physics.Arcade.Body;
  };
  private platforms?: Phaser.Physics.Arcade.StaticGroup;
  private artifactBodies?: Phaser.Physics.Arcade.StaticGroup;
  private graphics?: Phaser.GameObjects.Graphics;
  private bgGraphics?: Phaser.GameObjects.Graphics;
  private dynamicGraphics?: Phaser.GameObjects.Graphics;
  private playerGraphics?: Phaser.GameObjects.Graphics;
  private playerVisualKey = '';
  private playerCeremony: {
    state: PlayerCeremonyState;
    startedAt: number;
    until: number;
    strength: number;
  } | null = null;
  private labels: Phaser.GameObjects.Text[] = [];
  private artifactLabels: Phaser.GameObjects.Text[] = [];
  private artifactLabelDismissedZones = new Set<ZoneId>();
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  private space: Phaser.Input.Keyboard.Key | undefined;
  private facing: -1 | 1 = 1;
  private wasGrounded = false;
  private suppressNextLanding = false;
  private pendingImpactSpeed = 0;
  private pendingWallImpactSpeed = 0;
  private landingMaterial: LandingMaterial = 'stone';
  private landingSurface: LandingSurface = 'route';
  private charging = false;
  private chargeStart = 0;
  private chargeDirection: -1 | 1 = 1;
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
  private inputPaused = false;
  private sceneBooted = false;
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
      zoneId: ZoneId;
      collapseAt: number;
      attemptId: string;
    }
  >();

  setRenderScale(renderScale: number) {
    if (this.renderScale === renderScale) return;
    this.renderScale = renderScale;
    if (!this.sceneBooted) return;
    this.cameras.main.setZoom(renderScale);
    this.viewportLayoutPending = true;
  }

  setInputPaused(inputPaused: boolean) {
    this.inputPaused = inputPaused;
    resetSharedInput();
    this.cursors?.left?.reset();
    this.cursors?.right?.reset();
    this.space?.reset();

    if (inputPaused && this.charging) {
      this.charging = false;
      this.chargeTime = 0;
      this.publishedChargePercent = 0;
      window.dispatchEvent(
        new CustomEvent('fallstack:charge', { detail: { percent: 0 } })
      );
    }

    if (inputPaused && this.player) {
      const body = this.player.body;
      if (body.blocked.down || body.touching.down) {
        body.setAccelerationX(0);
        body.setVelocityX(0);
      }
    }

    if (!this.sceneBooted) return;
    if (inputPaused) this.scene.pause();
    else this.scene.resume();
  }

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
    this.sceneBooted = true;
    window.fallstackInput = window.fallstackInput ?? { ...INITIAL_INPUT };
    this.cameras.main.setZoom(this.renderScale);
    this.applyViewportLayout(false);
    this.physics.world.gravity.y = MOVEMENT_TUNING.gravityY;

    // Three graphics layers: background, static platforms/labels, dynamic animations
    this.bgGraphics = this.add.graphics();
    this.graphics = this.add.graphics();
    this.dynamicGraphics = this.add.graphics();
    this.playerGraphics = this.add.graphics();

    this.bgGraphics.setDepth(0);
    this.graphics.setDepth(2);
    this.dynamicGraphics.setDepth(3);
    this.playerGraphics.setDepth(4);

    this.platforms = this.physics.add.staticGroup();
    this.rebuildPlatformBodies();

    // Player physics stays transparent; presentation lives on its own layer.
    this.player = this.add.rectangle(
      this.layoutX(START_POS.x),
      START_POS.y,
      PLAYER_COLLISION_SIZE.width,
      PLAYER_COLLISION_SIZE.height,
      0xffffff,
      0
    ) as Phaser.GameObjects.Rectangle & {
      body: Phaser.Physics.Arcade.Body;
    };
    this.player.setDepth(4);
    this.physics.add.existing(this.player);
    this.player.body.setSize(
      PLAYER_COLLISION_SIZE.width,
      PLAYER_COLLISION_SIZE.height
    );
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
      this.shouldCollideWithPlatform,
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

    this.scale.on('resize', () => {
      // Phaser updates camera dimensions after emitting this event. Reconcile
      // layout on the next game frame so projection uses the new viewport.
      this.viewportLayoutPending = true;
    });

    this.refreshSnapshot(window.fallstackSnapshot);
    this.publishZone();
    this.snapCameraToPlayer();
    if (this.inputPaused) this.scene.pause();
  }

  override update(_time: number, deltaMs: number) {
    if (!this.player) return;
    this.applyPendingViewportLayout();
    if (!this.controlsReady) {
      this.stableFrameCount = deltaMs <= 34 ? this.stableFrameCount + 1 : 0;
      const settled =
        this.player.body.blocked.down || this.player.body.touching.down;
      if (this.dynamicGraphics) {
        this.dynamicGraphics.clear();
        this.drawDynamicElements(deltaMs);
      }
      if (this.stableFrameCount >= 4 && settled) {
        this.wasGrounded = true;
        this.controlsReady = true;
        window.dispatchEvent(new CustomEvent('fallstack:ready'));
      }
      return;
    }
    const input = this.readInput();
    const body = this.player.body;
    const onFloor = body.blocked.down || body.touching.down;
    if (!onFloor) {
      this.pendingImpactSpeed = Math.max(
        this.pendingImpactSpeed,
        Math.max(0, body.velocity.y)
      );
      const horizontalSpeed = Math.abs(body.velocity.x);
      if (horizontalSpeed > 0.5) this.pendingWallImpactSpeed = horizontalSpeed;
    }
    this.updateCurrentZone();
    this.highestY = Math.min(this.highestY, this.player.y);

    if (!this.charging) {
      if (input.left) this.facing = -1;
      if (input.right) this.facing = 1;
    }
    body.setGravityY(0);
    if (onFloor) {
      body.setAccelerationX(0);
      body.setDragX(MOVEMENT_TUNING.groundDragX);
      body.setMaxVelocity(
        MOVEMENT_TUNING.initialMaxVelocityX,
        MOVEMENT_TUNING.maxVelocityY
      );
      body.setVelocityX(
        this.charging
          ? 0
          : input.left
            ? -MOVEMENT_TUNING.groundSpeed
            : input.right
              ? MOVEMENT_TUNING.groundSpeed
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
      this.chargeDirection = this.facing;
      body.setVelocityX(0);
    }

    if (input.left || input.right || this.charging || !onFloor)
      this.artifactLabelDismissedZones.add(this.currentZone);

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
        this.pendingImpactSpeed = 0;
        this.pendingWallImpactSpeed = 0;
        this.facing = this.chargeDirection;
        this.lastLaunchDirection = this.chargeDirection;
        body.setVelocity(this.chargeDirection * launch.x, launch.y);
        window.dispatchEvent(
          new CustomEvent<LaunchEventDetail>('fallstack:launch', {
            detail: {
              direction: this.chargeDirection,
              chargePercent: this.lastChargePercent,
              originX: this.player.x,
              velocityX: this.chargeDirection * launch.x,
              velocityY: launch.y,
            },
          })
        );
      }
      this.charging = false;
      this.chargeTime = 0;
      this.publishedChargePercent = 0;
      window.dispatchEvent(
        new CustomEvent('fallstack:charge', { detail: { percent: 0 } })
      );
    }

    const showArtifactLabels = shouldShowArtifactLabels({
      charging: this.charging,
      dismissed: this.artifactLabelDismissedZones.has(this.currentZone),
      grounded: onFloor,
      velocityY: body.velocity.y,
    });
    for (const label of this.artifactLabels)
      label.setVisible(showArtifactLabels);

    if (this.suppressNextLanding && onFloor) {
      this.suppressNextLanding = false;
      this.pendingImpactSpeed = 0;
      this.pendingWallImpactSpeed = 0;
    } else if (!this.wasGrounded && onFloor) {
      const impactSpeed = this.pendingImpactSpeed;
      this.showPlayerCeremony(
        'land',
        Phaser.Math.Clamp((impactSpeed - 180) / 620, 0.25, 1)
      );
      window.dispatchEvent(
        new CustomEvent<LandEventDetail>('fallstack:land', {
          detail: {
            zoneId: this.currentZone,
            material: this.landingMaterial,
            surface: this.landingSurface,
            impactSpeed: Math.round(impactSpeed),
          },
        })
      );
      this.pendingImpactSpeed = 0;
      this.pendingWallImpactSpeed = 0;

      if (!this.reducedMotion) {
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
    if (reducedMotion) this.particles = [];
    this.playerVisualKey = '';
  }

  restoreCheckpoint(zoneId: ZoneId) {
    if (!this.player) return;
    this.checkpointed = new Set(checkpointedZonesBefore(zoneId));
    this.respawnZone = zoneId;
    this.respawn();
  }

  showMutationReceipt(receipt: MutationReceipt, snapshot: GameSnapshot) {
    if (!receipt.accepted || !receipt.siteId) return;
    this.mutationHighlight = {
      receipt,
      snapshot,
      until: this.time.now + 5_200,
    };
  }

  hudNoticePlacement(noticeHeight: number): HudNoticePlacement {
    if (
      !this.player ||
      this.viewportWidth() >= MOBILE_GAME_BREAKPOINT
    )
      return 'top';
    const cameraWorldViewY = this.cameras.main.worldView.y;
    const viewportHeight = this.viewportHeight();
    const canvasHeight = this.game.canvas.getBoundingClientRect().height;
    const cssScaleY = viewportHeight > 0 ? canvasHeight / viewportHeight : 1;
    const playerY = (this.player.y - cameraWorldViewY) * cssScaleY;
    const protectedSpans = [
      {
        top: playerY - 32 - NOTICE_PLAY_CLEARANCE,
        bottom: playerY + 32 + NOTICE_PLAY_CLEARANCE,
        weight: 2,
      },
    ];
    const nextLanding = this.nextRoutePlatform();
    if (nextLanding) {
      protectedSpans.push({
        top:
          (nextLanding.y - cameraWorldViewY) * cssScaleY -
          NOTICE_PLAY_CLEARANCE,
        bottom:
          (nextLanding.y + nextLanding.height - cameraWorldViewY) * cssScaleY +
          NOTICE_PLAY_CLEARANCE,
        weight: 1,
      });
    }
    return chooseHudNoticePlacement({
      viewportHeight: canvasHeight,
      noticeHeight,
      topOffset: MOBILE_NOTICE_TOP_OFFSET,
      bottomOffset: MOBILE_NOTICE_BOTTOM_OFFSET,
      protectedSpans,
    });
  }

  hudNoticeSide(noticeWidth: number): HudNoticeSide {
    if (!this.player || this.viewportWidth() >= MOBILE_GAME_BREAKPOINT)
      return 'right';
    const cameraWorldViewX = this.cameras.main.worldView.x;
    const canvasWidth = this.game.canvas.getBoundingClientRect().width;
    const viewportWidth = this.viewportWidth();
    const cssScaleX = viewportWidth > 0 ? canvasWidth / viewportWidth : 1;
    const playerX = (this.player.x - cameraWorldViewX) * cssScaleX;
    const protectedSpans = [
      {
        left:
          playerX -
          this.player.body.halfWidth * cssScaleX -
          NOTICE_PLAY_CLEARANCE,
        right:
          playerX +
          this.player.body.halfWidth * cssScaleX +
          NOTICE_PLAY_CLEARANCE,
        weight: 2,
      },
    ];
    const nextLanding = this.nextRoutePlatform();
    if (nextLanding) {
      const layout = this.layoutPlatform(nextLanding);
      protectedSpans.push({
        left:
          (layout.x - cameraWorldViewX) * cssScaleX -
          NOTICE_PLAY_CLEARANCE,
        right:
          (layout.x + layout.width - cameraWorldViewX) * cssScaleX +
          NOTICE_PLAY_CLEARANCE,
        weight: 1,
      });
    }
    return chooseHudNoticeSide({
      viewportWidth: canvasWidth,
      noticeWidth,
      leftOffset: MOBILE_NOTICE_SIDE_OFFSET,
      rightOffset: MOBILE_NOTICE_SIDE_OFFSET,
      protectedSpans,
    });
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
    return gameWorldWidth(this.viewportWidth());
  }

  private viewportWidth() {
    return this.cameras.main.width / this.renderScale;
  }

  private viewportHeight() {
    return this.cameras.main.height / this.renderScale;
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

  private applyViewportLayout(keepPlayerX: boolean): {
    routeGeometryChanged: boolean;
    cameraLayoutChanged: boolean;
  } {
    const previousOffset = this.currentRouteOffset;
    const previousWorldWidth = this.currentWorldWidth;
    const previousViewportWidth = this.currentViewportWidth;
    const previousViewportHeight = this.currentViewportHeight;
    const previousRenderScale = this.currentLayoutRenderScale;
    const playerLogicalX =
      keepPlayerX && this.player ? this.player.x - previousOffset : null;
    const viewportWidth = this.viewportWidth();
    const viewportHeight = this.viewportHeight();
    const worldWidth = this.gameWidth();
    this.currentWorldWidth = worldWidth;
    this.currentViewportWidth = viewportWidth;
    this.currentViewportHeight = viewportHeight;
    this.currentLayoutRenderScale = this.renderScale;
    this.currentRouteOffset = routeOffsetForGameWidth(worldWidth);
    const physicsBounds = physicsBoundsForViewport(
      viewportWidth,
      worldWidth
    );
    this.cameras.main.setBounds(0, 0, worldWidth, WORLD_HEIGHT);
    this.physics.world.setBounds(
      physicsBounds.left,
      0,
      physicsBounds.width,
      WORLD_HEIGHT + 220
    );
    if (playerLogicalX !== null && this.player)
      this.player.setX(this.layoutX(playerLogicalX));
    return {
      routeGeometryChanged:
        previousWorldWidth !== worldWidth ||
        previousOffset !== this.currentRouteOffset,
      cameraLayoutChanged:
        previousViewportWidth !== viewportWidth ||
        previousViewportHeight !== viewportHeight ||
        previousRenderScale !== this.renderScale,
    };
  }

  private applyPendingViewportLayout() {
    if (!this.viewportLayoutPending || !this.player) return;
    this.viewportLayoutPending = false;
    const { routeGeometryChanged, cameraLayoutChanged } =
      this.applyViewportLayout(true);
    if (routeGeometryChanged) {
      this.rebuildPlatformBodies();
      this.drawWorld();
      this.rebuildArtifactBodies();
    }
    if (cameraLayoutChanged) this.snapCameraToPlayer();
  }

  private cameraBottomPadding() {
    return cameraBottomPaddingForViewport(
      this.gameWidth(),
      this.viewportHeight()
    );
  }

  private cameraTargetY(y: number) {
    const camH = this.viewportHeight() || 480;
    const worldViewY = Phaser.Math.Clamp(
      y -
        (camH - this.cameraBottomPadding()) -
        this.cameraLookaheadY(),
      0,
      WORLD_HEIGHT - camH
    );
    return cameraScrollForWorldViewStart(
      worldViewY,
      camH,
      this.renderScale
    );
  }

  private cameraTargetX(x: number) {
    const viewportWidth = this.viewportWidth();
    const worldViewX = cameraScrollXForPlayer(
      x,
      viewportWidth,
      this.gameWidth(),
      this.cameraLookaheadX()
    );
    return cameraScrollForWorldViewStart(
      worldViewX,
      viewportWidth,
      this.renderScale
    );
  }

  private cameraLookaheadX() {
    if (!this.player) return 0;
    const body = this.player.body;
    const grounded = body.blocked.down || body.touching.down;
    if (this.charging)
      return this.chargeDirection * CAMERA_AIR_LOOKAHEAD;
    if (!grounded && this.lastLaunchDirection !== 0)
      return this.lastLaunchDirection * CAMERA_AIR_LOOKAHEAD;
    return Phaser.Math.Clamp(body.velocity.x * 0.12, -40, 40);
  }

  private cameraLookaheadY() {
    if (!this.player) return 0;
    return cameraVerticalLookahead(
      this.charging,
      this.lastChargePercent,
      this.player.body.velocity.y
    );
  }

  private nextRoutePlatform(): Platform | null {
    if (!this.player) return null;
    const player = this.player;
    const route = this.towerPlatforms
      .filter((platform) => platform.kind !== 'obstacle')
      .sort((left, right) => right.y - left.y);
    const supportIndex = route.findIndex(
      (platform) => platform.id === this.lastPlatformId
    );
    if (supportIndex >= 0) return route[supportIndex + 1] ?? null;
    return (
      route.find(
        (platform) =>
          platform.y < player.y - player.body.halfHeight
      ) ?? null
    );
  }

  private snapCameraToPlayer() {
    if (!this.player) return;
    this.cameras.main.scrollX = this.cameraTargetX(this.player.x);
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
    if (this.inputPaused) return { ...INITIAL_INPUT };
    return {
      left: Boolean(window.fallstackInput?.left || this.cursors?.left?.isDown),
      right: Boolean(
        window.fallstackInput?.right || this.cursors?.right?.isDown
      ),
      jump: Boolean(window.fallstackInput?.jump || this.space?.isDown),
    };
  }

  private onLand(playerObject: unknown, platformObject: unknown) {
    const player = playerObject as Phaser.GameObjects.Rectangle & {
      body: Phaser.Physics.Arcade.Body;
    };
    const object = platformObject as Phaser.GameObjects.GameObject;
    const platformId = object.getData('platformId');
    const platformKind = object.getData('kind') as Platform['kind'];
    const standing =
      player.body.blocked.down || player.body.touching.down;
    if (!standing) return;
    if (typeof platformId === 'string') this.lastPlatformId = platformId;
    this.landingMaterial = platformKind;
    this.landingSurface =
      platformId === 'summit'
        ? 'summit'
        : typeof platformId === 'string' && platformId.includes('checkpoint')
          ? 'checkpoint'
          : 'route';
    if (platformId === 'summit' && !this.summitSent) {
      this.summitSent = true;
      this.showPlayerCeremony('summit');
      this.drawPlayer();
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

  private onArtifactTouch(playerObject: unknown, artifactObject: unknown) {
    const player = playerObject as Phaser.GameObjects.Rectangle & {
      body: Phaser.Physics.Arcade.Body;
    };
    const object = artifactObject as Phaser.GameObjects.GameObject;
    const type = object.getData('artifactType') as Artifact['type'];
    const artifactId = object.getData('artifactId');
    const artifactZoneId = object.getData('artifactZoneId') as ZoneId;
    if (player.body.blocked.down || player.body.touching.down) {
      this.landingMaterial = artifactLandingMaterial(type);
      this.landingSurface = 'artifact';
    }
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
      this.startArtifactTimer(artifactId, type, artifactZoneId);
  }

  private shouldCollideWithPlatform(
    playerObject: unknown,
    platformObject: unknown
  ): boolean {
    const player = playerObject as Phaser.GameObjects.Rectangle & {
      body: Phaser.Physics.Arcade.Body;
    };
    const platform = platformObject as Phaser.GameObjects.Rectangle & {
      body: Phaser.Physics.Arcade.StaticBody;
    };
    const platformId = platform.getData('platformId');
    return canCollideWithPlatform({
      checkpoint:
        typeof platformId === 'string' && platformId.includes('checkpoint'),
      playerVelocityY: player.body.velocity.y,
      playerBottom: player.body.bottom,
      playerPreviousBottom: player.body.prev.y + player.body.height,
      platformTop: platform.body.top,
    });
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
    type: 'ghost_platform' | 'cursed_brick',
    zoneId: ZoneId
  ) {
    if (this.artifactTimers.has(artifactId)) return;
    const duration = artifactUseWindowMs(type);
    if (duration === null) return;
    const attemptId = this.currentAttemptId;
    this.artifactTimers.set(artifactId, {
      type,
      zoneId,
      collapseAt: this.time.now + duration,
      attemptId,
    });
    this.time.delayedCall(duration, () => {
      const timer = this.artifactTimers.get(artifactId);
      if (!timer || timer.attemptId !== this.currentAttemptId) return;
      this.artifactTimers.delete(artifactId);
      this.expiredArtifactIds.add(artifactId);
      window.dispatchEvent(
        new CustomEvent<ArtifactCollapseEventDetail>(
          'fallstack:artifact-collapse',
          {
            detail: { zoneId: timer.zoneId, type },
          }
        )
      );
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
    this.showPlayerCeremony('checkpoint');
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
    this.player.body.reset(this.layoutX(checkpoint.x), checkpoint.y);
    this.player.body.setAcceleration(0, 0);
    this.player.body.setGravityY(0);
    this.wasGrounded = false;
    this.suppressNextLanding = true;
    this.currentZone = this.respawnZone;
    this.rebuildPlatformBodies();
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
    this.pendingImpactSpeed = 0;
    this.pendingWallImpactSpeed = 0;
    this.landingMaterial = 'stone';
    this.landingSurface = 'route';
    this.lastPlatformId =
      this.respawnZone === BOTTOM_ZONE_ID ? 'start' : null;
    this.showPlayerCeremony('respawn');
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

    const impactSpeed = Math.max(
      Math.abs(body.velocity.x),
      this.pendingWallImpactSpeed
    );
    const side = intoLeft ? 'left' : 'right';
    body.setVelocityX(direction * MOVEMENT_TUNING.wallBounceVelocityX);
    body.setVelocityY(
      Math.min(body.velocity.y, MOVEMENT_TUNING.wallBounceLiftVelocityY)
    );
    this.facing = direction as -1 | 1;
    this.wallBonkPlatformId = this.lastPlatformId;
    this.lastWallBounceAt = now;
    this.pendingWallImpactSpeed = 0;
    window.dispatchEvent(
      new CustomEvent<WallBonkEventDetail>('fallstack:wall-bonk', {
        detail: {
          zoneId: this.currentZone,
          side,
          impactSpeed: Math.round(impactSpeed),
        },
      })
    );

    if (!this.reducedMotion) {
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
  }

  private updateCamera(deltaMs: number) {
    if (!this.player) return;
    const targetX = this.cameraTargetX(this.player.x);
    const targetY = this.cameraTargetY(this.player.y);

    if (this.reducedMotion) {
      this.cameras.main.scrollX = targetX;
      this.cameras.main.scrollY = targetY;
    } else {
      const currentX = this.cameras.main.scrollX;
      const currentY = this.cameras.main.scrollY;
      this.cameras.main.scrollX = Phaser.Math.Linear(
        currentX,
        targetX,
        Math.min(1, deltaMs / 90)
      );
      this.cameras.main.scrollY = Phaser.Math.Linear(
        currentY,
        targetY,
        Math.min(1, deltaMs / 120)
      );
    }
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
    this.artifactLabels = [];

    const drawW = this.gameWidth();

    const activeZoneIds = this.activeZoneIds();
    const activeZones = ZONES.filter((zone) => activeZoneIds.has(zone.id));

    for (const zone of activeZones) {
      const zoneSnapshot = window.fallstackSnapshot?.zones.find(
        (item) => item.id === zone.id
      );
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
        zoneSnapshot
          ? zoneEffectPresentation(zoneSnapshot).label
          : 'No active mark'
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
      addLabel: (centerX, y) =>
        this.addArtifactLabel(centerX, y, inWorldArtifactLabel(artifact)),
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
        const px =
          cam.worldView.x + Math.random() * cam.worldView.width;
        const py =
          cam.worldView.y + cam.worldView.height - Math.random() * 160;
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

    // 7. DRAW THE COMMITTED CHARGE ARC
    this.drawChargeIntent(g);

    // 8. DRAW PLAYER ON ITS OWN CACHED POSE LAYER
    this.drawPlayer();
  }

  private drawChargeIntent(g: Phaser.GameObjects.Graphics) {
    if (!this.charging || !this.player) return;
    const player = this.player;
    const chargeRatio = chargeRatioForHeldMs(this.chargeTime);
    const launch = launchVelocityForChargeRatio(chargeRatio);
    const direction = this.chargeDirection;
    const points = Array.from({ length: 5 }, (_, index) => {
      const seconds = (index + 1) * 0.045;
      return {
        x: player.x + direction * launch.x * seconds,
        y:
          player.y +
          launch.y * seconds +
          0.5 * MOVEMENT_TUNING.gravityY * seconds * seconds,
      };
    });

    g.lineStyle(2, RELIQUARY_COLORS.washi, 0.52);
    g.beginPath();
    g.moveTo(player.x + direction * 12, player.y - 8);
    for (const point of points) g.lineTo(point.x, point.y);
    g.strokePath();

    for (const [index, point] of points.entries()) {
      g.fillStyle(
        index === points.length - 1
          ? RELIQUARY_COLORS.persimmon
          : RELIQUARY_COLORS.gold,
        0.7 + index * 0.06
      );
      g.fillCircle(point.x, point.y, index === points.length - 1 ? 3.5 : 2.5);
    }

    const tip = points[0]!;
    g.fillStyle(RELIQUARY_COLORS.washi, 0.95).fillTriangle(
      tip.x + direction * 8,
      tip.y,
      tip.x,
      tip.y - 5,
      tip.x,
      tip.y + 5
    );
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

  private drawPlayer() {
    if (!this.player || !this.playerGraphics) return;
    const grounded =
      this.player.body.blocked.down || this.player.body.touching.down;
    const velocityY = this.player.body.velocity.y;
    const chargeRatio = chargePowerForHeldMs(this.chargeTime);
    const ceremony = this.activePlayerCeremony();
    const pose = playerVisualState({
      charging: this.charging,
      grounded,
      velocityY,
      ceremony: ceremony?.state ?? null,
    });
    const chargeTier = Math.round(chargeRatio * 8);
    const ceremonyTier = ceremony
      ? this.reducedMotion
        ? 4
        : Math.round(ceremony.progress * 4)
      : 0;
    const strengthTier = ceremony ? Math.round(ceremony.strength * 4) : 0;
    const visualKey = `${pose}:${this.facing}:${chargeTier}:${ceremonyTier}:${strengthTier}:${this.reducedMotion}`;
    this.playerGraphics.setPosition(this.player.x, this.player.y);
    if (visualKey === this.playerVisualKey) return;
    this.playerVisualKey = visualKey;
    this.playerGraphics.clear();
    renderReliquaryPlayer(this.playerGraphics, {
      x: 0,
      y: 0,
      facing: this.facing,
      charging: this.charging,
      grounded,
      velocityY,
      chargeRatio,
      reducedMotion: this.reducedMotion,
      ceremony: ceremony?.state ?? null,
      ceremonyProgress: ceremonyTier / 4,
      ceremonyStrength: ceremony?.strength ?? 1,
    });
  }

  private showPlayerCeremony(
    state: PlayerCeremonyState,
    strength = 1
  ): void {
    const priority: Record<PlayerCeremonyState, number> = {
      land: 1,
      checkpoint: 2,
      respawn: 3,
      summit: 4,
    };
    const current = this.activePlayerCeremony();
    if (current && priority[current.state] > priority[state]) return;
    this.playerCeremony = {
      state,
      startedAt: this.time.now,
      until: this.time.now + PLAYER_CEREMONY_DURATION_MS[state],
      strength: Phaser.Math.Clamp(strength, 0, 1),
    };
    this.playerVisualKey = '';
  }

  private activePlayerCeremony(): {
    state: PlayerCeremonyState;
    progress: number;
    strength: number;
  } | null {
    const ceremony = this.playerCeremony;
    if (!ceremony) return null;
    if (this.time.now >= ceremony.until) {
      this.playerCeremony = null;
      return null;
    }
    return {
      state: ceremony.state,
      progress: Phaser.Math.Clamp(
        (this.time.now - ceremony.startedAt) /
          Math.max(1, ceremony.until - ceremony.startedAt),
        0,
        1
      ),
      strength: ceremony.strength,
    };
  }

  private drawCheckpointLanterns(g: Phaser.GameObjects.Graphics) {
    const swingAngle = this.reducedMotion
      ? 0
      : Math.sin(this.time.now / 380) * 0.16;
    for (const platform of this.towerPlatforms) {
      const layout = this.layoutPlatform(platform);
      const isCheckpoint = layout.id.includes('checkpoint');
      if (isCheckpoint && this.isCameraVisibleY(layout.y, 80)) {
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
    const activeZoneIds = this.activeZoneIds();

    for (const zone of snapshot.zones) {
      if (!activeZoneIds.has(zone.id)) continue;
      for (const artifact of zone.artifacts) {
        if (artifact.type === 'cursed_brick') {
          if (this.expiredArtifactIds.has(artifact.id)) continue;
          const layout = this.layoutArtifact(artifact);
          if (!this.isCameraVisibleY(layout.y, 60)) continue;
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

  private isCameraVisibleY(y: number, margin: number): boolean {
    const worldView = this.cameras.main.worldView;
    return (
      y >= worldView.y - margin &&
      y <= worldView.bottom + margin
    );
  }

  private addZoneLabel(
    x: number,
    y: number,
    name: string,
    statusLabel: string
  ) {
    const label = this.add.text(x, y, `${name} · ${statusLabel}`, {
      fontFamily: '"Shippori Mincho", serif',
      fontSize: '12px',
      fontStyle: 'bold',
      resolution: this.renderScale,
      color: '#d9b45c',
      backgroundColor: 'rgba(23, 20, 38, 0.86)',
      padding: { left: 6, right: 6, top: 3, bottom: 3 },
    });
    label.setDepth(1);
    label.setAlpha(0.78);
    this.labels.push(label);
  }

  private addArtifactLabel(centerX: number, y: number, text: string) {
    const labelWidth = this.gameWidth() < 420 ? 120 : 148;
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
      fontSize: '12px',
      fontStyle: '700',
      resolution: this.renderScale,
      color: '#180d18',
      backgroundColor: 'rgba(244, 239, 226, 0.97)',
      padding: { left: 7, right: 7, top: 4, bottom: 4 },
      wordWrap: { width: labelWidth, useAdvancedWrap: true },
    });
    label.setOrigin(0.5, 1);
    label.setDepth(4);
    this.labels.push(label);
    this.artifactLabels.push(label);
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
      rect.setData('artifactZoneId', artifact.zoneId);
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
  const [resume, setResume] = useState<PlayerResume | null>(null);
  const [summitOpen, setSummitOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [discussionUrl, setDiscussionUrl] = useState<string | null>(null);
  const [supportUrl, setSupportUrl] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<
    'idle' | 'copied' | 'failed'
  >('idle');
  const [gameplayMuted, setGameplayMuted] = useState(
    () =>
      resolveGameplayMuted(
        localStorage.getItem('fallstack:gameplay-muted'),
        localStorage.getItem('fallstack:muted')
      )
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
  const [mutationPlacement, setMutationPlacement] =
    useState<HudNoticePlacement>('top');
  const [mutationSide, setMutationSide] = useState<HudNoticeSide>('right');
  const [checkpointVisible, setCheckpointVisible] = useState(false);
  const [checkpointPlacement, setCheckpointPlacement] =
    useState<HudNoticePlacement>('top');
  const [checkpointSide, setCheckpointSide] =
    useState<HudNoticeSide>('right');
  const [remoteBeatPlacement, setRemoteBeatPlacement] =
    useState<HudNoticePlacement>('top');
  const [remoteBeatSide, setRemoteBeatSide] =
    useState<HudNoticeSide>('right');
  const [checkpointText, setCheckpointText] = useState({ title: '', sub: '' });
  const [remoteBeat, setRemoteBeat] = useState<MutationBeat | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<FallstackScene | null>(null);
  const inputPausedRef = useRef(false);
  const soundRef = useRef<ProceduralSound | null>(
    new ProceduralSound({ gameplayMuted, musicMuted })
  );
  const resultDialogRef = useRef<HTMLDivElement | null>(null);
  const resultCloseRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const guideDialogRef = useRef<HTMLDivElement | null>(null);
  const previousGuideFocusRef = useRef<HTMLElement | null>(null);
  const chargeRef = useRef(0);
  const activeFallFeedbackAttemptRef = useRef<string | null>(null);
  const mutationTimerRef = useRef<number | null>(null);
  const mutationBannerRef = useRef<HTMLDivElement | null>(null);
  const remoteBeatRef = useRef<HTMLDivElement | null>(null);
  const checkpointBannerRef = useRef<HTMLDivElement | null>(null);
  const checkpointTimerRef = useRef<number | null>(null);
  const remoteBeatTimerRef = useRef<number | null>(null);
  const pendingBoardSnapshotRef = useRef<{
    snapshot: BoardSnapshot;
    beat: MutationBeat | null;
  } | null>(null);
  const restoredBoardRef = useRef<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  const toggleMusic = useCallback(() => {
    const nextMuted = !musicMuted;
    soundRef.current?.setMusicMuted(nextMuted);
    setMusicMuted(nextMuted);
  }, [musicMuted]);

  const toggleGameplaySound = useCallback(() => {
    const nextMuted = !gameplayMuted;
    soundRef.current?.setGameplayMuted(nextMuted);
    if (!nextMuted) soundRef.current?.previewGameplay();
    setGameplayMuted(nextMuted);
  }, [gameplayMuted]);

  const showMutation = useCallback(
    (text: string, receipt: MutationReceipt | null = null) => {
      if (checkpointTimerRef.current)
        window.clearTimeout(checkpointTimerRef.current);
      if (remoteBeatTimerRef.current)
        window.clearTimeout(remoteBeatTimerRef.current);
      setCheckpointVisible(false);
      setRemoteBeat(null);
      setMessage(text);
      setMutationReceipt(receipt);
      setMutationVisible(true);
      if (mutationTimerRef.current)
        window.clearTimeout(mutationTimerRef.current);
      mutationTimerRef.current = window.setTimeout(
        () => setMutationVisible(false),
        receipt ? 3_200 : 2_600
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
      2_800
    );
  }, []);

  const dismissGameplayNotices = useCallback(() => {
    activeFallFeedbackAttemptRef.current = null;
    if (mutationTimerRef.current)
      window.clearTimeout(mutationTimerRef.current);
    if (checkpointTimerRef.current)
      window.clearTimeout(checkpointTimerRef.current);
    if (remoteBeatTimerRef.current)
      window.clearTimeout(remoteBeatTimerRef.current);
    mutationTimerRef.current = null;
    checkpointTimerRef.current = null;
    remoteBeatTimerRef.current = null;
    setMutationVisible(false);
    setCheckpointVisible(false);
    setRemoteBeat(null);
  }, []);

  useLayoutEffect(() => {
    if (!mutationVisible || !mutationBannerRef.current) return;
    const bounds = mutationBannerRef.current.getBoundingClientRect();
    setMutationPlacement(
      sceneRef.current?.hudNoticePlacement(bounds.height) ?? 'top'
    );
    setMutationSide(
      sceneRef.current?.hudNoticeSide(bounds.width) ?? 'right'
    );
  }, [message, mutationReceipt, mutationVisible]);

  useLayoutEffect(() => {
    if (!checkpointVisible || !checkpointBannerRef.current) return;
    const bounds = checkpointBannerRef.current.getBoundingClientRect();
    setCheckpointPlacement(
      sceneRef.current?.hudNoticePlacement(
        bounds.height
      ) ?? 'top'
    );
    setCheckpointSide(
      sceneRef.current?.hudNoticeSide(bounds.width) ?? 'right'
    );
  }, [checkpointText, checkpointVisible]);

  useLayoutEffect(() => {
    if (
      !remoteBeat ||
      mutationVisible ||
      checkpointVisible ||
      !remoteBeatRef.current
    )
      return;
    const bounds = remoteBeatRef.current.getBoundingClientRect();
    setRemoteBeatPlacement(
      sceneRef.current?.hudNoticePlacement(
        bounds.height
      ) ?? 'top'
    );
    setRemoteBeatSide(
      sceneRef.current?.hudNoticeSide(bounds.width) ?? 'right'
    );
  }, [checkpointVisible, mutationVisible, remoteBeat]);

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
      if (boardChanged) {
        setResume((value) => ({
          zoneId: BOTTOM_ZONE_ID,
          mode: value?.mode ?? 'session',
        }));
      }
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
    if (mutationTimerRef.current)
      window.clearTimeout(mutationTimerRef.current);
    if (remoteBeatTimerRef.current)
      window.clearTimeout(remoteBeatTimerRef.current);
    setMutationVisible(false);
    setRemoteBeat(null);
    setCheckpointText({ title, sub });
    setCheckpointVisible(true);
    if (checkpointTimerRef.current)
      window.clearTimeout(checkpointTimerRef.current);
    checkpointTimerRef.current = window.setTimeout(
      () => setCheckpointVisible(false),
      2_600
    );
  }, []);

  const loadSharedState = useCallback(
    async (successMessage?: string | null) => {
      const res = await fetch('/api/init-game');
      const data = await parseApiResponse<InitGameResponse>(res);
      setSharedAvailable(true);
      setDiscussionUrl(data.postUrl);
      setSupportUrl(data.supportUrl);
      setResume(data.resume);
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
    return { falls: snapshot?.organicFalls ?? 0 };
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
  const sharedBoardId = isBoardSnapshot(snapshot) ? snapshot.boardId : null;

  const currentZoneInfo = useMemo(() => {
    if (!snapshot?.zones?.length)
      return { name: reliquaryZoneName(BOTTOM_ZONE_ID), segment: null };
    const segment =
      snapshot.zones.find((zone) => zone.id === currentZoneId) ??
      snapshot.zones[0] ??
      null;
    return { name: reliquaryZoneName(currentZoneId), segment };
  }, [currentZoneId, snapshot]);

  const currentZoneEffect = useMemo(
    () =>
      currentZoneInfo.segment
        ? zoneEffectPresentation(currentZoneInfo.segment)
        : {
            label: 'Reading tower',
            description: 'The daily route state is loading.',
            badgeClass: 'badge-quiet',
          },
    [currentZoneInfo.segment]
  );

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
        console.warn('Shared board unavailable; using local practice.', error);
        const localSnapshot = createLocalSnapshot();
        setSharedAvailable(false);
        setDiscussionUrl(null);
        setSupportUrl(null);
        setResume({
          zoneId: readDeviceResume(localStorage, localSnapshot),
          mode: 'session',
        });
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
    if (!sceneReady || !snapshot || !resume) return;
    const boardKey = isBoardSnapshot(snapshot)
      ? snapshot.boardId
      : `practice:${snapshot.dateKey}`;
    if (restoredBoardRef.current === boardKey) return;
    sceneRef.current?.restoreCheckpoint(resume.zoneId);
    restoredBoardRef.current = boardKey;
    if (resume.zoneId !== BOTTOM_ZONE_ID) {
      const frameId = window.requestAnimationFrame(() => {
        showCheckpoint(
          `Checkpoint restored · ${reliquaryZoneName(resume.zoneId)}`,
          resume.mode === 'account'
            ? 'Saved to your Reddit account for today.'
            : 'Saved on this device for today.'
        );
      });
      return () => window.cancelAnimationFrame(frameId);
    }
  }, [resume, sceneReady, showCheckpoint, snapshot]);

  useEffect(() => {
    localStorage.setItem('fallstack:gameplay-muted', String(gameplayMuted));
    localStorage.removeItem('fallstack:muted');
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
    const resumeVisibleAudio = () => {
      if (!document.hidden) unlock();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('pageshow', unlock);
    document.addEventListener('visibilitychange', resumeVisibleAudio);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('pageshow', unlock);
      document.removeEventListener('visibilitychange', resumeVisibleAudio);
    };
  }, []);

  useEffect(() => {
    window.fallstackAudioDiagnostics = () =>
      soundRef.current?.getDiagnostics() ?? {
        contextState: 'uninitialized',
        musicActive: false,
        musicStartPending: false,
        outputPeak: 0,
        outputRms: 0,
      };
    return () => {
      delete window.fallstackAudioDiagnostics;
    };
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('qa') !== 'audio')
      return;
    window.fallstackAudioCapture = {
      start: async () => {
        await soundRef.current?.startCapture();
      },
      stop: async () => {
        if (!soundRef.current)
          throw new Error('Fallstack audio is unavailable.');
        return soundRef.current.stopCapture();
      },
    };
    window.fallstackAudioPreview = (id, detail) => {
      soundRef.current?.play(id, detail);
    };
    window.fallstackAudioStopPreview = () => {
      soundRef.current?.stopCharge();
    };
    return () => {
      delete window.fallstackAudioCapture;
      delete window.fallstackAudioPreview;
      delete window.fallstackAudioStopPreview;
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
        const dialog = resultDialogRef.current;
        const focusable = Array.from(
          dialog?.querySelectorAll<HTMLButtonElement>(
            'button:not(:disabled)'
          ) ?? []
        );
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!dialog || !first || !last) return;
        const activeElement = document.activeElement;
        if (
          event.shiftKey &&
          (activeElement === dialog ||
            activeElement === first ||
            !dialog.contains(activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (activeElement === dialog ||
            activeElement === last ||
            !dialog.contains(activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previousFocusRef.current?.focus();
    };
  }, [summitOpen]);

  useEffect(() => {
    if (!guideOpen) return;
    previousGuideFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    window.setTimeout(() => {
      guideDialogRef.current?.scrollTo({ top: 0 });
      guideDialogRef.current?.focus({ preventScroll: true });
    }, 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGuideOpen(false);
      if (event.key === 'Tab') {
        const dialog = guideDialogRef.current;
        const focusable = Array.from(
          dialog?.querySelectorAll<HTMLButtonElement>(
            'button:not(:disabled)'
          ) ?? []
        );
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!dialog || !first || !last) return;
        const activeElement = document.activeElement;
        if (
          event.shiftKey &&
          (activeElement === dialog ||
            activeElement === first ||
            !dialog.contains(activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (activeElement === dialog ||
            activeElement === last ||
            !dialog.contains(activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previousGuideFocusRef.current?.focus();
    };
  }, [guideOpen]);

  useEffect(() => {
    const inputPaused = summitOpen || guideOpen;
    inputPausedRef.current = inputPaused;
    resetSharedInput();
    sceneRef.current?.setInputPaused(inputPaused);
  }, [guideOpen, summitOpen]);

  const copyResult = useCallback(async () => {
    if (!snapshot) return;
    const copied = await copyText(towerResultCopy(snapshot, sessionStats));
    setCopyStatus(copied ? 'copied' : 'failed');
  }, [sessionStats, snapshot]);

  const closeTowerMemory = useCallback(() => {
    setSummitOpen(false);
    setCopyStatus('idle');
  }, []);

  // Boot Phaser once, then keep it pinned to the real container size.
  useEffect(() => {
    if (gameRef.current) return;
    let frameId: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let appliedGameW = 0;
    let appliedGameH = 0;
    let appliedRenderScale = 0;

    const resizeGame = () => {
      const container = document.getElementById('game-canvas');
      if (!container || !gameRef.current) return;
      const {
        containerW,
        containerH,
        gameW,
        gameH,
        renderScale,
      } = computeGameDimensions(
        container.getBoundingClientRect(),
        window.devicePixelRatio
      );
      if (containerW === 0 || containerH === 0) return;
      if (
        gameW === appliedGameW &&
        gameH === appliedGameH &&
        renderScale === appliedRenderScale
      )
        return;
      appliedGameW = gameW;
      appliedGameH = gameH;
      appliedRenderScale = renderScale;
      sceneRef.current?.setRenderScale(renderScale);
      gameRef.current.scale.resize(gameW, gameH);
    };

    const initGame = () => {
      const container = document.getElementById('game-canvas');
      if (!container) return;
      const { containerW, containerH, gameW, gameH, renderScale } =
        computeGameDimensions(
          container.getBoundingClientRect(),
          window.devicePixelRatio
        );

      // Wait until browser layout has completed and container has dimensions
      if (containerW === 0 || containerH === 0) {
        frameId = requestAnimationFrame(initGame);
        return;
      }

      const scene = new FallstackScene('FallstackScene');
      scene.setRenderScale(renderScale);
      scene.setInputPaused(inputPausedRef.current);
      sceneRef.current = scene;
      appliedGameW = gameW;
      appliedGameH = gameH;
      appliedRenderScale = renderScale;
      const game = new Phaser.Game({
        type: Phaser.CANVAS,
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
          antialias: true,
          pixelArt: false,
          roundPixels: false,
        },
        audio: {
          noAudio: true,
        },
        scene,
      });
      gameRef.current = game;

      const styleCanvas = () => {
        const canvas = container.querySelector('canvas');
        if (canvas) {
          canvas.style.imageRendering = 'auto';
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
    if (!isBoardSnapshot(snapshot) || !sharedAvailable) return;

    const refreshQuietly = () => {
      if (document.visibilityState !== 'visible') return;
      void (async () => {
        try {
          const changed = await fetchChangedBoardSnapshot(snapshot);
          if (changed) reconcileRemoteSnapshot(changed);
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
    if (!sharedBoardId || !sharedAvailable) return;
    const channel = realtimeChannelForBoard(sharedBoardId);
    let requestInFlight = false;
    connectRealtime({
      channel,
      onMessage: (message: unknown) => {
        const current = window.fallstackSnapshot;
        if (
          requestInFlight ||
          !isBoardSnapshot(current) ||
          !isBoardRevisionMessage(message) ||
          !isNewerBoardRevision(current, message)
        )
          return;
        requestInFlight = true;
        void (async () => {
          try {
            const response = await fetch('/api/init-game');
            const data = await parseApiResponse<InitGameResponse>(response);
            reconcileRemoteSnapshot(data.snapshot);
          } catch (error) {
            console.error('Realtime refresh failed; polling will recover.', error);
          } finally {
            requestInFlight = false;
          }
        })();
      },
    });
    return () => disconnectRealtime(channel);
  }, [
    reconcileRemoteSnapshot,
    sharedAvailable,
    sharedBoardId,
  ]);

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
        if (activeFallFeedbackAttemptRef.current === detail.attemptId)
          showMutation(data.message, data.receipt);
        if (data.counted) soundRef.current?.play('mutation');
      } catch (error) {
        console.error('record-fall failed', error);
        if (activeFallFeedbackAttemptRef.current !== detail.attemptId) {
          if (
            error instanceof ApiRequestError &&
            error.data.snapshot
          )
            applyBoardSnapshot(error.data.snapshot);
          return;
        }
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
        const nextZone = nextZoneId(detail.zoneId);
        if (nextZone) {
          setResume({
            zoneId: writeDeviceResume(localStorage, snapshot, nextZone),
            mode: 'session',
          });
        }
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
        setResume(data.resume);
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
      soundRef.current?.play('summit');

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
      if (detail.percent > 0) dismissGameplayNotices();
      if (detail.percent <= 0) soundRef.current?.stopCharge();
      if (chargeRef.current === 0 && detail.percent > 0)
        soundRef.current?.play('charge-start');
      chargeRef.current = detail.percent;
      setCharge(detail.percent);
    };
    const onLand = (event: Event) => {
      const detail = (event as CustomEvent<LandEventDetail>).detail;
      setCharge(0);
      soundRef.current?.play('land', detail);
    };
    const onWallBonk = (event: Event) => {
      const detail = (event as CustomEvent<WallBonkEventDetail>).detail;
      soundRef.current?.play('wall-bonk', detail);
    };
    const onArtifactCollapse = (event: Event) => {
      const detail = (event as CustomEvent<ArtifactCollapseEventDetail>).detail;
      soundRef.current?.play('artifact-collapse', {
        zoneId: detail.zoneId,
        artifactType: detail.type,
      });
    };
    const onLaunch = (event: Event) => {
      const detail = (event as CustomEvent<LaunchEventDetail>).detail;
      dismissGameplayNotices();
      soundRef.current?.play('launch', {
        chargePercent: detail.chargePercent,
      });
    };
    const onFall = (event: Event) => {
      const detail = (event as CustomEvent<FallEventDetail>).detail;
      resetSharedInput();
      activeFallFeedbackAttemptRef.current = detail.attemptId;
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
    const onGameplayPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest('.touch-controls')
      )
        dismissGameplayNotices();
    };
    const onGameplayKeyDown = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code))
        dismissGameplayNotices();
    };
    window.addEventListener('fallstack:charge', onCharge);
    window.addEventListener('fallstack:land', onLand);
    window.addEventListener('fallstack:wall-bonk', onWallBonk);
    window.addEventListener('fallstack:artifact-collapse', onArtifactCollapse);
    window.addEventListener('fallstack:launch', onLaunch);
    window.addEventListener('fallstack:fall', onFall);
    window.addEventListener('fallstack:clear', onClear);
    window.addEventListener('fallstack:summit', onSummit);
    window.addEventListener('fallstack:zone', onZone);
    window.addEventListener('pointerdown', onGameplayPointerDown);
    window.addEventListener('keydown', onGameplayKeyDown);
    return () => {
      window.removeEventListener('fallstack:charge', onCharge);
      window.removeEventListener('fallstack:land', onLand);
      window.removeEventListener('fallstack:wall-bonk', onWallBonk);
      window.removeEventListener(
        'fallstack:artifact-collapse',
        onArtifactCollapse
      );
      window.removeEventListener('fallstack:launch', onLaunch);
      window.removeEventListener('fallstack:fall', onFall);
      window.removeEventListener('fallstack:clear', onClear);
      window.removeEventListener('fallstack:summit', onSummit);
      window.removeEventListener('fallstack:zone', onZone);
      window.removeEventListener('pointerdown', onGameplayPointerDown);
      window.removeEventListener('keydown', onGameplayKeyDown);
    };
  }, [dismissGameplayNotices, postClear, postFall, postSummit]);

  return (
    <main className="game-shell" data-build-id={BUILD_ID}>
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
        </div>

        <div
          className="community-tally"
          aria-label={`${stats.falls} community ${stats.falls === 1 ? 'fall' : 'falls'} today`}
        >
          <strong>{stats.falls}</strong>
          <span>
            <span className="community-tally-word">Community </span>
            falls
          </span>
        </div>

        <div className="topbar-actions" aria-label="Game reference">
          <button
            type="button"
            className="action-btn"
            onClick={() => {
              setSummitOpen(false);
              setGuideOpen(true);
            }}
          >
            Guide
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={() => {
              setGuideOpen(false);
              setSummitOpen(true);
            }}
            disabled={!snapshot}
          >
            Memory
          </button>
        </div>
      </header>

      {/* ── GAME VIEWPORT ── */}
      <section className="tower-wrap" aria-label="Fallstack tower">
        <div id="game-canvas" />
        <div className="tower-side-rails" aria-hidden="true" />

        {/* Zone tag — top left overlay */}
        <div
          className="hud-overlay zone-tag"
          role="status"
          aria-label={`Current zone: ${currentZoneInfo.name}. ${currentZoneEffect.description}`}
        >
          {currentZoneInfo.name}
          <span className={`zone-badge ${currentZoneEffect.badgeClass}`}>
            {currentZoneEffect.label}
          </span>
        </div>

        {/* Controls hint */}
        <div className="hud-overlay controls-hint" aria-hidden="true">
          Arrows move · Hold Space · Release to leap
        </div>

        {/* Mutation banner */}
        <div
          ref={mutationBannerRef}
          className={`hud-overlay mutation-banner${mutationReceipt ? ' receipt' : ''}${mutationVisible ? ' visible' : ''} place-${mutationPlacement} side-${mutationSide}`}
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

        {remoteBeat && !mutationVisible && !checkpointVisible && (
          <div
            ref={remoteBeatRef}
            className={`hud-overlay remote-beat place-${remoteBeatPlacement} side-${remoteBeatSide}`}
            role="status"
            aria-live="polite"
          >
            <span>REMOTE · BOARD r{remoteBeat.revision}</span>
            {remoteBeat.copy}
          </div>
        )}

        {/* Checkpoint banner */}
        <div
          ref={checkpointBannerRef}
          className={`hud-overlay checkpoint-banner${checkpointVisible ? ' visible' : ''} place-${checkpointPlacement} side-${checkpointSide}`}
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
      <TouchControls
        disabled={summitOpen || guideOpen || !sceneReady}
        charge={charge}
      />

      {guideOpen ? (
        <div
          className="result-backdrop guide-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fallstack-guide-title"
        >
          <div
            ref={guideDialogRef}
            className="result-card guide-card"
            tabIndex={-1}
          >
            <header className="guide-header">
              <p className="guide-kicker">Keep this open whenever you need it</p>
              <h2 id="fallstack-guide-title">How to climb</h2>
            </header>

            <ol className="guide-steps">
              <li>
                <b>Face</b>
                <span>Arrows or side buttons move and choose a direction.</span>
              </li>
              <li>
                <b>Charge</b>
                <span>
                  Hold Space or Jump. The dotted arc is your committed leap.
                </span>
              </li>
              <li>
                <b>Leap</b>
                <span>
                  Release. Arrows only nudge the arc once you are airborne.
                </span>
              </li>
            </ol>

            <section className="guide-section" aria-labelledby="tower-rules-title">
              <h3 id="tower-rules-title">How the shared tower changes</h3>
              <p>
                Falls add one anonymous scar at the missed jump. Repeated misses
                can grow helpers, temporary ghosts, or crumbling hazards. A clean
                zone clear repairs the route and becomes your checkpoint.
              </p>
              <dl className="guide-key">
                <div>
                  <dt>Helper active</dt>
                  <dd>Solid community-made foothold.</dd>
                </div>
                <div>
                  <dt>Ghost active</dt>
                  <dd>Temporary one-way foothold.</dd>
                </div>
                <div>
                  <dt>Hazard active</dt>
                  <dd>Cursed Brick crumbles after landing.</dd>
                </div>
                <div>
                  <dt>Clean clears</dt>
                  <dd>The community is repairing this route.</dd>
                </div>
              </dl>
            </section>

            <section className="guide-section guide-sound" aria-labelledby="sound-title">
              <div>
                <h3 id="sound-title">Sound</h3>
                <p>
                  Starts on your first press. Turning either switch on plays
                  immediately.
                </p>
              </div>
              <div className="guide-sound-actions">
                <button
                  type="button"
                  className="guide-toggle"
                  onClick={toggleMusic}
                  aria-pressed={!musicMuted}
                >
                  Music {musicMuted ? 'Off' : 'On'}
                </button>
                <button
                  type="button"
                  className="guide-toggle"
                  onClick={toggleGameplaySound}
                  aria-pressed={!gameplayMuted}
                >
                  SFX {gameplayMuted ? 'Off' : 'On'}
                </button>
              </div>
            </section>

            <button
              type="button"
              className="result-close-btn guide-close"
              onClick={() => setGuideOpen(false)}
            >
              Return to climb
            </button>
          </div>
        </div>
      ) : null}

      {/* ── RESULT CARD ── */}
      {summitOpen ? (
        <div
          className="result-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fallstack-memory-title"
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
              <h2 id="fallstack-memory-title">Tower Memory</h2>
              <p className="tower-memory-intro">
                {towerMemory?.introCopy ??
                  'This subreddit shaped this daily route.'}
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
                      <p className="tower-memory-effect">{zone.effect}</p>
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
                  'At 00:00 UTC, this subreddit gets a fresh shared tower.'}
              </p>
            </div>
            <div className="tower-memory-actions">
              <button
                ref={resultCloseRef}
                type="button"
                className="result-close-btn"
                onClick={closeTowerMemory}
              >
                Return
              </button>
              <button
                type="button"
                className="result-secondary-btn"
                disabled={!discussionUrl}
                onClick={() => discussionUrl && navigateTo(discussionUrl)}
              >
                Discuss
              </button>
              <button
                type="button"
                className="result-secondary-btn"
                onClick={() => void copyResult()}
              >
                {copyStatus === 'copied' ? 'Copied' : 'Copy result'}
              </button>
            </div>
            <p className="tower-memory-action-status" aria-live="polite">
              {copyStatus === 'copied'
                ? 'Result copied. Paste it into a comment when you choose.'
                : copyStatus === 'failed'
                  ? 'Copy was blocked by this webview.'
                  : !discussionUrl
                    ? 'Discussion opens from the shared Reddit post.'
                    : ''}
            </p>
            {supportUrl ? (
              <button
                type="button"
                className="tower-memory-support"
                onClick={() => navigateTo(supportUrl)}
              >
                Report a problem via subreddit modmail
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
