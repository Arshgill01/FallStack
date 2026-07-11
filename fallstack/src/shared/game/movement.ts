export const MOVEMENT_TUNING = {
  gravityY: 1550,
  groundDragX: 850,
  groundSpeed: 155,
  initialMaxVelocityX: 420,
  airMaxVelocityX: 390,
  maxVelocityY: 1300,
  airSteerAccelerationX: 620,
  wallBonkVelocityYThreshold: -720,
  chargeMs: 900,
  minChargePercent: 0.32,
  minLaunchVelocityX: 170,
  maxLaunchVelocityX: 400,
  minLaunchVelocityY: -560,
  maxLaunchVelocityY: -1000,
  reachableHorizontal: 260,
  reachableVertical: 165,
  generatedMinHorizontalStep: 68,
  generatedHorizontalStep: 145,
  topConnectorY: 300,
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
