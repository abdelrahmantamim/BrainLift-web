import express from 'express';
import { requireAdminAuth } from '../middleware/adminAuth.middleware.js';
import adminRateLimitRouter from './admin-ratelimit.routes.js';
import adminAuthRouter from './admin-auth.routes.js';
import adminModelsRouter from './admin-models.routes.js';
import adminUsersRouter from './admin-users.routes.js';
import adminStatsRouter from './admin-stats.routes.js';
import adminNotificationsRouter from './admin-notifications.routes.js';
import adminFilesRouter from './admin-files.routes.js';
import adminServerRouter from './admin-server.routes.js';
import adminSubscriptionLimitsRouter from './admin-subscription-limits.routes.js';

const router = express.Router();

// Admin auth routes (public - no requireAdminAuth)
router.use('/auth', adminAuthRouter);

// Admin health check (protected)
router.get('/health', requireAdminAuth, (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Admin routes active',
    admin: {
      id: req.adminId,
      email: req.adminEmail,
      role: req.adminRole
    }
  });
});

// Protected admin routes - all require admin authentication
router.use('/models', requireAdminAuth, adminModelsRouter);
router.use('/users', requireAdminAuth, adminUsersRouter);
router.use('/stats', requireAdminAuth, adminStatsRouter);
router.use('/notifications', requireAdminAuth, adminNotificationsRouter);
router.use('/files', requireAdminAuth, adminFilesRouter);
router.use('/server', requireAdminAuth, adminServerRouter);

// Subscription limits management (protected)
router.use('/subscription-limits', requireAdminAuth, adminSubscriptionLimitsRouter);

// Include rate limit management routes (protected)
router.use('/', requireAdminAuth, adminRateLimitRouter);

// All other admin routes should use requireAdminAuth middleware

export default router;