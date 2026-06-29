import "@testing-library/jest-dom";

// jsdom v4 + vitest 4 doesn't always expose localStorage.removeItem; install
// our own shim. Tests that need a fresh storage call clear() in beforeEach.
const memory: Record<string, string> = {};
const storageMock = {
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
});
