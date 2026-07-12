import type { ZoneId } from '../../shared/game/mutation';

export type Theme = {
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

export function themeForZone(zoneId: ZoneId): Theme {
  return THEMES[zoneId];
}

export function colorNumber(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}
