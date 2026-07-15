import { context, requestExpandedMode } from '@devvit/web/client';
import { useEffect, useState } from 'react';
import type { InitGameResponse } from '../shared/api.js';
import type { GameSnapshot } from '../shared/game/mutation.js';
import { splashSnapshotCopy } from './splashSnapshot.js';

export function Splash() {
  const username = context?.username;
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const copy = splashSnapshotCopy(snapshot);

  useEffect(() => {
    const controller = new AbortController();

    void fetch('/api/init-game', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Init failed with ${response.status}`);
        return (await response.json()) as InitGameResponse;
      })
      .then((response) => setSnapshot(response.snapshot))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Unable to load shared tower snapshot.', error);
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="splash-shell">
      <header className="splash-masthead">
        <p className="eyebrow">
          <span className="hanko" aria-hidden="true">
            登
          </span>
          Fallstack
        </p>
        <span className="splash-day-seal">
          Daily tower ·{' '}
          {snapshot
            ? `${snapshot.seededFalls} opening · ${snapshot.organicFalls} community`
            : 'loading'}
        </span>
      </header>

      <section className="splash-tower" aria-label="Today's community-shaped opening climb">
        <div className="splash-arch" aria-hidden="true" />
        <div className="splash-ledge splash-ledge-one" aria-hidden="true" />
        <div className="splash-ledge splash-ledge-two" aria-hidden="true" />
        <div className="splash-ledge splash-ledge-three" aria-hidden="true" />
        <div className="splash-corpse-stack" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="artifact-label">{copy.artifactLabel}</div>
        <div className="splash-climber" aria-hidden="true" />
      </section>

      <section className="splash-copy">
        <p className="splash-kicker">{copy.scopeLabel}</p>
        <h1>{copy.headline}</h1>
        <p>{copy.detail}</p>
        <button
          type="button"
          className="splash-cta"
          onClick={(event) => requestExpandedMode(event.nativeEvent, 'game')}
        >
          Enter the reliquary
        </button>
        <span className="splash-user">
          {username ? `u/${username}` : 'anonymous climber'}
        </span>
      </section>
    </main>
  );
}
