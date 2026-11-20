-- Atomically check a feature usage limit and increment if under it.
-- Returns: allowed boolean, current_usage int.
--
-- period:      'daily' | 'weekly' | 'lifetime'
-- p_limit:     -1 = unlimited (still increments for analytics), 0 = blocked, N = cap
-- p_today:     caller-computed current date string (UTC, 'YYYY-MM-DD') — matches
--              the JS `new Date().toISOString().split('T')[0]`
-- p_week_start: caller-computed Monday-of-week string — matches the JS
--              `getCurrentWeekStart()` (local Monday). Passed in (not computed in
--              SQL) so reset semantics exactly match the application's.
--
-- The SELECT ... FOR UPDATE serializes concurrent requests for the same user, so
-- two requests cannot both pass the check against the same remaining slot.

CREATE OR REPLACE FUNCTION check_and_increment_usage(
  p_user_id uuid,
  p_feature text,
  p_period text,
  p_limit int,
  p_today date,
  p_week_start date
) RETURNS TABLE(allowed boolean, current_usage int)
LANGUAGE plpgsql
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_used int;
  v_is_new_day boolean;
  v_is_new_week boolean;
  v_daily jsonb;
  v_weekly jsonb;
  v_lifetime jsonb;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0; RETURN;
  END IF;

  v_is_new_day  := (v_profile.last_request_date IS DISTINCT FROM p_today);
  v_is_new_week := (v_profile.week_start_date  IS DISTINCT FROM p_week_start);

  -- Current usage for the requested period (with reset semantics).
  IF p_period = 'lifetime' THEN
    v_used := COALESCE((v_profile.lifetime_feature_usage ->> p_feature)::int, 0);
  ELSIF p_period = 'weekly' THEN
    v_used := CASE WHEN v_is_new_week THEN 0
                   ELSE COALESCE((v_profile.weekly_feature_usage ->> p_feature)::int, 0) END;
  ELSE -- daily
    v_used := CASE WHEN v_is_new_day THEN 0
                   ELSE COALESCE((v_profile.daily_feature_usage ->> p_feature)::int, 0) END;
  END IF;

  -- Enforce.
  IF p_limit = 0 THEN
    RETURN QUERY SELECT false, v_used; RETURN;
  END IF;
  IF p_limit <> -1 AND v_used >= p_limit THEN
    RETURN QUERY SELECT false, v_used; RETURN;
  END IF;

  -- Increment. Daily bucket is always tracked (analytics), resetting on a new day.
  v_daily := CASE WHEN v_is_new_day THEN '{}'::jsonb
                  ELSE COALESCE(v_profile.daily_feature_usage, '{}'::jsonb) END;
  v_daily := jsonb_set(v_daily, ARRAY[p_feature],
              to_jsonb(COALESCE((v_daily ->> p_feature)::int, 0) + 1));

  v_weekly   := COALESCE(v_profile.weekly_feature_usage, '{}'::jsonb);
  v_lifetime := COALESCE(v_profile.lifetime_feature_usage, '{}'::jsonb);

  IF p_period = 'weekly' THEN
    v_weekly := CASE WHEN v_is_new_week THEN '{}'::jsonb ELSE v_weekly END;
    v_weekly := jsonb_set(v_weekly, ARRAY[p_feature],
                 to_jsonb(COALESCE((v_weekly ->> p_feature)::int, 0) + 1));
  ELSIF p_period = 'lifetime' THEN
    v_lifetime := jsonb_set(v_lifetime, ARRAY[p_feature],
                   to_jsonb(COALESCE((v_lifetime ->> p_feature)::int, 0) + 1));
  END IF;

  UPDATE profiles SET
    daily_feature_usage    = v_daily,
    weekly_feature_usage   = v_weekly,
    lifetime_feature_usage = v_lifetime,
    last_request_date      = p_today,
    week_start_date        = CASE WHEN p_period = 'weekly' THEN p_week_start ELSE week_start_date END,
    daily_ai_requests      = CASE WHEN v_is_new_day THEN 1 ELSE COALESCE(daily_ai_requests, 0) + 1 END,
    total_ai_requests      = COALESCE(total_ai_requests, 0) + 1
  WHERE id = p_user_id;

  RETURN QUERY SELECT true, v_used;
END;
$$;
