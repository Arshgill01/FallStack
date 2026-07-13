import { context, requestExpandedMode } from '@devvit/web/client';

export function Splash() {
  const username = context?.username;

  return (
    <main className="splash-shell">
      <header className="splash-masthead">
        <p className="eyebrow">
          <span className="hanko" aria-hidden="true">
            登
          </span>
          Fallstack
        </p>
        <span className="splash-day-seal">Daily tower · 37 falls</span>
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
        <div className="artifact-label">4 opening falls raised First Gap.</div>
        <div className="splash-climber" aria-hidden="true" />
      </section>

      <section className="splash-copy">
        <p className="splash-kicker">One community · one daily tower</p>
        <h1>The tower already remembers everyone who fell.</h1>
        <p>Use the foothold they left behind. Your fall may shape what comes next.</p>
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
