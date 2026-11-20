import express from 'express';
import authPool from '../utils/pgPool.js';
import { authMiddleware, requireAuth } from '../middleware/auth.middleware.js';
import { getSupabase } from '../config/services.config.js';
import userProfileCache from '../utils/userProfileCache.js';
import { cacheMiddleware, invalidateCache, cacheConfigs } from '../middleware/cache.middleware.js';
import { getSubscriptionInfo } from '../middleware/subscriptionLimits.middleware.js';
import { requirePaidWeb } from '../middleware/requirePaidWeb.middleware.js';
import { deleteAccountData } from '../services/accountDeletion.service.js';

const router = express.Router();

// Auth middleware is already applied at the server level before this router
// router.use(authMiddleware); // Removed to prevent overriding req.userId

// Get user profile (with caching)
router.get('/profile', cacheMiddleware(cacheConfigs.userProfile), async (req, res) => {
  console.log('Fetching profile for user:', req.userId, 'User object:', req.user);
  
  try {
    const supabase = getSupabase();
    
    // Get user profile - explicitly select all columns including preferences JSONB
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, chat_background_url, student_type, preferences, subscription_tier, created_at, updated_at')
      .eq('id', req.userId)
      .single();
    
    if (error) {
      console.error('Error fetching profile:', error);
      return res.status(404).json({ error: { message: 'Profile not found' } });
    }
    
    // Debug log to verify what's coming from database
    console.log('[Profile] Raw database profile:', JSON.stringify(profile, null, 2));
    
    console.log('[Profile] Found profile:', {
      id: profile.id,
      email: profile.email,
      hasAvatar: !!profile.avatar_url,
      hasUsername: !!profile.username,
      hasFullName: !!profile.full_name,
      hasPreferences: !!profile.preferences,
      preferencesValue: profile.preferences,
      studentType: profile.student_type
    });
    
    // Get user stats
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Count quizzes taken
    console.log('[Profile] Counting quiz attempts for user:', req.userId);
    const { count: totalQuizzes, error: quizError } = await supabase
      .from('quiz_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.userId);
    
    console.log('[Profile] Total quizzes:', totalQuizzes, 'Error:', quizError);
    
    // Count quizzes in last 7 days
    const { count: weeklyQuizzes } = await supabase
      .from('quiz_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.userId)
      .gte('created_at', sevenDaysAgo.toISOString());
    
    // Count questions answered
    const { data: attempts } = await supabase
      .from('quiz_attempts')
      .select('total_questions')
      .eq('user_id', req.userId);
    
    const totalQuestions = attempts?.reduce((sum, attempt) => sum + (attempt.total_questions || 0), 0) || 0;
    
    // Count chat sessions
    const { count: totalSessions } = await supabase
      .from('chat_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.userId);
    
    // Count weekly sessions
    const { count: weeklySessions } = await supabase
      .from('chat_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.userId)
      .gte('created_at', sevenDaysAgo.toISOString());
    
    // Check if user has OAuth accounts linked
    let hasOAuthAccount = false;
    try {
      const oauthAccountResult = await authPool.query(
        'SELECT id FROM "account" WHERE "userId" = $1 AND "providerId" IN ($2, $3)',
        [req.userId, 'google', 'apple']
      );
      hasOAuthAccount = oauthAccountResult.rows.length > 0;
      console.log('[Profile] OAuth account check:', { hasOAuthAccount, count: oauthAccountResult.rows.length });
    } catch (oauthError) {
      console.error('[Profile] Failed to check OAuth accounts:', oauthError);
    }
    
    const responseData = {
      id: req.userId,
      email: profile.email,
      name: profile.full_name,
      avatar_url: profile.avatar_url,
      chat_background_url: profile.chat_background_url,
      // Return the actual database value
      studentType: profile.student_type,
      student_type: profile.student_type,
      preferences: profile.preferences || {},
      hasOAuthAccount: hasOAuthAccount,
      stats: {
        totalQuizzes: totalQuizzes || 0,
        weeklyQuizzes: weeklyQuizzes || 0,
        totalQuestions: totalQuestions,
        sessionsThisWeek: weeklySessions || 0,
        totalSessions: totalSessions || 0
      }
    };
    
    console.log('[Profile] GET /profile - Database profile:', {
      userId: req.userId,
      dbId: profile.id,
      dbEmail: profile.email,
      dbStudentType: profile.student_type,
      dbPreferences: profile.preferences
    });
    
    console.log('[Profile] GET /profile response:', {
      userId: req.userId,
      hasPreferences: !!responseData.preferences,
      preferences: responseData.preferences,
      studentType: responseData.student_type,
      dbStudentType: profile.student_type,
      returnedStudentType: responseData.studentType
    });
    
    res.json(responseData);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: { message: 'Failed to fetch profile' } });
  }
});

// Update user profile
router.put('/profile', invalidateCache(['user:userId:*', 'dashboard:userId:*']), async (req, res) => {
  const { name, studentType, student_type, preferences } = req.body;
  
  console.log('[Profile] PUT /profile request body:', {
    name,
    studentType,
    student_type,
    preferences
  });
  
  // Handle both snake_case and camelCase for student type
  const actualStudentType = studentType || student_type;
  
  console.log('Updating profile for user:', req.userId);
  console.log('Student type received:', actualStudentType);
  
  try {
    const supabase = getSupabase();
    
    // Also update the Better Auth user table if name is provided
    if (name !== undefined) {
      console.log('Updating Better Auth user name for:', req.userId);
      const { error: userUpdateError } = await supabase
        .from('user')
        .update({ 
          name: name,
          updatedAt: new Date().toISOString()
        })
        .eq('id', req.userId);
      
      if (userUpdateError) {
        console.error('Error updating Better Auth user name:', userUpdateError);
        // Continue anyway - profile update is more important
      } else {
        console.log('Successfully updated Better Auth user name');
      }
    }
    
    // First check if profile exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.userId)
      .single();
    
    if (checkError && checkError.code === 'PGRST116') {
      // Profile doesn't exist, create it first
      console.log('Profile not found, creating new profile for user:', req.userId);
      
      // Get user email from the request (set by auth middleware)
      const email = req.user?.email || `user${req.userId.substring(0, 8)}@example.com`;
      
      const createData = {
        id: req.userId,
        email: email,
        full_name: name,
        student_type: actualStudentType,
        preferences: preferences || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert([createData])
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating profile:', createError);
        return res.status(500).json({ error: { message: 'Failed to create profile' } });
      }
      
      // Return the newly created profile
      return res.json({
        user: {
          id: req.userId,
          email: newProfile.email,
          name: newProfile.full_name,
          avatar_url: newProfile.avatar_url,
          chat_background_url: newProfile.chat_background_url,
          // Return the actual database value
          student_type: newProfile.student_type,
          subscription_tier: newProfile.subscription_tier || 'free',
          created_at: newProfile.created_at,
          preferences: newProfile.preferences,
          // Additional field for compatibility
          studentType: newProfile.student_type
        }
      });
    }
    
    // Profile exists, update it
    const updateData = {
      updated_at: new Date().toISOString()
    };
    
    if (name !== undefined) updateData.full_name = name;
    if (actualStudentType !== undefined) {
      updateData.student_type = actualStudentType;
    }
    if (preferences !== undefined) {
      // Merge with existing preferences
      const currentPrefs = existingProfile?.preferences || {};
      updateData.preferences = {
        ...currentPrefs,
        ...preferences
      };
    }
    
    console.log('[Profile] Before update - checking current profile:', {
      userId: req.userId,
      currentStudentType: existingProfile?.student_type,
      newStudentType: actualStudentType
    });
    
    console.log('[Profile] Update data being sent to database:', JSON.stringify(updateData, null, 2));
    
    // Ensure preferences is properly formatted for JSONB column
    if (updateData.preferences) {
      updateData.preferences = JSON.parse(JSON.stringify(updateData.preferences));
    }
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', req.userId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating profile:', error);
      return res.status(500).json({ error: { message: 'Failed to update profile' } });
    }
    
    // Invalidate cache after successful update
    userProfileCache.invalidate(req.userId);
    
    const responseData = {
      user: {
        id: req.userId,
        email: profile.email,
        name: profile.full_name,
        avatar_url: profile.avatar_url,
        chat_background_url: profile.chat_background_url,
        // Return the actual database value
        student_type: profile.student_type,
        subscription_tier: profile.subscription_tier || 'free',
        created_at: profile.created_at,
        preferences: profile.preferences,
        // Additional field for compatibility
        studentType: profile.student_type
      }
    };
    
    console.log('[user.routes] After database update - profile from DB:', {
      userId: req.userId,
      dbStudentType: profile.student_type,
      dbFullName: profile.full_name,
      dbPreferences: profile.preferences
    });
    
    console.log('[user.routes] PUT /profile response:', {
      userId: req.userId,
      studentType: profile.student_type,
      updatedProfile: profile,
      responseData: responseData.user.student_type
    });
    
    res.json(responseData);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: { message: 'Failed to update profile' } });
  }
});

// Update avatar
router.post('/avatar', requirePaidWeb, async (req, res) => {
  const { avatarUrl } = req.body;
  console.log('Updating avatar for user:', req.userId);
  
  try {
    const supabase = getSupabase();
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ 
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.userId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating avatar:', error);
      return res.status(500).json({ error: { message: 'Failed to update avatar' } });
    }
    
    // Invalidate cache after avatar update
    userProfileCache.invalidate(req.userId);
    
    res.json({
      avatarUrl: profile.avatar_url,
      message: 'Avatar updated successfully'
    });
  } catch (error) {
    console.error('Avatar update error:', error);
    res.status(500).json({ error: { message: 'Failed to update avatar' } });
  }
});

// Update chat background
router.post('/chat-background', requirePaidWeb, async (req, res) => {
  const { background } = req.body;
  console.log('Updating chat background for user:', req.userId);
  
  try {
    const supabase = getSupabase();
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ 
        chat_background_url: background,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.userId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating chat background:', error);
      return res.status(500).json({ error: { message: 'Failed to update chat background' } });
    }
    
    // Invalidate cache after background update
    userProfileCache.invalidate(req.userId);
    
    res.json({
      chatBackgroundUrl: profile.chat_background_url,
      message: 'Chat background updated successfully'
    });
  } catch (error) {
    console.error('Chat background update error:', error);
    res.status(500).json({ error: { message: 'Failed to update chat background' } });
  }
});

// Get user stats
router.get('/stats', requirePaidWeb, async (req, res) => {
  console.log('Fetching stats for user:', req.userId);
  
  try {
    const supabase = getSupabase();
    
    // Try to use optimized function first
    const { data: stats, error: statsError } = await supabase
      .rpc('get_user_stats', { p_user_id: req.userId })
      .single();
    
    if (!statsError && stats) {
      // Use optimized stats from function
      return res.json({
        quizzesTaken: parseInt(stats.total_quizzes) || 0,
        questionsAnswered: parseInt(stats.total_questions) || 0,
        correctAnswers: parseInt(stats.correct_answers) || 0,
        averageScore: parseInt(stats.average_score) || 0,
        sessionsThisWeek: parseInt(stats.weekly_sessions) || 0,
        totalSessions: parseInt(stats.total_sessions) || 0,
        weeklyQuizzes: parseInt(stats.weekly_quizzes) || 0,
        studyHours: parseInt(stats.study_hours) || 0,
        studyStreak: 0 // TODO: Implement streak calculation
      });
    }
    
    // Fallback to original implementation if function doesn't exist
    console.log('Using fallback stats implementation');
    
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Get quiz attempts with scores
    const { data: quizAttempts, error: quizError } = await supabase
      .from('quiz_attempts')
      .select('score, total_questions, created_at')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });
    
    if (quizError) {
      console.error('Error fetching quiz attempts:', quizError);
    }
    
    // Calculate stats
    const weeklyAttempts = quizAttempts?.filter(attempt => 
      new Date(attempt.created_at) >= sevenDaysAgo
    ) || [];
    
    const totalQuizzes = quizAttempts?.length || 0;
    const weeklyQuizzes = weeklyAttempts.length;
    
    const totalQuestions = quizAttempts?.reduce((sum, attempt) => 
      sum + (attempt.total_questions || 0), 0
    ) || 0;
    
    const correctAnswers = quizAttempts?.reduce((sum, attempt) => 
      sum + (attempt.score || 0), 0
    ) || 0;
    
    const averageScore = totalQuizzes > 0 
      ? Math.round(correctAnswers / totalQuestions * 100) 
      : 0;
    
    // Get chat sessions
    const { count: totalSessions } = await supabase
      .from('chat_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.userId);
    
    const { count: weeklySessions } = await supabase
      .from('chat_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.userId)
      .gte('created_at', sevenDaysAgo.toISOString());
    
    res.json({
      quizzesTaken: totalQuizzes,
      questionsAnswered: totalQuestions,
      correctAnswers: correctAnswers,
      averageScore: averageScore,
      sessionsThisWeek: weeklySessions || 0,
      totalSessions: totalSessions || 0,
      weeklyQuizzes: weeklyQuizzes,
      studyStreak: 0 // TODO: Implement streak calculation
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ error: { message: 'Failed to fetch stats' } });
  }
});

// Reset user statistics
router.post('/reset-stats', requirePaidWeb, async (req, res) => {
  console.log('Resetting user statistics for:', req.userId);
  
  try {
    const supabase = getSupabase();
    
    // Reset quiz attempts
    await supabase
      .from('quiz_attempts')
      .delete()
      .eq('user_id', req.userId);
    
    // Note: We don't delete chat conversations, just quiz attempts
    
    res.json({ message: 'Statistics reset successfully' });
  } catch (error) {
    console.error('Reset stats error:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

// Get user blocklist
router.get('/blocklist', requirePaidWeb, async (req, res) => {
  try {
    const supabase = getSupabase();
    
    const { data: blockedUsers, error } = await supabase
      .from('user_blocklist')
      .select(`
        *,
        blocked_user:profiles!user_blocklist_blocked_user_id_fkey(
          id,
          email,
          full_name,
          avatar_url
        )
      `)
      .eq('user_id', req.userId)
      .order('blocked_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      success: true,
      blockedUsers: blockedUsers || []
    });
  } catch (error) {
    console.error('Error fetching blocklist:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Block a user
router.post('/blocklist', requirePaidWeb, async (req, res) => {
  try {
    const { userEmail, reason } = req.body;
    const supabase = getSupabase();
    
    // Get user ID from email
    const { data: userToBlock, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', userEmail)
      .single();
    
    if (userError || !userToBlock) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Don't allow blocking yourself
    if (userToBlock.id === req.userId) {
      return res.status(400).json({
        success: false,
        error: 'You cannot block yourself'
      });
    }
    
    // Add to blocklist
    const { data, error } = await supabase
      .from('user_blocklist')
      .insert({
        user_id: req.userId,
        blocked_user_id: userToBlock.id,
        reason
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({
          success: false,
          error: 'User is already blocked'
        });
      }
      throw error;
    }
    
    res.json({
      success: true,
      message: 'User blocked successfully',
      data
    });
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Unblock a user
router.delete('/blocklist/:blockedUserId', requirePaidWeb, async (req, res) => {
  try {
    const { blockedUserId } = req.params;
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('user_blocklist')
      .delete()
      .eq('user_id', req.userId)
      .eq('blocked_user_id', blockedUserId);
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get subscription info
router.get('/subscription', async (req, res) => {
  try {
    const info = await getSubscriptionInfo(req.userId);
    res.json(info);
  } catch (error) {
    console.error('Subscription info error:', error);
    res.status(500).json({ error: { message: 'Failed to fetch subscription info' } });
  }
});

// Update sharing preferences
router.put('/sharing-preferences', requirePaidWeb, async (req, res) => {
  try {
    const { share_quiz_results, accept_shares_from_anyone } = req.body;
    const supabase = getSupabase();
    
    const updates = {};
    if (share_quiz_results !== undefined) {
      updates.share_quiz_results = share_quiz_results;
    }
    if (accept_shares_from_anyone !== undefined) {
      updates.accept_shares_from_anyone = accept_shares_from_anyone;
    }
    
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.userId)
      .select()
      .single();
    
    if (error) throw error;
    
    // Invalidate user profile cache
    await invalidateCache('userProfile', req.userId);
    
    res.json({
      success: true,
      message: 'Sharing preferences updated',
      data: {
        share_quiz_results: data.share_quiz_results,
        accept_shares_from_anyone: data.accept_shares_from_anyone
      }
    });
  } catch (error) {
    console.error('Error updating sharing preferences:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete user account (self-service)
router.delete('/account', async (req, res) => {
  try {
    await deleteAccountData({
      userId: req.userId,
      authUserId: req.user.id,
      supabase: getSupabase(),
      authPool,
    });

    // Invalidate cache
    userProfileCache.invalidate(req.userId);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('[Account Deletion] Cleanup failed', {
      code: error.code || 'ACCOUNT_DELETION_FAILED',
      stage: error.stage || 'unknown',
    });
    res.status(500).json({
      error: {
        message: 'Failed to delete account. Please try again or contact support.',
        code: error.code || 'ACCOUNT_DELETION_RETRYABLE',
      }
    });
  }
});

export default router;
