(() => {
  const NativeAudioContext = window.AudioContext ?? window.webkitAudioContext;
  if (!NativeAudioContext) return;

  const probe = {
    contexts: [],
    resumeCalls: 0,
    oscillatorStarts: 0,
    oscillatorStops: 0,
  };

  class TrackedAudioContext extends NativeAudioContext {
    constructor(...args) {
      super(...args);
      probe.contexts.push(this);
    }

    resume(...args) {
      probe.resumeCalls += 1;
      return super.resume(...args);
    }

    createOscillator(...args) {
      const oscillator = super.createOscillator(...args);
      const nativeStart = oscillator.start.bind(oscillator);
      const nativeStop = oscillator.stop.bind(oscillator);
      oscillator.start = (...startArgs) => {
        probe.oscillatorStarts += 1;
        return nativeStart(...startArgs);
      };
      oscillator.stop = (...stopArgs) => {
        probe.oscillatorStops += 1;
        return nativeStop(...stopArgs);
      };
      return oscillator;
    }
  }

  window.AudioContext = TrackedAudioContext;
  window.webkitAudioContext = TrackedAudioContext;
  window.__fallstackAudioProbe = probe;
})();
