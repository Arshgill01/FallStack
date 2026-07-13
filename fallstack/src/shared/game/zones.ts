export const ZONE_IDS = [
  'orbital_scrapyard',
  'crater_foundry',
  'comet_reef',
  'nebula_vault',
  'ring_citadel',
  'dwarf_garden',
  'pulsar_spine',
  'neutron_forge',
  'black_hole_chapel',
  'galaxy_reef',
  'dying_star_garden',
  'event_horizon_crown',
] as const;

export type ZoneId = (typeof ZONE_IDS)[number];

export const BOTTOM_ZONE_ID: ZoneId = ZONE_IDS[0];
export const TOP_ZONE_ID: ZoneId = ZONE_IDS[ZONE_IDS.length - 1]!;
export const ZONE_HEIGHT = 6000;

export const ZONE_NAMES: Record<ZoneId, string> = {
  orbital_scrapyard: 'Lower Ruins',
  crater_foundry: 'Broken Arcade',
  comet_reef: 'Washi Arch',
  nebula_vault: 'Root Vault',
  ring_citadel: 'Bell Mouth',
  dwarf_garden: 'Rope Gallery',
  pulsar_spine: 'Bell Spine',
  neutron_forge: 'Bound Landing',
  black_hole_chapel: 'Moon Chapel',
  galaxy_reef: 'Pale Eaves',
  dying_star_garden: 'Roof Garden',
  event_horizon_crown: 'Moon Crown',
};
