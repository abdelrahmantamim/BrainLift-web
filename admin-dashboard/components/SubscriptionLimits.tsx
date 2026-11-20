import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

type Period = 'lifetime' | 'weekly' | 'daily';

interface FeatureConfig {
  limit: number;
  period: Period;
}

interface TierLimits {
  chat: FeatureConfig;
  quiz: FeatureConfig;
  flashcard: FeatureConfig;
  file_upload: FeatureConfig;
  export: FeatureConfig;
  chart: FeatureConfig;
  file_storage?: FeatureConfig;
}

interface AllLimits {
  free: TierLimits;
  premium: TierLimits;
  ultra: TierLimits;
}

const FEATURE_LABELS: Record<string, string> = {
  chat: 'Chat Messages',
  quiz: 'Quizzes',
  flashcard: 'Flashcards',
  file_upload: 'File Uploads',
  export: 'Exports',
  chart: 'Charts',
};

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: 'Free', color: '#6b7280' },
  premium: { label: 'Premium', color: '#f59e0b' },
  ultra: { label: 'Ultra', color: '#8b5cf6' },
};

const PERIOD_LABELS: Record<Period, { label: string; color: string }> = {
  lifetime: { label: 'Lifetime', color: '#ef4444' },
  weekly: { label: 'Weekly', color: '#f59e0b' },
  daily: { label: 'Daily', color: '#3b82f6' },
};

/**
 * Normalize a value from DB that might be a plain number (legacy) or { limit, period }.
 */
function normalizeFeature(val: any, defaultPeriod: Period = 'daily'): FeatureConfig {
  if (val && typeof val === 'object' && 'limit' in val) {
    return { limit: val.limit, period: val.period || defaultPeriod };
  }
  if (typeof val === 'number') {
    return { limit: val, period: defaultPeriod };
  }
  return { limit: 0, period: defaultPeriod };
}

function normalizeTier(raw: any, tier: string): TierLimits {
  const defaultPeriods: Record<string, Record<string, Period>> = {
    free: { quiz: 'lifetime', flashcard: 'lifetime', file_upload: 'lifetime', chat: 'weekly', export: 'weekly', chart: 'lifetime' },
    premium: { quiz: 'daily', flashcard: 'daily', file_upload: 'daily', chat: 'daily', export: 'daily', chart: 'daily' },
    ultra: { quiz: 'daily', flashcard: 'daily', file_upload: 'daily', chat: 'daily', export: 'daily', chart: 'daily' },
  };
  const dp = defaultPeriods[tier] || defaultPeriods.premium;
  return {
    chat: normalizeFeature(raw?.chat, dp.chat),
    quiz: normalizeFeature(raw?.quiz, dp.quiz),
    flashcard: normalizeFeature(raw?.flashcard, dp.flashcard),
    file_upload: normalizeFeature(raw?.file_upload, dp.file_upload),
    export: normalizeFeature(raw?.export, dp.export),
    chart: normalizeFeature(raw?.chart, dp.chart),
  };
}

function normalizeAll(raw: any): AllLimits {
  return {
    free: normalizeTier(raw?.free, 'free'),
    premium: normalizeTier(raw?.premium, 'premium'),
    ultra: normalizeTier(raw?.ultra, 'ultra'),
  };
}

const SubscriptionLimits: React.FC = () => {
  const [limits, setLimits] = useState<AllLimits | null>(null);
  const [editLimits, setEditLimits] = useState<AllLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  const getToken = () =>
    document.cookie
      .split('; ')
      .find(row => row.startsWith('adminToken='))
      ?.split('=')[1];

  useEffect(() => {
    fetchLimits();
  }, []);

  const fetchLimits = async () => {
    try {
      const token = getToken();
      const response = await axios.get(`${API_URL}/admin/subscription-limits`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const normalized = normalizeAll(response.data.limits);
      setLimits(normalized);
      setEditLimits(JSON.parse(JSON.stringify(normalized)));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching subscription limits:', error);
      toast.error('Failed to load subscription limits');
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editLimits) return;
    setSaving(true);
    try {
      const token = getToken();
      await axios.put(
        `${API_URL}/admin/subscription-limits`,
        { limits: editLimits },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLimits(JSON.parse(JSON.stringify(editLimits)));
      setIsEditing(false);
      toast.success('Subscription limits updated');
    } catch (error: any) {
      console.error('Error updating limits:', error);
      toast.error(error?.response?.data?.error?.message || 'Failed to update limits');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditLimits(limits ? JSON.parse(JSON.stringify(limits)) : null);
    setIsEditing(false);
  };

  const updateLimit = (tier: string, feature: string, value: string) => {
    if (!editLimits) return;
    const num = value === '' ? 0 : parseInt(value, 10);
    if (isNaN(num)) return;
    setEditLimits({
      ...editLimits,
      [tier]: {
        ...editLimits[tier as keyof AllLimits],
        [feature]: {
          ...editLimits[tier as keyof AllLimits][feature as keyof TierLimits],
          limit: num,
        },
      },
    });
  };

  const updatePeriod = (tier: string, feature: string, period: Period) => {
    if (!editLimits) return;
    setEditLimits({
      ...editLimits,
      [tier]: {
        ...editLimits[tier as keyof AllLimits],
        [feature]: {
          ...editLimits[tier as keyof AllLimits][feature as keyof TierLimits],
          period,
        },
      },
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <div style={{ color: '#6b7280' }}>Loading subscription limits...</div>
      </div>
    );
  }

  if (!limits || !editLimits) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
        Failed to load subscription limits
      </div>
    );
  }

  const features = Object.keys(FEATURE_LABELS);
  const tiers = Object.keys(TIER_LABELS);

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Subscription Limits</h2>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
            Configure usage limits per tier. Each feature has a limit value and a reset period (lifetime / weekly / daily). Use -1 for unlimited, 0 to disable.
          </p>
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Edit Limits
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleCancel}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: saving ? '#9ca3af' : '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: 600,
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '0.75rem', color: '#374151', fontWeight: 600 }}>Feature</th>
              {tiers.map(tier => (
                <th key={tier} style={{ textAlign: 'center', padding: '0.75rem', minWidth: '180px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      backgroundColor: TIER_LABELS[tier].color + '20',
                      color: TIER_LABELS[tier].color,
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    {TIER_LABELS[tier].label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((feature, idx) => (
              <tr key={feature} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: idx % 2 === 0 ? '#fafafa' : '#fff' }}>
                <td style={{ padding: '0.75rem', fontWeight: 500, color: '#374151' }}>{FEATURE_LABELS[feature]}</td>
                {tiers.map(tier => {
                  const config = editLimits[tier as keyof AllLimits][feature as keyof TierLimits];
                  if (!config) return <td key={tier} />;
                  const { limit: val, period } = config;
                  const periodInfo = PERIOD_LABELS[period];
                  return (
                    <td key={tier} style={{ textAlign: 'center', padding: '0.5rem' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
                          <input
                            type="number"
                            value={val}
                            onChange={e => updateLimit(tier, feature, e.target.value)}
                            style={{
                              width: '70px',
                              textAlign: 'center',
                              padding: '0.375rem 0.5rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '0.375rem',
                              fontSize: '0.875rem',
                            }}
                          />
                          <select
                            value={period}
                            onChange={e => updatePeriod(tier, feature, e.target.value as Period)}
                            style={{
                              padding: '0.375rem 0.25rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '0.375rem',
                              fontSize: '0.75rem',
                              backgroundColor: '#fff',
                            }}
                          >
                            <option value="lifetime">Lifetime</option>
                            <option value="weekly">Weekly</option>
                            <option value="daily">Daily</option>
                          </select>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.125rem' }}>
                          <span
                            style={{
                              fontWeight: 600,
                              color: val === -1 ? '#10b981' : val === 0 ? '#ef4444' : '#374151',
                            }}
                          >
                            {val === -1 ? 'Unlimited' : val === 0 ? 'Disabled' : val}
                          </span>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              color: periodInfo.color,
                              textTransform: 'uppercase',
                            }}
                          >
                            {periodInfo.label}
                          </span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f0f9ff', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#1e40af' }}>
        <strong>Note:</strong> Changes take effect within 1 minute (server caches limits for 60 seconds).
        <br />
        <strong>Lifetime</strong> = never resets (total across account life). <strong>Weekly</strong> = resets every Monday. <strong>Daily</strong> = resets each day.
        <br />
        Values: positive number = limit, -1 = unlimited, 0 = feature disabled.
      </div>
    </div>
  );
};

export default SubscriptionLimits;
