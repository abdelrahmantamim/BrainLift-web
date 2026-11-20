# Hybrid Architecture Plan: Convex + Express Server

## Overview

This document outlines the hybrid architecture where Convex handles core database and auth functionality while the Express server continues to provide AI services, file processing, and admin features.

## Architecture Split

### Convex Responsibilities

1. **Database Operations**
   - All user data, profiles, quizzes, flashcards
   - Study sessions and progress tracking
   - File metadata (not actual file processing)
   - Real-time data synchronization

2. **Authentication**
   - Handled by Clerk integration
   - Session management
   - User profiles

3. **Real-time Features**
   - Chat message storage and retrieval
   - Live updates for collaborative features
   - Notification status updates

### Express Server Responsibilities

1. **AI Services**
   - OpenAI API integration
   - Anthropic Claude integration
   - Google Generative AI
   - Model selection and configuration
   - AI response generation for chat
   - Quiz and flashcard generation

2. **File Processing**
   - Unified Parser Service (separate microservice on port 8002):
     - Advanced document parsing with chunking
     - Table extraction
     - OCR capabilities
     - Semantic chunking strategies
   - OCR with Tesseract (multiple languages) - fallback
   - PDF text extraction - fallback
   - Word document processing - fallback
   - PowerPoint extraction - fallback
   - Image processing and optimization
   - Markitdown service integration

3. **Push Notifications**
   - Expo push notification service
   - Notification scheduling
   - Device token management (read from Convex)

4. **Email Services (Limited)**
   - Resend API only for custom notifications:
     - Share notifications ("User X shared a quiz with you")
     - Study reminders (if user prefers email)
   - Note: Clerk handles all auth-related emails

5. **Admin Features**
   - Server health monitoring
   - AI model configuration
   - Rate limit management
   - Manual push notifications
   - Usage analytics
   - Cost tracking

## Implementation Plan

### Phase 1: Update Server Architecture

1. **Remove Authentication**
   - Remove Better Auth entirely
   - Remove all auth middleware
   - Remove user management endpoints

2. **Update Database Access**
   - Keep Supabase client for admin tables only
   - Add Convex HTTP client for reading user data
   - Update file processing to write results to Convex

3. **Restructure Endpoints**
   ```
   /api/ai/
     - /chat/complete
     - /quiz/generate
     - /flashcards/generate
     
   /api/files/
     - /process
     - /extract-text
     - /generate-preview
     
   /api/admin/
     - /health
     - /models
     - /notifications/send
     - /analytics
     
   /api/notifications/
     - /send-push
     - /schedule
   ```

### Phase 2: Update Convex Integration

1. **AI Service Actions**
   ```typescript
   // convex/ai/actions.ts
   export const generateQuiz = action({
     args: {
       topic: v.string(),
       fileId: v.optional(v.id("files")),
       // ... other args
     },
     handler: async (ctx, args) => {
       // Call Express server API
       const response = await fetch(`${EXPRESS_URL}/api/ai/quiz/generate`, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'X-API-Key': process.env.EXPRESS_API_KEY,
         },
         body: JSON.stringify(args),
       });
       
       const quiz = await response.json();
       
       // Save to Convex database
       return await ctx.runMutation(internal.quizzes.saveGenerated, quiz);
     },
   });
   ```

2. **File Processing Flow**
   ```typescript
   // convex/files/actions.ts
   export const processFile = action({
     args: {
       fileId: v.id("files"),
       storageUrl: v.string(),
     },
     handler: async (ctx, args) => {
       // Call Express server for processing
       const response = await fetch(`${EXPRESS_URL}/api/files/process`, {
         method: 'POST',
         headers: {
           'X-API-Key': process.env.EXPRESS_API_KEY,
         },
         body: JSON.stringify({
           fileId: args.fileId,
           url: args.storageUrl,
         }),
       });
       
       const result = await response.json();
       
       // Update file with extracted text
       await ctx.runMutation(internal.files.updateExtractedText, {
         fileId: args.fileId,
         extractedText: result.text,
         metadata: result.metadata,
       });
     },
   });
   ```

### Phase 3: Server Updates

1. **Add Convex Client**
   ```javascript
   // server/config/convex.config.js
   import { ConvexHttpClient } from "convex/browser";
   
   export const convexClient = new ConvexHttpClient(
     process.env.CONVEX_URL,
     { 
       // Use system token for server-to-server auth
       headers: {
         Authorization: `Bearer ${process.env.CONVEX_DEPLOY_KEY}`,
       },
     }
   );
   ```

2. **Update Chat Service**
   ```javascript
   // server/services/chatService.js
   export async function generateChatResponse(conversationId, messages, context) {
     // Get user preferences from Convex
     const conversation = await convexClient.query(
       api.conversations.get,
       { conversationId }
     );
     
     const profile = await convexClient.query(
       api.profiles.getByUserId,
       { userId: conversation.userId }
     );
     
     const model = profile.preferences?.defaultAiModel || 'gpt-4';
     
     // Generate response using configured model
     const response = await generateAIResponse(messages, context, model);
     
     return response;
   }
   ```

3. **Update File Processor**
   ```javascript
   // server/routes/files.routes.js
   router.post('/process', authenticate, async (req, res) => {
     const { fileId, url } = req.body;
     
     try {
       // Download file from URL
       const fileBuffer = await downloadFile(url);
       
       // Process based on type
       const result = await processFile(fileBuffer, req.body.mimeType);
       
       // Return extracted text
       res.json({
         success: true,
         text: result.text,
         metadata: result.metadata,
       });
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   });
   ```

### Phase 4: Security

1. **API Key Authentication**
   ```javascript
   // server/middleware/apiAuth.middleware.js
   export function authenticateAPI(req, res, next) {
     const apiKey = req.headers['x-api-key'];
     
     if (!apiKey || apiKey !== process.env.EXPRESS_API_KEY) {
       return res.status(401).json({ error: 'Unauthorized' });
     }
     
     next();
   }
   ```

2. **CORS Configuration**
   ```javascript
   // Only allow Convex and admin dashboard
   app.use(cors({
     origin: [
       process.env.CONVEX_URL,
       'https://admin.getbrainlift.app',
       'http://localhost:3002', // Admin dev
     ],
     credentials: true,
   }));
   ```

### Phase 5: Admin Dashboard Updates

1. **Dual Connection**
   - Connect to Convex for user data (read-only)
   - Connect to Express for admin operations
   - Keep Supabase for admin-specific tables

2. **Updated Features**
   - User search via Convex
   - AI model configuration via Express
   - Push notifications via Express
   - Analytics from both systems

## Benefits of Hybrid Approach

1. **Leverages Strengths**
   - Convex: Real-time, type-safe database
   - Express: Heavy processing, AI services

2. **Maintains Features**
   - All AI capabilities preserved
   - Admin dashboard continues working
   - File processing remains powerful

3. **Scalability**
   - Convex handles user scale
   - Express scales independently for AI

4. **Cost Optimization**
   - Only pay for AI processing when used
   - Convex handles most requests efficiently

## Migration Timeline

- Week 1: Update Express server, remove auth
- Week 2: Complete Convex migration for core features
- Week 3: Integrate AI services with Convex
- Week 4: Update admin dashboard, testing

## Monitoring

1. **Express Server**
   - Health endpoint
   - Process monitoring
   - Error tracking

2. **Convex**
   - Built-in dashboard
   - Function metrics
   - Error logs

3. **Integration Points**
   - Log all cross-service calls
   - Monitor latency
   - Track failures