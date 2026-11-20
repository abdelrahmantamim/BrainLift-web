import axios from 'axios';
import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, TOKEN_KEY, USER_KEY } from '@/config/constants';
import { authService } from '@/services/auth.service';
import { isLimitReachedCode } from '@/utils/limitCodes';
import { trackEvent } from '@/utils/analytics';
import toast from 'react-hot-toast';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for session cookies
});

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add Authorization header with Bearer token from localStorage
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Session cookies will be sent automatically with withCredentials: true
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Token refresh state
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Handle 402 Payment Required (web paywall). The server enforces this for
    // free-tier users on web sessions. Refreshing the tier updates the auth
    // store, and ProtectedRoute (which wraps every app route) re-renders the
    // paywall in place — no hard navigation needed, so in-page state on the
    // current screen isn't discarded mid-session.
    if (error.response?.status === 402) {
      const data = error.response.data as { error?: { code?: string } };
      if (data?.error?.code === 'WEB_PAID_ONLY') {
        try {
          const { useAuthStore } = await import('@/store/authStore');
          await useAuthStore.getState().refreshTier();
        } catch {
          /* noop */
        }
        // Don't toast — the paywall screen explains it.
        return Promise.reject(error);
      }
    }

    // Handle 429 Too Many Requests for per-feature usage limits (quiz/flashcard/
    // file_upload/chat). The body carries error.code (one of the LIMIT_CODES in
    // limitCodes.ts) plus { tier, limit, usage, featureType, period }. Track the
    // hit, open the LimitReachedModal, and reject — the generic toast block
    // below is suppressed for this case so we don't double-toast.
    if (error.response?.status === 429) {
      const data = error.response.data as {
        error?: { code?: string; featureType?: string; usage?: number; limit?: number; period?: string };
      };
      const code = data?.error?.code;
      if (isLimitReachedCode(code)) {
        const { featureType, usage, limit, period } = data.error || {};
        trackEvent('limit_hit', {
          limitType: featureType,
          currentUsage: usage,
          limit,
          source: 'server_429',
        });
        try {
          const { useLimitModalStore } = await import('@/store/limitModalStore');
          useLimitModalStore.getState().open({
            limitType: featureType || 'unknown',
            used: usage ?? 0,
            total: limit ?? 0,
            period,
            placement: 'server_429',
          });
        } catch {
          /* noop */
        }
        // Don't toast — the modal explains it.
        return Promise.reject(error);
      }
    }

    // Handle 401 errors - session expired
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't attempt refresh for auth-related endpoints
      const skipRefreshUrls = [
        '/auth/session',
        '/auth/get-session',
        '/auth/sign-in',
        '/auth/sign-up',
        '/auth/session/extend-session',
      ];
      if (skipRefreshUrls.some((url) => originalRequest.url?.includes(url))) {
        return Promise.reject(error);
      }

      // Check if we're already on auth pages
      const authPaths = ['/login', '/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/'];
      if (authPaths.some(path => window.location.pathname === path || window.location.pathname.startsWith('/share/'))) {
        return Promise.reject(error);
      }

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (token) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return api(originalRequest);
        }).catch((err) => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await authService.refreshSession();

        if (newToken) {
          // Refresh succeeded - retry original request and process queue
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          processQueue(null, newToken);
          return api(originalRequest);
        } else {
          // Refresh failed - clear auth and redirect
          processQueue(error);
          localStorage.removeItem(USER_KEY);
          localStorage.removeItem(TOKEN_KEY);
          window.location.href = '/auth/login';
          return Promise.reject(error);
        }
      } catch (refreshError) {
        processQueue(refreshError);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = '/auth/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle 503 Service Unavailable (transient identity-mapping DB errors in
    // syncUser middleware). Bounded retry: up to 2 retries (3 attempts total)
    // with 500ms then 1500ms delays, tracked via _retryCount503 on the request
    // config. Retries go through the same `api` instance so a retried response
    // still passes through these interceptors. On final failure, toast the
    // copy here and reject — the generic toast block below must not also fire
    // for this status, so no double-toast.
    if (error.response?.status === 503) {
      const cfg = originalRequest as InternalAxiosRequestConfig & {
        _retry?: boolean;
        _retryCount503?: number;
      };
      cfg._retryCount503 = (cfg._retryCount503 ?? 0) + 1;
      if (cfg._retryCount503 <= 2) {
        await new Promise((resolve) => setTimeout(resolve, cfg._retryCount503 === 1 ? 500 : 1500));
        return api(cfg);
      }
      toast.error('Temporary server issue — please try again in a moment.');
      return Promise.reject(error);
    }

    // Handle other errors
    if (error.response) {
      const errorData = error.response.data as { message?: string; error?: { message?: string } };
      const message = errorData?.message ||
                     errorData?.error?.message ||
                     'An error occurred';

      // Don't show toast for validation errors (handled by forms), session
      // checks, paywall blocks (handled by paywall screen + redirect), or
      // 429s with a recognized limit code (handled above by the
      // LimitReachedModal — already returned early, but guarded here too so
      // this block never double-toasts if the branch order ever changes).
      const is429WithLimitCode =
        error.response.status === 429 &&
        isLimitReachedCode((errorData?.error as { code?: string } | undefined)?.code);

      // Don't toast for a duplicate content report — ReportContentModal
      // renders its own friendly "Already reported" state instead of an
      // error toast (server returns 400 for a repeat report by the same user).
      const isDuplicateReport =
        error.response.status === 400 &&
        originalRequest.url?.includes('/share/report-content');

      if (
        error.response.status !== 422 &&
        error.response.status !== 402 &&
        error.response.status !== 503 &&
        !is429WithLimitCode &&
        !isDuplicateReport &&
        !originalRequest.url?.includes('/auth/session') &&
        !originalRequest.url?.includes('/auth/get-session')
      ) {
        toast.error(message);
      }
    } else if (error.request) {
      // Only show network error if not a session check
      if (!originalRequest.url?.includes('/auth/session') && !originalRequest.url?.includes('/auth/get-session')) {
        toast.error('Network error. Please check your connection.');
      }
    }

    return Promise.reject(error);
  }
);

export default api;
