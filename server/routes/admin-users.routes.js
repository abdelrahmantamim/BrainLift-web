import express from 'express';
import { requireAdminAuth } from '../middleware/adminAuth.middleware.js';
import { getSupabase } from '../config/services.config.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Search user by email or userId (MUST be before /:userId to avoid param conflict)
router.get('/search', requireAdminAuth, async (req, res) => {
  try {
    const { email, userId } = req.query;
    const supabase = getSupabase();

    if (!email && !userId) {
      return res.status(400).json({
        error: 'Email or userId is required'
      });
    }

    let query = supabase
      .from('profiles')
      .select('id, email, full_name, subscription_tier, subscription_end_date, created_at');

    if (email) {
      query = query.eq('email', email);
    } else {
      query = query.eq('id', userId);
    }

    const { data: users, error } = await query;

    if (error) throw error;

    if (users && users.length > 0) {
      const user = users[0];

      // Check if user has OAuth providers via Better Auth tables
      let oauth_providers = [];
      const { data: authUser } = await supabase
        .from('user')
        .select('id')
        .eq('email', user.email)
        .single();

      if (authUser) {
        const { data: accounts } = await supabase
          .from('account')
          .select('providerId')
          .eq('userId', authUser.id);

        oauth_providers = accounts
          ? accounts.map(a => a.providerId).filter(p => p !== 'credential')
          : [];
      }

      res.json({
        user: {
          ...user,
          oauth_providers: oauth_providers.length > 0 ? oauth_providers : null
        }
      });
    } else {
      res.json({ user: null });
    }

  } catch (error) {
    console.error('[Admin Users] Error searching user:', error);
    res.status(500).json({
      error: 'Failed to search user'
    });
  }
});

// Get all users with pagination
router.get('/', requireAdminAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { page = 1, limit = 20, search = '', role = '', status = '' } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Build query
    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' });
    
    // Apply filters
    if (search) {
      // Sanitize search input - escape PostgREST special characters
      const sanitizedSearch = search.replace(/[%_\\.*(),:]/g, '');
      if (sanitizedSearch) {
        query = query.or(`email.ilike.%${sanitizedSearch}%,full_name.ilike.%${sanitizedSearch}%`);
      }
    }
    
    // Note: profiles table doesn't have a role column
    
    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }
    
    // Apply pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);
    
    const { data: users, error, count } = await query;
    
    if (error) throw error;
    
    // Get usage statistics for each user
    const usersWithStats = await Promise.all(users.map(async (user) => {
      // Get quiz count
      const { count: quizCount } = await supabase
        .from('quizzes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      // Get flashcard count
      const { count: flashcardCount } = await supabase
        .from('flashcard_sets')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      // Get file count
      const { count: fileCount } = await supabase
        .from('files')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      return {
        ...user,
        stats: {
          quizzes: quizCount || 0,
          flashcards: flashcardCount || 0,
          files: fileCount || 0,
          aiRequests: user.total_ai_requests || 0
        }
      };
    }));
    
    res.json({
      users: usersWithStats,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('[Admin Users] Error fetching users:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch users' }
    });
  }
});

// Get single user details
router.get('/:userId', requireAdminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const supabase = getSupabase();
    
    // Get user profile
    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error || !user) {
      return res.status(404).json({
        error: { message: 'User not found' }
      });
    }
    
    // Get detailed statistics
    const [
      { count: quizCount },
      { count: flashcardCount },
      { count: fileCount },
      { data: recentActivity }
    ] = await Promise.all([
      supabase.from('quizzes').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('flashcard_sets').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('files').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('quiz_attempts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10)
    ]);
    
    res.json({
      user,
      stats: {
        quizzes: quizCount || 0,
        flashcards: flashcardCount || 0,
        files: fileCount || 0,
        aiRequests: user.total_ai_requests || 0,
        dailyRequests: user.daily_ai_requests || 0,
        monthlyRequests: user.monthly_ai_requests || 0
      },
      recentActivity: recentActivity || []
    });
  } catch (error) {
    console.error('[Admin Users] Error fetching user details:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch user details' }
    });
  }
});

// Update user
router.patch('/:userId', requireAdminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_active, name, email } = req.body;
    const supabase = getSupabase();
    
    const updates = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    
    updates.updated_at = new Date().toISOString();
    
    const { data: user, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      user,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('[Admin Users] Error updating user:', error);
    res.status(500).json({
      error: { message: 'Failed to update user' }
    });
  }
});

// Reset user generation limit (cumulative_generation_count)
router.post('/:userId/reset-limit', requireAdminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const supabase = getSupabase();

    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('email, cumulative_generation_count')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ cumulative_generation_count: 0, daily_feature_usage: {}, last_request_date: null })
      .eq('id', userId);

    if (error) throw error;

    res.json({ success: true, message: `Limits reset for ${user.email} (was ${user.cumulative_generation_count} generations)` });
  } catch (error) {
    console.error('[Admin Users] Error resetting limit:', error);
    res.status(500).json({ error: { message: 'Failed to reset limit' } });
  }
});

// Reset user password
router.post('/:userId/reset-password', requireAdminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        error: { message: 'Password must be at least 8 characters long' }
      });
    }
    
    const supabase = getSupabase();
    
    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();
    
    if (userError || !user) {
      return res.status(404).json({
        error: { message: 'User not found' }
      });
    }
    
    // Update password in auth.users table
    const { data: authUser, error: authError } = await supabase
      .from('users')
      .update({
        hashed_password: await bcrypt.hash(newPassword, 10),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();
    
    if (authError) throw authError;
    
    res.json({
      success: true,
      message: 'Password reset successfully',
      email: user.email
    });
  } catch (error) {
    console.error('[Admin Users] Error resetting password:', error);
    res.status(500).json({
      error: { message: 'Failed to reset password' }
    });
  }
});

// Delete user (soft delete)
router.delete('/:userId', requireAdminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const supabase = getSupabase();
    
    // Soft delete by setting is_active to false and adding deleted timestamp
    const { data: user, error } = await supabase
      .from('profiles')
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: 'User deactivated successfully',
      user
    });
  } catch (error) {
    console.error('[Admin Users] Error deleting user:', error);
    res.status(500).json({
      error: { message: 'Failed to delete user' }
    });
  }
});

// Helper: add duration to a base date
function addDuration(baseDate, duration) {
  const date = new Date(baseDate);
  switch (duration) {
    case '1_week':
      date.setDate(date.getDate() + 7);
      break;
    case '1_month':
      date.setMonth(date.getMonth() + 1);
      break;
    case '1_year':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  return date;
}

// Upgrade/downgrade user subscription
// action: 'set' (default) = overwrite tier + expiration
//         'extend' = keep tier, add duration to current expiration (or from now if expired)
router.post('/upgrade', requireAdminAuth, async (req, res) => {
  try {
    const { userId, tier, duration, action = 'set' } = req.body;
    const supabase = getSupabase();

    if (!userId || !tier) {
      return res.status(400).json({
        error: 'UserId and tier are required'
      });
    }

    if (!['free', 'premium', 'ultra'].includes(tier)) {
      return res.status(400).json({
        error: 'Invalid tier. Must be "free", "premium", or "ultra"'
      });
    }

    if (!['set', 'extend'].includes(action)) {
      return res.status(400).json({
        error: 'Invalid action. Must be "set" or "extend"'
      });
    }

    const validDurations = ['1_week', '1_month', '1_year', 'lifetime'];
    if (tier !== 'free' && duration && !validDurations.includes(duration)) {
      return res.status(400).json({
        error: 'Invalid duration. Must be "1_week", "1_month", "1_year", or "lifetime"'
      });
    }

    if (tier !== 'free' && !duration) {
      return res.status(400).json({
        error: 'Duration is required for paid tiers'
      });
    }

    let subscriptionEndDate = null;

    if (tier === 'free') {
      // Downgrade: clear expiration
      subscriptionEndDate = null;
    } else if (duration === 'lifetime') {
      // Lifetime: null = never expires
      subscriptionEndDate = null;
    } else if (action === 'extend') {
      // Extend: fetch current expiration and add time from the later of (now, current expiration)
      const { data: currentUser, error: fetchError } = await supabase
        .from('profiles')
        .select('subscription_end_date')
        .eq('id', userId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          return res.status(404).json({ error: 'User not found' });
        }
        throw fetchError;
      }

      const now = new Date();
      const currentEnd = currentUser.subscription_end_date
        ? new Date(currentUser.subscription_end_date)
        : null;

      // If current subscription is still active (end date in the future), extend from that date
      // If expired or no end date, extend from now
      const baseDate = (currentEnd && currentEnd > now) ? currentEnd : now;
      subscriptionEndDate = addDuration(baseDate, duration).toISOString();
    } else {
      // Set: overwrite from now
      subscriptionEndDate = addDuration(new Date(), duration).toISOString();
    }

    // Update user's subscription tier
    const { data: user, error } = await supabase
      .from('profiles')
      .update({
        subscription_tier: tier,
        subscription_end_date: subscriptionEndDate,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id, email, full_name, subscription_tier, subscription_end_date')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          error: 'User not found'
        });
      }
      throw error;
    }

    const tierLabels = { free: 'Free', premium: 'Premium', ultra: 'Ultra' };
    const durationLabels = { '1_week': '1 week', '1_month': '1 month', '1_year': '1 year', 'lifetime': 'lifetime' };
    const actionLabel = action === 'extend' ? 'extended' : 'set';
    const durationText = tier === 'free' ? '' : ` (${durationLabels[duration] || 'lifetime'})`;
    res.json({
      success: true,
      message: `User ${actionLabel} to ${tierLabels[tier] || tier}${durationText}`,
      user
    });

  } catch (error) {
    console.error('[Admin Users] Error updating user tier:', error);
    res.status(500).json({
      error: 'Failed to update user subscription tier'
    });
  }
});

// Get user activity logs
router.get('/:userId/activity', requireAdminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;
    const supabase = getSupabase();
    
    // Get various activities
    const [
      { data: quizAttempts },
      { data: flashcardSessions },
      { data: files }
    ] = await Promise.all([
      supabase
        .from('quiz_attempts')
        .select('id, quiz_id, score, total_questions, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('flashcard_sessions')
        .select('id, set_id, cards_studied, accuracy, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('files')
        .select('id, filename, type, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
    ]);
    
    // Combine and sort activities
    const activities = [
      ...(quizAttempts || []).map(a => ({ ...a, type: 'quiz_attempt' })),
      ...(flashcardSessions || []).map(a => ({ ...a, type: 'flashcard_session' })),
      ...(files || []).map(f => ({ ...f, type: 'file_upload' }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
    
    res.json({
      activities,
      count: activities.length
    });
  } catch (error) {
    console.error('[Admin Users] Error fetching activity:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch user activity' }
    });
  }
});

export default router;