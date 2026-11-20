import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import * as betterAuthApi from 'better-auth/api';

// --- Mocks ---------------------------------------------------------------
// Mirror the server-side API surface of the installed Better Auth (1.6.x):
// `forgetPassword` was removed in favour of `requestPasswordReset`.
const requestPasswordReset = vi.fn();
const resetPassword = vi.fn();
vi.mock('../config/better-auth.config.js', () => ({
  auth: { api: { requestPasswordReset, resetPassword } },
}));

vi.mock('../utils/pgPool.js', () => ({
  default: { query: vi.fn(() => Promise.resolve({ rows: [] })) },
  closePool: vi.fn(),
}));

vi.mock('../services/deviceFingerprint.service.js', () => ({
  default: { trackDevice: vi.fn() },
}));

const { default: betterAuthRouter } = await import('../routes/better-auth.routes.js');

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/auth', betterAuthRouter);
  return a;
}

beforeEach(() => {
  requestPasswordReset.mockReset();
  resetPassword.mockReset();
});

describe('Better Auth API surface', () => {
  it('exposes requestPasswordReset (forgetPassword no longer exists)', () => {
    expect(typeof betterAuthApi.requestPasswordReset).toBe('function');
    expect(betterAuthApi.forgetPassword).toBeUndefined();
  });
});

describe('POST /api/auth/forget-password', () => {
  it('forwards email + redirectTo to auth.api.requestPasswordReset', async () => {
    requestPasswordReset.mockResolvedValue({ status: true, message: 'ok' });

    const res = await request(app())
      .post('/api/auth/forget-password')
      .send({ email: 'user@example.com', redirectTo: 'https://getbrainlift.app/auth/reset-password' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: true, message: 'ok' });
    expect(requestPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { email: 'user@example.com', redirectTo: 'https://getbrainlift.app/auth/reset-password' },
      }),
    );
  });

  it('returns 400 with the error message when Better Auth rejects the request', async () => {
    requestPasswordReset.mockRejectedValue(new Error('Reset password isn\'t enabled'));

    const res = await request(app())
      .post('/api/auth/forget-password')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Reset password isn\'t enabled');
  });
});

describe('POST /api/auth/reset-password', () => {
  it('forwards token + newPassword to auth.api.resetPassword', async () => {
    resetPassword.mockResolvedValue({ status: true });

    const res = await request(app())
      .post('/api/auth/reset-password')
      .send({ token: 'abc123', newPassword: 'N3wPassw0rd!' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: true });
    expect(resetPassword).toHaveBeenCalledWith(
      expect.objectContaining({ body: { token: 'abc123', newPassword: 'N3wPassw0rd!' } }),
    );
  });
});
