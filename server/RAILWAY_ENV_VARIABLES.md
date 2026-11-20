# Railway Environment Variables Guide

## Required Environment Variables for Railway Deployment

### Core Configuration
```bash
NODE_ENV=production
PORT=$PORT  # Railway will provide this automatically
```

### Database (Supabase) - REQUIRED
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

### Authentication (Better Auth) - REQUIRED
```bash
BETTER_AUTH_SECRET=your-better-auth-secret-key  # Generate a strong 32+ character secret
BETTER_AUTH_URL=https://your-railway-app.up.railway.app  # Your Railway app URL
BETTER_AUTH_TRUSTED_ORIGINS=https://your-frontend.com,https://your-mobile-app.com
```

### Canonical Public URLs - RECOMMENDED
```bash
WEB_APP_URL=https://getbrainlift.app        # Web app origin: canonical share links + welcome-email links
API_PUBLIC_URL=https://app.getbrainlift.app # Public API origin: QR-code image URLs in share responses
```
Both default to these exact values when unset, so they are optional today — set them explicitly so future domain changes are one dashboard edit. Note: `WEB_APP_URL` is also read by `email.service.js` (welcome-email "Get Started" link), which previously defaulted to `brain-lift-website.vercel.app`; setting this var points those emails at `getbrainlift.app/dashboard`.

### Admin Panel JWT - REQUIRED
```bash
JWT_SECRET=your-jwt-secret-key  # Generate a strong secret for admin panel
```

### AI Services - REQUIRED (at least one)
```bash
OPENAI_API_KEY=sk-your-openai-api-key  # For AI features
# OR
GOOGLE_API_KEY=your-google-api-key  # Alternative to OpenAI
```

### Push Notifications - OPTIONAL
```bash
# For web push notifications
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_EMAIL=admin@yourdomain.com

# For Expo push notifications (mobile)
EXPO_ACCESS_TOKEN=your-expo-access-token  # If using Expo push
```

### Redis Configuration - OPTIONAL (recommended for production)
```bash
REDIS_URL=redis://default:password@your-redis-host:6379
# OR individual settings:
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=your-redis-password
```

### CORS and URLs - REQUIRED
```bash
FRONTEND_URL=https://your-frontend-domain.com
MOBILE_URL=https://your-mobile-app.com  # Or expo URLs
APP_URL=https://your-railway-app.up.railway.app  # For share links
```

### Unified Parser Service - REQUIRED if using parser
```bash
UNIFIED_PARSER_URL=https://your-parser-service.up.railway.app
UNIFIED_PARSER_API_KEY=your-parser-api-key  # From unified-parser setup
```

### Email Service - OPTIONAL
```bash
RESEND_API_KEY=your-resend-api-key  # If using Resend for emails
```

### Monitoring - OPTIONAL
```bash
POSTHOG_API_KEY=your-posthog-api-key
POSTHOG_HOST=https://us.i.posthog.com
```

### File Upload - OPTIONAL (defaults provided)
```bash
MAX_FILE_SIZE_MB=50  # Default: 50MB
```

### Rate Limiting - OPTIONAL (defaults provided)
```bash
RATE_LIMIT_WINDOW_MS=900000  # Default: 15 minutes
RATE_LIMIT_MAX_REQUESTS=100  # Default: 100 requests
```

## Setting Environment Variables in Railway

1. Go to your Railway project dashboard
2. Click on your service (server)
3. Navigate to the "Variables" tab
4. Click "Add Variable" and add each required variable
5. Railway will automatically restart your service when variables are updated

## Generating Secrets

### Generate Better Auth Secret
```bash
openssl rand -base64 32
```

### Generate JWT Secret
```bash
openssl rand -base64 32
```

### Generate VAPID Keys (for web push)
```bash
npx web-push generate-vapid-keys
```

## Important Notes

1. **Never commit these values to your repository**
2. **Use strong, unique secrets for production**
3. **Update CORS origins to match your actual domains**
4. **Railway provides the PORT variable automatically - don't override it**
5. **Database URL should use SSL for production (add ?sslmode=require)**