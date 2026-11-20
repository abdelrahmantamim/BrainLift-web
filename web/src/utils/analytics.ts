import posthog from 'posthog-js';

export function initializeAnalytics(): void {
  const apiKey = import.meta.env.VITE_POSTHOG_API_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
  const debug = import.meta.env.VITE_POSTHOG_DEBUG === 'true';

  if (!apiKey) return;
  if (window.location.hostname === 'localhost' && !debug) return;

  posthog.init(apiKey, {
    api_host: host,
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    session_recording: {
      maskAllInputs: true,
    },
  });
}

export function identifyUser(userId: string, properties?: Record<string, unknown>): void {
  posthog.identify(userId, properties);
}

export function clearUser(): void {
  posthog.reset();
}

export function trackEvent(eventName: string, properties?: Record<string, unknown>): void {
  posthog.capture(eventName, properties);
}

export function trackError(error: Error, context?: Record<string, unknown>): void {
  posthog.capture('$exception', {
    $exception_message: error.message,
    $exception_stack_trace: error.stack,
    ...context,
  });
}

export function trackPageView(pageName: string): void {
  posthog.capture('$pageview', { pageName });
}

export { posthog };
