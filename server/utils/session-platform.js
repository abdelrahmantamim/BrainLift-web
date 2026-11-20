// Tag a Better Auth session row with the originating platform (web | mobile).
// Platform is derived server-side from the request Origin header against an
// allowlist; the client never supplies it.

import pool from './pgPool.js';
import logger from './serverLogger.js';

const DEFAULT_WEB_ORIGINS = [
  'https://getbrainlift.app',
  'https://www.getbrainlift.app',
  'https://brain-lift-website.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getWebOrigins() {
  const fromEnv = (process.env.WEB_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_WEB_ORIGINS;
}

// Mobile is the safe default. Misconfigured allowlist fails open to mobile
// (free user gets in via web) rather than fail-closed (mobile breaks).
export function detectPlatform(req) {
  const origin = req?.headers?.origin;
  if (!origin) return 'mobile';
  return getWebOrigins().includes(origin) ? 'web' : 'mobile';
}

export async function tagSessionPlatform(token, platform) {
  if (!token || !platform) return;
  // Upgrade-only: session rows default to 'mobile', so writing 'mobile' is a
  // wasted write at best — and at worst it would DOWNGRADE a web session whose
  // token-refresh request arrived without an Origin header, weakening the
  // paywall to the per-request Origin fallback alone.
  if (platform !== 'web') return;
  try {
    await pool.query(
      'UPDATE session SET platform = $1 WHERE token = $2',
      [platform, token]
    );
  } catch (error) {
    logger.error('SessionPlatform', 'Failed to tag session platform:', error);
  }
}
