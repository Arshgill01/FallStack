import {
  ARTIFACT_SPAWN_COUNT,
  artifactSlot,
  bucketArtifactType,
  planSiteArtifacts,
  siteStatus,
  type ArtifactSlotKind,
  type ArtifactType,
  type FailureBucket,
  type SiteMutationCounters,
  type SiteSnapshot,
  type ZoneId,
} from './mutation.js';

// Artifacts appear at 3/6/10, so without this layer most falls change a
// counter nobody can see. A forming mark is the visible-only silhouette of the
// artifact a slot is about to grow, so every accepted fall below the spawn
// threshold still changes the tower every climber renders.
export type FormingMark = {
  id: string;
  siteId: string;
  siteName: string;
  zoneId: ZoneId;
  slot: ArtifactSlotKind;
  bucket: FailureBucket | 'successful_clear';
  type: ArtifactType;
  count: number;
  // Falls from the quieter bucket that shares this slot (hazard only), drawn
  // as a second tally so a fall that ties the louder bucket still shows.
  secondaryCount: number;
  needed: number;
  x: number;
  y: number;
  width: number;
  height: number;
  copy: string;
};

// Progress from an artifact's current tier toward its next one, drawn as
// tally pips under the artifact.
export type TierPressure = {
  filled: number;
  total: number;
};

type SlotDriver = {
  slot: ArtifactSlotKind;
  bucket: FailureBucket | 'successful_clear';
  count: number;
};

export function slotDrivers(counters: SiteMutationCounters): SlotDriver[] {
  // Overjumps and helper slips share the hazard slot; the louder bucket owns
  // it, matching planSiteArtifacts.
  const hazard =
    counters.overjump >= counters.helper_overuse ? 'overjump' : 'helper_overuse';
  return [
    { slot: 'helper', bucket: 'short_jump', count: counters.short_jump },
    { slot: 'ghost', bucket: 'wall_bonk', count: counters.wall_bonk },
    { slot: 'hazard', bucket: hazard, count: counters[hazard] },
    {
      slot: 'lantern',
      bucket: 'successful_clear',
      count: counters.successfulClears,
    },
  ];
}

export function deriveFormingMarks(
  sites: readonly SiteSnapshot[]
): FormingMark[] {
  return sites.flatMap((site) => {
    const stabilized = siteStatus(site.counters) === 'Stabilized';
    return slotDrivers(site.counters)
      .filter(
        (driver) => driver.count > 0 && driver.count < ARTIFACT_SPAWN_COUNT
      )
      .map((driver) => {
        const type =
          driver.bucket === 'successful_clear'
            ? 'lantern_trail'
            : bucketArtifactType(driver.bucket, ARTIFACT_SPAWN_COUNT, stabilized);
        const rect = artifactSlot(site, driver.slot);
        return {
          id: `${site.id}-forming-${driver.slot}`,
          siteId: site.id,
          siteName: site.name,
          zoneId: site.zoneId,
          slot: driver.slot,
          bucket: driver.bucket,
          type,
          count: driver.count,
          secondaryCount:
            driver.slot === 'hazard'
              ? Math.min(
                  site.counters.overjump,
                  site.counters.helper_overuse
                )
              : 0,
          needed: ARTIFACT_SPAWN_COUNT,
          ...rect,
          copy: formingCopy(
            driver.bucket,
            type,
            ARTIFACT_SPAWN_COUNT - driver.count
          ),
        };
      });
  });
}

export function tierPressure(
  bucket: FailureBucket | 'successful_clear',
  count: number
): TierPressure | null {
  const tiers = bucket === 'successful_clear' ? [3, 6] : [3, 6, 10];
  const nextAt = tiers.find((threshold) => threshold > count);
  if (nextAt === undefined) return null;
  const from = [...tiers].reverse().find((threshold) => threshold <= count);
  if (from === undefined) return null;
  return { filled: count - from, total: nextAt - from };
}

export function formingCopy(
  bucket: FailureBucket | 'successful_clear',
  type: ArtifactType,
  remaining: number
): string {
  const cause = `${remaining} more ${causeLabel(bucket, remaining)}`;
  const one = remaining === 1;
  if (type === 'corpse_stack' || type === 'mercy_nail')
    return `${cause} ${one ? 'raises' : 'raise'} a foothold here.`;
  if (type === 'ghost_platform')
    return `${cause} ${one ? 'wakes' : 'wake'} a ghost ledge here.`;
  if (type === 'cursed_brick')
    return `${cause} ${one ? 'curses' : 'curse'} this landing.`;
  return `${cause} ${one ? 'lights' : 'light'} a trail here.`;
}

// Everything a site draws: grown artifacts, forming silhouettes, and tier
// pips. If this string does not change, a climber looking at the site cannot
// tell that anything happened.
export function siteFace(site: SiteSnapshot): string {
  const artifacts = planSiteArtifacts(site.counters).map((plan) => {
    const pressure = tierPressure(plan.bucket, plan.count);
    return `${plan.slot}:${plan.type}:${plan.tier}:${pressure ? `${pressure.filled}/${pressure.total}` : '-'}`;
  });
  const forming = deriveFormingMarks([site]).map(
    (mark) =>
      `${mark.slot}:forming:${mark.type}:${mark.count}+${mark.secondaryCount}`
  );
  return [...artifacts, ...forming].sort().join('|');
}

// Whether one more event in this bucket can change the site's face. Falls at a
// saturated slot, or hazard falls that do not raise a grown brick's count, are
// recorded but cannot be drawn.
export function bucketDrivesVisibleSlot(
  counters: SiteMutationCounters,
  bucket: FailureBucket | 'successful_clear'
): boolean {
  const ceiling = bucket === 'successful_clear' ? 6 : 10;
  const counter = bucket === 'successful_clear' ? 'successfulClears' : bucket;
  if (counters[counter] >= ceiling) return false;
  if (bucket === 'overjump' || bucket === 'helper_overuse') {
    const before = Math.max(counters.overjump, counters.helper_overuse);
    const after = Math.max(
      before,
      counters[bucket] + 1
    );
    // A forming brick tallies both buckets; a grown one shows only its count.
    return after > before || after < ARTIFACT_SPAWN_COUNT;
  }
  return true;
}

function causeLabel(
  bucket: FailureBucket | 'successful_clear',
  count: number
): string {
  const singular =
    bucket === 'short_jump'
      ? 'short jump'
      : bucket === 'overjump'
        ? 'overjump'
        : bucket === 'wall_bonk'
          ? 'wall bonk'
          : bucket === 'helper_overuse'
            ? 'helper slip'
            : 'clean clear';
  return count === 1 ? singular : `${singular}s`;
}
