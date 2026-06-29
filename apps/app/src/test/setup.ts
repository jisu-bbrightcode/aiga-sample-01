import "@testing-library/jest-dom";

// jsdom v4 + vitest 4 doesn't always expose localStorage.removeItem; install
// our own shim so settings tests (useTextSize, ColorMode persistence) can use
// the standard Storage API without surprise.
const memory: Record<string, string> = {};
const storageMock: Storage = {
  getItem: (k: string) => memory[k] ?? null,
  setItem: (k: string, v: string) => {
    memory[k] = String(v);
  },
  removeItem: (k: string) => {
    delete memory[k];
  },
  clear: () => {
    for (const k of Object.keys(memory)) delete memory[k];
  },
  key: (i: number) => Object.keys(memory)[i] ?? null,
  get length() {
    return Object.keys(memory).length;
  },
};
Object.defineProperty(window, "localStorage", {
  value: storageMock,
  writable: true,
  configurable: true,
});

class ResizeObserverMock implements ResizeObserver {
  observe() {
    // jsdom test shim: layout observation is not needed.
  }
  unobserve() {
    // jsdom test shim: layout observation is not needed.
  }
  disconnect() {
    // jsdom test shim: layout observation is not needed.
  }
}

Object.defineProperty(window, "ResizeObserver", {
  value: ResizeObserverMock,
  writable: true,
  configurable: true,
});

globalThis.ResizeObserver = ResizeObserverMock;

Object.defineProperty(globalThis, "matchMedia", {
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
  writable: true,
  configurable: true,
});

Object.defineProperty(navigator, "mediaDevices", {
  value: {
    enumerateDevices: () => Promise.resolve([]),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    getUserMedia: () => Promise.reject(new Error("not available in jsdom")),
  },
  writable: true,
  configurable: true,
});

const mediaTrackListMock = {
  length: 0,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
  [Symbol.iterator]: function* iterator() {
    // jsdom media track list shim.
  },
};

Object.defineProperty(HTMLMediaElement.prototype, "textTracks", {
  value: mediaTrackListMock,
  configurable: true,
});

Object.defineProperty(HTMLMediaElement.prototype, "audioTracks", {
  value: mediaTrackListMock,
  configurable: true,
});

Object.defineProperty(HTMLMediaElement.prototype, "videoTracks", {
  value: mediaTrackListMock,
  configurable: true,
});

Element.prototype.scrollIntoView = function scrollIntoViewMock() {
  // jsdom test shim: cmdk only needs the method to exist.
};

Element.prototype.getAnimations = function getAnimationsMock() {
  return [];
};
