export const MOVEMENT_TUNING = {
  gravityY: 1850,
  groundDragX: 1200,
  groundSpeed: 210,
  initialMaxVelocityX: 500,
  airMaxVelocityX: 500,
  maxVelocityY: 1450,
  airSteerAccelerationX: 180,
  wallBonkVelocityYThreshold: -720,
  wallBounceMinVelocityX: 120,
  wallBounceVelocityX: 360,
  wallBounceLiftVelocityY: -430,
  wallBounceCooldownMs: 180,
  chargeMs: 600,
  minChargePercent: 0.42,
  minLaunchVelocityX: 210,
  maxLaunchVelocityX: 460,
  minLaunchVelocityY: -650,
  maxLaunchVelocityY: -1050,
  reachableHorizontal: 260,
  reachableVertical: 165,
  generatedMinHorizontalStep: 68,
  generatedHorizontalStep: 145,
  topConnectorY: 360,
} as const;

export function chargePowerForHeldMs(heldMs: number): number {
  return clamp(heldMs / MOVEMENT_TUNING.chargeMs, 0, 1);
}

export function chargeRatioForHeldMs(heldMs: number): number {
  const power = chargePowerForHeldMs(heldMs);
  return (
    MOVEMENT_TUNING.minChargePercent +
    power * (1 - MOVEMENT_TUNING.minChargePercent)
  );
}

export function launchVelocityForChargeRatio(chargeRatio: number): {
  x: number;
  y: number;
} {
  const ratio = clamp(chargeRatio, MOVEMENT_TUNING.minChargePercent, 1);
  return {
    x: lerp(
      MOVEMENT_TUNING.minLaunchVelocityX,
      MOVEMENT_TUNING.maxLaunchVelocityX,
      ratio
    ),
    y: lerp(
      MOVEMENT_TUNING.minLaunchVelocityY,
      MOVEMENT_TUNING.maxLaunchVelocityY,
      ratio
    ),
  };
}

export function jumpArcForHeldMs(heldMs: number): {
  rise: number;
  sameHeightDistance: number;
  sameHeightDurationMs: number;
} {
  const velocity = launchVelocityForChargeRatio(chargeRatioForHeldMs(heldMs));
  const secondsToApex = Math.abs(velocity.y) / MOVEMENT_TUNING.gravityY;
  return {
    rise: (velocity.y * velocity.y) / (2 * MOVEMENT_TUNING.gravityY),
    sameHeightDistance: velocity.x * secondsToApex * 2,
    sameHeightDurationMs: secondsToApex * 2000,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}
