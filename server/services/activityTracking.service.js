import { getSupabase } from '../config/services.config.js';
import logger from '../utils/serverLogger.js';
import { clearDashboardCache } from '../middleware/cache.middleware.js';

/**
 * Activity Tracking Service
 * Centralized service for tracking user activities across the application
 */
class ActivityTrackingService {
  
  /**
   * Track user activity and update all related tracking tables
   * @param {string} userId - User ID
   * @param {Object} activityData - Activity data
   * @param {string} activityData.sessionType - Type of session: 'quiz', 'flashcard', 'chat', 'file_upload', 'file_study'
   * @param {string} [activityData.contentId] - ID of the content (quiz, deck, conversation, file)
   * @param {string} [activityData.contentTitle] - Title of the content
   * @param {string} [activityData.startTime] - ISO string of start time
   * @param {string} [activityData.endTime] - ISO string of end time
   * @param {number} [activityData.score] - Score percentage (0-100)
   * @param {number} [activityData.questionsAnswered] - Number of questions answered
   * @param {number} [activityData.correctAnswers] - Number of correct answers
   * @param {Object} [activityData.metadata] - Additional metadata
   * @returns {Promise<Object>} Session data
   */
  async trackActivity(userId, activityData) {
    const supabase = getSupabase();
    const {
      sessionType,
      contentId,
      contentTitle,
      startTime,
      endTime,
      score,
      questionsAnswered,
      correctAnswers,
      metadata = {}
    } = activityData;
    
    try {
      // Calculate duration if both times provided
      const durationMinutes = endTime && startTime 
        ? Math.round((new Date(endTime) - new Date(startTime)) / 1000 / 60)
        : null;
      
      // Insert study session record
      const { data: session, error: sessionError } = await supabase
        .from('user_study_sessions')
        .insert({
          user_id: userId,
          session_type: sessionType,
          content_id: contentId,
          content_title: contentTitle,
          start_time: startTime || new Date().toISOString(),
          end_time: endTime,
          duration_minutes: durationMinutes,
          score,
          questions_answered: questionsAnswered,
          correct_answers: correctAnswers,
          metadata
        })
        .select('id')
        .single();
      
      if (sessionError) {
        logger.error('ActivityTracking', 'Error tracking study session:', JSON.stringify(sessionError, null, 2));
        logger.error('ActivityTracking', 'Session data attempted:', {
          user_id: userId,
          session_type: sessionType,
          content_id: contentId,
          content_title: contentTitle,
          duration_minutes: durationMinutes
        });
        throw sessionError;
      }
      
      // Add to recent activities
      const activityTitle = this.getActivityTitle(sessionType, contentTitle, score, questionsAnswered);
      const activityDescription = this.getActivityDescription(sessionType, score, questionsAnswered, durationMinutes);
      const pointsEarned = this.calculatePointsEarned(sessionType, score, questionsAnswered, durationMinutes);
      
      await supabase
        .from('user_recent_activities')
        .insert({
          user_id: userId,
          activity_type: this.getActivityType(sessionType),
          title: activityTitle,
          description: activityDescription,
          icon: this.getActivityIcon(sessionType),
          points_earned: pointsEarned,
          metadata: {
            ...metadata,
            score,
            questionsAnswered,
            correctAnswers,
            duration: durationMinutes,
            sessionId: session.id
          }
        });
      
      // Update daily goals progress
      await this.updateDailyGoalsProgress(supabase, userId, sessionType, questionsAnswered, durationMinutes);
      
      // Update daily stats using the database function
      await supabase.rpc('update_user_daily_stats', { p_user_id: userId });
      
      // Check for achievements
      await this.checkAndUnlockAchievements(supabase, userId, sessionType, score, questionsAnswered);

      // Award XP based on activity
      await this.awardActivityXP(supabase, userId, sessionType, pointsEarned, score, session.id);

      logger.info('ActivityTracking', `Successfully tracked ${sessionType} activity for user ${userId}`);
      
      // Invalidate dashboard cache for this user to force fresh data
      try {
        await clearDashboardCache(userId);
        logger.info('ActivityTracking', `Cleared dashboard cache for user ${userId}`);
      } catch (cacheError) {
        logger.error('ActivityTracking', 'Failed to clear cache:', cacheError);
        // Continue even if cache clear fails
      }
      
      return {
        ...session,
        pointsEarned,
        activityTitle,
        activityDescription
      };
      
    } catch (error) {
      logger.error('ActivityTracking', 'Error in trackActivity:', JSON.stringify(error, null, 2));
      logger.error('ActivityTracking', 'Error message:', error?.message);
      logger.error('ActivityTracking', 'Error stack:', error?.stack);
      throw error;
    }
  }
  
  /**
   * Update daily goals progress based on activity
   */
  async updateDailyGoalsProgress(supabase, userId, sessionType, questionsAnswered, duration) {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      // Get or create today's goals
      const { data: goals, error } = await supabase
        .from('user_daily_goals')
        .select('*')
        .eq('user_id', userId)
        .eq('goal_date', today)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        logger.error('ActivityTracking', 'Error fetching daily goals:', error);
        return;
      }
      
      // Create default goals if none exist - simplified to just 3 goals
      if (!goals) {
        await supabase
          .from('user_daily_goals')
          .insert({
            user_id: userId,
            goal_date: today,
            quiz_goal: 1,
            flashcard_goal: 1,  // Changed to 1 - any flashcard review counts
            chat_goal: 1,
            file_goal: 0,  // Disabled
            study_time_goal: 0  // Disabled
          });
        return;
      }
      
      // Update progress based on activity type
      const updates = {};
      
      switch (sessionType) {
        case 'quiz':
          updates.quiz_completed = (goals.quiz_completed || 0) + 1;
          break;
        case 'flashcard':
          updates.flashcards_reviewed = (goals.flashcards_reviewed || 0) + (questionsAnswered || 0);
          break;
        case 'chat':
          updates.chat_sessions = (goals.chat_sessions || 0) + 1;
          break;
        case 'file_upload':
          updates.files_uploaded = (goals.files_uploaded || 0) + 1;
          break;
      }
      
      if (duration) {
        updates.study_time_minutes = (goals.study_time_minutes || 0) + duration;
      }
      
      // Check if goals are completed - only check the 3 active goals
      const isCompleted = 
        (updates.quiz_completed || goals.quiz_completed || 0) >= (goals.quiz_goal || 1) &&
        (updates.flashcards_reviewed || goals.flashcards_reviewed || 0) >= (goals.flashcard_goal || 1) &&
        (updates.chat_sessions || goals.chat_sessions || 0) >= (goals.chat_goal || 1);
      
      if (isCompleted && !goals.is_completed) {
        updates.is_completed = true;
        // Streak will be calculated by the database function when needed
        logger.info('ActivityTracking', `Daily goals completed for user ${userId} on ${today}`);
      }
      
      updates.updated_at = new Date().toISOString();
      
      await supabase
        .from('user_daily_goals')
        .update(updates)
        .eq('user_id', userId)
        .eq('goal_date', today);
        
    } catch (error) {
      logger.error('ActivityTracking', 'Error updating daily goals:', error);
    }
  }
  
  /**
   * Check and unlock achievements based on activity
   */
  async checkAndUnlockAchievements(supabase, userId, sessionType, score, questionsAnswered) {
    try {
      const achievements = [];
      
      // First-time achievements
      const { data: existingAchievements } = await supabase
        .from('user_achievements')
        .select('achievement_key')
        .eq('user_id', userId);
      
      const achievementKeys = new Set(existingAchievements?.map(a => a.achievement_key) || []);
      
      // First quiz completion
      if (sessionType === 'quiz' && !achievementKeys.has('first_quiz')) {
        achievements.push({
          achievement_type: 'milestone',
          achievement_key: 'first_quiz',
          achievement_name: 'Quiz Master',
          achievement_description: 'Completed your first quiz!',
          icon: 'trophy',
          points_awarded: 50
        });
      }
      
      // Perfect score achievement
      if (sessionType === 'quiz' && score === 100 && !achievementKeys.has('perfect_score')) {
        achievements.push({
          achievement_type: 'score',
          achievement_key: 'perfect_score',
          achievement_name: 'Perfect!',
          achievement_description: 'Scored 100% on a quiz!',
          icon: 'star',
          points_awarded: 100
        });
      }
      
      // Flashcard achievements
      if (sessionType === 'flashcard' && !achievementKeys.has('first_flashcard')) {
        achievements.push({
          achievement_type: 'milestone',
          achievement_key: 'first_flashcard',
          achievement_name: 'Card Shark',
          achievement_description: 'Completed your first flashcard session!',
          icon: 'cards',
          points_awarded: 30
        });
      }
      
      // Study streak achievements (check separately)
      await this.checkStreakAchievements(supabase, userId, achievementKeys);
      
      // Insert new achievements
      if (achievements.length > 0) {
        const achievementRecords = achievements.map(achievement => ({
          user_id: userId,
          ...achievement
        }));
        
        await supabase
          .from('user_achievements')
          .insert(achievementRecords);
        
        // Add achievement notifications to recent activities
        for (const achievement of achievements) {
          await supabase
            .from('user_recent_activities')
            .insert({
              user_id: userId,
              activity_type: 'achievement_unlocked',
              title: achievement.achievement_name,
              description: achievement.achievement_description,
              icon: achievement.icon,
              points_earned: achievement.points_awarded,
              metadata: { achievement_key: achievement.achievement_key }
            });
        }
        
        logger.info('ActivityTracking', `Unlocked ${achievements.length} achievements for user ${userId}`);
      }
      
    } catch (error) {
      logger.error('ActivityTracking', 'Error checking achievements:', error);
    }
  }
  
  /**
   * Check streak-based achievements
   */
  async checkStreakAchievements(supabase, userId, achievementKeys) {
    try {
      // Get current streak using the database function
      const { data: streakData } = await supabase.rpc('calculate_user_streak', { p_user_id: userId });
      const currentStreak = streakData || 0;
      
      const streakAchievements = [
        { days: 3, key: '3_day_streak', name: 'Getting Started', description: '3-day study streak!', points: 75 },
        { days: 7, key: '7_day_streak', name: 'Week Warrior', description: '7-day study streak!', points: 150 },
        { days: 14, key: '14_day_streak', name: 'Two Weeks Strong', description: '14-day study streak!', points: 300 },
        { days: 30, key: '30_day_streak', name: 'Monthly Master', description: '30-day study streak!', points: 500 }
      ];
      
      const newStreakAchievements = streakAchievements
        .filter(streak => currentStreak >= streak.days && !achievementKeys.has(streak.key))
        .map(streak => ({
          user_id: userId,
          achievement_type: 'streak',
          achievement_key: streak.key,
          achievement_name: streak.name,
          achievement_description: streak.description,
          icon: 'flame',
          points_awarded: streak.points
        }));
      
      if (newStreakAchievements.length > 0) {
        await supabase
          .from('user_achievements')
          .insert(newStreakAchievements);
          
        // Add to recent activities
        for (const achievement of newStreakAchievements) {
          await supabase
            .from('user_recent_activities')
            .insert({
              user_id: userId,
              activity_type: 'achievement_unlocked',
              title: achievement.achievement_name,
              description: achievement.achievement_description,
              icon: achievement.icon,
              points_earned: achievement.points_awarded,
              metadata: { achievement_key: achievement.achievement_key, streak_days: currentStreak }
            });
        }
      }
      
    } catch (error) {
      logger.error('ActivityTracking', 'Error checking streak achievements:', error);
    }
  }
  
  // Helper methods for activity formatting
  getActivityTitle(sessionType, contentTitle, score, questionsAnswered) {
    switch (sessionType) {
      case 'quiz':
        return contentTitle || 'Quiz Completed';
      case 'flashcard':
        return contentTitle || 'Flashcard Session';
      case 'chat':
        return contentTitle || 'AI Chat Session';
      case 'file_upload':
      case 'file_study':
        return contentTitle || 'File Study Session';
      default:
        return 'Study Session';
    }
  }
  
  getActivityDescription(sessionType, score, questionsAnswered, duration) {
    switch (sessionType) {
      case 'quiz':
        if (score !== null && score !== undefined && questionsAnswered) {
          return `Scored ${score}% on ${questionsAnswered} questions`;
        }
        return 'Completed quiz';
      case 'flashcard':
        if (questionsAnswered) {
          return `Reviewed ${questionsAnswered} flashcards`;
        }
        return 'Reviewed flashcards';
      case 'chat':
        if (duration) {
          return `Chat session for ${duration} minutes`;
        }
        return 'Had AI chat session';
      case 'file_upload':
        return 'Uploaded study material';
      case 'file_study':
        return 'Studied uploaded material';
      default:
        return 'Study activity completed';
    }
  }
  
  getActivityIcon(sessionType) {
    // Names must be valid Ionicons (the mobile home screen renders them with
    // <Ionicons name={...} />). 'cards' is NOT a valid Ionicon — use 'albums'
    // to match the Flashcards tab bar icon.
    const iconMap = {
      quiz: 'trophy',
      flashcard: 'albums',
      chat: 'chatbubbles',
      file_upload: 'cloud-upload',
      file_study: 'book'
    };
    return iconMap[sessionType] || 'checkmark-circle';
  }
  
  getActivityType(sessionType) {
    const typeMap = {
      quiz: 'quiz_completed',
      flashcard: 'flashcard_session',
      chat: 'chat_session',
      file_upload: 'file_uploaded',
      file_study: 'file_studied'
    };
    return typeMap[sessionType] || 'activity_completed';
  }
  
  calculatePointsEarned(sessionType, score, questionsAnswered, duration) {
    let basePoints = 0;
    
    switch (sessionType) {
      case 'quiz':
        basePoints = Math.round((score || 0) / 100 * (questionsAnswered || 10) * 2);
        break;
      case 'flashcard':
        basePoints = Math.min((questionsAnswered || 0), 50); // Max 50 points
        break;
      case 'chat':
        basePoints = Math.min(Math.round((duration || 0) / 5), 30); // 1 point per 5 minutes, max 30
        break;
      case 'file_upload':
        basePoints = 20;
        break;
      case 'file_study':
        basePoints = Math.min(Math.round((duration || 0) / 10), 20); // 1 point per 10 minutes, max 20
        break;
    }
    
    return Math.max(basePoints, 5); // Minimum 5 points for any activity
  }

  /**
   * Award XP for an activity using the database function
   */
  async awardActivityXP(supabase, userId, sessionType, pointsEarned, score, sessionId) {
    try {
      const xpSourceMap = {
        quiz: 'quiz',
        flashcard: 'flashcard',
        chat: 'chat',
        file_upload: 'upload',
        file_study: 'upload',
      };

      const sourceType = xpSourceMap[sessionType] || 'quiz';
      let xpAmount = pointsEarned;
      const reason = this.getXPReason(sessionType, score);

      // Award base XP
      await supabase.rpc('award_xp', {
        p_user_id: userId,
        p_amount: xpAmount,
        p_reason: reason,
        p_source_type: sourceType,
        p_source_id: sessionId || null,
        p_metadata: { sessionType, score },
      });

      // Award perfect quiz bonus
      if (sessionType === 'quiz' && score === 100) {
        await supabase.rpc('award_xp', {
          p_user_id: userId,
          p_amount: 100,
          p_reason: 'Perfect quiz score bonus!',
          p_source_type: 'perfect_quiz',
          p_source_id: sessionId || null,
          p_metadata: { sessionType, score },
        });
      }

      logger.info('ActivityTracking', `Awarded ${xpAmount} XP to user ${userId} for ${sessionType}`);
    } catch (error) {
      // Don't throw - XP award failure shouldn't break activity tracking
      logger.error('ActivityTracking', 'Error awarding XP:', error?.message);
    }
  }

  getXPReason(sessionType, score) {
    switch (sessionType) {
      case 'quiz':
        return score === 100 ? 'Completed quiz with perfect score!' : 'Completed a quiz';
      case 'flashcard':
        return 'Reviewed flashcard deck';
      case 'chat':
        return 'AI tutoring session';
      case 'file_upload':
        return 'Uploaded study material';
      case 'file_study':
        return 'Studied uploaded material';
      default:
        return 'Study activity completed';
    }
  }

  /**
   * Get user's dashboard statistics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Dashboard statistics
   */
  async getDashboardStats(userId) {
    const supabase = getSupabase();
    
    try {
      // Get user profile including XP data
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, student_type, total_xp, current_level, level_name, study_streak')
        .eq('id', userId)
        .single();
      
      // Get current stats from daily stats table (latest entry)
      let { data: latestStats } = await supabase
        .from('user_stats_daily')
        .select('*')
        .eq('user_id', userId)
        .order('stats_date', { ascending: false })
        .limit(1)
        .single();
      
      // If no stats in new table, calculate from existing data
      if (!latestStats) {
        logger.info('ActivityTracking', 'No stats in user_stats_daily, calculating from existing data');
        
        // Get quiz count - number of quizzes created by the user
        const { count: quizCount } = await supabase
          .from('quizzes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);
        
        // Get study sessions count
        const { count: sessionCount } = await supabase
          .from('study_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);
        
        // Get total study hours from chat conversations
        const { data: conversations } = await supabase
          .from('chat_conversations')
          .select('created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });
        
        let totalHours = 0;
        if (conversations && conversations.length > 0) {
          const sessionDurations = [];
          for (let i = 0; i < conversations.length - 1; i++) {
            const current = new Date(conversations[i].created_at);
            const next = new Date(conversations[i + 1].created_at);
            const diffMinutes = (next - current) / (1000 * 60);
            if (diffMinutes <= 30) {
              sessionDurations.push(diffMinutes);
            }
          }
          const totalMinutes = sessionDurations.reduce((sum, duration) => sum + duration, 0);
          totalHours = Math.round(totalMinutes / 60 * 10) / 10;
        }
        
        // Calculate streak
        let streakData = 0;
        try {
          const { data } = await supabase.rpc('calculate_user_streak', { p_user_id: userId });
          streakData = data || 0;
        } catch (error) {
          logger.warn('ActivityTracking', 'Failed to calculate streak:', error);
          streakData = 0;
        }
        
        // Create temporary stats object
        latestStats = {
          total_quizzes: quizCount || 0,
          total_flashcards: 0, // Will be 0 for now
          total_chat_sessions: sessionCount || 0,
          total_study_minutes: Math.round(totalHours * 60),
          current_streak: streakData || 0,
          best_streak: streakData || 0,
          total_points: 0, // Will be 0 for now
          average_quiz_score: 0,
          total_questions_answered: 0,
          total_correct_answers: 0
        };
      }
      
      // Get today's daily goals
      const today = new Date().toISOString().split('T')[0];
      const { data: dailyGoal } = await supabase
        .from('user_daily_goals')
        .select('*')
        .eq('user_id', userId)
        .eq('goal_date', today)
        .single();
      
      // Get recent activities (last 10)
      const { data: recentActivities } = await supabase
        .from('user_recent_activities')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      // Get recent achievements (last 5)
      const { data: achievements } = await supabase
        .from('user_achievements')
        .select('id, achievement_type, achievement_name, achievement_description, icon, points_awarded, unlocked_at, metadata')
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false })
        .limit(5);
      
      return {
        user: {
          id: userId,
          name: profile?.full_name || profile?.email?.split('@')[0] || 'Student',
          email: profile?.email,
          avatar_url: profile?.avatar_url,
          student_type: profile?.student_type,
          totalXP: profile?.total_xp || 0,
          level: profile?.current_level || 1,
          levelName: profile?.level_name || 'Curious Learner',
        },
        currentStats: {
          totalQuizzes: latestStats?.total_quizzes || 0,
          totalFlashcards: latestStats?.total_flashcards || 0,
          totalSessions: latestStats?.total_chat_sessions || 0,
          totalStudyMinutes: latestStats?.total_study_minutes || 0,
          currentStreak: latestStats?.current_streak || 0,
          bestStreak: latestStats?.best_streak || 0,
          totalPoints: latestStats?.total_points || 0,
          averageQuizScore: latestStats?.average_quiz_score || 0,
          questionsAnswered: latestStats?.total_questions_answered || 0,
          correctAnswers: latestStats?.total_correct_answers || 0
        },
        dailyGoal,
        recentActivities: (recentActivities || []).map(activity => ({
          id: activity.id,
          type: activity.activity_type,
          title: activity.title,
          description: activity.description,
          icon: activity.icon,
          pointsEarned: activity.points_earned,
          timestamp: activity.created_at,
          metadata: activity.metadata
        })),
        achievements: (achievements || []).map(achievement => ({
          id: achievement.id,
          type: achievement.achievement_type,
          name: achievement.achievement_name,
          description: achievement.achievement_description,
          icon: achievement.icon,
          pointsAwarded: achievement.points_awarded,
          unlockedAt: achievement.unlocked_at,
          metadata: achievement.metadata
        }))
      };
    } catch (error) {
      logger.error('ActivityTracking', 'Error fetching dashboard stats:', error);
      throw error;
    }
  }
}

export default new ActivityTrackingService();