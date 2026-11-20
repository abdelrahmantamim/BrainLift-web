import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = 'http://localhost:3001/api';

async function testQuizGeneration() {
  try {
    console.log('Testing quiz generation...\n');
    
    // First, get a session token
    const authResponse = await fetch(`${API_URL}/auth/session/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken: process.env.TEST_REFRESH_TOKEN || 'your-refresh-token-here'
      })
    });
    
    if (!authResponse.ok) {
      console.error('Failed to authenticate:', await authResponse.text());
      console.log('\nPlease set TEST_REFRESH_TOKEN in your .env file');
      return;
    }
    
    const authData = await authResponse.json();
    const accessToken = authData.accessToken;
    
    // Test quiz generation with Arabic content
    const quizResponse = await fetch(`${API_URL}/quiz/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        type: 'topic',
        topic: 'الذكاء الاصطناعي والتعلم الآلي',
        questionCount: 5,
        difficulty: 'medium',
        languagePreference: 'auto-detect',
        targetLanguage: 'ar'
      })
    });
    
    if (!quizResponse.ok) {
      console.error('Quiz generation failed:', await quizResponse.text());
      return;
    }
    
    const quiz = await quizResponse.json();
    console.log('Quiz generated successfully!');
    console.log('Title:', quiz.title);
    console.log('Questions:', quiz.questions.length);
    console.log('\nSample question:');
    console.log(JSON.stringify(quiz.questions[0], null, 2));
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testQuizGeneration();