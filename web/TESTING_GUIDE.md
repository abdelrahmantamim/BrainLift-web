# AI Tutoring App - Testing Guide

## ✅ Setup Confirmation

The web app is **properly connected** to the same Supabase database as your mobile app:
- **Database URL**: `https://hoyehjymzhdwozspccgh.supabase.co`
- **Total Users**: 14 active users
- **Authentication**: Shared auth.users table between mobile and web

## 🚀 How to Test

### 1. Start the Backend Server
```bash
cd server
npm install  # If not already installed
npm run dev
```
The server will start on `http://localhost:3001`

### 2. Start the Web App
```bash
cd web
npm install  # If not already installed
npm run dev
```
The web app will start on `http://localhost:3000`

### 3. Test with Existing Accounts

You can login with any of your existing mobile app accounts. Here are some active users:
- **abdelrahmanmtamim@gmail.com** (Last active: 2025-07-06)
- **aaa@ggg.com** (Recent account)
- **bantoom@gmail.com** 
- **fungameraa@gmail.com**
- **j.d.dotterer@gmail.com**

**Note**: Use the same password you set up in the mobile app for these accounts.

### 4. Create a New Test Account
You can also create a new account directly from the web app:
1. Click "Don't have an account?" on the login page
2. Fill in the registration form
3. The account will be created in the same Supabase database

## 🧪 Feature Testing Checklist

### Authentication
- [ ] Login with existing mobile app account
- [ ] Create new account
- [ ] Logout functionality
- [ ] Password validation (uppercase, lowercase, number, special character)

### Chat Feature
- [ ] Send messages to AI assistant
- [ ] Receive AI responses
- [ ] Copy message content (custom tooltip should appear)
- [ ] Export message as PDF
- [ ] Share message (generates getbrainlift.app link)
- [ ] Upload files via drag-and-drop or click

### Quiz Feature
- [ ] Create AI-generated quiz
- [ ] Import quiz by ID
- [ ] Take a quiz
- [ ] View quiz results
- [ ] Export quiz as PDF
- [ ] Share quiz

### Flashcards Feature
- [ ] Create flashcard deck (manually or from file)
- [ ] Study flashcards with spaced repetition
- [ ] Review cards without tracking
- [ ] Export flashcards as PDF
- [ ] Share flashcard deck

## 🔧 Running Tests

### Unit Tests
```bash
cd web
npm run test          # Run tests
npm run test:ui       # Run tests with UI
npm run test:coverage # Run tests with coverage report
```

### E2E Tests
```bash
cd web
npm run test:e2e      # Run E2E tests
npm run test:e2e:ui   # Run E2E tests with UI
npm run test:e2e:debug # Debug E2E tests
```

## 📊 Database Verification

To verify data sync between mobile and web:

1. **Create content on mobile app**
   - Create a quiz or flashcard deck
   - Start a chat conversation

2. **Login to web app with same account**
   - You should see all your mobile content
   - Any new content created on web will appear in mobile

## 🐛 Troubleshooting

### Backend Connection Issues
1. Ensure server is running on port 3001
2. Check `web/.env` has `VITE_API_URL=http://localhost:3001/api`
3. Check server logs for any errors

### Authentication Issues
1. Verify you're using the correct password
2. Check browser console for specific error messages
3. Ensure cookies are enabled (JWT tokens stored in cookies)

### Content Not Syncing
1. Pull to refresh on mobile app
2. Refresh web page
3. Check network tab for API errors

## 🔒 Security Notes

- All API calls use JWT authentication
- Passwords must meet security requirements
- Row Level Security (RLS) ensures users only see their own data
- Shared content uses secure share IDs with optional expiration

## 📱 Mobile-Web Feature Parity

Both mobile and web apps share:
- Same user accounts and authentication
- Same database for all content
- Same AI models and functionality
- Same sharing mechanism

Web-specific features:
- Keyboard shortcuts (Enter to send, Shift+Enter for new line)
- Hover effects and tooltips
- Resizable panels
- Multiple export options (preview/download)

Happy testing! 🎉