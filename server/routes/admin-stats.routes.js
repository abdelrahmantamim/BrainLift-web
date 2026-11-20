import express from 'express';
import { requireAdminAuth } from '../middleware/adminAuth.middleware.js';
import { getSupabase } from '../config/services.config.js';

const router = express.Router();

// Get dashboard statistics
router.get('/dashboard', requireAdminAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { timeRange = '7d' } = req.query;
    
    // Calculate date range
    let startDate = new Date();
    switch (timeRange) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }
    
    // Get various counts
    const [
      { count: totalUsers },
      { count: activeUsers },
      { count: totalQuizzes },
      { count: totalFlashcards },
      { count: totalFiles },
      { data: recentUsers },
      { data: aiUsage }
    ] = await Promise.all([
      // Total users
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      
      // Active users (logged in within timeRange)
      supabase.from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_seen', startDate.toISOString()),
      
      // Total quizzes
      supabase.from('quizzes').select('*', { count: 'exact', head: true }),
      
      // Total flashcard sets
      supabase.from('flashcard_sets').select('*', { count: 'exact', head: true }),
      
      // Total files
      supabase.from('files').select('*', { count: 'exact', head: true }),
      
      // Recent user signups
      supabase.from('profiles')
        .select('id, email, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
      
      // AI usage stats
      supabase.from('profiles')
        .select('daily_ai_requests, monthly_ai_requests, total_ai_requests')
    ]);
    
    // Calculate AI usage totals
    const aiStats = {
      daily: aiUsage?.reduce((sum, user) => sum + (user.daily_ai_requests || 0), 0) || 0,
      monthly: aiUsage?.reduce((sum, user) => sum + (user.monthly_ai_requests || 0), 0) || 0,
      total: aiUsage?.reduce((sum, user) => sum + (user.total_ai_requests || 0), 0) || 0
    };
    
    res.json({
      overview: {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalQuizzes: totalQuizzes || 0,
        totalFlashcards: totalFlashcards || 0,
        totalFiles: totalFiles || 0
      },
      aiUsage: aiStats,
      recentUsers: recentUsers || [],
      timeRange,
      period: {
        start: startDate.toISOString(),
        end: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Admin Stats] Error fetching dashboard stats:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch dashboard statistics' }
    });
  }
});

// Get growth statistics
router.get('/growth', requireAdminAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { period = 'daily', days = 30 } = req.query;
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(days));
    
    // Get user growth data
    const { data: users, error } = await supabase
      .from('profiles')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    // Group by period
    const growth = {};
    users.forEach(user => {
      const date = new Date(user.created_at);
      let key;
      
      if (period === 'daily') {
        key = date.toISOString().split('T')[0];
      } else if (period === 'weekly') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else if (period === 'monthly') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      
      growth[key] = (growth[key] || 0) + 1;
    });
    
    // Convert to array and fill gaps
    const growthData = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      let key;
      if (period === 'daily') {
        key = currentDate.toISOString().split('T')[0];
      } else if (period === 'weekly') {
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else if (period === 'monthly') {
        key = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      }
      
      growthData.push({
        date: key,
        newUsers: growth[key] || 0
      });
      
      if (period === 'daily') {
        currentDate.setDate(currentDate.getDate() + 1);
      } else if (period === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (period === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }
    
    res.json({
      period,
      data: growthData,
      total: users.length,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    });
  } catch (error) {
    console.error('[Admin Stats] Error fetching growth stats:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch growth statistics' }
    });
  }
});

// Get content statistics
router.get('/content', requireAdminAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    
    // Get content statistics
    const [
      { data: quizStats },
      { data: flashcardStats },
      { data: fileStats },
      { data: popularQuizzes },
      { data: activeCreators }
    ] = await Promise.all([
      // Quiz statistics by difficulty
      supabase.from('quizzes')
        .select('difficulty')
        .then(({ data }) => {
          const stats = { easy: 0, medium: 0, hard: 0 };
          data?.forEach(quiz => {
            stats[quiz.difficulty || 'medium']++;
          });
          return { data: stats };
        }),
      
      // Flashcard statistics
      supabase.from('flashcard_sets')
        .select('card_count')
        .then(({ data }) => {
          const totalCards = data?.reduce((sum, set) => sum + (set.card_count || 0), 0) || 0;
          return { data: { sets: data?.length || 0, cards: totalCards } };
        }),
      
      // File statistics by type
      supabase.from('files')
        .select('type')
        .then(({ data }) => {
          const stats = {};
          data?.forEach(file => {
            const type = file.type || 'unknown';
            stats[type] = (stats[type] || 0) + 1;
          });
          return { data: stats };
        }),
      
      // Popular quizzes (most attempted)
      supabase.from('quiz_attempts')
        .select('quiz_id')
        .then(async ({ data }) => {
          const attemptCounts = {};
          data?.forEach(attempt => {
            attemptCounts[attempt.quiz_id] = (attemptCounts[attempt.quiz_id] || 0) + 1;
          });
          
          const topQuizIds = Object.entries(attemptCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id]) => id);
          
          if (topQuizIds.length > 0) {
            const { data: quizzes } = await supabase
              .from('quizzes')
              .select('id, title')
              .in('id', topQuizIds);
            
            return {
              data: topQuizIds.map(id => {
                const quiz = quizzes?.find(q => q.id === id);
                return {
                  id,
                  title: quiz?.title || 'Unknown Quiz',
                  attempts: attemptCounts[id]
                };
              })
            };
          }
          return { data: [] };
        }),
      
      // Most active content creators
      supabase.from('quizzes')
        .select('user_id')
        .then(async ({ data }) => {
          const contentCounts = {};
          data?.forEach(quiz => {
            contentCounts[quiz.user_id] = (contentCounts[quiz.user_id] || 0) + 1;
          });
          
          const topUserIds = Object.entries(contentCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id]) => id);
          
          if (topUserIds.length > 0) {
            const { data: users } = await supabase
              .from('profiles')
              .select('id, email, name')
              .in('id', topUserIds);
            
            return {
              data: topUserIds.map(id => {
                const user = users?.find(u => u.id === id);
                return {
                  id,
                  email: user?.email || 'Unknown',
                  name: user?.name || 'Unknown',
                  contentCount: contentCounts[id]
                };
              })
            };
          }
          return { data: [] };
        })
    ]);
    
    res.json({
      quizzes: {
        byDifficulty: quizStats,
        total: Object.values(quizStats).reduce((sum, count) => sum + count, 0)
      },
      flashcards: flashcardStats,
      files: {
        byType: fileStats,
        total: Object.values(fileStats).reduce((sum, count) => sum + count, 0)
      },
      popular: {
        quizzes: popularQuizzes || []
      },
      creators: {
        topCreators: activeCreators || []
      }
    });
  } catch (error) {
    console.error('[Admin Stats] Error fetching content stats:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch content statistics' }
    });
  }
});

// Get system health statistics
router.get('/health', requireAdminAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    
    // Get error logs (if we have an errors table)
    // For now, we'll return basic health metrics
    
    const [
      { count: totalUsers },
      { data: recentRequests }
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles')
        .select('last_request_date')
        .not('last_request_date', 'is', null)
        .order('last_request_date', { ascending: false })
        .limit(100)
    ]);
    
    // Calculate request rate
    const now = new Date();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const recentRequestCount = recentRequests?.filter(r => 
      new Date(r.last_request_date) > oneHourAgo
    ).length || 0;
    
    res.json({
      status: 'healthy',
      metrics: {
        totalUsers: totalUsers || 0,
        requestsPerHour: recentRequestCount,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Admin Stats] Error fetching health stats:', error);
    res.status(500).json({
      status: 'error',
      error: { message: 'Failed to fetch health statistics' }
    });
  }
});

export default router;