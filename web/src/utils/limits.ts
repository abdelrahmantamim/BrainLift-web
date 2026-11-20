import { useLimitModalStore } from '../store/limitModalStore';
import { trackEvent } from './analytics';
import api from '../services/api';

export type LimitType = 'chat' | 'file_upload' | 'flashcard' | 'quiz' | 'export' | 'chart';

export interface LimitInfo {
  limit: number;
  used: number;
  remaining: number;
  type: 'lifetime' | 'weekly' | 'daily' | 'cumulative';
}

export interface StructuredLimits {
  quiz: LimitInfo;
  flashcard: LimitInfo;
  file_upload: LimitInfo;
  chat: LimitInfo;
  export: LimitInfo;
  chart: LimitInfo;
  file_storage: LimitInfo;
  // Legacy compat — computed summary of quiz+flashcard+file_upload
  generations?: LimitInfo;
}

export interface ServerSubscriptionResponse {
  tier: string;
  expiresAt: string | null;
  limits: StructuredLimits;
}

// Cached server response
let cachedResponse: ServerSubscriptionResponse | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 30_000; // 30s

const LOCAL_STORAGE_KEY = 'server_subscription_cache';

/**
 * Persist cached response to localStorage for offline fallback.
 */
function persistCache() {
  if (cachedResponse) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cachedResponse));
    } catch {
      /* noop */
    }
  }
}

/**
 * Load cached response from localStorage.
 */
function loadCacheFromStorage(): ServerSubscriptionResponse | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* noop */
  }
  return null;
}

/**
 * The server has returned three historical shapes for /user/subscription
 * (new per-feature, legacy shared-generations pool, old flat numbers).
 * This loose type covers all of them; each branch below narrows to one.
 */
interface RawSubscriptionData {
  tier?: string;
  expiresAt?: string | null;
  limits?: Partial<StructuredLimits> & Record<string, LimitInfo | number | undefined>;
  usage?: {
    features?: Record<string, number>;
    fileStorageLimit?: number;
    totalFiles?: number;
  };
}

/**
 * Convert old flat limits format to structured format for backward compatibility.
 */
function normalizeServerResponse(data: RawSubscriptionData): ServerSubscriptionResponse {
  // New per-feature format (quiz, flashcard, file_upload each have their own limit)
  if (data.limits?.quiz?.limit !== undefined) {
    return data as ServerSubscriptionResponse;
  }

  // Legacy format with shared generations pool
  if (data.limits?.generations?.limit !== undefined) {
    const gen = data.limits.generations;
    return {
      ...data,
      limits: {
        quiz: { ...gen },
        flashcard: { ...gen },
        file_upload: { ...gen },
        chat: data.limits.chat,
        export: data.limits.export,
        chart: data.limits.chart,
        file_storage: data.limits.file_storage,
      },
    } as ServerSubscriptionResponse;
  }

  // Old flat format: limits values are plain numbers
  const flatLimits = (data.limits || {}) as Record<string, number | undefined>;
  const features = data.usage?.features || {};

  const makeLimitInfo = (key: string, type: 'daily' | 'cumulative' = 'daily'): LimitInfo => {
    const limit = flatLimits[key] ?? -1;
    const used = features[key] ?? 0;
    return { limit, used, remaining: limit === -1 ? -1 : Math.max(0, limit - used), type };
  };

  return {
    tier: data.tier || 'free',
    expiresAt: data.expiresAt || null,
    limits: {
      quiz: makeLimitInfo('quiz', 'daily'),
      flashcard: makeLimitInfo('flashcard', 'daily'),
      file_upload: makeLimitInfo('file_upload', 'daily'),
      chat: makeLimitInfo('chat', 'daily'),
      export: makeLimitInfo('export', 'daily'),
      chart: makeLimitInfo('chart', 'daily'),
      file_storage: {
        limit: flatLimits.file_storage ?? data.usage?.fileStorageLimit ?? 10,
        used: data.usage?.totalFiles ?? 0,
        remaining:
          (flatLimits.file_storage ?? 10) === -1
            ? -1
            : Math.max(0, (flatLimits.file_storage ?? 10) - (data.usage?.totalFiles ?? 0)),
        type: 'cumulative',
      },
    },
  };
}

/**
 * Fetch fresh subscription data from server.
 */
export async function refreshLimits(): Promise<ServerSubscriptionResponse | null> {
  try {
    const response = await api.get('/user/subscription');
    const data = normalizeServerResponse(response.data);
    cachedResponse = data;
    lastFetchTime = Date.now();
    persistCache();
    return data;
  } catch {
    return null;
  }
}

/**
 * Get the current cached subscription response, fetching if stale.
 */
async function getSubscriptionData(): Promise<ServerSubscriptionResponse | null> {
  // Return memory cache if fresh
  if (cachedResponse?.limits && Date.now() - lastFetchTime < CACHE_TTL) {
    return cachedResponse;
  }

  // Try fetching from server
  const fresh = await refreshLimits();
  if (fresh) return fresh;

  // Fall back to memory cache
  if (cachedResponse?.limits) return cachedResponse;

  // Fall back to localStorage cache
  const stored = loadCacheFromStorage();
  if (stored) {
    cachedResponse = stored;
    return stored;
  }

  // No cache at all - return null (fail-open)
  return null;
}

/**
 * Get the LimitInfo for a given feature type.
 */
function getLimitInfoForType(data: ServerSubscriptionResponse, limitType: LimitType): LimitInfo {
  const key = limitType as keyof StructuredLimits;
  if (data.limits[key]) {
    return data.limits[key] as LimitInfo;
  }
  // Unknown type - fail open
  return { limit: -1, used: 0, remaining: -1, type: 'daily' };
}

/**
 * Drop the in-memory cache so the next check re-fetches from the server.
 * Call after a gated action succeeds (the server increments the count).
 */
export function invalidateCache(): void {
  lastFetchTime = 0;
  cachedResponse = null;
}

/**
 * Proactively check whether an action is allowed under the user's current
 * limits. Fails open (returns true) whenever we don't have reliable data —
 * first launch offline, fetch failure, unknown limit type, paid tier, etc.
 * When the limit is exhausted for a free-tier user, tracks `limit_hit` and
 * opens the limit-reached modal, then returns false.
 */
export async function checkAndGate(limit: LimitType, placement: string): Promise<boolean> {
  const data = await getSubscriptionData();

  // Fail-open: no data at all (first launch offline, fetch failure)
  if (!data?.limits) return true;

  // Paid users bypass all limits
  if (data.tier !== 'free') return true;

  const info = getLimitInfoForType(data, limit);

  // -1 means unlimited
  if (info.limit === -1) return true;

  if (info.remaining <= 0) {
    trackEvent('limit_hit', { limitType: limit, currentUsage: info.used, limit: info.limit });
    useLimitModalStore.getState().open({
      limitType: limit,
      used: info.used,
      total: info.limit,
      period: info.type,
      placement,
    });
    return false;
  }
  return true;
}
