import { Audio, Video } from '@remotion/media';
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import { FPS } from './Root';
import { SOURCE_STARTS } from './timings.generated';

type Shot = {
  duration: number;
  sourceStart: number;
  scale: [number, number];
  x: [number, number];
  y: [number, number];
  entrance: 'none' | 'cut' | 'whip-left' | 'whip-right' | 'lift' | 'punch';
  label: string;
};

const SHOTS: Shot[] = [
  { duration: 3.2, sourceStart: SOURCE_STARTS[0], scale: [1.08, 1.22], x: [0, -34], y: [18, -24], entrance: 'none', label: 'Opening board' },
  { duration: 2.8, sourceStart: SOURCE_STARTS[1], scale: [1.24, 1.1], x: [42, -12], y: [-22, 8], entrance: 'whip-left', label: 'Opening climb' },
  { duration: 3, sourceStart: SOURCE_STARTS[2], scale: [1.1, 1.17], x: [-24, 26], y: [15, -16], entrance: 'lift', label: 'First boundary' },
  { duration: 3, sourceStart: SOURCE_STARTS[3], scale: [1.28, 1.11], x: [54, -20], y: [-28, 10], entrance: 'whip-right', label: 'Same route' },
  { duration: 3.5, sourceStart: SOURCE_STARTS[4], scale: [1.1, 1.32], x: [0, -24], y: [20, -28], entrance: 'punch', label: 'Real fall and recovery' },
  { duration: 3.5, sourceStart: SOURCE_STARTS[5], scale: [1.26, 1.1], x: [-46, 18], y: [-28, 12], entrance: 'cut', label: 'Persisted marks' },
  { duration: 3, sourceStart: SOURCE_STARTS[6], scale: [1.09, 1.24], x: [28, -32], y: [14, -24], entrance: 'lift', label: 'Shared route change' },
  { duration: 4, sourceStart: SOURCE_STARTS[7], scale: [1.26, 1.1], x: [46, -18], y: [-30, 14], entrance: 'whip-left', label: 'Artifact climb' },
  { duration: 3.5, sourceStart: SOURCE_STARTS[8], scale: [1.1, 1.25], x: [-34, 32], y: [16, -26], entrance: 'punch', label: 'Next player route' },
  { duration: 4.5, sourceStart: SOURCE_STARTS[9], scale: [1.26, 1.08], x: [44, -34], y: [-28, 14], entrance: 'cut', label: 'Community consequence' },
  { duration: 4, sourceStart: SOURCE_STARTS[10], scale: [1.09, 1.23], x: [-30, 38], y: [16, -24], entrance: 'whip-right', label: 'Clean clear' },
  { duration: 4, sourceStart: SOURCE_STARTS[11], scale: [1.25, 1.09], x: [40, -28], y: [-26, 14], entrance: 'lift', label: 'Stabilized climb' },
  { duration: 2.3, sourceStart: SOURCE_STARTS[12], scale: [1.12, 1.22], x: [-22, 20], y: [12, -16], entrance: 'whip-left', label: 'Lower Ruins theme' },
  { duration: 2.3, sourceStart: SOURCE_STARTS[13], scale: [1.24, 1.12], x: [34, -18], y: [-20, 10], entrance: 'whip-right', label: 'Bell Shaft theme' },
  { duration: 2.4, sourceStart: SOURCE_STARTS[14], scale: [1.11, 1.26], x: [-26, 24], y: [14, -24], entrance: 'punch', label: 'Moon Roof theme' },
  { duration: 2.5, sourceStart: SOURCE_STARTS[15], scale: [1.23, 1.1], x: [32, -18], y: [-22, 12], entrance: 'lift', label: 'Tower memory climb' },
  { duration: 2.5, sourceStart: SOURCE_STARTS[16], scale: [1.1, 1.25], x: [-18, 18], y: [12, -22], entrance: 'punch', label: 'Summit leap' },
];

const SUBTITLES = [
  { from: 0, duration: 6, kicker: 'DAILY COMMUNITY CLIMBER', lines: ['ONE SUBREDDIT.', 'ONE DAILY TOWER.'] },
  { from: 6, duration: 6, kicker: 'SAME BOARD', lines: ['EVERYONE CLIMBS', 'THE SAME GENERATED ROUTE.'] },
  { from: 12, duration: 7, kicker: 'FAILURE PERSISTS', lines: ['MISS A JUMP?', 'YOUR FALL STAYS.'] },
  { from: 19, duration: 7, kicker: 'SHARED MUTATION', lines: ['FALLS BECOME FOOTHOLDS.', 'GHOSTS. CURSES.'] },
  { from: 26, duration: 8, kicker: 'COMMUNITY CONSEQUENCE', lines: ['THE NEXT PLAYER CLIMBS', 'WHAT EVERYONE CHANGED.'] },
  { from: 34, duration: 8, kicker: 'SKILL REPAIRS THE DAMAGE', lines: ['CLEAN CLEARS STABILIZE', 'THE ROUTE FOR EVERYONE.'] },
  { from: 42, duration: 7, kicker: 'DAILY VARIETY', lines: ['THREE THEMES.', 'A NEW FINITE TOWER EVERY DAY.'] },
  { from: 49, duration: 5, kicker: 'TOWER MEMORY', lines: ['THE DAMAGE BECOMES', 'THE DAY’S STORY.'] },
] as const;

export const FallstackPitch = () => {
  return (
    <AbsoluteFill className="composition">
      <FontFaces />
      <ShotTrack />
      <Grade />
      {SUBTITLES.map((subtitle) => (
        <Sequence
          key={subtitle.from}
          from={subtitle.from * FPS}
          durationInFrames={subtitle.duration * FPS}
        >
          <Subtitle
            kicker={subtitle.kicker}
            lines={subtitle.lines}
            duration={subtitle.duration}
          />
        </Sequence>
      ))}
      <Sequence from={54 * FPS} durationInFrames={4 * FPS}>
        <FinalLockup />
      </Sequence>
      <TransitionAccents />
      <Audio
        src={staticFile('generated/fallstack-score.wav')}
        volume={(audioFrame) =>
          interpolate(audioFrame, [0, 30, 57 * FPS, 58 * FPS], [0, 0.92, 0.92, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        }
      />
    </AbsoluteFill>
  );
};

const ShotTrack = () => {
  let start = 0;
  return (
    <>
      {SHOTS.map((shot, index) => {
        const from = start;
        start += shot.duration * FPS;
        return (
          <Sequence key={shot.label} from={from} durationInFrames={shot.duration * FPS}>
            <GameplayShot shot={shot} />
          </Sequence>
        );
      })}
      <Sequence from={54 * FPS} durationInFrames={4 * FPS}>
        <SummitHold />
      </Sequence>
    </>
  );
};

const GameplayShot = ({ shot }: { shot: Shot }) => {
  const frame = useCurrentFrame();
  const durationInFrames = shot.duration * FPS;
  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const entrance = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const entranceX = shot.entrance === 'whip-left'
    ? mix(-170, 0, entrance)
    : shot.entrance === 'whip-right'
      ? mix(170, 0, entrance)
      : 0;
  const entranceY = shot.entrance === 'lift' ? mix(92, 0, entrance) : 0;
  const entranceScale = shot.entrance === 'punch' ? mix(0.13, 0, entrance) : 0;
  const entranceBlur = shot.entrance.startsWith('whip') ? mix(8, 0, entrance) : 0;
  const scale = mix(shot.scale[0], shot.scale[1], progress) + entranceScale;
  const x = mix(shot.x[0], shot.x[1], progress) + entranceX;
  const y = mix(shot.y[0], shot.y[1], progress) + entranceY;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#171426' }}>
      <Video
        src={staticFile('generated/gameplay.webm')}
        trimBefore={Math.round(shot.sourceStart * FPS)}
        objectFit="cover"
        muted
        name={shot.label}
        style={{
          width: '100%',
          height: '100%',
          transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
          filter: `saturate(1.08) contrast(1.06) brightness(0.98) blur(${entranceBlur}px)`,
          transformOrigin: '50% 50%',
        }}
      />
    </AbsoluteFill>
  );
};

const SummitHold = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 4 * FPS], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#171426' }}>
      <Img
        src={staticFile('generated/summit.png')}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${mix(1.04, 1.12, progress)}) translateY(${mix(0, -12, progress)}px)`,
          filter: 'saturate(1.04) contrast(1.08) brightness(0.72)',
        }}
      />
    </AbsoluteFill>
  );
};

const Subtitle = ({
  kicker,
  lines,
  duration,
}: {
  kicker: string;
  lines: readonly string[];
  duration: number;
}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 11], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const durationInFrames = duration * FPS;
  const opacity = interpolate(frame, [0, 6, durationInFrames - 18, durationInFrames - 1], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill className="subtitle-safe">
      <div
        className="subtitle"
        style={{
          opacity,
          transform: `translateY(${mix(32, 0, enter)}px) scale(${mix(0.96, 1, enter)})`,
        }}
      >
        <div className="subtitle-kicker">{kicker}</div>
        {lines.map((line) => (
          <div className="subtitle-line" key={line}>{line}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const FontFaces = () => (
  <style>{`
    @font-face {
      font-family: 'Shippori Mincho';
      src: url('${staticFile('generated/fonts/shippori-mincho-700.woff2')}') format('woff2');
      font-weight: 700;
    }
    @font-face {
      font-family: 'Zen Maru Gothic';
      src: url('${staticFile('generated/fonts/zen-maru-gothic-400.woff2')}') format('woff2');
      font-weight: 400;
    }
    @font-face {
      font-family: 'Zen Maru Gothic';
      src: url('${staticFile('generated/fonts/zen-maru-gothic-700.woff2')}') format('woff2');
      font-weight: 700;
    }
  `}</style>
);

const FinalLockup = () => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill className="final-lockup-safe">
      <div className="final-lockup" style={{ opacity: enter, transform: `scale(${mix(0.93, 1, enter)})` }}>
        <div className="hanko">登</div>
        <div className="final-title">FALLSTACK</div>
        <div className="final-rule" />
        <div className="final-tagline">THE LEVEL IS MADE OUT OF EVERYONE ELSE’S FAILURES.</div>
      </div>
    </AbsoluteFill>
  );
};

const Grade = () => (
  <AbsoluteFill className="grade" aria-hidden>
    <div className="vignette" />
    <div className="subtitle-bed" />
    <div className="frame-rule frame-rule-top" />
    <div className="frame-rule frame-rule-bottom" />
  </AbsoluteFill>
);

const TransitionAccents = () => (
  <>
    <Sequence from={12 * FPS} durationInFrames={12}>
      <FallPulse />
    </Sequence>
    <Sequence from={42 * FPS} durationInFrames={18}>
      <ThemeSweep />
    </Sequence>
    <Sequence from={54 * FPS} durationInFrames={14}>
      <FinalBloom />
    </Sequence>
  </>
);

const FallPulse = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 3, 11], [0, 0.22, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(circle at 50% 48%, transparent 12%, #7f2638 88%)',
        mixBlendMode: 'screen',
        opacity,
      }}
    />
  );
};

const ThemeSweep = () => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, 17], [-420, 2200], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div
        style={{
          width: 300,
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(241, 201, 95, 0.24), transparent)',
          mixBlendMode: 'screen',
          transform: `translateX(${x}px) skewX(-12deg)`,
        }}
      />
    </AbsoluteFill>
  );
};

const FinalBloom = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 3, 13], [0, 0.3, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(circle, rgba(241, 201, 95, 0.8), transparent 62%)',
        mixBlendMode: 'screen',
        opacity,
      }}
    />
  );
};

function mix(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}
