import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pushService = require('./pushNotification.service.cjs');

// Wrapper function to match the expected interface
export async function sendPushNotification(pushToken, title, body, data = {}) {
  try {
    // If it's an Expo token, send directly
    if (pushToken && pushToken.startsWith('ExponentPushToken')) {
      const messages = [{
        to: pushToken,
        sound: 'default',
        title,
        body,
        data,
        priority: 'default',
        channelId: data.channelId || 'default'
      }];
      
      const result = await pushService.sendBatch(messages);
      return {
        success: result.sent > 0,
        error: result.failed > 0 ? 'Some notifications failed' : null,
        details: result
      };
    }
    
    return {
      success: false,
      error: 'Invalid push token format'
    };
  } catch (error) {
    console.error('[Push Notification] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}