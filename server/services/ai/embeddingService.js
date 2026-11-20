import OpenAI from 'openai';

// Initialize OpenAI client lazily to ensure env vars are loaded
let openai;
function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

// Cache embeddings to avoid re-computing identical text
const embeddingCache = new Map();
const CACHE_MAX_SIZE = 1000;

export async function generateEmbedding(text) {
  try {
    // Check cache first
    const cacheKey = text.substring(0, 1000); // Use first 1000 chars as key
    if (embeddingCache.has(cacheKey)) {
      console.log('[Embedding] Using cached embedding');
      return embeddingCache.get(cacheKey);
    }

    // Generate new embedding
    console.log('[Embedding] Generating embedding for text length:', text.length);
    
    const response = await getOpenAI().embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });

    const embedding = response.data[0].embedding;

    // Cache the result
    if (embeddingCache.size >= CACHE_MAX_SIZE) {
      // Remove oldest entry
      const firstKey = embeddingCache.keys().next().value;
      embeddingCache.delete(firstKey);
    }
    embeddingCache.set(cacheKey, embedding);

    return embedding;

  } catch (error) {
    console.error('[Embedding] Error generating embedding:', error);
    
    // Return a mock embedding for development/testing
    if (process.env.NODE_ENV === 'development') {
      console.log('[Embedding] Returning mock embedding for development');
      return Array(1536).fill(0).map(() => Math.random() - 0.5);
    }
    
    throw error;
  }
}

// Generate embeddings for multiple texts in batch
export async function generateEmbeddings(texts) {
  try {
    console.log('[Embedding] Generating embeddings for', texts.length, 'texts');
    
    // OpenAI supports batch embedding
    const response = await getOpenAI().embeddings.create({
      model: "text-embedding-ada-002",
      input: texts,
    });

    return response.data.map(item => item.embedding);

  } catch (error) {
    console.error('[Embedding] Error generating batch embeddings:', error);
    
    // Fall back to individual embeddings
    console.log('[Embedding] Falling back to individual embeddings');
    return Promise.all(texts.map(text => generateEmbedding(text)));
  }
}

// Calculate cosine similarity between two embeddings
export function cosineSimilarity(embedding1, embedding2) {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same length');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// Find most relevant chunks based on query embedding
export async function findRelevantChunks(queryEmbedding, chunks, topK = 5) {
  const scoredChunks = chunks.map(chunk => ({
    ...chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  // Sort by score descending and return top K
  return scoredChunks
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}