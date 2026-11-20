import express from 'express';
const router = express.Router();
import { authMiddleware, requireAuth } from '../middleware/auth.middleware.js';
import { getSupabase } from '../config/services.config.js';
import { getModelConfig } from '../utils/modelConfig.js';
import { generateAIResponse } from '../services/ai/unifiedAIService.js';
import { getTokenParameter, getTemperature } from '../utils/helpers.js';
import { cacheMiddleware, invalidateCache, cacheConfigs } from '../middleware/cache.middleware.js';
import { detectLanguageWithContext } from '../utils/languageDetection.js';
import unifiedContentExtractor from '../utils/unifiedContentExtractor.js';
import contentModerationService from '../services/contentModeration.service.js';
import { validate } from '../middleware/validate.js';
import { generateQuizSchema, saveQuizSchema, manualQuizSchema, quizAttemptSchema } from '../schemas/quiz.schemas.js';
import { sanitizeCustomInstructions } from '../utils/promptSanitizer.js';
import { checkSubscriptionLimit } from '../middleware/subscriptionLimits.middleware.js';
import { parseAndValidateGeneratedQuiz, InvalidGeneratedQuizError } from '../utils/validateGeneratedQuiz.js';

// Auth middleware is already applied at the server level before this router
// router.use(authMiddleware); // Removed to prevent overriding req.userId

// Helper function to get language instruction based on detected language
async function getLanguageInstruction(targetLanguage, detectedLanguage, languagePreference, isFromFiles = false) {
  // If user explicitly selected a target language, use it
  if (targetLanguage) {
    const { languageMap } = await import('../utils/languageDetection.js');
    const langName = languageMap[targetLanguage]?.name || targetLanguage;
    return `IMPORTANT: The user has requested the quiz to be in ${langName}. Create ALL content (title, questions, options, explanations) in ${langName} only. Do not mix languages. Even if the source content is in a different language, translate everything to ${langName}.`;
  }
  
  // If we have detected language from client, use it
  if (detectedLanguage && detectedLanguage.name) {
    return `IMPORTANT: The user speaks ${detectedLanguage.name}. Create ALL content (title, questions, options, explanations) in ${detectedLanguage.name} only. Do not mix languages.`;
  }
  
  // Fallback to old behavior if no detected language
  if (languagePreference === 'english') {
    return 'IMPORTANT: Create ALL questions, answers, options, explanations, and the title in English only, regardless of the input language or topic.';
  } else if (languagePreference === 'auto-detect-default-english' || !languagePreference) {
    // Default to auto-detect-default-english when languagePreference is undefined
    if (isFromFiles) {
      return 'IMPORTANT: If the content is clearly in a non-English language, create ALL questions, answers, and the title in that language. Otherwise, create them in English.';
    } else {
      return 'IMPORTANT: Create ALL questions, answers, and the title in English unless the topic request itself is written in another language (not just about something from another language/culture). For example, "LaLiga Players" should be in English, but "Jugadores de LaLiga" should be in Spanish.';
    }
  } else {
    return 'IMPORTANT: Detect the language of the input content and create ALL questions, answers, and the title in the SAME language. If the content is in Spanish, create Spanish questions. If in Arabic, create Arabic questions.';
  }
}

// Generate quiz (invalidates quiz list cache)
router.post('/generate', validate(generateQuizSchema), checkSubscriptionLimit('quiz'), invalidateCache(['quiz:userId:*', 'quiz:v2:userId:*', 'quiz:v3:userId:*']), async (req, res) => {
  const startTime = Date.now();
  const { type, topic, content, fileIds, questionCount = 10, difficulty = 'medium', customInstructions, languagePreference, detectedLanguage, targetLanguage } = req.body;
  
  // If client didn't detect language, do it server-side
  let finalDetectedLanguage = detectedLanguage;
  if (!detectedLanguage && topic) {
    finalDetectedLanguage = await detectLanguageWithContext(topic, customInstructions || content || '');
    console.log('[Server] Detected language:', finalDetectedLanguage);
  }
  
  console.log('Generating quiz:', { type, topic, questionCount, difficulty, customInstructions, languagePreference, detectedLanguage: finalDetectedLanguage, targetLanguage });
  
  try {
    const modelConfig = getModelConfig();
    
    // Prepare the prompt for AI
    let prompt = `Generate ${questionCount} multiple choice questions for a quiz with ${difficulty} difficulty level. Each question should have 4 options (A, B, C, D) with only one correct answer. Include an explanation for the correct answer.\n\n`;
    
    // Add custom instructions FIRST if they exist (sanitized to prevent prompt injection)
    const safeCustomInstructions = sanitizeCustomInstructions(customInstructions);
    if (safeCustomInstructions) {
      prompt += `Additional requirements for the questions:\n${safeCustomInstructions}\n\n`;
      
      // If custom instructions are provided, only add difficulty guidance that doesn't conflict
      if (difficulty === 'easy') {
        prompt += 'While following the above requirements, aim for a slightly easier difficulty level where appropriate.\n';
      } else if (difficulty === 'hard') {
        prompt += 'While following the above requirements, aim for a more challenging difficulty level where appropriate.\n';
      }
    } else {
      // Only apply standard difficulty guidance if no custom instructions
      if (difficulty === 'easy') {
        prompt += 'Make the questions straightforward and test basic understanding. Avoid complex scenarios or tricky wording.\n';
      } else if (difficulty === 'hard') {
        prompt += 'Make the questions challenging, requiring deep understanding and critical thinking. Include complex scenarios and nuanced distinctions.\n';
      } else {
        prompt += 'Make the questions moderately challenging, testing both understanding and application of concepts.\n';
      }
    }
    
    prompt += '\n';
    
    if (type === 'topic' && topic) {
      prompt += `Topic: ${topic}\n`;
      if (content) {
        prompt += `Additional context: ${content}\n`;
      }
    } else if (type === 'files' && fileIds && fileIds.length > 0) {
      // Use unified content extractor for consistent processing
      let fileContent = '';
      let detectedLanguages = [];
      let contentChunks = []; // Collect chunks for better language detection
      
      const dbStartTime = Date.now();
      
      // Extract content from each file using unified extractor
      const extractionPromises = fileIds.map(fileId => 
        unifiedContentExtractor.extractFileContent(fileId, req.userId, {
          includeImages: false, // Don't include base64 images for AI
          includeMetadata: true,
          purpose: 'quiz'
        })
      );
      
      try {
        const extractedContents = await Promise.all(extractionPromises);
        console.log(`[Quiz] Unified extraction time: ${Date.now() - dbStartTime}ms for ${fileIds.length} files`);
        
        for (const extracted of extractedContents) {
          if (extracted && extracted.extractedData) {
            const data = extracted.extractedData;
            
            // Track detected languages
            if (data.language && data.language !== 'unknown') {
              detectedLanguages.push(data.language);
            }
            
            // Collect text chunks for better language detection
            if (data.text && data.text.length > 50) {
              // Split text into reasonable chunks (around 200 chars each)
              const chunkSize = 200;
              for (let i = 0; i < data.text.length; i += chunkSize) {
                contentChunks.push(data.text.substring(i, i + chunkSize));
              }
            }
            
            // Build content using unified extractor's formatted output
            const context = unifiedContentExtractor.buildAIContext(extracted, 'quiz');
            fileContent += `\n${context}\n`;
            
            console.log(`[Quiz] Added content from ${extracted.fileName}: ${data.text.length} chars, language: ${data.language}`);
          }
        }
        
        // Handle language detection based on targetLanguage setting
        if (targetLanguage === 'auto' && contentChunks.length > 0) {
          // Use chunks for better language detection when auto is selected
          const { detectLanguageFromChunks } = await import('../utils/languageDetection.js');
          finalDetectedLanguage = await detectLanguageFromChunks(contentChunks);
          console.log(`[Quiz] Auto-detected language from ${contentChunks.length} chunks: ${finalDetectedLanguage.name} (${finalDetectedLanguage.confidence})`);
        } else if (!targetLanguage && !detectedLanguage && detectedLanguages.length > 0) {
          // Fallback to file-level detection if no chunks or not auto mode
          const langCounts = detectedLanguages.reduce((acc, lang) => {
            acc[lang] = (acc[lang] || 0) + 1;
            return acc;
          }, {});
          const mostCommonLang = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0][0];
          console.log(`[Quiz] Auto-detected language from files: ${mostCommonLang}`);
          finalDetectedLanguage = { code: mostCommonLang, name: mostCommonLang };
        }
      } catch (error) {
        console.error('[Quiz] Error extracting file content:', error);
        // Fallback to simple message
        fileContent = '\n--- Error extracting file content ---\n';
      }
      
      if (fileContent) {
        prompt += `Generate questions based ONLY on the following educational content. All questions must be directly related to this material${safeCustomInstructions ? ` AND follow the custom requirements specified above` : ''}:\n${fileContent}\n\nIMPORTANT: Only create questions about the content provided above. Do not generate generic questions.${safeCustomInstructions ? ` Remember to follow the requirements specified earlier.` : ''}`;
      } else {
        prompt += `Generate questions based on the uploaded educational content.\n`;
      }
    }
    
    prompt += `\nReturn the response as a JSON object with this exact format:
{
  "title": "A descriptive title for the quiz based on the content",
  "questions": [
    {
      "id": "1",
      "question": "The actual question text?",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctAnswer": 0,
      "explanation": "Explanation of why this is the correct answer"
    }
  ]
}

Make the questions educational and challenging but fair. Ensure correctAnswer is the index (0-3) of the correct option. The title should be specific to the content, not generic.`;

    // Use configured model or fallback to default
    const activeModel = modelConfig.quiz || { 
      provider: 'openai', 
      model_name: 'gpt-4.1-nano-2025-04-14',
      api_endpoint: 'https://api.openai.com/v1/chat/completions'
    };
    
    console.log(`Using ${activeModel.provider} model: ${activeModel.model_name} for quiz generation`);
    
    // Log sanitized custom instructions presence (not content)
    if (safeCustomInstructions) {
      console.log('[Quiz] Custom instructions applied (sanitized)');
    }
    
    const aiStartTime = Date.now();
    let responseText = '';
    
    // Use unified AI service
    try {
      const languageInstruction = await getLanguageInstruction(targetLanguage, finalDetectedLanguage, languagePreference, type === 'files');
      const systemContent = `You are an expert quiz creator. ${languageInstruction} Only create questions based on information that is explicitly stated in the provided content. Do not invent or assume information not present in the source material. Always respond with valid JSON. Also suggest a descriptive title for the quiz based on the content.${safeCustomInstructions ? `\n\nThe user has provided additional requirements for quiz style: ${safeCustomInstructions}` : ''}`;
      
      const messages = [
        { role: 'system', content: systemContent },
        { role: 'user', content: prompt }
      ];
      
      const temperature = getTemperature(activeModel.model_name);
      const tokenParam = getTokenParameter(activeModel.model_name, { type: 'quiz' });
      
      console.log('[Quiz] Using unified AI service:', {
        provider: activeModel.provider,
        model: activeModel.model_name,
        temperature,
        maxTokens: tokenParam.max_tokens || 2000
      });
      
      const aiResponse = await generateAIResponse({
        feature: 'quiz',
        messages,
        temperature,
        maxTokens: tokenParam.max_tokens || 2000,
        jsonMode: true // Use JSON response format for consistency
      });
      
      responseText = aiResponse.content.trim();
    } catch (error) {
      console.error(`Failed to generate quiz with ${activeModel.model_name}:`, error.message);
      // The unified AI service already handles fallback internally
      throw error;
    }
    
    console.log(`[Quiz] AI generation time: ${Date.now() - aiStartTime}ms`);

    const validated = parseAndValidateGeneratedQuiz(responseText);
    const questions = validated.questions;
    const quizTitle = validated.title || `Quiz on ${topic || 'Educational Content'}`;
    
    // Don't auto-save - let the client decide when to save
    // This prevents duplicate quizzes when the client calls /save endpoint
    
    // Return quiz without saving
    const totalTime = Date.now() - startTime;
    console.log(`[Quiz] Total generation time: ${totalTime}ms`);
    
    await req.featureUsage?.finalize();
    res.json({
      title: quizTitle,
      questions: questions,
      description: `A quiz with ${questions.length} questions${topic ? ` about ${topic}` : ''}`,
      difficulty: difficulty,
      category: 'general',
      tags: []
    });
    
  } catch (error) {
    console.error('Quiz generation error:', error);
    await req.featureUsage?.release().catch(() => {});
    res.status(error instanceof InvalidGeneratedQuizError ? 502 : 500).json({
      error: { message: error instanceof InvalidGeneratedQuizError ? 'We could not create a valid quiz. Please try again.' : 'Failed to generate quiz', code: error.code }
    });
  }
});

if (process.env.NODE_ENV !== 'production') {
// Debug endpoint to verify quiz exists
router.get('/debug/:quizId', async (req, res) => {
  const { quizId } = req.params;
  const supabase = getSupabase();
  
  const { data: quiz, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .single();
    
  res.json({ 
    exists: !!quiz,
    quiz,
    error,
    requestingUser: req.userId,
    ownerMatch: quiz?.user_id === req.userId
  });
});

// Get user's quizzes (no cache version for testing)
router.get('/list-no-cache', async (req, res) => {
  console.log('[No Cache] Fetching user quizzes for user:', req.userId);
  
  try {
    const supabase = getSupabase();
    
    const { data: quizzes, error } = await supabase
      .from('quizzes')
      .select(`
        *,
        quiz_attempts (
          score,
          completed_at
        )
      `)
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[No Cache] Error:', error);
      return res.status(500).json({ error: { message: 'Failed to fetch quizzes' } });
    }
    
    console.log('[No Cache] Found quizzes:', quizzes?.length || 0);
    
    // Transform the data to match frontend expectations
    const transformedQuizzes = (quizzes || []).map(quiz => {
      // Calculate attempts data from quiz_attempts array if available
      let attempts = 0;
      let bestScore = null;
      let lastAttempt = null;
      
      if (quiz.quiz_attempts && Array.isArray(quiz.quiz_attempts)) {
        attempts = quiz.quiz_attempts.length;
        if (attempts > 0) {
          bestScore = Math.max(...quiz.quiz_attempts.map(a => a.score || 0));
          const sortedAttempts = quiz.quiz_attempts
            .filter(a => a.completed_at)
            .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
          if (sortedAttempts.length > 0) {
            lastAttempt = sortedAttempts[0].completed_at;
          }
        }
      }
      
      return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        questionCount: quiz.question_count,
        createdAt: quiz.created_at,
        lastAttempt: lastAttempt,
        bestScore: bestScore,
        attempts: attempts,
        tags: quiz.tags || [],
        category: quiz.category || 'general',
        difficulty: quiz.difficulty || 'medium'
      };
    });
    
    // Log a sample to debug caching issues
    if (transformedQuizzes.length > 0) {
      console.log('[Quiz List] Sample transformed quiz:', {
        id: transformedQuizzes[0].id,
        title: transformedQuizzes[0].title,
        attempts: transformedQuizzes[0].attempts,
        bestScore: transformedQuizzes[0].bestScore,
        tags: transformedQuizzes[0].tags,
        category: transformedQuizzes[0].category
      });
    }
    
    res.json({ quizzes: transformedQuizzes });
  } catch (error) {
    console.error('[No Cache] Quiz list error:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

}
// Get user's quizzes
router.get('/list', cacheMiddleware(cacheConfigs.quizList), async (req, res) => {
  console.log('Fetching user quizzes for user:', req.userId);
  
  try {
    const supabase = getSupabase();
    
    // Try to use the database function first
    const { data: quizzes, error } = await supabase
      .rpc('get_user_quizzes', { p_user_id: req.userId });
    
    if (error) {
      console.error('Error fetching quizzes with function:', error);
    }
    
    // Always do a direct query as well to ensure we get all quizzes
    const { data: directQuizzes, error: directError } = await supabase
      .from('quizzes')
      .select(`
        id,
        title,
        description,
        question_count,
        created_at,
        source_type,
        tags,
        category,
        difficulty,
        quiz_attempts (
          score,
          completed_at
        )
      `)
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });
    
    if (directError) {
      console.error('Direct query also failed:', directError);
    }
    
    // If we have results from both, compare them
    if (quizzes && directQuizzes) {
      const functionQuizIds = new Set(quizzes.map(q => q.id));
      const missingQuizzes = directQuizzes.filter(q => !functionQuizIds.has(q.id));
      
      if (missingQuizzes.length > 0) {
        console.warn('[Quiz] Some quizzes missing from function results:', {
          totalFromFunction: quizzes.length,
          totalFromDirect: directQuizzes.length,
          missing: missingQuizzes.map(q => ({
            id: q.id,
            title: q.title,
            source_type: q.source_type
          }))
        });
      }
    }
    
    // Always use direct query results since function doesn't return tags/category properly
    const finalQuizzes = directQuizzes || quizzes;
    
    if (!finalQuizzes) {
      return res.json({ quizzes: [] });
    }
    
    // Transform the data to match frontend expectations
    const transformedQuizzes = (finalQuizzes || []).map(quiz => {
      // Calculate attempts data from quiz_attempts array if available
      let attempts = 0;
      let bestScore = null;
      let lastAttempt = null;
      
      if (quiz.quiz_attempts && Array.isArray(quiz.quiz_attempts)) {
        attempts = quiz.quiz_attempts.length;
        if (attempts > 0) {
          bestScore = Math.max(...quiz.quiz_attempts.map(a => a.score || 0));
          const sortedAttempts = quiz.quiz_attempts
            .filter(a => a.completed_at)
            .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
          if (sortedAttempts.length > 0) {
            lastAttempt = sortedAttempts[0].completed_at;
          }
        }
      }
      
      return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        questionCount: quiz.question_count,
        createdAt: quiz.created_at,
        lastAttempt: quiz.last_attempt || lastAttempt,
        bestScore: quiz.best_score || bestScore,
        attempts: Number(quiz.attempts) || attempts,
        tags: quiz.tags || [],
        category: quiz.category || 'general',
        difficulty: quiz.difficulty || 'medium'
      };
    });
    
    res.json({ quizzes: transformedQuizzes });
  } catch (error) {
    console.error('Quiz list error:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

// Get specific quiz
router.get('/:quizId', async (req, res) => {
  const { quizId } = req.params;
  console.log('Fetching quiz:', quizId);
  
  try {
    const supabase = getSupabase();
    
    // Fetch quiz from database - only allow owner access
    const { data: quiz, error } = await supabase
      .from('quizzes')
      .select('id, title, description, questions, question_count, tags, category, difficulty')
      .eq('id', quizId)
      .eq('user_id', req.userId)
      .single();

    if (error || !quiz) {
      return res.status(404).json({ error: { message: 'Quiz not found' } });
    }

    res.json({
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      questions: quiz.questions,
      questionCount: quiz.question_count,
      tags: quiz.tags || [],
      category: quiz.category || 'general',
      difficulty: quiz.difficulty || 'medium'
    });
  } catch (error) {
    console.error('Quiz fetch error:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

// Delete quiz
router.delete('/:quizId', invalidateCache(['quiz:userId:*', 'quiz:v2:userId:*', 'quiz:v3:userId:*']), async (req, res) => {
  const { quizId } = req.params;
  console.log('Deleting quiz:', quizId);
  
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('quizzes')
      .delete()
      .eq('id', quizId)
      .eq('user_id', req.userId);
    
    if (error) {
      console.error('Error deleting quiz:', error);
      return res.status(500).json({ error: { message: 'Failed to delete quiz' } });
    }
    
    res.json({ message: 'Quiz deleted successfully' });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

// Update quiz
router.patch('/:quizId', invalidateCache(['quiz:userId:*', 'quiz:v2:userId:*', 'quiz:v3:userId:*']), async (req, res) => {
  const { quizId } = req.params;
  const { title, description, tags, category, difficulty } = req.body;
  console.log('Updating quiz:', quizId, { title, description, tags, category, difficulty });
  
  try {
    const supabase = getSupabase();
    
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (tags !== undefined) updateData.tags = tags;
    if (category !== undefined) updateData.category = category;
    if (difficulty !== undefined) updateData.difficulty = difficulty;
    
    console.log('Update data being sent to database:', updateData);
    
    const { data: quiz, error } = await supabase
      .from('quizzes')
      .update(updateData)
      .eq('id', quizId)
      .eq('user_id', req.userId)
      .select('id, title, description, question_count, tags, category, difficulty')
      .single();
    
    if (error) {
      console.error('Error updating quiz:', error);
      return res.status(500).json({ error: { message: 'Failed to update quiz' } });
    }
    
    console.log('Quiz updated successfully:', quiz);
    res.json({ quiz, message: 'Quiz updated successfully' });
  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

// Save quiz attempt/results (invalidates quiz list cache)
router.post('/:quizId/attempt', validate(quizAttemptSchema), invalidateCache(['quiz:userId:*', 'quiz:v2:userId:*', 'quiz:v3:userId:*']), async (req, res) => {
  const { quizId } = req.params;
  const { score, totalQuestions, answers, timeSpent, startTime, endTime, quizTitle } = req.body;
  console.log('Saving quiz attempt:', { quizId, score, totalQuestions });
  
  try {
    const supabase = getSupabase();
    
    // Get quiz details if title not provided
    let title = quizTitle;
    if (!title) {
      const { data: quiz } = await supabase
        .from('quizzes')
        .select('title')
        .eq('id', quizId)
        .single();
      title = quiz?.title || 'Quiz';
    }
    
    // Save quiz attempt to database
    const { data: attempt, error } = await supabase
      .from('quiz_attempts')
      .insert([{
        quiz_id: quizId,
        user_id: req.userId,
        score: score,
        total_questions: totalQuestions,
        answers: answers,
        time_spent: timeSpent
      }])
      .select('id')
      .single();
    
    if (error) {
      console.error('Error saving quiz attempt:', error);
      return res.status(500).json({ 
        error: { message: 'Failed to save quiz results', details: error.message } 
      });
    }
    
    // Track user activity for the quiz completion
    try {
      const correctAnswers = answers?.filter((answer, index) => {
        // Assuming answers array contains user's selected options
        // This would need to be adjusted based on your actual quiz structure
        return answer.isCorrect || false;
      }).length || Math.round((score / 100) * totalQuestions);
      
      // Import the tracking function from stats routes
      const statsModule = await import('./stats.routes.js');
      
      await statsModule.trackUserActivity(supabase, req.userId, {
        sessionType: 'quiz',
        contentId: quizId,
        contentTitle: title,
        startTime: startTime || new Date(Date.now() - (timeSpent * 1000)).toISOString(),
        endTime: endTime || new Date().toISOString(),
        score: score,
        questionsAnswered: totalQuestions,
        correctAnswers: correctAnswers,
        metadata: {
          quizId,
          timeSpent,
          attemptId: attempt.id,
          difficulty: 'medium' // Could be extracted from quiz data
        }
      });
      
      console.log('Activity tracked successfully for quiz completion');
    } catch (trackingError) {
      console.error('Error tracking quiz activity:', trackingError);
      // Don't fail the request if tracking fails
    }
    
    res.json({
      attemptId: attempt.id,
      message: 'Quiz results saved successfully'
    });
  } catch (error) {
    console.error('Quiz attempt save error:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

// Create manual quiz endpoint
router.post('/manual', validate(manualQuizSchema), async (req, res) => {
  const { title, description, questions, questionCount, tags, category, difficulty } = req.body;
  console.log('Creating manual quiz:', { title, description, questionCount, tags, category, difficulty });
  
  try {
    const supabase = getSupabase();
    
    // Validate questions
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ 
        error: { message: 'Invalid questions provided' } 
      });
    }
    
    // Format questions to match expected structure
    const formattedQuestions = questions.map((q, index) => ({
      id: index + 1,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || `The correct answer is option ${q.correctAnswer + 1}.`
    }));
    
    // Save quiz to database
    const { data: quiz, error } = await supabase
      .from('quizzes')
      .insert([{
        user_id: req.userId,
        title: title || 'Manual Quiz',
        description: description || 'Manually created quiz',
        source_type: 'manual',
        source_data: {
          createdAt: new Date().toISOString(),
          manual: true
        },
        questions: formattedQuestions,
        question_count: formattedQuestions.length,
        tags: tags || [],
        category: category || 'general',
        difficulty: difficulty || 'medium'
      }])
      .select('id, is_suspended')
      .single();
    
    if (error) {
      console.error('Error saving manual quiz:', error);
      return res.status(500).json({ 
        error: { message: 'Failed to save quiz', details: error.message } 
      });
    }
    
    // Update user stats after manual quiz creation
    try {
      await supabase.rpc('update_user_daily_stats', { p_user_id: req.userId });
      console.log('Updated user stats after manual quiz creation');
    } catch (statsError) {
      console.error('Error updating stats after manual quiz creation:', statsError);
    }
    
    res.json({
      success: true,
      quizId: quiz.id,
      message: 'Quiz created successfully'
    });
  } catch (error) {
    console.error('Manual quiz creation error:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

// Save quiz endpoint
router.post('/save', validate(saveQuizSchema), invalidateCache(['quiz:userId:*', 'quiz:v2:userId:*', 'quiz:v3:userId:*']), async (req, res) => {
  const { title, description, questions, source, sourceData, tags, category, difficulty } = req.body;
  console.log('Saving quiz:', { title, questionCount: questions?.length, tags, category, difficulty });
  
  try {
    const supabase = getSupabase();
    
    // First, scan the quiz content for moderation
    const quizData = {
      title: title || 'Untitled Quiz',
      description: description || null,
      questions: questions
    };
    
    const moderationResults = await contentModerationService.scanQuiz(quizData);
    
    // Save quiz to database
    const { data: quiz, error } = await supabase
      .from('quizzes')
      .insert([{
        user_id: req.userId,
        title: title || 'Untitled Quiz',
        description: description || null,
        source_type: source || 'topic',
        source_data: sourceData || {},
        questions: questions,
        question_count: questions.length,
        tags: tags || [],
        category: category || 'general',
        difficulty: difficulty || 'medium',
        // If content is flagged as inappropriate, mark it as suspended
        is_suspended: moderationResults.overall === 'inappropriate',
        suspension_reason: moderationResults.overall === 'inappropriate' ? 'auto_moderation' : null,
        suspension_details: moderationResults.overall === 'inappropriate' ? moderationResults : null
      }])
      .select('id, is_suspended')
      .single();
    
    if (error) {
      console.error('Error saving quiz:', error);
      return res.status(500).json({ 
        error: { message: 'Failed to save quiz', details: error.message } 
      });
    }
    
    // Add to moderation queue if needed
    if (moderationResults.overall !== 'clean') {
      await contentModerationService.addToModerationQueue('quiz', quiz.id, req.userId, moderationResults);
    }
    
    // Update user stats after quiz creation
    try {
      // Update daily stats to reflect the new quiz
      await supabase.rpc('update_user_daily_stats', { p_user_id: req.userId });
      console.log('Updated user stats after quiz creation');
    } catch (statsError) {
      console.error('Error updating stats after quiz creation:', statsError);
      // Don't fail the request if stats update fails
    }
    
    // If content was auto-suspended, inform the user
    if (quiz.is_suspended) {
      return res.status(200).json({
        quizId: quiz.id,
        message: 'Quiz saved but is under review for policy violations',
        suspended: true,
        reason: 'Content flagged for review'
      });
    }
    
    res.json({
      quizId: quiz.id,
      message: 'Quiz saved successfully'
    });
  } catch (error) {
    console.error('Quiz save error:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

export default router;
