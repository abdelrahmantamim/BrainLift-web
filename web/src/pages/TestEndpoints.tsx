import React, { useState } from 'react';
import axios from '@/services/api';
import { authService } from '@/services/auth.service';
import { quizService } from '@/services/quiz.service';
import { flashcardService } from '@/services/flashcard.service';
import { fileService } from '@/services/file.service';
import { chatService } from '@/services/chat.service';

export const TestEndpoints: React.FC = () => {
  const [results, setResults] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  const addResult = (result: string) => {
    setResults(prev => [...prev, result]);
  };

  const testEndpoints = async () => {
    setTesting(true);
    setResults(['🚀 Testing Better Auth Integration with Core Features']);

    try {
      // 1. Check if already logged in
      addResult('\n1️⃣ Checking authentication status...');
      const session = await authService.getSession();
      if (!session) {
        addResult('❌ Not logged in. Please log in first.');
        setTesting(false);
        return;
      }
      addResult(`✅ Logged in as: ${session.user.email}`);

      // 2. Test Quizzes
      addResult('\n2️⃣ Testing Quizzes Endpoint...');
      try {
        const quizzes = await quizService.getQuizzes();
        addResult(`✅ Quizzes fetched: ${quizzes.length} quizzes`);
        if (quizzes.length > 0) {
          addResult(`   First quiz: ${quizzes[0].title}`);
        }
      } catch (error: unknown) {
        const errorData = error as { response?: { status?: number }; message?: string };
        addResult(`❌ Quizzes error: ${errorData.response?.status} ${errorData.message}`);
      }

      // 3. Test Flashcards
      addResult('\n3️⃣ Testing Flashcards Endpoint...');
      try {
        const decks = await flashcardService.getDecks();
        addResult(`✅ Flashcard decks fetched: ${decks.length} decks`);
        if (decks.length > 0) {
          addResult(`   First deck: ${decks[0].title}`);
        }
      } catch (error: unknown) {
        const errorData = error as { response?: { status?: number }; message?: string };
        addResult(`❌ Flashcards error: ${errorData.response?.status} ${errorData.message}`);
      }

      // 4. Test Files
      addResult('\n4️⃣ Testing Files Endpoint...');
      try {
        const files = await fileService.getFiles();
        addResult(`✅ Files fetched: ${files.length} files`);
        if (files.length > 0) {
          addResult(`   First file: ${files[0].fileName}`);
        }
      } catch (error: unknown) {
        const errorData = error as { response?: { status?: number }; message?: string };
        addResult(`❌ Files error: ${errorData.response?.status} ${errorData.message}`);
      }

      // 5. Test Chat
      addResult('\n5️⃣ Testing Chat Endpoint...');
      try {
        const sessions = await chatService.getSessions();
        const sessionCount = sessions.length;
        addResult(`✅ Chat history fetched: ${sessionCount} sessions`);
      } catch (error: unknown) {
        const errorData = error as { response?: { status?: number }; message?: string };
        addResult(`❌ Chat error: ${errorData.response?.status} ${errorData.message}`);
      }

      // 6. Test Stats
      addResult('\n6️⃣ Testing Stats Endpoint...');
      try {
        const response = await axios.get('/auth/stats');
        addResult(`✅ Stats fetched: ${JSON.stringify(response.data)}`);
      } catch (error: unknown) {
        const errorData = error as { response?: { status?: number }; message?: string };
        addResult(`❌ Stats error: ${errorData.response?.status} ${errorData.message}`);
      }

      addResult('\n✨ All tests completed!');
    } catch (error: unknown) {
      const errorData = error as { message?: string };
      addResult(`\n❌ Test failed: ${errorData.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">API Endpoint Test</h1>
        
        <button
          onClick={testEndpoints}
          disabled={testing}
          className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed mb-8"
        >
          {testing ? 'Testing...' : 'Run Tests'}
        </button>

        <div className="bg-gray-900 rounded-lg p-6 font-mono text-sm">
          {results.length === 0 ? (
            <p className="text-gray-400">Click "Run Tests" to start testing endpoints</p>
          ) : (
            results.map((result, index) => (
              <div key={index} className="whitespace-pre-wrap">
                {result}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};