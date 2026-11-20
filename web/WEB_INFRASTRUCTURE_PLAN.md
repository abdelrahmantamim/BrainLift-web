# BrainLift Web Infrastructure Plan

## Domain: getbrainlift.app

## Overview
Complete web infrastructure to support BrainLift mobile app, including landing page, authentication, shareable content, and admin dashboard.

## 1. Public Pages (No Auth Required)

### Landing Page (/)
- Modern, responsive design showcasing BrainLift features
- Hero section with app download links (App Store/Google Play)
- Feature sections: AI-powered learning, flashcards, quizzes, progress tracking
- Testimonials/social proof
- Pricing (if applicable)
- Footer with legal links

### Shareable Content Pages
- `/share/quiz/{shareId}` - Public quiz preview
- `/share/flashcards/{shareId}` - Public flashcard deck preview
- "Open in App" CTA buttons
- SEO optimized with Open Graph meta tags

### Legal Pages
- `/privacy` - Privacy Policy
- `/terms` - Terms of Service
- `/contact` - Contact form

## 2. Authentication Pages

### Better Auth Aligned Pages
- `/auth/login` - Email/password + Apple Sign-In
- `/auth/register` - New user registration
- `/auth/reset-password` - Password reset flow
- `/auth/reset-password/confirm` - Reset confirmation
- `/auth/apple/callback` - Apple OAuth redirect handler

### Features Required:
- Session-based auth matching mobile app
- Apple Sign-In web implementation
- Password validation matching server rules
- Error handling for all auth scenarios

## 3. Protected Pages (Requires Auth)

### User Dashboard (/dashboard)
- Overview of user's learning progress
- Recent quizzes and flashcards
- Study streak tracking
- Quick actions

### Content Management
- `/quizzes` - User's quiz library
- `/flashcards` - User's flashcard decks
- `/study-sessions` - Study history

## 4. Admin Dashboard Updates

### Current Issues to Fix:
- JWT auth → Better Auth sessions
- Update API endpoints
- Fix notification sending
- User management with OAuth accounts

### Required Features:
- User analytics
- Content moderation
- Push notification management
- System health monitoring

## 5. Technical Requirements

### Environment Variables
```env
VITE_API_URL=https://api.getbrainlift.app
VITE_APP_URL=https://getbrainlift.app
VITE_APPLE_CLIENT_ID=com.brainlift.service
VITE_APPLE_REDIRECT_URI=https://getbrainlift.app/auth/apple/callback
```

### API Integration
- Update all endpoints to match Better Auth
- Handle session cookies properly
- Implement proper CORS for getbrainlift.app

### SEO & Performance
- Server-side rendering for public pages
- Open Graph tags for shareable content
- PWA capabilities
- Analytics integration

## 6. Deployment Configuration

### Hosting Options
1. **Vercel** (Recommended for Next.js)
   - Automatic SSL
   - Edge functions
   - Easy environment management

2. **Netlify** (For current Vite setup)
   - Simple deployment
   - Form handling
   - Redirect rules

### DNS Configuration
- A record → hosting provider
- CNAME www → getbrainlift.app
- SSL certificate (automatic with most providers)

## 7. Implementation Priority

1. **Phase 1 - Core Infrastructure** (Today)
   - Landing page
   - Auth pages with Better Auth
   - Apple Sign-In web flow
   - Basic shareable pages

2. **Phase 2 - User Features**
   - Protected dashboard
   - Content management pages
   - Study tracking

3. **Phase 3 - Admin & Polish**
   - Admin dashboard migration
   - Analytics
   - Performance optimization

## 8. Design System

### Brand Colors
- Primary: #667eea (Purple)
- Secondary: #764ba2 (Dark Purple)
- Accent: #f093fb (Pink)
- Success: #10b981
- Error: #ef4444

### Typography
- Headings: Inter or SF Pro Display
- Body: Inter or SF Pro Text
- Code: SF Mono or Fira Code

### Components
- Consistent with mobile app design
- Modern, clean interface
- Smooth animations
- Dark mode support

## 9. File Structure
```
web/
├── src/
│   ├── pages/
│   │   ├── public/
│   │   │   ├── LandingPage.tsx
│   │   │   ├── ShareQuizPage.tsx
│   │   │   └── ShareFlashcardsPage.tsx
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx (updated)
│   │   │   ├── RegisterPage.tsx (updated)
│   │   │   ├── ResetPasswordPage.tsx
│   │   │   └── AppleCallbackPage.tsx
│   │   └── dashboard/
│   │       └── DashboardPage.tsx
│   ├── components/
│   │   ├── landing/
│   │   ├── auth/
│   │   └── shared/
│   └── services/
│       └── auth.service.ts (updated for Better Auth)
```

## 10. Testing Strategy
- E2E tests for critical flows
- Unit tests for auth logic
- Visual regression tests
- Performance monitoring

## Next Steps
1. Create landing page component
2. Update auth pages for Better Auth
3. Implement Apple Sign-In web flow
4. Create shareable content pages
5. Deploy to getbrainlift.app