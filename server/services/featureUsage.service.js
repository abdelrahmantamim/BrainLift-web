import { randomUUID } from 'node:crypto';
import { getSupabase } from '../config/services.config.js';

export async function reserveFeatureUsage({ userId, feature, period, limit, operationId = randomUUID() }) {
  const { data, error } = await getSupabase().rpc('reserve_feature_usage', {
    p_operation_id: operationId,
    p_user_id: userId,
    p_feature: feature,
    p_period: period,
    p_limit: limit,
    p_today: new Date().toISOString().slice(0, 10),
    p_week_start: getCurrentWeekStart(),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { allowed: Boolean(row?.allowed), operationId, currentUsage: row?.current_usage ?? limit };
}

export async function finalizeFeatureUsage(operationId) {
  if (!operationId) return true;
  const { data, error } = await getSupabase().rpc('finalize_feature_usage', { p_operation_id: operationId });
  if (error) throw error;
  return data !== false;
}

export async function releaseFeatureUsage(operationId) {
  if (!operationId) return true;
  const { data, error } = await getSupabase().rpc('release_feature_usage', { p_operation_id: operationId });
  if (error) throw error;
  return data !== false;
}

function getCurrentWeekStart(now = new Date()) {
  const monday = new Date(now);
  const day = now.getDay();
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  return monday.toISOString().slice(0, 10);
}
