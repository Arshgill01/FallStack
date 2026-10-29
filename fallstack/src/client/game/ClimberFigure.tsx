import type { ClimberId } from '../../shared/game/climbers.js';

// Static portraits for the shell. In-game poses are drawn by renderClimbers.
export function ClimberFigure({
  climberId,
  size = 64,
}: {
  climberId: ClimberId;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 64 80"
      width={size}
      height={(size * 80) / 64}
      aria-hidden="true"
      className="climber-figure"
    >
      {climberId === 'pilgrim' ? (
        <>
          <path
            d="M32 8 C18 8 14 24 14 36 L10 70 H54 L50 36 C50 24 46 8 32 8Z"
            fill="#F3EBDD"
            stroke="#16111A"
            strokeWidth="3"
          />
          <path d="M24 30 H40 V36 H24Z" fill="#16111A" />
          <path d="M12 52 H52" stroke="#E95F45" strokeWidth="5" />
          <path d="M20 70 V76 M44 70 V76" stroke="#16111A" strokeWidth="4" />
        </>
      ) : climberId === 'wick' ? (
        <>
          <path
            d="M32 4 C26 12 26 18 32 22 C38 18 38 12 32 4Z"
            fill="#FF7A3D"
            stroke="#16111A"
            strokeWidth="2.5"
          />
          <rect
            x="20"
            y="22"
            width="24"
            height="46"
            rx="4"
            fill="#F6E7C8"
            stroke="#16111A"
            strokeWidth="3"
          />
          <path
            d="M20 30 q4 8 8 0 q4 10 8 0"
            fill="none"
            stroke="#16111A"
            strokeWidth="2"
          />
          <circle cx="28" cy="42" r="2.5" fill="#16111A" />
          <circle cx="37" cy="42" r="2.5" fill="#16111A" />
          <path d="M24 68 V76 M40 68 V76" stroke="#16111A" strokeWidth="4" />
        </>
      ) : climberId === 'kite' ? (
        <>
          <path
            d="M46 6 L60 22 L46 40 L34 22Z"
            fill="#8FA8FF"
            stroke="#16111A"
            strokeWidth="2.5"
          />
          <circle
            cx="28"
            cy="26"
            r="11"
            fill="#F3EBDD"
            stroke="#16111A"
            strokeWidth="3"
          />
          <circle cx="25" cy="26" r="2" fill="#16111A" />
          <circle cx="32" cy="26" r="2" fill="#16111A" />
          <path
            d="M16 40 H40 L42 68 H14Z"
            fill="#E95F45"
            stroke="#16111A"
            strokeWidth="3"
          />
          <path d="M18 38 H40" stroke="#16111A" strokeWidth="5" />
          <path d="M20 68 V76 M36 68 V76" stroke="#16111A" strokeWidth="4" />
        </>
      ) : (
        <>
          <circle
            cx="32"
            cy="26"
            r="18"
            fill="#E8C35A"
            stroke="#16111A"
            strokeWidth="3"
          />
          <circle
            cx="32"
            cy="26"
            r="9"
            fill="#2D6E8C"
            stroke="#16111A"
            strokeWidth="2.5"
          />
          <path
            d="M18 44 H46 L48 68 H16Z"
            fill="#6B4A1E"
            stroke="#16111A"
            strokeWidth="3"
          />
          <path
            d="M46 52 q12 0 10 12 q-2 10 -12 8"
            fill="none"
            stroke="#F3EBDD"
            strokeWidth="2.5"
          />
          <path d="M22 68 V76 M42 68 V76" stroke="#16111A" strokeWidth="5" />
        </>
      )}
    </svg>
  );
}
