# Apple Sign-In Setup Guide

## Prerequisites

### 1. Apple Developer Account
- You need an active Apple Developer Program membership ($99/year)
- Visit: https://developer.apple.com/programs/

### 2. App ID Configuration
1. Go to Apple Developer Portal > Certificates, Identifiers & Profiles
2. Click Identifiers > App IDs
3. Select your app or create a new App ID
4. Enable "Sign in with Apple" capability
5. Click "Edit" next to Sign in with Apple
6. Configure your return URLs

### 3. Service ID (for Web/Server)
1. Go to Identifiers > Services IDs
2. Create a new Service ID (e.g., `com.yourcompany.tutorapp.service`)
3. Enable "Sign in with Apple"
4. Configure domains and return URLs:
   - Domain: `yourdomain.com`
   - Return URL: `https://yourdomain.com/api/auth/callback/apple`

### 4. Private Key
1. Go to Keys in the Apple Developer Portal
2. Create a new key and enable "Sign in with Apple"
3. Download the `.p8` file (you can only download it once!)
4. Note your:
   - Key ID (10 characters)
   - Team ID (found in Membership section)

## Environment Variables

Add these to your `.env` file:

```env
# Apple Sign-In Configuration
APPLE_CLIENT_ID=com.yourcompany.tutorapp.service
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=XXXXXXXXXX
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
YOUR_P8_FILE_CONTENTS_HERE
-----END PRIVATE KEY-----"

# OR use a file path
APPLE_PRIVATE_KEY_PATH=./config/apple-signin-key.p8
```

## Server Configuration

### Better Auth Config Update

```javascript
// In better-auth.config.js
import { betterAuth } from 'better-auth';
import { appleProvider } from 'better-auth/providers';

export const auth = betterAuth({
  // ... existing config
  
  providers: [
    appleProvider({
      clientId: process.env.APPLE_CLIENT_ID,
      teamId: process.env.APPLE_TEAM_ID,
      keyId: process.env.APPLE_KEY_ID,
      privateKey: process.env.APPLE_PRIVATE_KEY,
      // OR
      privateKeyPath: process.env.APPLE_PRIVATE_KEY_PATH,
      
      // Optional: customize scopes
      scope: ['name', 'email'],
      
      // Optional: customize redirect URI
      redirectURI: process.env.APPLE_REDIRECT_URI || 'https://yourdomain.com/api/auth/callback/apple',
    })
  ],
});
```

## Mobile App Configuration

### iOS (React Native)

1. Install dependencies:
```bash
npm install @invertase/react-native-apple-authentication
cd ios && pod install
```

2. Enable capability in Xcode:
   - Open `.xcworkspace` in Xcode
   - Select your target
   - Go to "Signing & Capabilities"
   - Add "Sign in with Apple" capability

3. Implementation:
```javascript
import { appleAuth } from '@invertase/react-native-apple-authentication';

async function onAppleButtonPress() {
  try {
    // Start Apple sign-in
    const appleAuthRequestResponse = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
    });

    // Get credential state
    const credentialState = await appleAuth.getCredentialStateForUser(
      appleAuthRequestResponse.user
    );

    if (credentialState === appleAuth.State.AUTHORIZED) {
      // Send to your server
      const response = await api.post('/auth/apple/mobile', {
        identityToken: appleAuthRequestResponse.identityToken,
        authorizationCode: appleAuthRequestResponse.authorizationCode,
        user: appleAuthRequestResponse.user,
        email: appleAuthRequestResponse.email,
        fullName: appleAuthRequestResponse.fullName,
      });
      
      // Handle successful login
      const { token, user } = response.data;
      // Store token and navigate
    }
  } catch (error) {
    console.error('Apple Sign-In Error:', error);
  }
}
```

### Android
Apple Sign-In on Android requires a web-based flow:

1. Use WebView or Chrome Custom Tabs
2. Direct to: `https://yourdomain.com/api/auth/signin/apple`
3. Handle the callback with deep linking

## Server Endpoints

### Web Sign-In Flow
```
GET /api/auth/signin/apple
    -> Redirects to Apple
    -> Apple redirects to /api/auth/callback/apple
    -> Server creates session
    -> Redirects to app with token
```

### Mobile Token Verification
```
POST /api/auth/apple/mobile
Body: {
  identityToken: string,
  authorizationCode: string,
  user: string,
  email?: string,
  fullName?: object
}
```

## Testing

### Development
1. Use Sign in with Apple JS for web testing
2. For mobile, you need a real device (simulator won't work)
3. Test users can be created in App Store Connect

### Production Checklist
- [ ] App ID configured with Sign in with Apple
- [ ] Service ID created and configured
- [ ] Private key generated and secured
- [ ] Environment variables set
- [ ] Return URLs whitelisted in Apple configuration
- [ ] Mobile app capabilities enabled
- [ ] Privacy policy and terms of service URLs provided to Apple

## Common Issues

1. **Invalid client**: Check your Service ID matches APPLE_CLIENT_ID
2. **Invalid grant**: Authorization code expired or already used
3. **Invalid audience**: Bundle ID mismatch in identity token
4. **No email returned**: User chose to hide email; use relay email provided

## Security Notes

- Never expose your private key
- Validate identity tokens on the server
- Store Apple user ID for future logins
- Handle email relay addresses properly
- Implement proper session management