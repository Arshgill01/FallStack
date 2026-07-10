export type InputState = {
  left: boolean;
  right: boolean;
  jump: boolean;
};

export const INITIAL_INPUT: InputState = {
  left: false,
  right: false,
  jump: false,
};

export function resetSharedInput() {
  window.fallstackInput = { ...INITIAL_INPUT };
}

export function setSharedInput(key: keyof InputState, value: boolean) {
  window.fallstackInput = {
    ...(window.fallstackInput ?? INITIAL_INPUT),
    [key]: value,
  };
}
