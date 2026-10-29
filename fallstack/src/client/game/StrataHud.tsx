import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BIOME_IDS, biomeForZone } from '../../shared/game/biomes.js';
import {
  POWER_UPS,
  type LoadoutChip,
  type PowerUpKind,
} from '../../shared/game/powerups.js';
import type { ZoneId } from '../../shared/game/zones.js';
import {
  altimeterFor,
  zoneNumber,
  type GustEventDetail,
  type LoadoutEventDetail,
  type PickupEventDetail,
  type StrataMomentDetail,
} from './strata-ui';

type Toast = { id: number; tone: PowerUpKind; title: string; sub: string };
type Entry = { id: number; zoneId: ZoneId };

const TOAST_MS = 1700;
const ENTRY_MS = 2600;

// The strata HUD subscribes to scene events directly so ticking timers only
// re-render this component, never the whole game shell.
export function StrataHud({ zoneId }: { zoneId: ZoneId }) {
  const [chips, setChips] = useState<LoadoutChip[]>([]);
  const [gust, setGust] = useState<GustEventDetail>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [entry, setEntry] = useState<Entry | null>(null);
  const toastSeq = useRef(0);
  const highestBiome = useRef(biomeForZone(zoneId).ordinal);

  useEffect(() => {
    const showToast = (next: Omit<Toast, 'id'>) =>
      setToast({ ...next, id: ++toastSeq.current });
    const onLoadout = (event: Event) =>
      setChips((event as CustomEvent<LoadoutEventDetail>).detail.chips);
    const onGust = (event: Event) =>
      setGust((event as CustomEvent<GustEventDetail>).detail);
    const onPickup = (event: Event) => {
      const kind = (event as CustomEvent<PickupEventDetail>).detail.kind;
      showToast({ tone: kind, title: `+ ${POWER_UPS[kind].name}`, sub: POWER_UPS[kind].hint });
    };
    const onMoment = (event: Event) => {
      const kind = (event as CustomEvent<StrataMomentDetail>).detail.kind;
      if (kind === 'thread')
        showToast({
          tone: 'thread',
          title: 'Thread caught you',
          sub: 'Reeled back to your last ledge. No fall recorded.',
        });
      else if (kind === 'spring')
        showToast({ tone: 'second_wind', title: 'Sprung', sub: 'Hold Jump on touchdown to plant.' });
    };
    window.addEventListener('fallstack:loadout', onLoadout);
    window.addEventListener('fallstack:gust', onGust);
    window.addEventListener('fallstack:pickup', onPickup);
    window.addEventListener('fallstack:strata-moment', onMoment);
    return () => {
      window.removeEventListener('fallstack:loadout', onLoadout);
      window.removeEventListener('fallstack:gust', onGust);
      window.removeEventListener('fallstack:pickup', onPickup);
      window.removeEventListener('fallstack:strata-moment', onMoment);
    };
  }, []);

  // Announce a biome only the first time the climber reaches it this session.
  useEffect(() => {
    const ordinal = biomeForZone(zoneId).ordinal;
    if (ordinal <= highestBiome.current) return;
    highestBiome.current = ordinal;
    setEntry({ id: Date.now(), zoneId });
  }, [zoneId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!entry) return;
    const timer = window.setTimeout(() => setEntry(null), ENTRY_MS);
    return () => window.clearTimeout(timer);
  }, [entry]);

  const biome = biomeForZone(zoneId);
  const altimeter = altimeterFor(zoneId);
  const entryBiome = entry ? biomeForZone(entry.zoneId) : null;

  return (
    <>
      <div
        className="strata-altimeter"
        role="img"
        aria-label={`${biome.name}, zone ${zoneNumber(zoneId)} of 12`}
      >
        {altimeter.bands.map((band) => (
          <span
            key={band.biomeId}
            className={band.current ? 'current' : undefined}
            style={{ flexGrow: band.zones, background: band.accent }}
          />
        ))}
        <i
          className="strata-altimeter-marker"
          style={{ top: `${altimeter.markerFromTop * 100}%` }}
        />
      </div>

      {gust ? (
        <div
          className={`strata-gust phase-${gust.phase}`}
          role="status"
          aria-label={`${gust.phase === 'gust' ? 'Gust' : 'Gust incoming'} blowing ${gust.direction > 0 ? 'right' : 'left'}`}
        >
          <span>{gust.phase === 'gust' ? 'Gust' : gust.phase === 'warning' ? 'Gust in' : 'Calm'}</span>
          <svg
            viewBox="0 0 28 14"
            width="26"
            height="13"
            aria-hidden="true"
            style={{ transform: gust.direction < 0 ? 'scaleX(-1)' : undefined }}
          >
            <path
              d="M2 7 H24 M18 2 L25 7 L18 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      ) : null}

      {chips.length ? (
        <ul className="strata-loadout" aria-label="Power-ups">
          {chips.map((chip) => (
            <li
              key={chip.kind}
              className={`strata-chip kind-${chip.kind}`}
              style={{ '--chip-fill': POWER_UPS[chip.kind].css.fill, '--chip-fraction': chip.fraction } as CSSProperties}
            >
              <PowerUpIcon kind={chip.kind} />
              <span>
                <b>{chip.name}</b>
                <small>
                  {chip.timed ? `${(chip.value / 10).toFixed(1)} s` : `×${chip.value}`}
                </small>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {toast ? (
        <div
          key={toast.id}
          className="strata-toast"
          role="status"
          aria-live="polite"
          style={{ '--chip-fill': POWER_UPS[toast.tone].css.fill } as CSSProperties}
        >
          <PowerUpIcon kind={toast.tone} />
          <span>
            <b>{toast.title}</b>
            <small>{toast.sub}</small>
          </span>
        </div>
      ) : null}

      {entry && entryBiome ? (
        <div
          key={entry.id}
          className="strata-entry"
          role="status"
          aria-live="polite"
          style={{ '--entry-accent': entryBiome.css.accent, '--entry-ink': entryBiome.css.accentInk } as CSSProperties}
        >
          <span className="strata-entry-kicker">
            Stratum {entryBiome.ordinal} of {BIOME_IDS.length}
          </span>
          <strong>{entryBiome.name}</strong>
          <p>{entryBiome.rule}</p>
        </div>
      ) : null}
    </>
  );
}

export function PowerUpIcon({ kind }: { kind: PowerUpKind }) {
  return (
    <svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true" className="power-up-icon">
      <circle cx="20" cy="20" r="17" fill={POWER_UPS[kind].css.fill} stroke="#16111A" strokeWidth="3" />
      {kind === 'spark' ? (
        <path d="M22 8 L13 22 H20 L18 32 L27 18 H20Z" fill="#16111A" />
      ) : kind === 'updraft' ? (
        <path
          d="M12 22 L20 14 L28 22 M12 29 L20 21 L28 29"
          fill="none"
          stroke="#16111A"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : kind === 'second_wind' ? (
        <path
          d="M11 26 Q20 12 29 26 M14 31 Q20 22 26 31"
          fill="none"
          stroke="#16111A"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ) : (
        <>
          <rect x="13" y="12" width="14" height="16" rx="2" fill="none" stroke="#16111A" strokeWidth="3" />
          <path d="M13 17 H27 M13 23 H27" stroke="#16111A" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}
