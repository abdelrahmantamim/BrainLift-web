-- Add cumulative generation count to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cumulative_generation_count INTEGER NOT NULL DEFAULT 0;

-- Update app_config with new subscription_limits structure
INSERT INTO app_config (key, value, updated_at)
VALUES (
  'subscription_limits',
  '{"free":{"generations":5,"chat":10,"export":0,"chart":1,"file_storage":10},"premium":{"generations":50,"chat":100,"export":10,"chart":10,"file_storage":100},"ultra":{"generations":-1,"chat":-1,"export":-1,"chart":-1,"file_storage":-1}}'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
