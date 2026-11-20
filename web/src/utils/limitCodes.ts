// Server limit codes (server/middleware/subscriptionLimits.middleware.js):
// LIFETIME_LIMIT_REACHED (free-tier quiz/flashcard/upload/chart),
// WEEKLY_LIMIT_REACHED (free-tier chat), DAILY_LIMIT_REACHED (paid tiers).
// All three mean "quota exhausted — offer an upgrade".
const LIMIT_CODES = ['LIFETIME_LIMIT_REACHED', 'WEEKLY_LIMIT_REACHED', 'DAILY_LIMIT_REACHED'] as const;

export function isLimitReachedCode(code: unknown): boolean {
  return typeof code === 'string' && (LIMIT_CODES as readonly string[]).includes(code);
}
