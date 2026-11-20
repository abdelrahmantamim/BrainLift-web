import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisStore = new Map();
const clearCachePattern = vi.fn(async (pattern) => {
  const prefix = pattern.replace(/\*+$/, '');
  for (const key of redisStore.keys()) {
    if (key.startsWith(prefix)) redisStore.delete(key);
  }
});

vi.mock('../config/redis.config.js', () => ({
  getCache: vi.fn(async (key) => redisStore.get(key)),
  setCache: vi.fn(async (key, value) => redisStore.set(key, value)),
  deleteCache: vi.fn(async (key) => redisStore.delete(key)),
  clearCachePattern,
}));

vi.mock('../config/services.config.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../middleware/auth.middleware.js', () => ({
  requireAuth: vi.fn((_req, _res, next) => next()),
}));

vi.mock('../services/activityTracking.service.js', () => ({
  default: {},
}));

vi.mock('../utils/serverLogger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const { default: statsRouter } = await import('../routes/stats.routes.js');
const { clearDashboardCache } = await import('../middleware/cache.middleware.js');

function dashboardCacheHandler() {
  const dashboardRoute = statsRouter.stack.find(
    (layer) => layer.route?.path === '/dashboard' && layer.route.methods.get,
  );
  return dashboardRoute.route.stack[0].handle;
}

function response() {
  return {
    statusCode: 200,
    set: vi.fn(),
    json: vi.fn(),
  };
}

describe('dashboard cache invalidation', () => {
  beforeEach(() => {
    redisStore.clear();
    clearCachePattern.mockClear();
  });

  it('stores dashboard responses in the namespace cleared after activity updates', async () => {
    const cache = dashboardCacheHandler();
    const request = {
      method: 'GET',
      path: '/dashboard',
      query: {},
      userId: 'user-123',
    };
    const firstResponse = response();
    const firstNext = vi.fn();

    await cache(request, firstResponse, firstNext);
    firstResponse.json({ user: { totalXP: 1046 } });

    expect(firstNext).toHaveBeenCalledOnce();
    expect(redisStore.get('dashboard:user-123:GET:/dashboard:{}')).toEqual({
      user: { totalXP: 1046 },
    });

    await clearDashboardCache('user-123');

    expect(clearCachePattern).toHaveBeenCalledWith('dashboard:user-123:*');
    expect(redisStore.size).toBe(0);

    const secondNext = vi.fn();
    await cache(request, response(), secondNext);
    expect(secondNext).toHaveBeenCalledOnce();
  });
});
