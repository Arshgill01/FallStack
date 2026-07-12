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
      <section className="splash-tower" aria-hidden="true">
        <div className="splash-artifact artifact-a" />
        <div className="splash-artifact artifact-b" />
        <div className="splash-artifact artifact-c" />
        <div className="artifact-label">{copy.artifactLabel}</div>
      </section>

      <section className="splash-copy">
        <p className="eyebrow">
          <span className="hanko" aria-hidden="true">
            登
          </span>
          Fallstack
        </p>
        <h1>{copy.headline}</h1>
        <p>{copy.detail}</p>
        <button
          type="button"
          className="splash-cta"
          onClick={(event) => requestExpandedMode(event.nativeEvent, 'game')}
        >
          Climb today's tower
        </button>
        <span className="splash-user">
          {username ? `u/${username}` : 'anonymous climber'}
        </span>
      </section>
    </main>
  );
}
