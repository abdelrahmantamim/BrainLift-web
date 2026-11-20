import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getSupabase } from '../config/services.config.js';
import logger from '../utils/serverLogger.js';
import { cacheMiddleware, invalidateCache, cacheConfigs } from '../middleware/cache.middleware.js';
import activityTrackingService from '../services/activityTracking.service.js';

const router = express.Router();

// Authentication is already applied at the server.js level with syncUserToSupabase
// Don't reapply here as it overwrites the UUID with Better Auth ID

// Export helper function for use in other routes (backward compatibility)
export async function trackUserActivity(supabase, userId, activityData) {
  return await activityTrackingService.trackActivity(userId, activityData);
}

// Track activity endpoint (for manual tracking)
router.post('/track-activity', async (req, res) => {
  try {
    const userId = req.userId;
    
    const {
      sessionType,
      contentId,
      contentTitle,
      startTime,
      endTime,
      score,
      questionsAnswered,
      correctAnswers,
      metadata
    } = req.body;
    
    logger.info('Stats', 'Tracking activity for user:', userId, 'Type:', sessionType);
    
    // Validate required fields
    if (!sessionType) {
      return res.status(400).json({ error: { message: 'sessionType is required' } });
    }
    
    const session = await activityTrackingService.trackActivity(userId, {
      sessionType,
      contentId,
      contentTitle,
      startTime: startTime || new Date().toISOString(),
      endTime,
      score,
      questionsAnswered,
      correctAnswers,
      metadata
    });
    
    // Invalidate dashboard cache
    await invalidateCache([`dashboard:userId:${userId}`]);
    
    res.json({
      success: true,
      session: {
        id: session.id,
        duration: session.duration_minutes,
        pointsEarned: session.pointsEarned
      }
    });
    
  } catch (error) {
    logger.error('Stats', 'Error tracking activity:', error);
    res.status(500).json({ 
      error: { message: 'Failed to track activity' } 
    });
  }
});

// Get recent activities
router.get('/recent-activities', async (req, res) => {
  try {
    const userId = req.userId;
    const supabase = getSupabase();
    const { limit = 20, offset = 0, type } = req.query;
    
    let query = supabase
      .from('user_recent_activities')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (type) {
      query = query.eq('activity_type', type);
    }
    
    const { data: activities, error, count } = await query;
    
    if (error) {
      throw error;
    }
    
    res.json({
      activities: (activities || []).map(activity => ({
        id: activity.id,
        type: activity.activity_type,
        title: activity.title,
        description: activity.description,
        icon: activity.icon,
        pointsEarned: activity.points_earned,
        timestamp: activity.created_at,
        metadata: activity.metadata
      })),
      pagination: {
        total: count || activities?.length || 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: activities?.length === parseInt(limit)
      }
    });
    
  } catch (error) {
    logger.error('Stats', 'Error fetching recent activities:', error);
    res.status(500).json({ 
      error: { message: 'Failed to fetch recent activities' } 
    });
  }
});

// Get continue learning info (last study session)
router.get('/continue-learning', async (req, res) => {
  try {
    const userId = req.userId;
    const supabase = getSupabase();
    
    // Get the most recent study session
    const { data: lastSession, error } = await supabase
      .from('user_study_sessions')
      .select('id, content_id, content_title, session_type, start_time, end_time, duration_minutes, score, questions_answered, correct_answers')
      .eq('user_id', userId)
      .order('start_time', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    if (!lastSession) {
      return res.json({
        hasContent: false,
        message: 'No previous study sessions found'
      });
    }
    
    // Get content details based on session type
    let contentInfo = {
      id: lastSession.content_id,
      title: lastSession.content_title,
      type: lastSession.session_type
    };
    
    // Try to get more detailed content info
    if (lastSession.content_id) {
      try {
        let contentQuery;
        switch (lastSession.session_type) {
          case 'quiz':
            contentQuery = supabase
              .from('quizzes')
              .select('id, title, description, difficulty')
              .eq('id', lastSession.content_id)
              .single();
            break;
          case 'flashcard':
            contentQuery = supabase
              .from('flashcard_decks')
              .select('id, name as title, category')
              .eq('id', lastSession.content_id)
              .single();
            break;
          case 'chat':
            contentQuery = supabase
              .from('study_sessions')
              .select('id, title')
              .eq('id', lastSession.content_id)
              .single();
            break;
          default:
            contentQuery = null;
        }
        
        if (contentQuery) {
          const { data: content } = await contentQuery;
          if (content) {
            contentInfo = { ...contentInfo, ...content };
          }
        }
      } catch (contentError) {
        logger.warn('Stats', 'Failed to fetch detailed content info:', contentError);
      }
    }
    
    res.json({
      hasContent: true,
      lastSession: {
        id: lastSession.id,
        sessionType: lastSession.session_type,
        startTime: lastSession.start_time,
        endTime: lastSession.end_time,
        duration: lastSession.duration_minutes,
        score: lastSession.score,
        questionsAnswered: lastSession.questions_answered,
        correctAnswers: lastSession.correct_answers
      },
      content: contentInfo,
      recommendation: getStudyRecommendation(lastSession)
    });
    
  } catch (error) {
    logger.error('Stats', 'Error fetching continue learning info:', error);
    res.status(500).json({ 
      error: { message: 'Failed to fetch continue learning information' } 
    });
  }
});

function getStudyRecommendation(lastSession) {
  const sessionType = lastSession.session_type;
  const score = lastSession.score;
  
  if (sessionType === 'quiz' && score !== null) {
    if (score < 70) {
      return {
        type: 'review',
        message: 'Continue studying this topic to improve your understanding',
        suggestedAction: 'Review flashcards or study materials'
      };
    } else if (score >= 90) {
      return {
        type: 'advance',
        message: 'Great job! Ready to tackle new challenges',
        suggestedAction: 'Try a more advanced topic or create new content'
      };
    }
  }
  
  return {
    type: 'continue',
    message: 'Continue your learning journey',
    suggestedAction: 'Pick up where you left off'
  };
}

// Get comprehensive dashboard statistics
router.get('/dashboard', cacheMiddleware({ ttl: 300, prefix: 'dashboard' }), async (req, res) => {
  try {
    const userId = req.userId;
    logger.info('Stats', 'Fetching dashboard data for user:', userId);
    
    // Use the centralized service for dashboard data
    const dashboardData = await activityTrackingService.getDashboardStats(userId);
    
    // Get weekly stats (sum of last 7 days)
    const supabase = getSupabase();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data: weeklyData } = await supabase
      .from('user_stats_daily')
      .select('total_quizzes, total_flashcards, total_chat_sessions, total_study_minutes')
      .eq('user_id', userId)
      .gte('stats_date', sevenDaysAgo);
    
    const weeklyStats = weeklyData?.reduce((acc, day) => ({
      quizzesThisWeek: acc.quizzesThisWeek + (day.total_quizzes || 0),
      flashcardsThisWeek: acc.flashcardsThisWeek + (day.total_flashcards || 0),
      sessionsThisWeek: acc.sessionsThisWeek + (day.total_chat_sessions || 0),
      studyMinutesThisWeek: acc.studyMinutesThisWeek + (day.total_study_minutes || 0)
    }), { quizzesThisWeek: 0, flashcardsThisWeek: 0, sessionsThisWeek: 0, studyMinutesThisWeek: 0 }) || {};
    
    // Calculate daily goal completion percentage - only 3 goals count
    let completionPercentage = 0;
    if (dashboardData.dailyGoal) {
      const goals = [
        { completed: dashboardData.dailyGoal.quiz_completed || 0, target: dashboardData.dailyGoal.quiz_goal || 1 },
        { completed: dashboardData.dailyGoal.flashcards_reviewed || 0, target: dashboardData.dailyGoal.flashcard_goal || 1 },
        { completed: dashboardData.dailyGoal.chat_sessions || 0, target: dashboardData.dailyGoal.chat_goal || 1 }
      ];
      
      const totalProgress = goals.reduce((sum, goal) => sum + Math.min(goal.completed / goal.target, 1), 0);
      completionPercentage = Math.round((totalProgress / 3) * 100);
    }
    
    const response = {
      ...dashboardData,
      weeklyStats: {
        ...weeklyStats,
        averageScoreThisWeek: 0 // TODO: Calculate from recent quiz attempts
      },
      dailyGoal: dashboardData.dailyGoal ? {
        goalDate: dashboardData.dailyGoal.goal_date,
        goals: {
          quizzes: dashboardData.dailyGoal.quiz_goal || 1,
          flashcards: dashboardData.dailyGoal.flashcard_goal || 1,
          chatSessions: dashboardData.dailyGoal.chat_goal || 1,
          files: dashboardData.dailyGoal.file_goal || 1,
          studyMinutes: dashboardData.dailyGoal.study_time_goal || 30
        },
        progress: {
          quizzes: dashboardData.dailyGoal.quiz_completed || 0,
          flashcards: dashboardData.dailyGoal.flashcards_reviewed || 0,
          chatSessions: dashboardData.dailyGoal.chat_sessions || 0,
          files: dashboardData.dailyGoal.files_uploaded || 0,
          studyMinutes: dashboardData.dailyGoal.study_time_minutes || 0
        },
        isCompleted: dashboardData.dailyGoal.is_completed || false,
        completionPercentage
      } : {
        goalDate: new Date().toISOString().split('T')[0],
        goals: { quizzes: 1, flashcards: 1, chatSessions: 1, files: 1, studyMinutes: 30 },
        progress: { quizzes: 0, flashcards: 0, chatSessions: 0, files: 0, studyMinutes: 0 },
        isCompleted: false,
        completionPercentage: 0
      }
    };
    
    logger.info('Stats', 'Returning dashboard data');
    res.json(response);
    
  } catch (error) {
    logger.error('Stats', 'Error fetching dashboard data:', error);
    res.status(500).json({ 
      error: { message: 'Failed to fetch dashboard statistics' } 
    });
  }
});

// Legacy stats endpoint (for backward compatibility)
router.get('/stats', async (req, res) => {
  try {
    const userId = req.userId;
    const supabase = getSupabase();
    
    logger.info('Stats', 'Fetching stats for user:', userId);
    
    // Get study sessions count
    const { data: sessions, error: sessionsError } = await supabase
      .from('study_sessions')
      .select('id', { count: 'exact' })
      .eq('user_id', userId);
    
    // Get total study hours from chat conversations
    const { data: conversations, error: conversationsError } = await supabase
      .from('chat_conversations')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    
    // Calculate study hours (rough estimate based on conversation timestamps)
    let totalHours = 0;
    if (conversations && conversations.length > 0) {
      // Group conversations by session (within 30 minutes of each other)
      let sessionStart = new Date(conversations[0].created_at);
      let lastMessageTime = sessionStart;
      
      for (let i = 1; i < conversations.length; i++) {
        const currentTime = new Date(conversations[i].created_at);
        const timeDiff = (currentTime - lastMessageTime) / 1000 / 60; // minutes
        
        if (timeDiff > 30) {
          // New session - calculate previous session duration
          const sessionDuration = (lastMessageTime - sessionStart) / 1000 / 60 / 60; // hours
          totalHours += Math.min(sessionDuration, 2); // Cap at 2 hours per session
          sessionStart = currentTime;
        }
        lastMessageTime = currentTime;
      }
      
      // Add last session
      const lastSessionDuration = (lastMessageTime - sessionStart) / 1000 / 60 / 60;
      totalHours += Math.min(lastSessionDuration, 2);
    }
    
    // Get achievement count (from quiz completions)
    const { data: quizResults, error: quizError } = await supabase
      .from('quiz_results')
      .select('score')
      .eq('user_id', userId)
      .gte('score', 80); // Count scores 80% or higher as achievements
    
    // Get current streak (days with activity)
    const { data: recentActivity } = await supabase
      .from('study_sessions')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });
    
    // Calculate streak
    let streak = 0;
    if (recentActivity && recentActivity.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let currentDate = new Date(recentActivity[0].created_at);
      currentDate.setHours(0, 0, 0, 0);
      
      // Check if there was activity today or yesterday
      const daysSinceLastActivity = Math.floor((today - currentDate) / (24 * 60 * 60 * 1000));
      if (daysSinceLastActivity <= 1) {
        streak = 1;
        
        // Count consecutive days backwards
        const activityDates = new Set(
          recentActivity.map(a => {
            const date = new Date(a.created_at);
            date.setHours(0, 0, 0, 0);
            return date.toISOString().split('T')[0];
          })
        );
        
        let checkDate = new Date(currentDate);
        checkDate.setDate(checkDate.getDate() - 1);
        
        while (activityDates.has(checkDate.toISOString().split('T')[0])) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }
    }
    
    const stats = {
      sessions: sessions?.length || 0,
      hours: Math.round(totalHours * 10) / 10, // Round to 1 decimal
      achievements: quizResults?.length || 0,
      streak: streak
    };
    
    logger.info('Stats', 'Returning stats:', stats);
    
    res.json(stats);
  } catch (error) {
    logger.error('Stats', 'Error fetching stats:', error);
    res.status(500).json({ 
      error: { message: 'Failed to fetch statistics' } 
    });
  }
});

// Reset user statistics (for testing)
router.post('/reset-stats', async (req, res) => {
  try {
    const userId = req.userId;
    
    logger.warn('Stats', 'Resetting stats for user:', userId);
    
    // This is a dangerous operation - in production, you might want to:
    // 1. Add admin check
    // 2. Soft delete instead of hard delete
    // 3. Archive data before deletion
    
    // For now, we'll just return success without actually deleting
    res.json({ 
      message: 'Stats reset functionality is disabled for safety',
      success: false 
    });
    
  } catch (error) {
    logger.error('Stats', 'Error resetting stats:', error);
    res.status(500).json({ 
      error: { message: 'Failed to reset statistics' } 
    });
  }
});

// Legacy track activities endpoint (for backward compatibility)
router.post('/activities', async (req, res) => {
  try {
    const userId = req.userId;
    
    const {
      sessionType,
      contentId,
      contentTitle,
      startTime,
      endTime,
      score,
      questionsAnswered,
      correctAnswers,
      metadata
    } = req.body;
    
    logger.info('Stats', 'Tracking activity for user:', userId, 'Type:', sessionType);
    
    // Validate required fields
    if (!sessionType) {
      return res.status(400).json({ error: { message: 'sessionType is required' } });
    }
    
    const session = await activityTrackingService.trackActivity(userId, {
      sessionType,
      contentId,
      contentTitle,
      startTime: startTime || new Date().toISOString(),
      endTime,
      score,
      questionsAnswered,
      correctAnswers,
      metadata
    });
    
    // Invalidate dashboard cache
    await invalidateCache([`dashboard:userId:${userId}`]);
    
    res.json({
      success: true,
      session: {
        id: session.id,
        duration: session.duration_minutes,
        pointsEarned: session.pointsEarned
      }
    });
    
  } catch (error) {
    logger.error('Stats', 'Error tracking activity:', error);
    res.status(500).json({ 
      error: { message: 'Failed to track activity' } 
    });
  }
});

// Legacy get activities endpoint (for backward compatibility)
router.get('/activities', async (req, res) => {
  try {
    const userId = req.userId;
    const supabase = getSupabase();
    const { limit = 20, offset = 0, type } = req.query;
    
    let query = supabase
      .from('user_recent_activities')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (type) {
      query = query.eq('activity_type', type);
    }
    
    const { data: activities, error, count } = await query;
    
    if (error) {
      throw error;
    }
    
    res.json({
      activities: (activities || []).map(activity => ({
        id: activity.id,
        type: activity.activity_type,
        title: activity.title,
        description: activity.description,
        icon: activity.icon,
        pointsEarned: activity.points_earned,
        timestamp: activity.created_at,
        metadata: activity.metadata
      })),
      pagination: {
        total: count || activities?.length || 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: activities?.length === parseInt(limit)
      }
    });
    
  } catch (error) {
    logger.error('Stats', 'Error fetching activities:', error);
    res.status(500).json({ 
      error: { message: 'Failed to fetch activities' } 
    });
  }
});

// Get/Update daily goals
router.get('/daily-goals', async (req, res) => {
  try {
    const userId = req.userId;
    const supabase = getSupabase();
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    
    const { data: goals, error } = await supabase
      .from('user_daily_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('goal_date', date)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    if (!goals) {
      // Create default goals - only 3 active goals
      await supabase
        .from('user_daily_goals')
        .insert({
          user_id: userId,
          goal_date: date,
          quiz_goal: 1,
          flashcard_goal: 10,
          chat_goal: 1,
          file_goal: 0,  // Disabled
          study_time_goal: 0  // Disabled
        });
      
      return res.json({
        goalDate: date,
        goals: {
          quizzes: 1,
          flashcards: 10,
          chatSessions: 1,
          files: 0,  // Disabled
          studyMinutes: 0  // Disabled
        },
        progress: {
          quizzes: 0,
          flashcards: 0,
          chatSessions: 0,
          files: 0,
          studyMinutes: 0
        },
        isCompleted: false,
        completionPercentage: 0
      });
    }
    
    // Calculate completion percentage - only 3 active goals
    const goalsList = [
      { completed: goals.quiz_completed || 0, target: goals.quiz_goal || 1 },
      { completed: goals.flashcards_reviewed || 0, target: goals.flashcard_goal || 10 },
      { completed: goals.chat_sessions || 0, target: goals.chat_goal || 1 }
    ];
    
    const totalProgress = goalsList.reduce((sum, goal) => sum + Math.min(goal.completed / goal.target, 1), 0);
    const completionPercentage = Math.round((totalProgress / 3) * 100);
    
    res.json({
      goalDate: goals.goal_date,
      goals: {
        quizzes: goals.quiz_goal || 1,
        flashcards: goals.flashcard_goal || 10,
        chatSessions: goals.chat_goal || 1,
        files: goals.file_goal || 1,
        studyMinutes: goals.study_time_goal || 30
      },
      progress: {
        quizzes: goals.quiz_completed || 0,
        flashcards: goals.flashcards_reviewed || 0,
        chatSessions: goals.chat_sessions || 0,
        files: goals.files_uploaded || 0,
        studyMinutes: goals.study_time_minutes || 0
      },
      isCompleted: goals.is_completed || false,
      completionPercentage
    });
    
  } catch (error) {
    logger.error('Stats', 'Error fetching daily goals:', error);
    res.status(500).json({ 
      error: { message: 'Failed to fetch daily goals' } 
    });
  }
});

router.put('/daily-goals', async (req, res) => {
  try {
    const userId = req.userId;
    const supabase = getSupabase();
    const { goals } = req.body;
    const today = new Date().toISOString().split('T')[0];
    
    if (!goals || typeof goals !== 'object') {
      return res.status(400).json({ error: { message: 'Goals object is required' } });
    }
    
    const { data: updatedGoals, error } = await supabase
      .from('user_daily_goals')
      .upsert({
        user_id: userId,
        goal_date: today,
        quiz_goal: goals.quizzes || 1,
        flashcard_goal: goals.flashcards || 10,
        chat_goal: goals.chatSessions || 1,
        file_goal: goals.files || 1,
        study_time_goal: goals.studyMinutes || 30,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    // Invalidate cache
    await invalidateCache([`dashboard:userId:${userId}`]);
    
    res.json({ success: true, goals: updatedGoals });
    
  } catch (error) {
    logger.error('Stats', 'Error updating daily goals:', error);
    res.status(500).json({ 
      error: { message: 'Failed to update daily goals' } 
    });
  }
});

// Get analytics data
router.get('/analytics', async (req, res) => {
  try {
    const userId = req.userId;
    const supabase = getSupabase();
    const { period = 'week', type = 'study_time' } = req.query;
    
    let startDate;
    const endDate = new Date();
    
    switch (period) {
      case 'week':
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    
    const { data: analyticsData, error } = await supabase
      .from('user_stats_daily')
      .select('stats_date, total_study_minutes, total_quizzes, total_flashcards')
      .eq('user_id', userId)
      .gte('stats_date', startDate.toISOString().split('T')[0])
      .order('stats_date', { ascending: true });
    
    if (error) {
      throw error;
    }
    
    const data = (analyticsData || []).map(row => {
      const date = new Date(row.stats_date);
      let value = 0;
      
      switch (type) {
        case 'study_time':
          value = row.total_study_minutes || 0;
          break;
        case 'quiz_count':
          value = row.total_quizzes || 0;
          break;
        case 'flashcard_count':
          value = row.total_flashcards || 0;
          break;
      }
      
      return {
        date: row.stats_date,
        value,
        label: date.toLocaleDateString('en-US', { weekday: 'short' })
      };
    });
    
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const average = data.length > 0 ? total / data.length : 0;
    
    res.json({
      period,
      type,
      data,
      summary: {
        total,
        average: Math.round(average * 10) / 10,
        trend: 'stable', // TODO: Calculate trend
        trendPercentage: 0
      }
    });
    
  } catch (error) {
    logger.error('Stats', 'Error fetching analytics:', error);
    res.status(500).json({ 
      error: { message: 'Failed to fetch analytics' } 
    });
  }
});

export default router;
