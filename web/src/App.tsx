import { useEffect } from 'react';
import { initializeAnalytics } from './utils/analytics';
import { BrainLifting } from './components/common/BrainLifting';

// Initialize PostHog analytics
initializeAnalytics();
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CelebrationProvider } from './contexts/CelebrationProvider';
import { LimitReachedModal } from './components/common/LimitReachedModal';

// Layout
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Pages
import { HomePage } from './pages/HomePage';
import { ChatPage } from './pages/ChatPage';
import { FilesPage } from './pages/FilesPage';
import { FlashcardsPage } from './pages/FlashcardsPage';
import { FlashcardStudyPage } from './pages/FlashcardStudyPage';
import { FlashcardReviewPage } from './pages/FlashcardReviewPage';
import { FlashcardCreatePage } from './pages/FlashcardCreatePage';
import { QuizzesPage } from './pages/QuizzesPage';
import { QuizCreatePage } from './pages/QuizCreatePage';
import { QuizTakePage } from './pages/QuizTakePage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { AppleCallbackPage } from './pages/auth/AppleCallbackPage';
import ModernLandingPage from './pages/ModernLandingPage';
import LandingDesign4 from './pages/LandingDesign4';
import LandingDesign6 from './pages/LandingDesign6';
import LandingDesign7 from './pages/LandingDesign7';
import LandingDesign8 from './pages/LandingDesign8';
import LandingDesign9 from './pages/LandingDesign9';
import LandingDesign10 from './pages/LandingDesign10';
import { ShareQuizPage } from './pages/ShareQuizPage';
import { ShareFlashcardsPage } from './pages/ShareFlashcardsPage';
import { SharePreviewPage } from './pages/SharePreviewPage';
import { ShareMessagePage } from './pages/ShareMessagePage';
import { TestEndpoints } from './pages/TestEndpoints';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import HelpPage from './pages/HelpPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Store
import { useAuthStore } from './store/authStore';
import { useUIStore } from './store/uiStore';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const isCheckingAuth = useAuthStore((state) => state.isCheckingAuth);
  const initSystemThemeListener = useUIStore((state) => state.initSystemThemeListener);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const unsubscribe = initSystemThemeListener();
    return unsubscribe;
  }, [initSystemThemeListener]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pg-cream">
        <BrainLifting message="Loading..." />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <CelebrationProvider>
        <Router>
          <Routes>
          {/* Public routes */}
          <Route path="/" element={<ModernLandingPage />} />
          <Route path="/4" element={<LandingDesign4 />} />
          <Route path="/6" element={<LandingDesign6 />} />
          <Route path="/7" element={<LandingDesign7 />} />
          <Route path="/8" element={<LandingDesign8 />} />
          <Route path="/9" element={<LandingDesign9 />} />
          <Route path="/10" element={<LandingDesign10 />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/support" element={<Navigate to="/help" replace />} />
          <Route path="/share/preview/:type/:shareId" element={<SharePreviewPage />} />
          <Route path="/share/quiz/:shareId" element={<ShareQuizPage />} />
          <Route path="/share/flashcards/:shareId" element={<ShareFlashcardsPage />} />
          <Route path="/share/message/:shareId" element={<ShareMessagePage />} />

          {/* Auth routes */}
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/apple/callback" element={<AppleCallbackPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<HomePage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/files" element={<FilesPage />} />
              <Route path="/flashcards" element={<FlashcardsPage />} />
              <Route path="/flashcards/create/manual" element={<FlashcardCreatePage />} />
              <Route path="/flashcards/:id/study" element={<FlashcardStudyPage />} />
              <Route path="/flashcards/:id/review" element={<FlashcardReviewPage />} />
              <Route path="/quizzes" element={<QuizzesPage />} />
              <Route path="/quiz/create/manual" element={<QuizCreatePage />} />
              <Route path="/quiz/:id/take" element={<QuizTakePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/test-endpoints" element={<TestEndpoints />} />
            </Route>
          </Route>

          {/* Admin routes */}
          <Route path="/admin_dashboard" element={<Navigate to="https://getbrainlift.app/admin" />} />

          {/* Catch all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--pg-surface)',
            color: 'var(--pg-text)',
            border: '2px solid var(--pg-border)',
            borderRadius: '12px',
            fontFamily: "'Nunito', sans-serif",
            boxShadow: '4px 4px 0px var(--pg-coral)',
          },
        }}
      />
      <LimitReachedModal />
      </CelebrationProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
