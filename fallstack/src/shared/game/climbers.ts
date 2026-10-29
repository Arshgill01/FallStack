import type { PowerUpKind } from './powerups.js';

// Climbers change silhouette and which pickup they get more out of. Movement
// stays global so every climber's falls feed the shared board identically.
export const CLIMBER_IDS = ['pilgrim', 'wick', 'kite', 'diver'] as const;

export type ClimberId = (typeof CLIMBER_IDS)[number];

export const DEFAULT_CLIMBER_ID: ClimberId = 'pilgrim';

export type ClimberDefinition = {
  id: ClimberId;
  name: string;
  tagline: string;
  affinity: PowerUpKind;
  perk: string;
  perkShort: string;
  css: { accent: string; stage: string };
};

export const CLIMBERS: Record<ClimberId, ClimberDefinition> = {
  pilgrim: {
    id: 'pilgrim',
    name: 'Pilgrim',
    tagline: 'The original hooded archivist.',
    affinity: 'second_wind',
    perk: 'Holds two Second Winds',
    perkShort: '2× Second Wind',
    css: { accent: '#FF8A70', stage: '#2A1410' },
  },
  wick: {
    id: 'wick',
    name: 'Wick',
    tagline: 'A candle courier. The flame grows as you charge.',
    affinity: 'spark',
    perk: 'Spark burns 60% longer',
    perkShort: 'Spark +60%',
    css: { accent: '#FFB36B', stage: '#3A1A0E' },
  },
  kite: {
    id: 'kite',
    name: 'Kite',
    tagline: 'A small flyer with a paper kite on their back.',
    affinity: 'updraft',
    perk: 'Updraft glides 60% longer',
    perkShort: 'Updraft +60%',
    css: { accent: '#A9BCFF', stage: '#161B36' },
  },
  diver: {
    id: 'diver',
    name: 'Diver',
    tagline: 'Brass bell helmet, a spool of line at the hip.',
    affinity: 'thread',
    perk: 'Holds two Safety Threads',
    perkShort: '2× Safety Thread',
    css: { accent: '#E8C35A', stage: '#160D22' },
  },
};

export function parseClimberId(value: unknown): ClimberId | null {
  return typeof value === 'string' &&
    (CLIMBER_IDS as readonly string[]).includes(value)
    ? (value as ClimberId)
    : null;
}
