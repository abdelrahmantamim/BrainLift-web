import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Helper to install a controllable matchMedia mock that tracks listeners
// so tests can simulate a `change` event firing.
function installMatchMediaMock(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners: Array<(e: { matches: boolean }) => void> = [];

  const mql = {
    get matches() {
      return matches;
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addListener: vi.fn((cb: (e: { matches: boolean }) => void) => listeners.push(cb)),
    removeListener: vi.fn(),
    addEventListener: vi.fn((_event: string, cb: (e: { matches: boolean }) => void) => {
      listeners.push(cb);
    }),
    removeEventListener: vi.fn((_event: string, cb: (e: { matches: boolean }) => void) => {
      const idx = listeners.indexOf(cb);
      if (idx >= 0) listeners.splice(idx, 1);
    }),
    dispatchEvent: vi.fn(),
  };

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation(() => mql),
  });

  return {
    simulateChange(newMatches: boolean) {
      matches = newMatches;
      listeners.forEach((cb) => cb({ matches: newMatches }));
    },
  };
}

describe('uiStore', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  it('(a) loads persisted legacy light/dark values unchanged', async () => {
    installMatchMediaMock(false);
    // Simulate a legacy persisted value written under the pre-migration shape.
    localStorage.setItem(
      'ui-storage-v2',
      JSON.stringify({ state: { theme: 'dark' }, version: 0 })
    );

    const { useUIStore } = await import('../uiStore');
    expect(useUIStore.getState().theme).toBe('dark');
    expect(useUIStore.getState().resolvedTheme).toBe('dark');
  });

  it('(a) loads persisted legacy light value unchanged', async () => {
    installMatchMediaMock(true);
    localStorage.setItem(
      'ui-storage-v2',
      JSON.stringify({ state: { theme: 'light' }, version: 0 })
    );

    const { useUIStore } = await import('../uiStore');
    expect(useUIStore.getState().theme).toBe('light');
    expect(useUIStore.getState().resolvedTheme).toBe('light');
  });

  it('(b) setTheme("system") with matchMedia mocked dark resolves to dark and applies class', async () => {
    installMatchMediaMock(true);
    const { useUIStore } = await import('../uiStore');

    useUIStore.getState().setTheme('system');

    expect(useUIStore.getState().theme).toBe('system');
    expect(useUIStore.getState().resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('(c) simulated matchMedia change event flips resolvedTheme while in system mode', async () => {
    const mock = installMatchMediaMock(false);
    const { useUIStore } = await import('../uiStore');

    useUIStore.getState().setTheme('system');
    expect(useUIStore.getState().resolvedTheme).toBe('light');

    const unsubscribe = useUIStore.getState().initSystemThemeListener();

    mock.simulateChange(true);

    expect(useUIStore.getState().resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    unsubscribe();
  });

  it('(c) does not flip resolvedTheme on change event when not in system mode', async () => {
    const mock = installMatchMediaMock(false);
    const { useUIStore } = await import('../uiStore');

    useUIStore.getState().setTheme('light');
    const unsubscribe = useUIStore.getState().initSystemThemeListener();

    mock.simulateChange(true);

    expect(useUIStore.getState().resolvedTheme).toBe('light');
    unsubscribe();
  });

  it('(d) defaults new users to system theme', async () => {
    installMatchMediaMock(false);
    // No persisted value at all.
    const { useUIStore } = await import('../uiStore');

    expect(useUIStore.getState().theme).toBe('system');
  });

  it('initSystemThemeListener returns an unsubscribe function', async () => {
    installMatchMediaMock(false);
    const { useUIStore } = await import('../uiStore');

    const unsubscribe = useUIStore.getState().initSystemThemeListener();
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });
});
