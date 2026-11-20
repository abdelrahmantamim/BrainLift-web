import express from 'express';
import { getSupabase } from '../config/services.config.js';
import logger from '../utils/serverLogger.js';

const router = express.Router();

// XP award amounts matching the plan
const XP_AWARDS = {
  quiz: 50,
  perfect_quiz: 100,
  flashcard: 30,
  chat: 20,
  upload: 25,
  daily_login: 10,
  daily_quests: 50,
  signup_bonus: 10,
  streak_bonus_7: 50,
  streak_bonus_30: 150,
  streak_bonus_100: 500,
};

// GET /api/xp/profile - Get user's XP profile
router.get('/profile', async (req, res) => {
  try {
    const userId = req.userId;
    const supabase = getSupabase();

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('total_xp, current_level, level_name, study_streak')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('XP', 'Error fetching XP profile:', error);
      return res.status(500).json({ error: { message: 'Failed to fetch XP profile' } });
    }

    // Calculate progress to next level
    const levelThresholds = [0, 200, 500, 900, 1500, 2500, 3500, 5000, 7000, 10000, Infinity];
    const currentLevelIndex = (profile.current_level || 1) - 1;
    const currentThreshold = levelThresholds[currentLevelIndex] || 0;
    const nextThreshold = levelThresholds[currentLevelIndex + 1] || Infinity;
    const xpInCurrentLevel = (profile.total_xp || 0) - currentThreshold;
    const xpNeededForNext = nextThreshold - currentThreshold;
    const progress = nextThreshold === Infinity ? 1 : xpInCurrentLevel / xpNeededForNext;

    res.json({
      totalXP: profile.total_xp || 0,
      level: profile.current_level || 1,
      levelName: profile.level_name || 'Curious Learner',
      streak: profile.study_streak || 0,
      progress: Math.min(Math.max(progress, 0), 1),
      xpToNextLevel: nextThreshold === Infinity ? 0 : nextThreshold - (profile.total_xp || 0),
      nextLevelXP: nextThreshold === Infinity ? null : nextThreshold,
    });
  } catch (error) {
    logger.error('XP', 'Error in /profile:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

// POST /api/xp/award - Award XP to user
router.post('/award', async (req, res) => {
  try {
    const userId = req.userId;
    const supabase = getSupabase();
    const { amount, reason, sourceType, sourceId, metadata } = req.body;

    if (!amount || !reason || !sourceType) {
      return res.status(400).json({ error: { message: 'amount, reason, and sourceType are required' } });
    }

    // Validate sourceType
    const validSourceTypes = ['quiz', 'flashcard', 'chat', 'upload', 'daily_login', 'daily_quests', 'achievement', 'streak_bonus', 'signup_bonus', 'perfect_quiz'];
    if (!validSourceTypes.includes(sourceType)) {
      return res.status(400).json({ error: { message: 'Invalid sourceType' } });
    }

    // Prevent duplicate daily_login awards
    if (sourceType === 'daily_login') {
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase
        .from('xp_transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('source_type', 'daily_login')
        .gte('created_at', `${today}T00:00:00Z`)
        .lt('created_at', `${today}T23:59:59Z`)
        .limit(1);

      if (existing && existing.length > 0) {
        return res.json({
          success: true,
          alreadyAwarded: true,
          message: 'Daily login XP already awarded today',
        });
      }
    }

    // Award XP using database function
    const { data, error } = await supabase.rpc('award_xp', {
      p_user_id: userId,
      p_amount: Math.max(0, Math.round(amount)),
      p_reason: reason,
      p_source_type: sourceType,
      p_source_id: sourceId || null,
      p_metadata: metadata || {},
    });

    if (error) {
      logger.error('XP', 'Error awarding XP:', error);
      return res.status(500).json({ error: { message: 'Failed to award XP' } });
    }

    const result = data?.[0] || {};

    res.json({
      success: true,
      xpAwarded: amount,
      totalXP: result.new_total_xp || 0,
      level: result.new_level || 1,
      levelName: result.new_level_name || 'Curious Learner',
      levelChanged: result.level_changed || false,
    });
  } catch (error) {
    logger.error('XP', 'Error in /award:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

// GET /api/xp/history - Get XP transaction history
router.get('/history', async (req, res) => {
  try {
    const userId = req.userId;
    const supabase = getSupabase();
    const { limit = 20, offset = 0 } = req.query;

    const { data: transactions, error, count } = await supabase
      .from('xp_transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      logger.error('XP', 'Error fetching XP history:', error);
      return res.status(500).json({ error: { message: 'Failed to fetch XP history' } });
    }

    res.json({
      transactions: (transactions || []).map(t => ({
        id: t.id,
        amount: t.amount,
        reason: t.reason,
        sourceType: t.source_type,
        sourceId: t.source_id,
        metadata: t.metadata,
        createdAt: t.created_at,
      })),
      pagination: {
        total: count || 0,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: (Number(offset) + Number(limit)) < (count || 0),
      },
    });
  } catch (error) {
    logger.error('XP', 'Error in /history:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

// GET /api/xp/leaderboard - Get XP leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const userId = req.userId;
    const supabase = getSupabase();
    const { limit = 10 } = req.query;

    const { data: leaders, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, total_xp, current_level, level_name')
      .order('total_xp', { ascending: false })
      .limit(Number(limit));

    if (error) {
      logger.error('XP', 'Error fetching leaderboard:', error);
      return res.status(500).json({ error: { message: 'Failed to fetch leaderboard' } });
    }

    // Find current user's rank
    const { count: userRank } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gt('total_xp', leaders?.find(l => l.id === userId)?.total_xp || 0);

    res.json({
      leaderboard: (leaders || []).map((l, index) => ({
        rank: index + 1,
        userId: l.id,
        name: l.full_name || 'Anonymous',
        avatarUrl: l.avatar_url,
        totalXP: l.total_xp,
        level: l.current_level,
        levelName: l.level_name,
        isCurrentUser: l.id === userId,
      })),
      userRank: (userRank || 0) + 1,
    });
  } catch (error) {
    logger.error('XP', 'Error in /leaderboard:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

// GET /api/xp/achievements - Get all achievements for user
router.get('/achievements', async (req, res) => {
  try {
    const userId = req.userId;
    const supabase = getSupabase();

    const { data: achievements, error } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false });

    if (error) {
      logger.error('XP', 'Error fetching achievements:', error);
      return res.status(500).json({ error: { message: 'Failed to fetch achievements' } });
    }

    // Define all available achievements
    const allAchievements = [
      { key: 'first_quiz', name: 'Quiz Master', description: 'Complete your first quiz', icon: 'trophy', points: 50, type: 'milestone' },
      { key: 'first_flashcard', name: 'Card Collector', description: 'Review your first flashcard deck', icon: 'cards', points: 30, type: 'milestone' },
      { key: 'first_chat', name: 'Curious Mind', description: 'Have your first AI chat session', icon: 'chatbubbles', points: 20, type: 'milestone' },
      { key: 'perfect_score', name: 'Perfectionist', description: 'Score 100% on a quiz', icon: 'star', points: 100, type: 'score' },
      { key: 'streak_3', name: 'Getting Started', description: 'Maintain a 3-day study streak', icon: 'flame', points: 75, type: 'streak' },
      { key: 'streak_7', name: 'Week Warrior', description: 'Maintain a 7-day study streak', icon: 'flame', points: 150, type: 'streak' },
      { key: 'streak_14', name: 'Fortnight Fighter', description: 'Maintain a 14-day study streak', icon: 'flame', points: 300, type: 'streak' },
      { key: 'streak_30', name: 'Monthly Master', description: 'Maintain a 30-day study streak', icon: 'flame', points: 500, type: 'streak' },
      { key: 'streak_100', name: 'Century Scholar', description: 'Maintain a 100-day study streak', icon: 'flame', points: 1000, type: 'streak' },
      { key: 'speed_demon', name: 'Speed Demon', description: 'Complete a quiz in under 2 minutes', icon: 'flash', points: 75, type: 'special' },
      { key: 'night_owl', name: 'Night Owl', description: 'Study after 10 PM', icon: 'moon', points: 25, type: 'special' },
      { key: 'early_bird', name: 'Early Bird', description: 'Study before 7 AM', icon: 'sunny', points: 25, type: 'special' },
    ];

    const unlockedKeys = new Set((achievements || []).map(a => a.achievement_key));

    res.json({
      unlocked: (achievements || []).map(a => ({
        id: a.id,
        key: a.achievement_key,
        name: a.achievement_name,
        description: a.achievement_description,
        icon: a.icon,
        pointsAwarded: a.points_awarded,
        unlockedAt: a.unlocked_at,
        type: a.achievement_type,
      })),
      available: allAchievements
        .filter(a => !unlockedKeys.has(a.key))
        .map(a => ({
          key: a.key,
          name: a.name,
          description: a.description,
          icon: a.icon,
          points: a.points,
          type: a.type,
        })),
      totalUnlocked: achievements?.length || 0,
      totalAvailable: allAchievements.length,
    });
  } catch (error) {
    logger.error('XP', 'Error in /achievements:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

// POST /api/xp/daily-login - Claim daily login XP
router.post('/daily-login', async (req, res) => {
  try {
    const userId = req.userId;
    const supabase = getSupabase();
    const today = new Date().toISOString().split('T')[0];

    // Check if already claimed today
    const { data: existing } = await supabase
      .from('xp_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('source_type', 'daily_login')
      .gte('created_at', `${today}T00:00:00Z`)
      .lt('created_at', `${today}T23:59:59Z`)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.json({
        success: true,
        alreadyClaimed: true,
        message: 'Daily login XP already claimed today',
      });
    }

    // Award daily login XP
    const { data, error } = await supabase.rpc('award_xp', {
      p_user_id: userId,
      p_amount: XP_AWARDS.daily_login,
      p_reason: 'Daily login bonus',
      p_source_type: 'daily_login',
      p_source_id: today,
      p_metadata: { date: today },
    });

    if (error) {
      logger.error('XP', 'Error awarding daily login XP:', error);
      return res.status(500).json({ error: { message: 'Failed to award daily login XP' } });
    }

    const result = data?.[0] || {};

    res.json({
      success: true,
      alreadyClaimed: false,
      xpAwarded: XP_AWARDS.daily_login,
      totalXP: result.new_total_xp || 0,
      level: result.new_level || 1,
      levelName: result.new_level_name || 'Curious Learner',
      levelChanged: result.level_changed || false,
    });
  } catch (error) {
    logger.error('XP', 'Error in /daily-login:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

export default router;
