import { createAuthClient } from 'better-auth/client';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import { API_BASE_URL } from '@/config/constants';

// Define the auth client with proper typing
export const authClient = createAuthClient({
  baseURL: `${API_BASE_URL}/auth`,
  
  // Enable credentials for cookie-based sessions
  fetchOptions: {
    credentials: 'include' as RequestCredentials,
  },
  
  // Additional plugins can be added here
  plugins: [
    inferAdditionalFields({
      user: {
        studentType: {
          type: 'string',
          required: false,
        },
        avatarUrl: {
          type: 'string', 
          required: false,
        },
        chatBackgroundUrl: {
          type: 'string',
          required: false,
        },
        emailVerified: {
          type: 'boolean',
          required: false,
        },
      },
    }),
  ],
});

// Export typed hooks for React
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  resetPassword,
  changePassword,
  updateUser,
} = authClient;

// Export the password-reset request method. better-auth renamed
// `forgetPassword` -> `requestPasswordReset` in 1.6.x.
export const forgotPassword = authClient.requestPasswordReset;

// Export the session type
export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;