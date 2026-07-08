import './index.css';

import { context, requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function Splash() {
  return (
    <main className="splash-shell">
      <section className="splash-tower" aria-hidden="true">
        <div className="splash-artifact artifact-a" />
        <div className="splash-artifact artifact-b" />
        <div className="splash-artifact artifact-c" />
      </section>
      <section className="splash-copy">
        <p className="eyebrow">Fallstack</p>
        <h1>Today's tower has 37 failed climbs in it.</h1>
        <p>14 falls made the first foothold. Add yours carefully.</p>
        <button type="button" onClick={(event) => requestExpandedMode(event.nativeEvent, 'game')}>
          Climb today's tower
        </button>
        <span>{context.username ? `u/${context.username}` : 'anonymous climber'}</span>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
