import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveTheme(theme: ThemeMode): ResolvedTheme {
  if (theme === 'system') {
    return getSystemPrefersDark() ? 'dark' : 'light';
  }
  return theme;
}

function applyResolvedTheme(resolvedTheme: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
}

interface UIState {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  sidebarCollapsed: boolean;

  // Actions
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  initSystemThemeListener: () => () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const CURRENT_PERSIST_VERSION = 1;

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      resolvedTheme: resolveTheme('system'),
      sidebarCollapsed: false,

      toggleTheme: () => {
        const { theme } = get();
        // Cycle: light -> dark -> system -> light
        const nextTheme: ThemeMode =
          theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
        get().setTheme(nextTheme);
      },

      setTheme: (theme) => {
        const resolvedTheme = resolveTheme(theme);
        applyResolvedTheme(resolvedTheme);
        set({ theme, resolvedTheme });
      },

      initSystemThemeListener: () => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
          return () => {};
        }

        const mql = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = (e: { matches: boolean }) => {
          if (get().theme !== 'system') return;
          const resolvedTheme: ResolvedTheme = e.matches ? 'dark' : 'light';
          applyResolvedTheme(resolvedTheme);
          set({ resolvedTheme });
        };

        if (typeof mql.addEventListener === 'function') {
          mql.addEventListener('change', handleChange);
          return () => mql.removeEventListener('change', handleChange);
        }

        // Fallback for older browsers/mocks using addListener/removeListener
        mql.addListener(handleChange);
        return () => mql.removeListener(handleChange);
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      setSidebarCollapsed: (collapsed) => {
        set({ sidebarCollapsed: collapsed });
      },
    }),
    {
      name: 'ui-storage-v2',
      version: CURRENT_PERSIST_VERSION,
      partialize: (state) => ({ theme: state.theme }),
      migrate: (persistedState) => {
        // Legacy state (version 0) only ever stored 'light' | 'dark'.
        // Those values are valid ThemeMode values, so pass them through
        // unchanged; new installs (no persisted state) get the 'system' default.
        const state = persistedState as { theme?: ThemeMode } | undefined;
        return { theme: state?.theme ?? 'system' };
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const resolvedTheme = resolveTheme(state.theme);
        state.resolvedTheme = resolvedTheme;
        applyResolvedTheme(resolvedTheme);
      },
    }
  )
);
