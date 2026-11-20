-- Dashboard Real Data System - Database Migration
-- This migration creates all necessary tables for comprehensive user activity tracking
-- Run this in your Supabase SQL editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. User daily goals and progress tracking
CREATE TABLE IF NOT EXISTS user_daily_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  goal_date DATE NOT NULL,
  quiz_goal INTEGER DEFAULT 1,
  flashcard_goal INTEGER DEFAULT 10,
  chat_goal INTEGER DEFAULT 1,
  file_goal INTEGER DEFAULT 1,
  study_time_goal INTEGER DEFAULT 30, -- minutes
  quiz_completed INTEGER DEFAULT 0,
  flashcards_reviewed INTEGER DEFAULT 0,
  chat_sessions INTEGER DEFAULT 0,
  files_uploaded INTEGER DEFAULT 0,
  study_time_minutes INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, goal_date)
);

-- Add foreign key constraint based on existing user table structure
-- First check if profiles table exists, if not use auth.users
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    ALTER TABLE user_daily_goals ADD CONSTRAINT user_daily_goals_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  ELSE
    ALTER TABLE user_daily_goals ADD CONSTRAINT user_daily_goals_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL; -- Ignore if constraint already exists
END $$;

-- 2. User study sessions tracking (enhanced)
CREATE TABLE IF NOT EXISTS user_study_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_type TEXT NOT NULL, -- 'quiz', 'flashcard', 'chat', 'file_upload', 'file_study'
  content_id UUID, -- ID of the quiz, deck, conversation, or file
  content_title TEXT,
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  score DECIMAL(5,2), -- For quizzes and flashcard sessions
  questions_answered INTEGER,
  correct_answers INTEGER,
  metadata JSONB DEFAULT '{}', -- Additional session-specific data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraint for user_study_sessions
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    ALTER TABLE user_study_sessions ADD CONSTRAINT user_study_sessions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  ELSE
    ALTER TABLE user_study_sessions ADD CONSTRAINT user_study_sessions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. User achievements tracking
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  achievement_type TEXT NOT NULL, -- 'streak', 'score', 'quantity', 'special'
  achievement_key TEXT NOT NULL, -- 'first_quiz', '10_day_streak', 'perfect_score', etc.
  achievement_name TEXT NOT NULL,
  achievement_description TEXT,
  icon TEXT,
  points_awarded INTEGER DEFAULT 0,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, achievement_key)
);

-- Add foreign key constraint for user_achievements
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    ALTER TABLE user_achievements ADD CONSTRAINT user_achievements_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  ELSE
    ALTER TABLE user_achievements ADD CONSTRAINT user_achievements_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4. User stats summary (computed daily)
CREATE TABLE IF NOT EXISTS user_stats_daily (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  stats_date DATE NOT NULL,
  total_quizzes INTEGER DEFAULT 0,
  total_flashcards INTEGER DEFAULT 0,
  total_chat_sessions INTEGER DEFAULT 0,
  total_files_uploaded INTEGER DEFAULT 0,
  total_study_minutes INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  average_quiz_score DECIMAL(5,2),
  total_questions_answered INTEGER DEFAULT 0,
  total_correct_answers INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, stats_date)
);

-- Add foreign key constraint for user_stats_daily
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    ALTER TABLE user_stats_daily ADD CONSTRAINT user_stats_daily_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  ELSE
    ALTER TABLE user_stats_daily ADD CONSTRAINT user_stats_daily_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 5. Recent activity feed
CREATE TABLE IF NOT EXISTS user_recent_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL, -- 'quiz_completed', 'flashcard_session', 'chat_session', 'file_uploaded', 'achievement_unlocked'
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  metadata JSONB DEFAULT '{}', -- Store additional data like score, duration, etc.
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraint for user_recent_activities
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    ALTER TABLE user_recent_activities ADD CONSTRAINT user_recent_activities_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  ELSE
    ALTER TABLE user_recent_activities ADD CONSTRAINT user_recent_activities_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_daily_goals_user_date ON user_daily_goals(user_id, goal_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_study_sessions_user_time ON user_study_sessions(user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_user_study_sessions_type ON user_study_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_user_study_sessions_content ON user_study_sessions(content_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_type ON user_achievements(achievement_type);
CREATE INDEX IF NOT EXISTS idx_user_stats_daily_user_date ON user_stats_daily(user_id, stats_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_recent_activities_user_time ON user_recent_activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_recent_activities_type ON user_recent_activities(activity_type);

-- Row Level Security (RLS)
ALTER TABLE user_daily_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recent_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow users to access only their own data
-- For user_daily_goals
DROP POLICY IF EXISTS "Users can access own daily goals" ON user_daily_goals;
CREATE POLICY "Users can access own daily goals" ON user_daily_goals
  FOR ALL USING (auth.uid() = user_id);

-- For user_study_sessions  
DROP POLICY IF EXISTS "Users can access own study sessions" ON user_study_sessions;
CREATE POLICY "Users can access own study sessions" ON user_study_sessions
  FOR ALL USING (auth.uid() = user_id);

-- For user_achievements
DROP POLICY IF EXISTS "Users can access own achievements" ON user_achievements;
CREATE POLICY "Users can access own achievements" ON user_achievements
  FOR ALL USING (auth.uid() = user_id);

-- For user_stats_daily
DROP POLICY IF EXISTS "Users can access own stats" ON user_stats_daily;
CREATE POLICY "Users can access own stats" ON user_stats_daily
  FOR ALL USING (auth.uid() = user_id);

-- For user_recent_activities
DROP POLICY IF EXISTS "Users can access own activities" ON user_recent_activities;
CREATE POLICY "Users can access own activities" ON user_recent_activities
  FOR ALL USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Triggers to auto-update updated_at
DROP TRIGGER IF EXISTS update_user_daily_goals_updated_at ON user_daily_goals;
CREATE TRIGGER update_user_daily_goals_updated_at 
  BEFORE UPDATE ON user_daily_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_stats_daily_updated_at ON user_stats_daily;
CREATE TRIGGER update_user_stats_daily_updated_at 
  BEFORE UPDATE ON user_stats_daily
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate user streak
CREATE OR REPLACE FUNCTION calculate_user_streak(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    streak_count INTEGER := 0;
    check_date DATE := CURRENT_DATE;
    has_activity BOOLEAN;
BEGIN
    -- Check if user has activity today or yesterday (grace period)
    SELECT EXISTS(
        SELECT 1 FROM user_study_sessions
        WHERE user_id = p_user_id 
          AND DATE(start_time) >= CURRENT_DATE - INTERVAL '1 day'
    ) INTO has_activity;
    
    -- If no recent activity, streak is 0
    IF NOT has_activity THEN
        RETURN 0;
    END IF;
    
    -- Count consecutive days with activity
    LOOP
        SELECT EXISTS(
            SELECT 1 FROM user_study_sessions
            WHERE user_id = p_user_id 
              AND DATE(start_time) = check_date
        ) INTO has_activity;
        
        IF has_activity THEN
            streak_count := streak_count + 1;
            check_date := check_date - INTERVAL '1 day';
        ELSE
            EXIT;
        END IF;
        
        -- Safety limit to prevent infinite loops
        IF streak_count > 365 THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN streak_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update daily stats (called by activity tracking)
CREATE OR REPLACE FUNCTION update_user_daily_stats(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    today_date DATE := CURRENT_DATE;
    quiz_count INTEGER;
    flashcard_count INTEGER;
    chat_count INTEGER;
    file_count INTEGER;
    study_minutes INTEGER;
    total_points INTEGER;
    current_streak INTEGER;
    avg_quiz_score DECIMAL(5,2);
    total_questions INTEGER;
    total_correct INTEGER;
    best_streak_val INTEGER;
BEGIN
    -- Count today's activities
    SELECT COUNT(*) INTO quiz_count
    FROM user_study_sessions
    WHERE user_id = p_user_id 
      AND session_type = 'quiz'
      AND DATE(start_time) = today_date;
    
    SELECT COUNT(*) INTO flashcard_count
    FROM user_study_sessions
    WHERE user_id = p_user_id 
      AND session_type = 'flashcard'
      AND DATE(start_time) = today_date;
    
    SELECT COUNT(*) INTO chat_count
    FROM user_study_sessions
    WHERE user_id = p_user_id 
      AND session_type = 'chat'
      AND DATE(start_time) = today_date;
    
    SELECT COUNT(*) INTO file_count
    FROM user_study_sessions
    WHERE user_id = p_user_id 
      AND session_type IN ('file_upload', 'file_study')
      AND DATE(start_time) = today_date;
    
    SELECT COALESCE(SUM(duration_minutes), 0) INTO study_minutes
    FROM user_study_sessions
    WHERE user_id = p_user_id 
      AND DATE(start_time) = today_date;
    
    -- Calculate total questions and correct answers
    SELECT 
        COALESCE(SUM(questions_answered), 0),
        COALESCE(SUM(correct_answers), 0)
    INTO total_questions, total_correct
    FROM user_study_sessions
    WHERE user_id = p_user_id 
      AND DATE(start_time) = today_date;
    
    -- Calculate average quiz score for today
    SELECT AVG(score) INTO avg_quiz_score
    FROM user_study_sessions
    WHERE user_id = p_user_id 
      AND session_type = 'quiz'
      AND score IS NOT NULL
      AND DATE(start_time) = today_date;
    
    -- Calculate current streak
    SELECT calculate_user_streak(p_user_id) INTO current_streak;
    
    -- Get best streak from previous records or current
    SELECT COALESCE(MAX(best_streak), 0) INTO best_streak_val
    FROM user_stats_daily
    WHERE user_id = p_user_id;
    
    best_streak_val := GREATEST(best_streak_val, current_streak);
    
    -- Calculate total points from achievements
    SELECT COALESCE(SUM(points_awarded), 0) INTO total_points
    FROM user_achievements
    WHERE user_id = p_user_id;
    
    -- Upsert daily stats
    INSERT INTO user_stats_daily (
        user_id, stats_date, total_quizzes, total_flashcards, 
        total_chat_sessions, total_files_uploaded, total_study_minutes,
        total_points, current_streak, best_streak, average_quiz_score,
        total_questions_answered, total_correct_answers
    )
    VALUES (
        p_user_id, today_date, quiz_count, flashcard_count,
        chat_count, file_count, study_minutes, total_points, 
        current_streak, best_streak_val, avg_quiz_score,
        total_questions, total_correct
    )
    ON CONFLICT (user_id, stats_date)
    DO UPDATE SET
        total_quizzes = EXCLUDED.total_quizzes,
        total_flashcards = EXCLUDED.total_flashcards,
        total_chat_sessions = EXCLUDED.total_chat_sessions,
        total_files_uploaded = EXCLUDED.total_files_uploaded,
        total_study_minutes = EXCLUDED.total_study_minutes,
        total_points = EXCLUDED.total_points,
        current_streak = EXCLUDED.current_streak,
        best_streak = EXCLUDED.best_streak,
        average_quiz_score = EXCLUDED.average_quiz_score,
        total_questions_answered = EXCLUDED.total_questions_answered,
        total_correct_answers = EXCLUDED.total_correct_answers,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get optimized conversation messages (if not exists)
CREATE OR REPLACE FUNCTION get_conversation_messages(
    p_conversation_id UUID,
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    role TEXT,
    content TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cc.id,
        cc.role,
        cc.content,
        cc.created_at
    FROM chat_conversations cc
    WHERE cc.session_id = p_conversation_id 
      AND cc.user_id = p_user_id
    ORDER BY cc.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Insert some initial achievements if they don't exist
INSERT INTO user_achievements (user_id, achievement_type, achievement_key, achievement_name, achievement_description, icon, points_awarded)
SELECT 
    id as user_id,
    'welcome' as achievement_type,
    'account_created' as achievement_key,
    'Welcome to BrainLift!' as achievement_name,
    'You''ve successfully created your account' as achievement_description,
    'star' as icon,
    50 as points_awarded
FROM (SELECT id FROM profiles LIMIT 0) p  -- This will create the structure but not insert data
ON CONFLICT (user_id, achievement_key) DO NOTHING;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON user_daily_goals TO authenticated;
GRANT ALL ON user_study_sessions TO authenticated;
GRANT ALL ON user_achievements TO authenticated;
GRANT ALL ON user_stats_daily TO authenticated;
GRANT ALL ON user_recent_activities TO authenticated;

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE 'Dashboard tracking tables created successfully!';
    RAISE NOTICE 'Tables created: user_daily_goals, user_study_sessions, user_achievements, user_stats_daily, user_recent_activities';
    RAISE NOTICE 'Functions created: calculate_user_streak, update_user_daily_stats, get_conversation_messages';
    RAISE NOTICE 'All tables have RLS enabled and proper indexes for performance';
END $$;