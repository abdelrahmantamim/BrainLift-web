import { create } from 'zustand';
import { authService } from '@/services/auth.service';
import type { LoginCredentials, RegisterData, User } from '@/services/auth.service';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { notificationService } from '@/services/notification.service';

export type SubscriptionTier = 'free' | 'premium' | 'ultra' | null;

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isCheckingAuth: boolean;
  tier: SubscriptionTier;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  refreshTier: () => Promise<SubscriptionTier>;
}

async function fetchTier(): Promise<SubscriptionTier> {
  try {
    const res = await api.get('/user/subscription');
    const tier = (res.data?.tier as SubscriptionTier) || 'free';
    return tier;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: authService.getCurrentUser(),
  token: authService.getToken(),
  isAuthenticated: !!authService.getCurrentUser() && !!authService.getToken(),
  isLoading: false,
  isCheckingAuth: true,
  tier: null,

  login: async (credentials) => {
    set({ isLoading: true });
    try {
      const response = await authService.login(credentials);
      const token = authService.getToken();
      set({ user: response.user, token, isAuthenticated: true });
      notificationService.init();
      toast.success('Welcome back!');

      // Refresh tier after login (does not block UI; preserves last known
      // tier on transient failure)
      void get().refreshTier();
    } catch (error: unknown) {
      const errorData = error as { message?: string };
      const message = errorData.message || 'Login failed';
      toast.error(message);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      const response = await authService.register(data);
      const token = authService.getToken();
      set({ user: response.user, token, isAuthenticated: true });
      notificationService.init();
      toast.success('Account created successfully!');

      void get().refreshTier();
    } catch (error: unknown) {
      const errorData = error as { message?: string };
      const message = errorData.message || 'Registration failed';
      toast.error(message);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
      set({ user: null, token: null, isAuthenticated: false, tier: null });
    } finally {
      set({ isLoading: false });
    }
  },

  checkAuth: async () => {
    set({ isCheckingAuth: true });
    try {
      const user = authService.getCurrentUser();
      const token = authService.getToken();

      if (user && token) {
        // Verify session is still valid
        const session = await authService.getSession();

        if (session && session.user) {
          set({
            user: session.user,
            token: token,
            isAuthenticated: true,
            isCheckingAuth: false
          });
          notificationService.init();

          // Refresh tier in background
          void get().refreshTier();
        } else {
          set({ user: null, token: null, isAuthenticated: false, isCheckingAuth: false, tier: null });
        }
      } else {
        set({ user: null, token: null, isAuthenticated: false, isCheckingAuth: false, tier: null });
      }
    } catch (error) {
      console.error('checkAuth error:', error);
      set({ user: null, token: null, isAuthenticated: false, isCheckingAuth: false, tier: null });
    }
  },

  refreshTier: async () => {
    if (!get().isAuthenticated) return get().tier;
    const fetched = await fetchTier();
    // A genuine tier (incl. 'free') is non-null and is written. On a transient
    // error fetchTier returns null — preserve the last known-good tier rather
    // than forcing a paying user to the paywall.
    if (fetched !== null) {
      set({ tier: fetched });
      return fetched;
    }
    return get().tier;
  },

  updateProfile: async (updates) => {
    // Persist to server first
    try {
      await api.put('/user/profile', {
        name: updates.name,
        studentType: updates.student_type || updates.studentType,
      });
    } catch (error) {
      console.error('Failed to update profile on server:', error);
      toast.error('Failed to save profile changes');
      throw error;
    }

    // Then update local state
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null
    }));

    // Update localStorage
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      const updatedUser = { ...currentUser, ...updates };
      localStorage.setItem('user_data', JSON.stringify(updatedUser));
    }
  },
}));
