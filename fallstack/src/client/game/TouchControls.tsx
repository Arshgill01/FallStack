import {
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
} from 'react';
import { resetSharedInput, setSharedInput, type InputState } from './input';

type TouchControlsProps = {
  disabled: boolean;
  charge: number;
};

export function TouchControls({ disabled, charge }: TouchControlsProps) {
  useEffect(() => {
    if (!disabled) return;
    resetSharedInput();
  }, [disabled]);

  const set = (key: keyof InputState, value: boolean) => {
    if (disabled) return;
    setSharedInput(key, value);
  };

  const bind = (key: keyof InputState) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      set(key, true);
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      set(key, false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    onPointerCancel: () => set(key, false),
    onLostPointerCapture: () => set(key, false),
    onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      set(key, true);
    },
    onKeyUp: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      set(key, false);
    },
  });

  return (
    <nav className="touch-controls" aria-label="Climb controls">
      <button
        type="button"
        className="ctrl-btn"
        aria-label="Move left"
        disabled={disabled}
        {...bind('left')}
      >
        ◀
      </button>
      <button
        type="button"
        className="jump-btn"
        aria-label="Hold to charge jump"
        disabled={disabled}
        {...bind('jump')}
      >
        <span
          className="jump-charge-fill"
          style={{ transform: `scaleX(${charge / 100})` }}
        />
        <span className="jump-btn-label">Hold · Space</span>
      </button>
      <button
        type="button"
        className="ctrl-btn"
        aria-label="Move right"
        disabled={disabled}
        {...bind('right')}
      >
        ▶
      </button>
    </nav>
  );
}
