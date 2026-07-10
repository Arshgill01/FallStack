import { context, requestExpandedMode } from '@devvit/web/client';

export function Splash() {
  const username = context?.username;

  return (
    <main className="splash-shell">
      <section className="splash-tower" aria-hidden="true">
        <div className="splash-artifact artifact-a" />
        <div className="splash-artifact artifact-b" />
        <div className="splash-artifact artifact-c" />
        <div className="artifact-label">14 falls made this foothold.</div>
      </section>

      <section className="splash-copy">
        <p className="eyebrow">
          <span className="hanko" aria-hidden="true">
            登
          </span>
          Fallstack
        </p>
        <h1>Today's tower has 37 failed climbs in it.</h1>
        <p>14 falls shaped the first foothold. Add yours carefully.</p>
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
