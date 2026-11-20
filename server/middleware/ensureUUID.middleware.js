// Middleware to ensure req.userId is always a UUID, not a Better Auth ID
export function ensureUUID(req, res, next) {
  // Check if req.userId exists and is not a UUID format
  if (req.userId && !req.userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    // If user object has UUID from syncUser, use it
    if (req.user && req.user.uuid) {
      console.log('[EnsureUUID] Converting Better Auth ID to UUID:', req.userId, '->', req.user.uuid);
      req.userId = req.user.uuid;
    } else {
      console.log('[EnsureUUID] Warning: Non-UUID userId found but no UUID mapping available:', req.userId);
    }
  }
  next();
}