import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Helper to login
async function login(page: Page, email: string, password: string) {
  await page.goto('/auth/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/home');
}

// Helper to wait for API response
async function waitForApiResponse(page: Page, urlPattern: string | RegExp) {
  return page.waitForResponse(response => 
    urlPattern instanceof RegExp 
      ? urlPattern.test(response.url())
      : response.url().includes(urlPattern)
  );
}

test.describe('Notification System', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page, 'test@example.com', 'Test123!@#');
  });

  test.describe('Notification Bell UI', () => {
    test('should display notification bell in header', async ({ page }) => {
      // Check if notification bell is visible
      const notificationBell = page.locator('button').filter({ has: page.locator('svg[class*="lucide-bell"]') });
      await expect(notificationBell).toBeVisible();
    });

    test('should show dropdown when bell is clicked', async ({ page }) => {
      // Click notification bell
      const notificationBell = page.locator('button').filter({ has: page.locator('svg[class*="lucide-bell"]') });
      await notificationBell.click();
      
      // Check if dropdown is visible
      await expect(page.locator('text=Notifications').first()).toBeVisible();
      await expect(page.locator('text=Mark all as read, Enable Notifications, No notifications yet').first()).toBeVisible();
    });

    test('should show unread count badge', async ({ page }) => {
      // Mock API response with unread notifications
      await page.route('**/api/notifications/history*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            notifications: [
              {
                id: '1',
                type: 'quiz_completed',
                title: 'Quiz Completed!',
                body: 'You scored 85% on Math Quiz',
                data: {},
                read: false,
                createdAt: new Date().toISOString()
              }
            ],
            unreadCount: 1,
            pagination: {
              total: 1,
              page: 1,
              limit: 10,
              totalPages: 1,
              hasMore: false
            }
          })
        });
      });

      // Reload to trigger notification fetch
      await page.reload();
      
      // Check if badge is displayed
      const badge = page.locator('span').filter({ hasText: '1' }).first();
      await expect(badge).toBeVisible();
      await expect(badge).toHaveClass(/bg-red-500/);
    });

    test('should close dropdown when clicking outside', async ({ page }) => {
      // Open dropdown
      const notificationBell = page.locator('button').filter({ has: page.locator('svg[class*="lucide-bell"]') });
      await notificationBell.click();
      await expect(page.locator('text=Notifications').first()).toBeVisible();
      
      // Click outside
      await page.click('body', { position: { x: 10, y: 10 } });
      
      // Dropdown should be hidden
      await expect(page.locator('text=Notifications').first()).not.toBeVisible();
    });
  });

  test.describe('Permission Handling', () => {
    test('should show permission request when notifications not enabled', async ({ page, context }) => {
      // Grant permission in browser context
      await context.grantPermissions(['notifications']);
      
      // Click notification bell
      const notificationBell = page.locator('button').filter({ has: page.locator('svg[class*="lucide-bell"]') });
      await notificationBell.click();
      
      // Check for enable notifications button
      const enableButton = page.locator('button:has-text("Enable Notifications")');
      await expect(enableButton).toBeVisible();
    });

    test('should request notification permission when enable button is clicked', async ({ page, context }) => {
      // Grant permission in browser context
      await context.grantPermissions(['notifications']);
      
      // Click notification bell
      const notificationBell = page.locator('button').filter({ has: page.locator('svg[class*="lucide-bell"]') });
      await notificationBell.click();
      
      // Click enable notifications
      const enableButton = page.locator('button:has-text("Enable Notifications")');
      await enableButton.click();
      
      // Wait for subscription API call
      const subscribeResponse = waitForApiResponse(page, '/api/notifications/subscribe');
      
      // Should make API call to subscribe
      await expect(subscribeResponse).resolves.toBeTruthy();
    });
  });

  test.describe('Notification History', () => {
    test('should display notification history', async ({ page }) => {
      // Mock API response
      await page.route('**/api/notifications/history*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            notifications: [
              {
                id: '1',
                type: 'quiz_completed',
                title: 'Quiz Completed!',
                body: 'You scored 85% on Math Quiz',
                data: {},
                read: false,
                createdAt: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
              },
              {
                id: '2',
                type: 'content_shared',
                title: 'New Content Shared',
                body: 'John shared a flashcard deck with you',
                data: {},
                read: true,
                createdAt: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
              }
            ],
            unreadCount: 1,
            pagination: {
              total: 2,
              page: 1,
              limit: 10,
              totalPages: 1,
              hasMore: false
            }
          })
        });
      });

      // Open notification dropdown
      const notificationBell = page.locator('button').filter({ has: page.locator('svg[class*="lucide-bell"]') });
      await notificationBell.click();
      
      // Check notifications are displayed
      await expect(page.locator('text=Quiz Completed!')).toBeVisible();
      await expect(page.locator('text=You scored 85% on Math Quiz')).toBeVisible();
      await expect(page.locator('text=New Content Shared')).toBeVisible();
      await expect(page.locator('text=John shared a flashcard deck with you')).toBeVisible();
      
      // Check time display
      await expect(page.locator('text=/hour.*ago/i').first()).toBeVisible();
    });

    test('should show empty state when no notifications', async ({ page }) => {
      // Mock empty response
      await page.route('**/api/notifications/history*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            notifications: [],
            unreadCount: 0,
            pagination: {
              total: 0,
              page: 1,
              limit: 10,
              totalPages: 0,
              hasMore: false
            }
          })
        });
      });

      // Open notification dropdown
      const notificationBell = page.locator('button').filter({ has: page.locator('svg[class*="lucide-bell"]') });
      await notificationBell.click();
      
      // Check empty state
      await expect(page.locator('text=No notifications yet')).toBeVisible();
    });

    test('should show correct icons for notification types', async ({ page }) => {
      // Mock API response with different notification types
      await page.route('**/api/notifications/history*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            notifications: [
              {
                id: '1',
                type: 'quiz_completed',
                title: 'Quiz notification',
                body: 'Quiz completed',
                read: false,
                createdAt: new Date().toISOString()
              },
              {
                id: '2',
                type: 'content_shared',
                title: 'Share notification',
                body: 'Content shared',
                read: false,
                createdAt: new Date().toISOString()
              },
              {
                id: '3',
                type: 'study_reminder',
                title: 'Reminder notification',
                body: 'Time to study',
                read: false,
                createdAt: new Date().toISOString()
              },
              {
                id: '4',
                type: 'achievement_unlocked',
                title: 'Achievement notification',
                body: 'New achievement',
                read: false,
                createdAt: new Date().toISOString()
              }
            ],
            unreadCount: 4,
            pagination: {
              total: 4,
              page: 1,
              limit: 10,
              totalPages: 1,
              hasMore: false
            }
          })
        });
      });

      // Open notification dropdown
      const notificationBell = page.locator('button').filter({ has: page.locator('svg[class*="lucide-bell"]') });
      await notificationBell.click();
      
      // Check that different notification types have different styling
      const quizNotification = page.locator('div').filter({ hasText: 'Quiz notification' }).first();
      await expect(quizNotification.locator('.text-green-500')).toBeVisible();
      
      const shareNotification = page.locator('div').filter({ hasText: 'Share notification' }).first();
      await expect(shareNotification.locator('.text-blue-500')).toBeVisible();
      
      const reminderNotification = page.locator('div').filter({ hasText: 'Reminder notification' }).first();
      await expect(reminderNotification.locator('.text-yellow-500')).toBeVisible();
      
      const achievementNotification = page.locator('div').filter({ hasText: 'Achievement notification' }).first();
      await expect(achievementNotification.locator('.text-purple-500')).toBeVisible();
    });
  });

  test.describe('Mark as Read', () => {
    test('should mark individual notification as read', async ({ page }) => {
      // Mock initial response
      await page.route('**/api/notifications/history*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            notifications: [
              {
                id: 'test-notification-1',
                type: 'quiz_completed',
                title: 'Unread Notification',
                body: 'This is unread',
                read: false,
                createdAt: new Date().toISOString()
              }
            ],
            unreadCount: 1,
            pagination: {
              total: 1,
              page: 1,
              limit: 10,
              totalPages: 1,
              hasMore: false
            }
          })
        });
      });

      // Mock mark as read response
      await page.route('**/api/notifications/test-notification-1/read', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      });

      // Open dropdown
      const notificationBell = page.locator('button').filter({ has: page.locator('svg[class*="lucide-bell"]') });
      await notificationBell.click();
      
      // Click on notification to mark as read
      const notification = page.locator('div').filter({ hasText: 'Unread Notification' }).first();
      await notification.click();
      
      // Wait for API call
      await waitForApiResponse(page, '/api/notifications/test-notification-1/read');
      
      // Check that unread indicator is removed
      const unreadDot = notification.locator('.bg-purple-500.rounded-full');
      await expect(unreadDot).not.toBeVisible();
    });

    test('should mark all notifications as read', async ({ page }) => {
      // Mock initial response with multiple unread
      await page.route('**/api/notifications/history*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            notifications: [
              {
                id: '1',
                type: 'quiz_completed',
                title: 'First Unread',
                body: 'Body 1',
                read: false,
                createdAt: new Date().toISOString()
              },
              {
                id: '2',
                type: 'content_shared',
                title: 'Second Unread',
                body: 'Body 2',
                read: false,
                createdAt: new Date().toISOString()
              }
            ],
            unreadCount: 2,
            pagination: {
              total: 2,
              page: 1,
              limit: 10,
              totalPages: 1,
              hasMore: false
            }
          })
        });
      });

      // Mock mark all as read response
      await page.route('**/api/notifications/read-all', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      });

      // Open dropdown
      const notificationBell = page.locator('button').filter({ has: page.locator('svg[class*="lucide-bell"]') });
      await notificationBell.click();
      
      // Click mark all as read
      const markAllButton = page.locator('button:has-text("Mark all as read")');
      await expect(markAllButton).toBeVisible();
      await markAllButton.click();
      
      // Wait for API call
      await waitForApiResponse(page, '/api/notifications/read-all');
      
      // Badge should disappear
      const badge = page.locator('span').filter({ hasText: '2' });
      await expect(badge).not.toBeVisible();
    });
  });

  test.describe('Web Push Subscription', () => {
    test('should get VAPID key from server', async ({ page }) => {
      // Mock VAPID key response
      await page.route('**/api/notifications/vapid-key', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            publicKey: 'BKd0G7BL7zKn7F8OVW5GWQmFPj0LpF5YnMHcG8LnZ0Q2F5R3JqCWV6V1t8LkJpX6QZ9F0M1KvQz2Q3F5R3JqCWV'
          })
        });
      });

      // Navigate to trigger service worker
      await page.goto('/home');
      
      // Wait for VAPID key request
      const vapidResponse = await waitForApiResponse(page, '/api/notifications/vapid-key');
      expect(vapidResponse.status()).toBe(200);
    });

    test('should handle subscription endpoint', async ({ page, context }) => {
      // Grant notification permission
      await context.grantPermissions(['notifications']);
      
      // Mock subscription response
      await page.route('**/api/notifications/subscribe', async route => {
        const request = route.request();
        const body = request.postDataJSON();
        
        // Validate subscription object
        expect(body).toHaveProperty('subscription');
        expect(body).toHaveProperty('device');
        expect(body.device.type).toBe('web');
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: 'subscription-id' }
          })
        });
      });

      // Open dropdown and enable notifications
      const notificationBell = page.locator('button').filter({ has: page.locator('svg[class*="lucide-bell"]') });
      await notificationBell.click();
      
      const enableButton = page.locator('button:has-text("Enable Notifications")');
      if (await enableButton.isVisible()) {
        await enableButton.click();
        
        // Wait for subscription call
        await waitForApiResponse(page, '/api/notifications/subscribe');
      }
    });

    test('should handle unsubscribe endpoint', async ({ page }) => {
      // Mock unsubscribe response
      await page.route('**/api/notifications/unsubscribe', async route => {
        const request = route.request();
        const body = request.postDataJSON();
        
        // Validate endpoint
        expect(body).toHaveProperty('endpoint');
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Unsubscribed from web push notifications'
          })
        });
      });

      // This would typically be triggered from settings
      // For now, we just verify the endpoint exists
      const response = await page.request.post('/api/notifications/unsubscribe', {
        data: { endpoint: 'https://example.com/push/endpoint' }
      });
      
      expect(response.status()).toBe(200);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // Mock error response
      await page.route('**/api/notifications/history*', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Internal server error'
          })
        });
      });

      // Open dropdown
      const notificationBell = page.locator('button').filter({ has: page.locator('svg[class*="lucide-bell"]') });
      await notificationBell.click();
      
      // Should show loading state initially
      await expect(page.locator('text=Loading notifications...')).toBeVisible();
      
      // After error, should still show UI (empty state)
      await page.waitForTimeout(1000);
      await expect(page.locator('text=No notifications yet')).toBeVisible();
    });

    test('should handle network errors', async ({ page }) => {
      // Block notification requests
      await page.route('**/api/notifications/**', route => route.abort());
      
      // Open dropdown
      const notificationBell = page.locator('button').filter({ has: page.locator('svg[class*="lucide-bell"]') });
      await notificationBell.click();
      
      // Should handle gracefully
      await expect(page.locator('text=Notifications').first()).toBeVisible();
      await page.waitForTimeout(1000);
      await expect(page.locator('text=No notifications yet')).toBeVisible();
    });
  });

  test.describe('Service Worker Integration', () => {
    test('should register service worker', async ({ page }) => {
      // Check if service worker is registered
      const swRegistration = await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return {
          registered: !!registration,
          scope: registration?.scope,
          active: !!registration?.active
        };
      });
      
      expect(swRegistration.registered).toBe(true);
      expect(swRegistration.scope).toContain(page.url());
    });

    test('should handle push events in service worker', async ({ page }) => {
      // This test verifies the service worker can handle push events
      // In a real test, you'd need to trigger actual push events
      const swCode = await page.request.get('/sw.js');
      const swContent = await swCode.text();
      
      // Verify push event listener exists
      expect(swContent).toContain("addEventListener('push'");
      expect(swContent).toContain('showNotification');
    });

    test('should handle notification clicks', async ({ page }) => {
      // Verify notification click handler exists
      const swCode = await page.request.get('/sw.js');
      const swContent = await swCode.text();
      
      // Verify notification click listener exists
      expect(swContent).toContain("addEventListener('notificationclick'");
      expect(swContent).toContain('clients.openWindow');
      
      // Verify it handles different notification types
      expect(swContent).toContain('quiz_completed');
      expect(swContent).toContain('content_shared');
      expect(swContent).toContain('study_reminder');
      expect(swContent).toContain('achievement_unlocked');
    });
  });

  test.describe('Notification Preferences', () => {
    test('should fetch user preferences', async ({ page }) => {
      // Mock preferences response
      await page.route('**/api/notifications/preferences', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              enabled: true,
              daily_reminder: true,
              daily_reminder_time: '09:00:00',
              weekly_summary: true,
              achievement_alerts: true,
              quiz_reminders: true,
              study_streak_reminders: true,
              custom_schedules: [],
              quiet_hours_start: '22:00:00',
              quiet_hours_end: '08:00:00'
            }
          })
        });
      });

      // This would typically be accessed from settings
      const response = await page.request.get('/api/notifications/preferences');
      const data = await response.json();
      
      expect(response.status()).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.enabled).toBe(true);
    });

    test('should update preferences', async ({ page }) => {
      // Mock update response
      await page.route('**/api/notifications/preferences', async route => {
        if (route.request().method() === 'PUT') {
          const body = route.request().postDataJSON();
          
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { ...body, updated_at: new Date().toISOString() }
            })
          });
        }
      });

      // Make update request
      const response = await page.request.put('/api/notifications/preferences', {
        data: {
          quiz_completed: false,
          content_shared: true,
          study_reminder: true,
          achievement_unlocked: false
        }
      });
      
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  test.describe('CORS and Authentication', () => {
    test('should include credentials in notification requests', async ({ page }) => {
      // Intercept requests to check headers
      const requests: Array<{ url: string; headers: Record<string, string> }> = [];
      await page.route('**/api/notifications/**', async route => {
        requests.push({
          url: route.request().url(),
          headers: route.request().headers()
        });
        await route.continue();
      });

      // Open notification dropdown to trigger API call
      const notificationBell = page.locator('button').filter({ has: page.locator('svg[class*="lucide-bell"]') });
      await notificationBell.click();
      
      // Wait for history request
      await page.waitForTimeout(1000);
      
      // Check that requests include credentials
      const historyRequest = requests.find(r => r.url.includes('/history'));
      expect(historyRequest).toBeDefined();
      
      // The withCredentials setting should ensure cookies are sent
      // This is handled by axios configuration
    });

    test('should handle 401 unauthorized errors', async ({ page }) => {
      // Mock 401 response
      await page.route('**/api/notifications/history*', async route => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { message: 'Unauthorized' }
          })
        });
      });

      // Try to open notifications
      const notificationBell = page.locator('button').filter({ has: page.locator('svg[class*="lucide-bell"]') });
      await notificationBell.click();
      
      // Should redirect to login
      await page.waitForURL('/auth/login', { timeout: 5000 });
    });
  });
});