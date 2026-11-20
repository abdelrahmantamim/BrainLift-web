import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const AUTH_KEY = 'test-webhook-key';
process.env.REVENUECAT_WEBHOOK_AUTH_KEY = AUTH_KEY;

// Capture the update args + count DB writes per request.
let lastUpdate = null;
let updateCount = 0;
let failNextUpdates = 0; // when > 0, updates resolve with an error
const supabaseMock = {
  from: vi.fn(() => {
    const chain = {};
    chain.update = vi.fn((vals) => { lastUpdate = vals; updateCount += 1; return chain; });
    chain.eq = vi.fn(() => chain);
    chain.then = (resolve) => {
      if (failNextUpdates > 0) {
        failNextUpdates -= 1;
        return resolve({ data: null, error: { message: 'db down' } });
      }
      return resolve({ data: null, error: null });
    };
    return chain;
  }),
};

vi.mock('../config/services.config.js', () => ({
  getSupabase: () => supabaseMock,
}));

const { default: webhookRouter } = await import('../routes/webhook.routes.js');

function appWith() {
  const app = express();
  app.use(express.json());
  app.use('/api/webhooks/revenuecat', webhookRouter);
  return app;
}

function authed(payload, id = undefined) {
  const event = { ...payload };
  // Give each test a unique event id unless one is supplied, so idempotency
  // does not bleed across tests.
  event.id = id ?? `evt-${Math.round(performance.now() * 1000)}-${updateCount}`;
  return request(appWith())
    .post('/api/webhooks/revenuecat')
    .set('Authorization', `Bearer ${AUTH_KEY}`)
    .send({ event });
}

describe('RevenueCat webhook', () => {
  beforeEach(() => { lastUpdate = null; updateCount = 0; failNextUpdates = 0; });

  it('rejects requests with a missing/wrong auth header', async () => {
    const res = await request(appWith())
      .post('/api/webhooks/revenuecat')
      .send({ event: { type: 'INITIAL_PURCHASE', app_user_id: 'u', entitlement_ids: ['Pro'], id: 'e1' } });
    expect(res.status).toBe(401);
  });

  it('grants premium from Pro entitlement', async () => {
    const res = await authed({ type: 'INITIAL_PURCHASE', app_user_id: '11111111-1111-1111-1111-111111111111', entitlement_ids: ['Pro'] });
    expect(res.status).toBe(200);
    expect(lastUpdate?.subscription_tier).toBe('premium');
  });

  it('grants ultra from Ultra entitlement', async () => {
    const res = await authed({ type: 'RENEWAL', app_user_id: '22222222-2222-2222-2222-222222222222', entitlement_ids: ['Ultra'] });
    expect(res.status).toBe(200);
    expect(lastUpdate?.subscription_tier).toBe('ultra');
  });

  it('downgrades to free on EXPIRATION', async () => {
    const res = await authed({ type: 'EXPIRATION', app_user_id: '33333333-3333-3333-3333-333333333333' });
    expect(res.status).toBe(200);
    expect(lastUpdate?.subscription_tier).toBe('free');
  });

  it('rejects events with no app_user_id', async () => {
    const res = await authed({ type: 'INITIAL_PURCHASE', entitlement_ids: ['Pro'] });
    expect(res.status).toBe(400);
  });

  it('does NOT treat the retry of a FAILED event as a duplicate — the retry is processed', async () => {
    failNextUpdates = 1;
    const first = await authed({ type: 'INITIAL_PURCHASE', app_user_id: '55555555-5555-5555-5555-555555555555', entitlement_ids: ['Pro'] }, 'retry-event-1');
    expect(first.status).toBe(500); // failed write → 5xx so RevenueCat retries
    const retry = await authed({ type: 'INITIAL_PURCHASE', app_user_id: '55555555-5555-5555-5555-555555555555', entitlement_ids: ['Pro'] }, 'retry-event-1');
    expect(retry.status).toBe(200);
    expect(retry.body.duplicate).toBeUndefined(); // processed for real, not skipped
    expect(lastUpdate?.subscription_tier).toBe('premium');
  });

  it('ignores a duplicate event id and does not write twice', async () => {
    const first = await authed({ type: 'INITIAL_PURCHASE', app_user_id: '44444444-4444-4444-4444-444444444444', entitlement_ids: ['Pro'] }, 'dup-event-1');
    expect(first.status).toBe(200);
    const writesAfterFirst = updateCount;
    const second = await authed({ type: 'INITIAL_PURCHASE', app_user_id: '44444444-4444-4444-4444-444444444444', entitlement_ids: ['Pro'] }, 'dup-event-1');
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    expect(updateCount).toBe(writesAfterFirst); // no second write
  });
});

describe('RevenueCat webhook — fail closed without key', () => {
  it('returns 500 when REVENUECAT_WEBHOOK_AUTH_KEY is unset', async () => {
    vi.resetModules();
    delete process.env.REVENUECAT_WEBHOOK_AUTH_KEY;
    vi.doMock('../config/services.config.js', () => ({ getSupabase: () => supabaseMock }));
    const mod = await import('../routes/webhook.routes.js');
    const app = express();
    app.use(express.json());
    app.use('/api/webhooks/revenuecat', mod.default);
    const res = await request(app)
      .post('/api/webhooks/revenuecat')
      .send({ event: { type: 'INITIAL_PURCHASE', app_user_id: 'u', id: 'e2' } });
    expect(res.status).toBe(500);
    // restore for any later modules
    process.env.REVENUECAT_WEBHOOK_AUTH_KEY = AUTH_KEY;
  });
});
