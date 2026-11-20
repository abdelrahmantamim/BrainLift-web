-- Deploy before application code. The legacy check_and_increment_usage RPC is
-- intentionally retained so rolling deploys and rollbacks remain compatible.
CREATE TABLE IF NOT EXISTS feature_usage_reservations (
  operation_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  feature text NOT NULL,
  period text NOT NULL CHECK (period IN ('daily', 'weekly', 'lifetime')),
  bucket_start date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'committed', 'released', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes',
  finalized_at timestamptz
);
CREATE INDEX IF NOT EXISTS feature_usage_reservations_admission_idx
  ON feature_usage_reservations(user_id, feature, period, bucket_start, status);

CREATE OR REPLACE FUNCTION reserve_feature_usage(p_operation_id uuid, p_user_id uuid, p_feature text,
  p_period text, p_limit integer, p_today date, p_week_start date)
RETURNS TABLE(allowed boolean, current_usage integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p profiles%ROWTYPE; bucket date; used integer; pending integer;
BEGIN
  SELECT * INTO p FROM profiles WHERE id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 0; RETURN; END IF;
  bucket := CASE p_period WHEN 'daily' THEN p_today WHEN 'weekly' THEN p_week_start ELSE DATE '1970-01-01' END;
  IF EXISTS (SELECT 1 FROM feature_usage_reservations r WHERE r.operation_id=p_operation_id
    AND (r.user_id<>p_user_id OR r.feature<>p_feature OR r.period<>p_period OR r.bucket_start<>bucket)) THEN
    RETURN QUERY SELECT false, 0; RETURN;
  END IF;
  UPDATE feature_usage_reservations SET status='expired', finalized_at=now()
    WHERE user_id=p_user_id AND feature=p_feature AND status='pending' AND expires_at <= now();
  IF EXISTS (SELECT 1 FROM feature_usage_reservations r WHERE r.operation_id=p_operation_id AND r.status IN ('pending','committed')) THEN
    RETURN QUERY SELECT true, 0; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM feature_usage_reservations r WHERE r.operation_id=p_operation_id) THEN
    RETURN QUERY SELECT false, 0; RETURN;
  END IF;
  used := CASE p_period
    WHEN 'lifetime' THEN COALESCE((p.lifetime_feature_usage->>p_feature)::int,0)
    WHEN 'weekly' THEN CASE WHEN p.week_start_date=p_week_start THEN COALESCE((p.weekly_feature_usage->>p_feature)::int,0) ELSE 0 END
    ELSE CASE WHEN p.last_request_date=p_today THEN COALESCE((p.daily_feature_usage->>p_feature)::int,0) ELSE 0 END END;
  SELECT count(*)::int INTO pending FROM feature_usage_reservations r
    WHERE r.user_id=p_user_id AND r.feature=p_feature AND r.period=p_period AND r.bucket_start=bucket AND r.status='pending';
  IF p_limit >= 0 AND used + pending >= p_limit THEN RETURN QUERY SELECT false, used+pending; RETURN; END IF;
  INSERT INTO feature_usage_reservations(operation_id,user_id,feature,period,bucket_start)
    VALUES(p_operation_id,p_user_id,p_feature,p_period,bucket);
  RETURN QUERY SELECT true, used+pending+1;
END $$;

CREATE OR REPLACE FUNCTION finalize_feature_usage(p_operation_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r feature_usage_reservations%ROWTYPE; p profiles%ROWTYPE; usage jsonb; analytics_day date;
BEGIN
  SELECT * INTO r FROM feature_usage_reservations WHERE operation_id=p_operation_id;
  IF NOT FOUND THEN RETURN false; END IF;
  -- All lifecycle functions take the profile lock before the reservation lock.
  SELECT * INTO p FROM profiles WHERE id=r.user_id FOR UPDATE;
  SELECT * INTO r FROM feature_usage_reservations WHERE operation_id=p_operation_id FOR UPDATE;
  analytics_day := (r.created_at AT TIME ZONE 'UTC')::date;
  IF r.status='committed' THEN RETURN true; END IF;
  IF r.status <> 'pending' OR r.expires_at <= now() THEN
    UPDATE feature_usage_reservations SET status=CASE WHEN status='pending' THEN 'expired' ELSE status END, finalized_at=COALESCE(finalized_at,now()) WHERE operation_id=p_operation_id;
    RETURN false;
  END IF;
  IF r.period='daily' THEN
    IF p.last_request_date IS NOT NULL AND p.last_request_date > r.bucket_start THEN
      UPDATE feature_usage_reservations SET status='expired',finalized_at=now() WHERE operation_id=p_operation_id; RETURN false;
    END IF;
    usage:=CASE WHEN p.last_request_date=r.bucket_start THEN COALESCE(p.daily_feature_usage,'{}') ELSE '{}' END;
    UPDATE profiles SET daily_feature_usage=jsonb_set(usage,ARRAY[r.feature],to_jsonb(COALESCE((usage->>r.feature)::int,0)+1)),last_request_date=r.bucket_start,
      daily_ai_requests=CASE WHEN p.last_request_date=r.bucket_start THEN COALESCE(p.daily_ai_requests,0)+1 ELSE 1 END,
      total_ai_requests=COALESCE(p.total_ai_requests,0)+1 WHERE id=r.user_id;
  ELSIF r.period='weekly' THEN
    IF p.week_start_date IS NOT NULL AND p.week_start_date > r.bucket_start THEN
      UPDATE feature_usage_reservations SET status='expired',finalized_at=now() WHERE operation_id=p_operation_id; RETURN false;
    END IF;
    usage:=CASE WHEN p.week_start_date=r.bucket_start THEN COALESCE(p.weekly_feature_usage,'{}') ELSE '{}' END;
    UPDATE profiles SET weekly_feature_usage=jsonb_set(usage,ARRAY[r.feature],to_jsonb(COALESCE((usage->>r.feature)::int,0)+1)),week_start_date=r.bucket_start WHERE id=r.user_id;
  ELSE
    usage:=COALESCE(p.lifetime_feature_usage,'{}');
    UPDATE profiles SET lifetime_feature_usage=jsonb_set(usage,ARRAY[r.feature],to_jsonb(COALESCE((usage->>r.feature)::int,0)+1)) WHERE id=r.user_id;
  END IF;
  -- Historical reporting always tracks successful operations daily, even when
  -- admission uses a weekly/lifetime bucket. Never roll a newer day backward.
  IF r.period <> 'daily' THEN
    UPDATE profiles SET
      daily_feature_usage=jsonb_set(CASE WHEN last_request_date=analytics_day THEN COALESCE(daily_feature_usage,'{}') ELSE '{}' END,
        ARRAY[r.feature],to_jsonb(CASE WHEN last_request_date=analytics_day THEN COALESCE((daily_feature_usage->>r.feature)::int,0)+1 ELSE 1 END)),
      last_request_date=analytics_day,
      daily_ai_requests=CASE WHEN last_request_date=analytics_day THEN COALESCE(daily_ai_requests,0)+1 ELSE 1 END,
      total_ai_requests=COALESCE(total_ai_requests,0)+1
      WHERE id=r.user_id AND (last_request_date IS NULL OR last_request_date <= analytics_day);
    IF NOT FOUND THEN
      UPDATE profiles SET total_ai_requests=COALESCE(total_ai_requests,0)+1 WHERE id=r.user_id;
    END IF;
  END IF;
  UPDATE profiles SET monthly_ai_requests=CASE
    WHEN p.last_request_date IS NOT NULL AND date_trunc('month',p.last_request_date::timestamp)=date_trunc('month',analytics_day::timestamp)
      THEN COALESCE(p.monthly_ai_requests,0)+1 ELSE 1 END
    WHERE id=r.user_id;
  UPDATE feature_usage_reservations SET status='committed',finalized_at=now() WHERE operation_id=p_operation_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION release_feature_usage(p_operation_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE changed integer;
BEGIN
  UPDATE feature_usage_reservations SET status='released',finalized_at=now()
    WHERE operation_id=p_operation_id AND status='pending'; GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed=1 OR EXISTS(SELECT 1 FROM feature_usage_reservations WHERE operation_id=p_operation_id AND status='released');
END $$;

REVOKE ALL ON feature_usage_reservations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON feature_usage_reservations TO service_role;
REVOKE ALL ON FUNCTION reserve_feature_usage(uuid,uuid,text,text,integer,date,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION finalize_feature_usage(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION release_feature_usage(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_feature_usage(uuid,uuid,text,text,integer,date,date) TO service_role;
GRANT EXECUTE ON FUNCTION finalize_feature_usage(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION release_feature_usage(uuid) TO service_role;
