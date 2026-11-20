import { useState, useEffect, useRef } from 'react';
import { featureFlagsService } from '@/services/featureFlags.service';

interface UseFeatureFlagsResult {
  isWebLoginEnabled: boolean;
  isLoading: boolean;
  error: boolean;
}

export function useFeatureFlags(): UseFeatureFlagsResult {
  const [isWebLoginEnabled, setIsWebLoginEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const abortedRef = useRef(false);

  useEffect(() => {
    abortedRef.current = false;

    const checkFlags = async () => {
      try {
        const webLoginEnabled = await featureFlagsService.isWebLoginEnabled();
        if (!abortedRef.current) {
          setIsWebLoginEnabled(webLoginEnabled);
          setError(false);
        }
      } catch {
        if (!abortedRef.current) {
          // Default to enabled on error so users aren't locked out
          setIsWebLoginEnabled(true);
          setError(true);
        }
      } finally {
        if (!abortedRef.current) {
          setIsLoading(false);
        }
      }
    };

    checkFlags();

    return () => {
      abortedRef.current = true;
    };
  }, []);

  return { isWebLoginEnabled, isLoading, error };
}
