import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { getSupabase } from '../config/services.config.js';
import { getModelConfig } from '../utils/modelConfig.js';
import { generateAIResponse } from '../services/ai/unifiedAIService.js';
import { checkSubscriptionLimit } from '../middleware/subscriptionLimits.middleware.js';
import { languageMap, detectLanguage } from '../utils/languageDetection.js';
import unifiedContentExtractor from '../utils/unifiedContentExtractor.js';
import activityTrackingService from '../services/activityTracking.service.js';
import logger from '../utils/serverLogger.js';
import { sanitizeCustomInstructions } from '../utils/promptSanitizer.js';
import { createHash } from 'node:crypto';
import { clearDashboardCache } from '../middleware/cache.middleware.js';

const router = express.Router();

// Auth middleware is already applied at the server level before this router
// router.use(authMiddleware); // Removed to prevent overriding req.userId

// Create manual flashcard deck
router.post('/manual', async (req, res) => {
  try {
    const { deckName, flashcards, category, tags } = req.body;
    const supabase = getSupabase();
    const userId = req.userId;
    
    console.log('[Flashcards] Creating manual deck:', { deckName, cardCount: flashcards?.length });
    
    // Validate input
    if (!deckName || !flashcards || flashcards.length === 0) {
      return res.status(400).json({ error: { message: 'Deck name and flashcards are required' } });
    }
    
    if (flashcards.length > 20) {
      return res.status(400).json({ error: { message: 'Maximum 20 flashcards allowed per deck' } });
    }
    
    // Create deck
    const { data: deck, error: deckError } = await supabase
      .from('flashcard_decks')
      .insert([{
        user_id: userId,
        name: deckName,
        file_name: 'Manual Entry',
        created_at: new Date().toISOString(),
        category: category || 'general',
        tags: tags || []
      }])
      .select('id')
      .single();

    if (deckError) {
      console.error('Error creating deck:', deckError);
      return res.status(500).json({ error: { message: 'Failed to create deck' } });
    }

    // Prepare flashcards for insertion
    const flashcardsToInsert = flashcards.map((card, index) => ({
      deck_id: deck.id,
      question: card.q,
      answer: card.a,
      citation: card.page || 'Manual Entry',
      ease_factor: 2.5,
      interval: 1,
      repetitions: 0,
      next_due: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }));
    
    // Insert flashcards
    const { data: insertedCards, error: cardsError } = await supabase
      .from('flashcards')
      .insert(flashcardsToInsert);
    
    if (cardsError) {
      console.error('Error creating flashcards:', cardsError);
      // Try to clean up the deck
      await supabase
        .from('flashcard_decks')
        .delete()
        .eq('id', deck.id);
      return res.status(500).json({ error: { message: 'Failed to create flashcards' } });
    }
    
    res.json({
      success: true,
      deckId: deck.id,
      deckName: deck.name,
      cardCount: flashcards.length,
    });
  } catch (error) {
    console.error('Manual flashcard creation error:', error);
    res.status(500).json({ error: { message: 'Failed to create manual flashcards' } });
  }
});

// Get all flashcard decks for user
router.get('/decks', async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.userId;

    // Get all decks with card counts
    const { data: decks, error } = await supabase
      .from('flashcard_decks')
      .select(`
        id, name, file_id, file_name, created_at, last_reviewed,
        flashcards (
          id,
          next_due,
          ease_factor
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching decks:', error);
      return res.status(500).json({ error: { message: 'Failed to fetch decks' } });
    }

    // Process decks to add card counts
    const processedDecks = (decks || []).map(deck => {
      const cards = deck.flashcards || [];
      const now = new Date();
      const dueCards = cards.filter(card => new Date(card.next_due) <= now);

      return {
        id: deck.id,
        name: deck.name,
        fileId: deck.file_id,
        fileName: deck.file_name,
        cardCount: cards.length,
        dueCount: dueCards.length,
        createdAt: deck.created_at,
        lastReviewed: deck.last_reviewed,
      };
    });

    res.json({ decks: processedDecks });
  } catch (error) {
    console.error('Get decks error:', error);
    res.status(500).json({ error: { message: 'Failed to fetch flashcard decks' } });
  }
});

// Generate flashcards from a file or topic
function validateFlashcardGeneration(req, res, next) {
  const { fileId, fileIds, topic, content } = req.body || {};
  if (!fileId && (!Array.isArray(fileIds) || fileIds.length === 0) && !topic && !content) {
    return res.status(400).json({ error: { message: 'Either file ID(s) or topic/content is required' } });
  }
  next();
}

router.post('/generate', validateFlashcardGeneration, checkSubscriptionLimit('flashcard'), async (req, res) => {
  try {
    const { fileId, fileIds, topic, content, languagePreference, numberOfCards, customInstructions, targetLanguage, difficulty, category, tags } = req.body;
    const supabase = getSupabase();
    const modelConfig = getModelConfig();
    const userId = req.userId;
    
    console.log('[Flashcards] Request body:', { 
      fileId, 
      fileIds, 
      topic, 
      content: content?.substring(0, 50),
      numberOfCards,
      customInstructions,
      targetLanguage
    });

    let deckName, fileName, sections = [];
    let fileNames = []; // Declare fileNames here so it's available throughout the function
    let allChunks = []; // Declare allChunks here so it's available throughout the function

    if (fileId || fileIds) {
      // Generate from file(s)
      const filesToProcess = fileIds || [fileId];
      allChunks = []; // Reset allChunks for file processing

      for (const fId of filesToProcess) {
        console.log(`[Flashcards] Looking up file: ${fId}`);
        
        // Get file without user_id filter - let RLS handle security
        const { data: file, error: fileError } = await supabase
          .from('files')
          .select('id, name')
          .eq('id', fId)
          .single();

        if (fileError || !file) {
          console.error('File not found:', fId, fileError);
          continue;
        }

        console.log(`[Flashcards] Processing file: ${file.name}`);
        fileNames.push(file.name);

        // Get processed chunks for the file - use same approach as chat
        const { data: chunks, error: chunksError } = await supabase
          .from('file_chunks')
          .select('id, content, chunk_index, metadata')
          .eq('file_id', fId)
          .order('chunk_index', { ascending: true });

        if (chunksError) {
          console.error('Error fetching chunks:', chunksError);
          continue;
        }

        console.log(`[Flashcards] Found ${chunks?.length || 0} chunks for file ${fId}`);

        if (chunks && chunks.length > 0) {
          // For image files, extract ALL relevant data using the same approach as chat
          const processedChunks = chunks.map(chunk => {
            let isImageChunk = false;
            let processedChunk = { ...chunk };
            
            // Check if this is an image chunk
            if (chunk.metadata && chunk.metadata.type === 'image') {
              isImageChunk = true;
            } else {
              try {
                const parsedContent = JSON.parse(chunk.content);
                if (parsedContent.type === 'image' && parsedContent.base64) {
                  isImageChunk = true;
                }
              } catch (e) {
                // Not JSON image data
              }
            }
            
            if (isImageChunk) {
              try {
                const imageData = JSON.parse(chunk.content);
                console.log(`[Flashcards] Processing image chunk for: ${imageData.fileName}`);
                console.log(`[Flashcards] Image data structure:`, {
                  hasOCR: imageData.hasOCR,
                  hasOcrData: !!imageData.ocrData,
                  ocrDataKeys: imageData.ocrData ? Object.keys(imageData.ocrData) : [],
                  hasRawText: !!imageData.rawText,
                  rawTextLength: imageData.rawText ? imageData.rawText.length : 0,
                  hasAdvancedAnalysis: !!imageData.advancedAnalysis,
                  imageDataKeys: Object.keys(imageData)
                });
                
                let extractedContent = '';
                
                // First, add any advanced analysis data if available
                if (imageData.advancedAnalysis) {
                  const analysis = imageData.advancedAnalysis;
                  console.log(`[Flashcards] Image has advanced analysis:`, Object.keys(analysis));
                  
                  // Content type hint
                  if (analysis.contentType) {
                    extractedContent += `[Image Content Type: ${analysis.contentType}]\n\n`;
                  }
                  
                  // Exercise/Question data
                  if (analysis.exercise) {
                    extractedContent += '[Educational Exercise Detected:]\n';
                    if (analysis.exercise.questionNumber) {
                      extractedContent += `Question #${analysis.exercise.questionNumber}\n`;
                    }
                    if (analysis.exercise.problemType) {
                      extractedContent += `Type: ${analysis.exercise.problemType}\n`;
                    }
                    if (analysis.exercise.questionText) {
                      extractedContent += `Question: ${analysis.exercise.questionText}\n`;
                    }
                    if (analysis.exercise.instructions) {
                      extractedContent += `Instructions: ${analysis.exercise.instructions}\n`;
                    }
                    extractedContent += '\n';
                  }
                  
                  // Table data
                  if (analysis.tableData) {
                    extractedContent += '[Table Data Extracted:]\n';
                    if (analysis.tableData.headers && analysis.tableData.headers.length > 0) {
                      extractedContent += `Headers: ${analysis.tableData.headers.join(', ')}\n`;
                    }
                    if (analysis.tableData.rows) {
                      extractedContent += `Rows: ${analysis.tableData.rows.length}\n`;
                    }
                    if (analysis.tableData.formattedText) {
                      extractedContent += analysis.tableData.formattedText + '\n';
                    }
                    extractedContent += '\n';
                  }
                  
                  // Mathematical content
                  if (analysis.mathContent) {
                    extractedContent += '[Mathematical Content:]\n';
                    extractedContent += analysis.mathContent + '\n\n';
                  }
                  
                  // Chart data
                  if (analysis.chartData) {
                    extractedContent += '[Chart Data:]\n';
                    extractedContent += `Type: ${analysis.chartData.type}\n`;
                    if (analysis.chartData.data) {
                      extractedContent += `Data points: ${JSON.stringify(analysis.chartData.data)}\n`;
                    }
                    extractedContent += '\n';
                  }
                }
                
                // Then add OCR text - handle both advanced and fast OCR formats
                if (imageData.ocrData && imageData.ocrData.text) {
                  extractedContent += '[OCR Text Extraction:]\n';
                  extractedContent += `Language: ${imageData.ocrData.language || 'unknown'}\n`;
                  extractedContent += `Confidence: ${imageData.ocrData.confidence || 0}%\n`;
                  extractedContent += 'Text:\n' + imageData.ocrData.text + '\n';
                } else if (imageData.rawText) {
                  extractedContent += '[Raw Text:]\n' + imageData.rawText + '\n';
                  // Try to get language from ocrData even if text is in rawText
                  if (imageData.ocrData && imageData.ocrData.language) {
                    extractedContent += `Language: ${imageData.ocrData.language}\n`;
                  }
                }
                
                // Only use chunks with actual content
                if (extractedContent.trim()) {
                  processedChunk = {
                    ...chunk,
                    content: extractedContent.trim(),
                    metadata: {
                      ...chunk.metadata,
                      detectedLanguage: imageData.ocrData?.language || 'unknown',
                      hasAdvancedAnalysis: !!imageData.advancedAnalysis
                    }
                  };
                  console.log(`[Flashcards] Extracted content length: ${extractedContent.length} chars`);
                  console.log(`[Flashcards] Content preview: ${extractedContent.substring(0, 200)}...`);
                } else {
                  console.log(`[Flashcards] No content extracted from image chunk`);
                  return null; // This will be filtered out
                }
              } catch (e) {
                console.error('[Flashcards] Error parsing image chunk:', e);
                return null; // Skip chunks that fail to parse
              }
            }
            
            return processedChunk;
          }).filter(chunk => chunk !== null); // Remove null chunks
          
          // Filter out chunks with no meaningful content or raw JSON
          const textChunks = processedChunks.filter(chunk => {
            const hasContent = chunk.content && chunk.content.trim().length > 0;
            const isNotRawJSON = !chunk.content.includes('"type":"image"') || chunk.content.includes('[');
            return hasContent && isNotRawJSON;
          });
          
          console.log(`[Flashcards] Processed ${textChunks.length} valid chunks from ${chunks.length} total chunks`);
          allChunks.push(...textChunks);
        } else {
          // Try to use the file's extractedText if no chunks are found
          if (file.extractedText && file.extractedText.trim().length > 0) {
            console.log(`[Flashcards] No chunks found, using extractedText for file ${fId}`);
            allChunks.push({
              content: file.extractedText,
              chunk_index: 0,
              file_id: fId
            });
          }
        }
      }

      if (allChunks.length === 0) {
        console.log(`[Flashcards] No chunks found for any files. Files: ${fileNames.join(', ')}`);
        return res.status(400).json({ 
          error: { 
            message: 'No content found in the selected files. The files may still be processing or need to be re-uploaded.',
            files: fileNames,
            fileIds: filesToProcess
          } 
        });
      }

      // Combine all chunks into sections for processing
      const combinedContent = allChunks.map(chunk => chunk.content).join('\n\n');
      
      // Log content preview for debugging
      console.log(`[Flashcards] Combined content preview (first 200 chars): ${combinedContent.substring(0, 200)}...`);
      console.log(`[Flashcards] Total content length: ${combinedContent.length} characters`);
      
      // Check if this is likely an image file based on file extension
      const isImageFileCheck = fileNames.some(name => {
        const ext = name.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
      });
      
      // For images, don't split content as OCR text is usually short
      if (isImageFileCheck) {
        sections = [combinedContent];
        console.log(`[Flashcards] Processing image file(s) - content length: ${combinedContent.length}`);
      } else {
        // Split content into manageable sections if it's too large
        const MAX_CONTENT_LENGTH = 50000; // Reduced from 100000 for better processing
        if (combinedContent.length > MAX_CONTENT_LENGTH) {
          // Split into multiple sections
          sections = [];
          for (let i = 0; i < combinedContent.length; i += MAX_CONTENT_LENGTH) {
            sections.push(combinedContent.substring(i, i + MAX_CONTENT_LENGTH));
          }
          console.log(`[Flashcards] Content split into ${sections.length} sections for processing`);
        } else {
          sections = [combinedContent];
        }
      }

      // Create a more descriptive default name
      if (fileNames.length > 1) {
        deckName = `Study Set from ${fileNames.length} Files`;
      } else {
        const fileName = fileNames[0];
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
        // Clean up common file naming patterns
        const cleanName = nameWithoutExt
          .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
          .replace(/\b\w/g, l => l.toUpperCase()); // Title case
        deckName = `${cleanName} Study Cards`;
      }
      fileName = fileNames.join(', ');

    } else {
      // Generate from topic/content - create more descriptive name
      if (topic) {
        deckName = `${topic} Study Set`;
      } else {
        // If only content provided, try to extract a topic from first few words
        const contentPreview = content.substring(0, 100).trim();
        const firstSentence = contentPreview.split('.')[0];
        if (firstSentence.length > 5 && firstSentence.length < 50) {
          deckName = `${firstSentence} Study Cards`;
        } else {
          deckName = 'Custom Study Set';
        }
      }
      fileName = topic;
      
      // Create content section with custom instructions if provided
      let fullContent = content || `Generate comprehensive flashcards about: ${topic}`;
      if (customInstructions && !content) {
        fullContent = `Generate comprehensive flashcards about: ${topic}. Focus on: ${customInstructions}`;
      }
      sections = [fullContent];
    }

    console.log(`[Flashcards] Processing ${sections.length} sections`);

    // Generate flashcards for each section
    const allFlashcards = [];
    
    // Different prompts for file-based vs topic-based generation
    const isFromFiles = fileId || fileIds;
    
    // Determine number of cards to generate
    let cardsToGenerate = Math.min(Math.max(parseInt(numberOfCards, 10) || 15, 1), 50);
    
    // Check if we're processing an image file (only relevant for file-based generation)
    let isImageFile = false;
    if (isFromFiles && fileNames.length > 0) {
      isImageFile = fileNames.some(name => {
        const ext = name.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
      });
    }
    
    // For images or very short content, adjust expectations
    if (isImageFile && sections.length === 1 && sections[0].length < 500) {
      cardsToGenerate = Math.min(cardsToGenerate, 5);
      console.log(`[Flashcards] Limited content detected (likely from image), adjusting target to ${cardsToGenerate} cards`);
    }
    
    // Determine language instruction based on preference
    let languageInstruction = '';
    let detectedLanguage = null;
    
    // Check if we already have language info from OCR
    let ocrDetectedLanguage = null;
    if (allChunks.length > 0) {
      // Look for language metadata in chunks
      for (const chunk of allChunks) {
        if (chunk.metadata && chunk.metadata.detectedLanguage && chunk.metadata.detectedLanguage !== 'unknown') {
          ocrDetectedLanguage = chunk.metadata.detectedLanguage;
          console.log(`[Flashcards] Found OCR-detected language: ${ocrDetectedLanguage}`);
          // Log the actual content to verify it matches the detected language
          console.log(`[Flashcards] Chunk content preview for language verification: "${chunk.content.substring(0, 100)}..."`);
          break;
        }
      }
    }
    
    console.log(`[Flashcards] Language settings:`, {
      targetLanguage,
      languagePreference,
      isFromFiles,
      ocrDetectedLanguage
    });
    
    // If user explicitly selected a target language, use it
    if (targetLanguage && targetLanguage !== 'auto') {
      const langName = languageMap[targetLanguage]?.name || targetLanguage;
      languageInstruction = `LANGUAGE: The user has requested flashcards in ${langName}. Create ALL questions and answers in ${langName} only. Do not mix languages. Even if the source content is in a different language, translate everything to ${langName}.`;
    } else if (targetLanguage === 'auto' || languagePreference === 'auto' || languagePreference === 'auto-detect-default-english') {
      // Auto mode - detect language from content
      
      // Use chunk-based detection if we have chunks and targetLanguage is explicitly 'auto'
      if (targetLanguage === 'auto' && allChunks && allChunks.length > 0) {
        const { detectLanguageFromChunks } = await import('../utils/languageDetection.js');
        const chunkTexts = allChunks.map(chunk => chunk.content);
        detectedLanguage = await detectLanguageFromChunks(chunkTexts);
        console.log(`[Flashcards] Auto-detected language from ${chunkTexts.length} chunks: ${detectedLanguage.name} (${detectedLanguage.confidence})`);
        
        const langName = detectedLanguage.name;
        if (detectedLanguage.code === 'ar') {
          languageInstruction = `LANGUAGE: The content is in Arabic (العربية). You MUST create ALL questions and answers in Arabic ONLY. Use Arabic script (العربية) for both questions and answers. Do NOT use any other language or script. This is CRITICAL.`;
        } else {
          languageInstruction = `LANGUAGE: The content is in ${langName}. Create ALL questions and answers in ${langName} only. Do not mix languages.`;
        }
      }
      // First check if we have OCR-detected language
      else if (ocrDetectedLanguage && ocrDetectedLanguage !== 'unknown') {
        const langName = ocrDetectedLanguage.charAt(0).toUpperCase() + ocrDetectedLanguage.slice(1);
        // Special handling for Arabic to be extra clear
        if (ocrDetectedLanguage.toLowerCase() === 'arabic' || ocrDetectedLanguage.toLowerCase() === 'ar') {
          languageInstruction = `LANGUAGE: The content is in Arabic (العربية). You MUST create ALL questions and answers in Arabic ONLY. Use Arabic script (العربية) for both questions and answers. Do NOT use any other language or script. This is CRITICAL.`;
        } else {
          languageInstruction = `LANGUAGE: The content is in ${langName} (detected during OCR processing). Create ALL questions and answers in ${langName} only. Do not mix languages.`;
        }
        console.log(`[Flashcards] Using OCR-detected language: ${langName}`);
      } else if (isFromFiles && sections.length > 0) {
        // For file-based content, sample random chunks
        const sampleSize = Math.min(3, sections.length);
        const samples = [];
        
        // Get random chunks from the content
        for (let i = 0; i < sampleSize; i++) {
          const randomSection = sections[Math.floor(Math.random() * sections.length)];
          // Take a chunk from the middle of the section
          const chunkSize = 200;
          const startPos = Math.max(0, Math.floor(randomSection.length / 2) - chunkSize / 2);
          const chunk = randomSection.substring(startPos, startPos + chunkSize);
          samples.push(chunk);
        }
        
        // Detect language from combined samples
        const combinedSample = samples.join(' ');
        detectedLanguage = await detectLanguage(combinedSample);
        
        console.log(`[Flashcards] Detected language from content:`, detectedLanguage);
        
        if (detectedLanguage && detectedLanguage.confidence > 0.6) {
          languageInstruction = `LANGUAGE: The content appears to be in ${detectedLanguage.name}. Create ALL questions and answers in ${detectedLanguage.name} only.`;
        } else {
          languageInstruction = 'LANGUAGE: Create flashcards in English (language detection was uncertain).';
        }
      } else if (!isFromFiles && (topic || content)) {
        // For topic-based generation, detect from the topic/content
        const textToDetect = content || topic;
        detectedLanguage = await detectLanguage(textToDetect);
        
        console.log(`[Flashcards] Detected language from topic/content:`, detectedLanguage);
        
        if (detectedLanguage && detectedLanguage.confidence > 0.6) {
          languageInstruction = `LANGUAGE: The request appears to be in ${detectedLanguage.name}. Create ALL questions and answers in ${detectedLanguage.name} only.`;
        } else {
          languageInstruction = 'LANGUAGE: Create flashcards in English (language detection was uncertain).';
        }
      } else {
        languageInstruction = 'LANGUAGE: Create flashcards in English.';
      }
    } else {
      // Default to English if no preference specified
      languageInstruction = 'LANGUAGE: Create flashcards in English.';
    }
    
    // Sanitize and add custom instructions if provided
    const safeCustomInstructions = sanitizeCustomInstructions(customInstructions);
    const customInstructionText = safeCustomInstructions
      ? `\n\nAdditional requirements: ${safeCustomInstructions}`
      : '';
    
    // Special prompt for image content
    const imageContentPrompt = isImageFile 
      ? `\n\nIMAGE CONTENT NOTE: This appears to be text extracted from an image. The content may be:
- Photo captions, labels, or annotations
- Text visible in the image (signs, documents, etc.)
- OCR-extracted text which may have some errors
Focus on creating flashcards from any meaningful text found, but understand the content may be limited.`
      : '';
    
    const systemPrompt = isFromFiles 
      ? `You are an expert tutor helping students master material efficiently.

Given the following study content, generate high-quality flashcards in JSON format. Each flashcard must focus on key concepts, definitions, processes, or critical facts that will help the student recall and understand the material.

CRITICAL RULES:
1. ${languageInstruction}
2. Extract ONLY information that is EXPLICITLY stated in the content
3. Do NOT invent, assume, or add any information not present in the source material

Guidelines:
- Do **NOT** ask about page numbers, headings, source metadata, or which page/slide contains information
- Use **clear, concise** language appropriate for student review
- Include **questions that test understanding**, not just memorization (e.g., "What is the function of...?" or "How does X relate to Y?")
- Mix question styles: definitions, comparisons, mechanisms, causes/effects, and clinical relevance (if applicable)
- Avoid repetition. Each flashcard must address a **distinct** idea
- Quality over quantity - generate FEWER flashcards if needed to maintain high quality
- Keep answers concise but complete (preferably under 140 characters)${customInstructionText}${imageContentPrompt}

FORBIDDEN QUESTION TYPES:
- "On which page/slide is X mentioned?"
- "What is the main focus of the content?"
- "What does the text discuss?"
- Questions about document structure or metadata
- Generic questions that could apply to any content

You MUST return ONLY a valid JSON object in this exact format:
{
  "flashcards": [
    {
      "q": "Specific educational question testing understanding",
      "a": "Clear, concise answer",
      "page": "Reference if available (optional)"
    }
  ]
}

Generate UP TO ${cardsToGenerate} flashcards in the array.

Focus on creating flashcards that:
- Test conceptual understanding
- Cover key definitions and terminology
- Explore relationships between concepts
- Address practical applications
- Include important formulas or processes
- Highlight critical distinctions or comparisons`
      : `You are an expert educational content creator. Generate comprehensive flashcards about the given topic.
    
IMPORTANT RULES:
1. ${languageInstruction}
2. Create educational flashcards based on commonly known facts and concepts about the topic
3. Ensure all information is accurate and educationally valuable
4. Each flashcard should test understanding of key concepts, facts, or relationships
5. Keep answers concise (under 140 characters when possible)
6. Generate UP TO ${cardsToGenerate} high-quality flashcards - fewer if the topic has limited scope
7. Quality over quantity - only create meaningful educational flashcards
8. NEVER create filler questions just to reach a count${customInstructionText}

FORBIDDEN:
- Generic questions like "What is [topic]?" without specific focus
- Overly broad or vague questions
- Questions that could apply to any topic

You MUST return ONLY a valid JSON object in this exact format:
{
  "flashcards": [
    {
      "q": "Specific question about the topic",
      "a": "Concise, accurate answer (max 140 chars)",
      "page": "General Knowledge"
  }
]

Focus on:
- Key definitions and terminology
- Important concepts and principles
- Cause-and-effect relationships
- Historical context and significance
- Practical applications
- Common misconceptions or important distinctions`;

    // Process all sections
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      
      // Skip empty sections, but allow short ones for topic-based generation
      const minLength = isFromFiles ? 50 : 10; // Lower threshold for topic-based
      if (!section || section.trim().length < minLength) {
        console.log(`[Flashcards] Skipping section ${i + 1} - too short (${section?.length || 0} chars, min: ${minLength})`);
        continue;
      }
      
      console.log(`[Flashcards] Processing section ${i + 1} of ${sections.length} (${section.length} chars)`);
      
      try {
        let flashcardsText;
        
        const chatModel = modelConfig.chat || { provider: 'openai', model_id: 'gpt-4.1-nano' };
        
        // Adjust number of cards per section if multiple sections
        const cardsPerSection = sections.length > 1 
          ? Math.ceil(cardsToGenerate / sections.length) 
          : cardsToGenerate;
        
        // Update system prompt with section-specific card count
        const sectionSystemPrompt = systemPrompt.replace(
          `UP TO ${cardsToGenerate} flashcards`,
          `UP TO ${cardsPerSection} flashcards`
        );
        
        // Use unified AI service
        const messages = [
          { role: 'system', content: sectionSystemPrompt },
          { role: 'user', content: `Generate flashcards from this content:\n\n${section}` }
        ];
        
        const aiResponse = await generateAIResponse({
          feature: 'flashcards', // Will use testing model (same as quiz)
          messages,
          temperature: 0.3,
          maxTokens: 2000,
          jsonMode: true // Use JSON response format for consistency
        });
        
        flashcardsText = aiResponse.content;
          
        console.log(`[Flashcards] Section ${i + 1} AI Response length:`, flashcardsText?.length || 0);

        // Parse the JSON response
        let sectionFlashcards;
        try {
          // Parse the JSON response
          const parsedResponse = JSON.parse(flashcardsText);
          // Handle both array format (legacy) and object format (new)
          sectionFlashcards = parsedResponse.flashcards || parsedResponse;
          
          // If it's not an array, try to extract JSON array from the response
          if (!Array.isArray(sectionFlashcards)) {
            const jsonMatch = flashcardsText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              sectionFlashcards = JSON.parse(jsonMatch[0]);
            } else {
              console.error('No flashcards array found in response');
              throw new Error('Invalid AI response format');
            }
          }
        } catch (parseError) {
          console.error(`Failed to parse flashcards JSON for section ${i + 1}:`, parseError);
          continue; // Skip this section and continue with others
        }

        // Filter and validate flashcards
        const validFlashcards = sectionFlashcards.filter(card => {
          // Basic validation
          if (!card.q || !card.a || card.q.length === 0 || card.a.length === 0) {
            return false;
          }
          
          // Filter out generic/mock questions
          const lowerQ = card.q.toLowerCase();
          const lowerA = card.a.toLowerCase();
          
          // Forbidden patterns in questions
          const forbiddenQuestionPatterns = [
            'main focus',
            'content provided',
            'text discuss',
            'type of information',
            'encoded information',
            'complex data string',
            'what is being described',
            'the content appears to be',
            'the text mentions',
            'according to the content'
          ];
          
          // Forbidden patterns in answers
          const forbiddenAnswerPatterns = [
            'appears to be',
            'possibly encoded',
            'complex data',
            'encoded information',
            'not clear from',
            'content doesn\'t specify',
            'no specific information'
          ];
          
          // Check for forbidden patterns
          const hasInvalidQuestion = forbiddenQuestionPatterns.some(pattern => lowerQ.includes(pattern));
          const hasInvalidAnswer = forbiddenAnswerPatterns.some(pattern => lowerA.includes(pattern));
          
          if (hasInvalidQuestion || hasInvalidAnswer) {
            console.log(`[Flashcards] Filtered out generic flashcard: "${card.q}" -> "${card.a}"`);
            return false;
          }
          
          return true;
        }).map(card => {
          // Truncate answer if too long
          if (card.a.length > 140) {
            card.a = card.a.substring(0, 137) + '...';
          }
          return card;
        });

        allFlashcards.push(...validFlashcards);
        
        // If we have enough cards, stop processing
        if (allFlashcards.length >= cardsToGenerate) {
          console.log(`[Flashcards] Reached target number of cards, stopping at section ${i + 1}`);
          break;
        }
      } catch (error) {
        console.error(`Error generating flashcards for section ${i + 1}:`, error);
        // Continue processing other sections
      }
    }
    
    if (allFlashcards.length === 0) {
      return res.status(500).json({ error: { message: 'Failed to generate flashcards. Please try again.' } });
    }

    // Remove duplicates
    const uniqueFlashcards = Array.from(
      new Map(allFlashcards.map(card => [card.q.toLowerCase(), card])).values()
    );
    
    // Trim to requested number if we have more
    const finalFlashcards = uniqueFlashcards.slice(0, cardsToGenerate);

    console.log(`[Flashcards] Generated ${finalFlashcards.length} unique flashcards from ${uniqueFlashcards.length} total`);
    console.log(`[Flashcards] Final deck name after processing: "${deckName}"`);

    if (finalFlashcards.length === 0) {
      return res.status(400).json({ error: { message: 'Failed to generate flashcards from the content' } });
    }
    
    // Log if we generated fewer cards than requested
    if (finalFlashcards.length < cardsToGenerate) {
      console.log(`[Flashcards] Note: Generated only ${finalFlashcards.length} flashcards (requested: ${cardsToGenerate}) due to content limitations`);
    }

    // Generate a better deck name using AI
    try {
      let namingPrompt;
      
      if (isFromFiles && fileNames.length > 0) {
        // For file-based flashcards, use file names as context
        namingPrompt = `Based on these flashcard questions and the source files, generate a concise, descriptive name for this flashcard deck.

IMPORTANT: Generate the name in the SAME LANGUAGE as the questions below.
${languageInstruction}

Source Files: ${fileNames.join(', ')}

Sample Questions:
${finalFlashcards.slice(0, 3).map(card => card.q).join('\n')}

Requirements:
- Maximum 50 characters
- Use the same language as the questions
- Be descriptive and relevant to the content
- Include subject/topic indication if clear
- Return ONLY the deck name, nothing else
- Examples: "Biology Chapter 3", "Spanish Vocabulary", "Physics Formulas"`;
      } else {
        // For topic-based flashcards
        namingPrompt = `Based on these flashcard questions, generate a concise, descriptive name for this flashcard deck.

IMPORTANT: Generate the name in the SAME LANGUAGE as the questions below.
${languageInstruction}

Original Topic: ${topic || 'General Study'}

Sample Questions:
${finalFlashcards.slice(0, 3).map(card => card.q).join('\n')}

Requirements:
- Maximum 50 characters
- Use the same language as the questions
- Be descriptive and relevant to the content
- Return ONLY the deck name, nothing else`;
      }

      const chatModel = modelConfig.chat || { provider: 'openai', model_id: 'gpt-4.1-nano' };
      
      // Use unified AI service for naming
      const messages = [
        { role: 'user', content: namingPrompt }
      ];
      
      const aiResponse = await generateAIResponse({
        feature: 'flashcards', // Will use testing model
        messages,
        temperature: 0.7,
        maxTokens: 100
      });
      
      let suggestedName = aiResponse.content.trim();
      
      // Clean up the suggested name
      suggestedName = suggestedName.replace(/["'`]/g, ''); // Remove quotes
      suggestedName = suggestedName.replace(/^(Deck name:|Title:)\s*/i, ''); // Remove prefixes
      
      if (suggestedName && suggestedName.length > 0 && suggestedName.length <= 50) {
        deckName = suggestedName;
        console.log(`[Flashcards] AI suggested deck name: "${deckName}"`);
      } else {
        console.log(`[Flashcards] AI suggested name rejected (length: ${suggestedName?.length}): "${suggestedName}"`);
      }
      
    } catch (nameError) {
      console.error('[Flashcards] Error generating deck name:', nameError);
      console.log(`[Flashcards] Keeping default deck name: "${deckName}"`);
      // Keep the default name if AI naming fails
    }

    // Create deck
    const deckId = uuidv4();

    const { error: deckError } = await supabase
      .from('flashcard_decks')
      .insert({
        id: deckId,
        user_id: userId,
        file_id: fileId || null,
        name: deckName,
        file_name: fileName,
        created_at: new Date().toISOString(),
        difficulty: difficulty || null,
        category: category || 'general',
        tags: tags || [],
        language: targetLanguage || 'en',
        custom_instructions: customInstructions || null,
      });

    if (deckError) {
      console.error('Error creating deck:', deckError);
      return res.status(500).json({ error: { message: 'Failed to create flashcard deck' } });
    }

    // Insert flashcards
    const flashcardsToInsert = finalFlashcards.map(card => ({
      id: uuidv4(),
      deck_id: deckId,
      question: card.q,
      answer: card.a,
      citation: card.page || null,
      next_due: new Date().toISOString(),
      ease_factor: 2.5,
      interval: 1,
      repetitions: 0,
      created_at: new Date().toISOString(),
    }));

    const { error: cardsError } = await supabase
      .from('flashcards')
      .insert(flashcardsToInsert);

    if (cardsError) {
      console.error('Error inserting flashcards:', cardsError);
      // Try to clean up the deck
      await supabase.from('flashcard_decks').delete().eq('id', deckId);
      return res.status(500).json({ error: { message: 'Failed to save flashcards' } });
    }

    console.log(`[Flashcards] Successfully created deck "${deckName}" with ${flashcardsToInsert.length} cards`);
    
    res.json({
      success: true,
      deckId,
      deckName,
      cardCount: flashcardsToInsert.length,
      cards: flashcardsToInsert.map(card => ({
        id: card.id,
        question: card.question,
        answer: card.answer,
        citation: card.citation,
      })),
    });
  } catch (error) {
    console.error('Generate flashcards error:', error);
    res.status(500).json({ error: { message: 'Failed to generate flashcards' } });
  }
});

// Get flashcards for a deck
router.get('/decks/:deckId', async (req, res) => {
  try {
    const { deckId } = req.params;
    const supabase = getSupabase();
    const userId = req.userId;

    // Get deck info
    const { data: deck, error: deckError } = await supabase
      .from('flashcard_decks')
      .select('id, name, file_name, created_at, last_reviewed')
      .eq('id', deckId)
      .eq('user_id', userId)
      .single();

    if (deckError || !deck) {
      return res.status(404).json({ error: { message: 'Deck not found' } });
    }

    // Get all cards
    const { data: cards, error: cardsError } = await supabase
      .from('flashcards')
      .select('id, question, answer, citation, next_due, ease_factor, interval, repetitions, last_reviewed, created_at')
      .eq('deck_id', deckId)
      .order('created_at', { ascending: true });

    if (cardsError) {
      console.error('Error fetching cards:', cardsError);
      return res.status(500).json({ error: { message: 'Failed to fetch flashcards' } });
    }

    console.log(`[Flashcards] Fetched ${cards?.length || 0} cards for deck ${deckId}`);
    if (cards && cards.length > 0) {
      console.log('[Flashcards] Sample card:', { 
        id: cards[0].id, 
        hasQuestion: !!cards[0].question,
        hasAnswer: !!cards[0].answer,
        questionLength: cards[0].question?.length,
        answerLength: cards[0].answer?.length
      });
    }

    res.json({
      deck: {
        id: deck.id,
        name: deck.name,
        fileName: deck.file_name,
        createdAt: deck.created_at,
        lastReviewed: deck.last_reviewed,
      },
      cards: cards || [],
    });
  } catch (error) {
    console.error('Get deck error:', error);
    res.status(500).json({ error: { message: 'Failed to fetch deck' } });
  }
});

// Rename a deck
router.patch('/decks/:deckId/rename', async (req, res) => {
  try {
    const { deckId } = req.params;
    const { name } = req.body;
    const supabase = getSupabase();
    const userId = req.userId;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: { message: 'Deck name is required' } });
    }

    // Verify ownership and update
    const { data: deck, error } = await supabase
      .from('flashcard_decks')
      .update({ name: name.trim() })
      .eq('id', deckId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !deck) {
      return res.status(404).json({ error: { message: 'Deck not found' } });
    }

    res.json({ success: true, deck });
  } catch (error) {
    console.error('Rename deck error:', error);
    res.status(500).json({ error: { message: 'Failed to rename deck' } });
  }
});

// Delete a deck
router.delete('/decks/:deckId', async (req, res) => {
  try {
    const { deckId } = req.params;
    const supabase = getSupabase();
    const userId = req.userId;

    // Verify ownership
    const { data: deck, error: deckError } = await supabase
      .from('flashcard_decks')
      .select('id')
      .eq('id', deckId)
      .eq('user_id', userId)
      .single();

    if (deckError || !deck) {
      return res.status(404).json({ error: { message: 'Deck not found' } });
    }

    // Delete flashcards first (cascade should handle this, but being explicit)
    await supabase
      .from('flashcards')
      .delete()
      .eq('deck_id', deckId);

    // Delete deck
    const { error: deleteError } = await supabase
      .from('flashcard_decks')
      .delete()
      .eq('id', deckId);

    if (deleteError) {
      console.error('Error deleting deck:', deleteError);
      return res.status(500).json({ error: { message: 'Failed to delete deck' } });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete deck error:', error);
    res.status(500).json({ error: { message: 'Failed to delete deck' } });
  }
});

// Update card review (spaced repetition)
router.patch('/cards/:cardId/review', async (req, res) => {
  try {
    const { cardId } = req.params;
    const { easeFactor, interval, repetitions, nextDue } = req.body;
    const supabase = getSupabase();
    const userId = req.userId;

    // Verify the card's deck belongs to the user before mutating its review state.
    const { data: ownedCard, error: fetchError } = await supabase
      .from('flashcards')
      .select('deck_id')
      .eq('id', cardId)
      .single();
    if (fetchError || !ownedCard) {
      return res.status(404).json({ error: { message: 'Card not found' } });
    }
    const { data: ownedDeck, error: deckError } = await supabase
      .from('flashcard_decks')
      .select('id')
      .eq('id', ownedCard.deck_id)
      .eq('user_id', userId)
      .single();
    if (deckError || !ownedDeck) {
      return res.status(403).json({ error: { message: 'Unauthorized' } });
    }

    const { error } = await supabase
      .from('flashcards')
      .update({
        ease_factor: easeFactor,
        interval,
        repetitions,
        next_due: nextDue,
        last_reviewed: new Date().toISOString(),
      })
      .eq('id', cardId);

    if (error) {
      console.error('Error updating card:', error);
      return res.status(500).json({ error: { message: 'Failed to update card' } });
    }

    // Update deck last reviewed date
    const { data: card } = await supabase
      .from('flashcards')
      .select('deck_id')
      .eq('id', cardId)
      .single();

    if (card) {
      await supabase
        .from('flashcard_decks')
        .update({ last_reviewed: new Date().toISOString() })
        .eq('id', card.deck_id);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update card error:', error);
    res.status(500).json({ error: { message: 'Failed to update card review' } });
  }
});

// Start flashcard study session. Opening a deck is not completed work, so this
// endpoint deliberately records no activity or XP.
router.post('/session/start', async (req, res) => {
  try {
    const { deckId, deckName } = req.body;
    const userId = req.userId;
    if (!deckId) {
      return res.status(400).json({ error: { message: 'deckId is required' } });
    }
    const supabase = getSupabase();
    const { data: deck, error: deckError } = await supabase
      .from('flashcard_decks')
      .select('id')
      .eq('id', deckId)
      .eq('user_id', userId)
      .single();
    if (deckError || !deck) {
      return res.status(404).json({ error: { message: 'Deck not found' } });
    }
    
    logger.info('Flashcards', `User ${userId} started reviewing deck: ${deckName}`);
    
    res.json({ 
      success: true,
      message: 'Flashcard session started'
    });
  } catch (error) {
    logger.error('Flashcards', 'Error starting flashcard session:', error);
    res.status(500).json({ 
      error: { message: 'Failed to start flashcard session' } 
    });
  }
});

// Complete flashcard study session (for bulk reviews)
router.post('/session/complete', async (req, res) => {
  try {
    const {
      deckId,
      cardsReviewed,
      correctAnswers,
      startTime,
      endTime,
      sessionData,
      completionId
    } = req.body;
    
    const supabase = getSupabase();
    const userId = req.userId;
    
    console.log('[Flashcards] Completing study session:', {
      deckId,
      cardsReviewed: cardsReviewed?.length || 0,
      correctAnswers
    });
    
    // Validate required fields
    const parsedStart = new Date(startTime || Date.now() - 5 * 60 * 1000);
    const parsedEnd = new Date(endTime || Date.now());
    if (
      !deckId ||
      (completionId !== undefined && (typeof completionId !== 'string' || completionId.length > 120)) ||
      !Array.isArray(cardsReviewed) ||
      cardsReviewed.length === 0 ||
      !Number.isInteger(correctAnswers) ||
      correctAnswers < 0 ||
      correctAnswers > cardsReviewed.length ||
      !Number.isFinite(parsedStart.getTime()) ||
      !Number.isFinite(parsedEnd.getTime()) ||
      parsedEnd < parsedStart
    ) {
      return res.status(400).json({ 
        error: { message: 'Invalid flashcard completion payload' }
      });
    }
    const uniqueCardIds = [...new Set(cardsReviewed)];
    if (uniqueCardIds.length !== cardsReviewed.length) {
      return res.status(400).json({ error: { message: 'Invalid flashcard completion payload' } });
    }
    const effectiveCompletionId = completionId || createHash('sha256')
      .update(`${userId}:${deckId}:${parsedStart.toISOString()}:${parsedEnd.toISOString()}:${[...uniqueCardIds].sort().join(',')}`)
      .digest('hex');
    
    // Get deck info
    const { data: deck, error: deckError } = await supabase
      .from('flashcard_decks')
      .select('name')
      .eq('id', deckId)
      .eq('user_id', userId)
      .single();
    
    if (deckError) {
      console.error('Error fetching deck:', deckError);
      return res.status(404).json({ error: { message: 'Deck not found' } });
    }
    
    // Calculate session duration
    const start = parsedStart;
    const end = parsedEnd;
    const durationMinutes = Math.round((end - start) / (1000 * 60));
    
    // Calculate score
    const totalCards = cardsReviewed.length;
    const score = totalCards > 0 ? Math.round((correctAnswers / totalCards) * 100) : 0;

    const { data: ownedCards, error: cardsError } = await supabase
      .from('flashcards')
      .select('id')
      .eq('deck_id', deckId)
      .in('id', uniqueCardIds);
    if (cardsError || ownedCards?.length !== uniqueCardIds.length) {
      return res.status(400).json({ error: { message: 'Reviewed cards do not belong to this deck' } });
    }

    const { data: completion, error: completionError } = await supabase.rpc('complete_flashcard_session', {
      p_user_id: userId,
      p_deck_id: deckId,
      p_card_ids: uniqueCardIds,
      p_correct_answers: correctAnswers,
      p_start_time: start.toISOString(),
      p_end_time: end.toISOString(),
      p_completion_id: effectiveCompletionId,
      p_session_data: sessionData || {},
    });
    if (completionError) {
      console.error('Error tracking flashcard session:', completionError);
      return res.status(503).json({ error: { message: 'Failed to record flashcard session', code: 'SESSION_TRACKING_FAILED' } });
    }
    const completionResult = Array.isArray(completion) ? completion[0] : completion;
    if (completionResult?.duplicate) return res.json({ success: true, duplicate: true });
    if (!completionResult?.session_id) {
      return res.status(503).json({ error: { message: 'Failed to record flashcard session', code: 'SESSION_TRACKING_FAILED' } });
    }
    try {
      await activityTrackingService.checkAndUnlockAchievements(supabase, userId, 'flashcard', score, totalCards);
    } catch (achievementError) {
      logger.error('Flashcards', 'Failed to refresh flashcard achievements:', achievementError);
    }
    await clearDashboardCache(userId).catch(error => logger.error('Flashcards', 'Failed to clear dashboard cache:', error));
    
    res.json({
      success: true,
      session: {
        deckId,
        totalCards,
        correctAnswers,
        score,
        duration: durationMinutes,
        averageTimePerCard: Math.round((durationMinutes * 60) / totalCards) // seconds
      }
    });
    
  } catch (error) {
    console.error('Flashcard session completion error:', error);
    res.status(500).json({ error: { message: 'Failed to complete study session' } });
  }
});

// Update a single flashcard
router.put('/cards/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    const { question, answer } = req.body;
    const supabase = getSupabase();
    const userId = req.userId;

    console.log(`[Flashcards] Updating card ${cardId}`);

    // Validate input
    if (!question || !answer) {
      return res.status(400).json({ error: { message: 'Question and answer are required' } });
    }

    // First verify the card belongs to the user
    const { data: card, error: fetchError } = await supabase
      .from('flashcards')
      .select('deck_id')
      .eq('id', cardId)
      .single();

    if (fetchError || !card) {
      return res.status(404).json({ error: { message: 'Card not found' } });
    }

    // Verify the deck belongs to the user
    const { data: deck, error: deckError } = await supabase
      .from('flashcard_decks')
      .select('id')
      .eq('id', card.deck_id)
      .eq('user_id', userId)
      .single();

    if (deckError || !deck) {
      return res.status(403).json({ error: { message: 'Unauthorized' } });
    }

    // Update the card
    const { data: updatedCard, error: updateError } = await supabase
      .from('flashcards')
      .update({
        question: question.trim(),
        answer: answer.trim(),
        // Reset spaced repetition when content changes significantly
        ease_factor: 2.5,
        interval: 1,
        repetitions: 0,
        next_due: new Date().toISOString()
      })
      .eq('id', cardId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating card:', updateError);
      return res.status(500).json({ error: { message: 'Failed to update card' } });
    }

    console.log(`[Flashcards] Successfully updated card ${cardId}`);
    res.json({
      success: true,
      card: updatedCard
    });

  } catch (error) {
    console.error('Update card error:', error);
    res.status(500).json({ error: { message: 'Failed to update card' } });
  }
});

// Delete a single flashcard
router.delete('/cards/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    const supabase = getSupabase();
    const userId = req.userId;

    console.log(`[Flashcards] Deleting card ${cardId}`);

    // First verify the card belongs to the user
    const { data: card, error: fetchError } = await supabase
      .from('flashcards')
      .select('deck_id')
      .eq('id', cardId)
      .single();

    if (fetchError || !card) {
      return res.status(404).json({ error: { message: 'Card not found' } });
    }

    // Verify the deck belongs to the user
    const { data: deck, error: deckError } = await supabase
      .from('flashcard_decks')
      .select('id')
      .eq('id', card.deck_id)
      .eq('user_id', userId)
      .single();

    if (deckError || !deck) {
      return res.status(403).json({ error: { message: 'Unauthorized' } });
    }

    // Delete the card
    const { error: deleteError } = await supabase
      .from('flashcards')
      .delete()
      .eq('id', cardId);

    if (deleteError) {
      console.error('Error deleting card:', deleteError);
      return res.status(500).json({ error: { message: 'Failed to delete card' } });
    }

    console.log(`[Flashcards] Successfully deleted card ${cardId}`);
    res.json({
      success: true,
      message: 'Card deleted successfully'
    });

  } catch (error) {
    console.error('Delete card error:', error);
    res.status(500).json({ error: { message: 'Failed to delete card' } });
  }
});

// Get deck with editing capabilities (includes all card details)
router.get('/decks/:deckId/edit', async (req, res) => {
  try {
    const { deckId } = req.params;
    const supabase = getSupabase();
    const userId = req.userId;

    // Get deck info
    const { data: deck, error: deckError } = await supabase
      .from('flashcard_decks')
      .select('id, name, file_name, created_at, category, tags, language')
      .eq('id', deckId)
      .eq('user_id', userId)
      .single();

    if (deckError || !deck) {
      return res.status(404).json({ error: { message: 'Deck not found' } });
    }

    // Get all cards with full details
    const { data: cards, error: cardsError } = await supabase
      .from('flashcards')
      .select('id, question, answer, citation, next_due, ease_factor, interval, repetitions, last_reviewed, created_at')
      .eq('deck_id', deckId)
      .order('created_at', { ascending: true });

    if (cardsError) {
      console.error('Error fetching cards for editing:', cardsError);
      return res.status(500).json({ error: { message: 'Failed to fetch flashcards' } });
    }

    console.log(`[Flashcards] Fetched ${cards?.length || 0} cards for editing deck ${deckId}`);

    res.json({
      deck: {
        id: deck.id,
        name: deck.name,
        fileName: deck.file_name,
        createdAt: deck.created_at,
        category: deck.category,
        tags: deck.tags,
        language: deck.language
      },
      cards: cards || [],
      totalCards: cards?.length || 0
    });

  } catch (error) {
    console.error('Get deck for editing error:', error);
    res.status(500).json({ error: { message: 'Failed to fetch deck for editing' } });
  }
});

export default router;
