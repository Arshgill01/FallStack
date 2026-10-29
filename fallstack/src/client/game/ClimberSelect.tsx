import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  CLIMBER_IDS,
  CLIMBERS,
  type ClimberId,
} from '../../shared/game/climbers.js';
import { POWER_UPS } from '../../shared/game/powerups.js';
import { ClimberFigure } from './ClimberFigure';

export function ClimberSelect({
  current,
  firstVisit,
  onConfirm,
  onClose,
}: {
  current: ClimberId;
  firstVisit: boolean;
  onConfirm: (climberId: ClimberId) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<ClimberId>(current);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const climber = CLIMBERS[picked];

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="result-backdrop climber-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="climber-select-title"
    >
      <div
        className="climber-card"
        style={
          {
            '--climber-accent': climber.css.accent,
            '--climber-stage': climber.css.stage,
          } as CSSProperties
        }
      >
        <header className="climber-header">
          <p className="climber-kicker">
            {firstVisit ? "Today's tower" : 'Switch climber'}
          </p>
          <button
            type="button"
            className="climber-close"
            aria-label="Close climber select"
            onClick={onClose}
          >
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
              <path
                d="M4 4 L16 16 M16 4 L4 16"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        <h2 id="climber-select-title" className="climber-title">
          Pick your climber
        </h2>

        <section className="climber-stage" aria-live="polite">
          <div className="climber-stage-copy">
            <strong>{climber.name}</strong>
            <span>{climber.perk}</span>
            <small>{climber.tagline}</small>
          </div>
          <div className="climber-stage-figure">
            <ClimberFigure climberId={picked} size={92} />
            <span className="climber-stage-ledge" aria-hidden="true" />
          </div>
        </section>

        <div className="climber-grid" role="radiogroup" aria-label="Climbers">
          {CLIMBER_IDS.map((id) => {
            const option = CLIMBERS[id];
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={picked === id}
                className="climber-option"
                style={{ '--option-accent': option.css.accent } as CSSProperties}
                onClick={() => setPicked(id)}
              >
                <ClimberFigure climberId={id} size={30} />
                <span>
                  <b>{option.name}</b>
                  <small>{option.perkShort}</small>
                </span>
              </button>
            );
          })}
        </div>

        <p className="climber-note">
          Everyone jumps the same. Your climber only changes how much you get
          out of {POWER_UPS[climber.affinity].name}.
        </p>

        <button
          ref={confirmRef}
          type="button"
          className="climber-confirm"
          onClick={() => onConfirm(picked)}
        >
          Climb as {climber.name}
        </button>
      </div>
    </div>
  );
}
