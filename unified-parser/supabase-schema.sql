-- Supabase schema for unified parser service
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Parsed documents table
CREATE TABLE IF NOT EXISTS parsed_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  processing_id TEXT NOT NULL UNIQUE,
  title TEXT,
  author TEXT,
  pages INTEGER,
  word_count INTEGER,
  language TEXT,
  has_tables BOOLEAN DEFAULT false,
  has_images BOOLEAN DEFAULT false,
  created_date TEXT,
  modified_date TEXT,
  chunk_count INTEGER,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document chunks table
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES parsed_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_type TEXT NOT NULL,
  content TEXT NOT NULL,
  parent_id TEXT,
  level INTEGER,
  metadata JSONB,
  embedding vector(1536), -- For future semantic search
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_parsed_documents_user_id ON parsed_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_parsed_documents_processing_id ON parsed_documents(processing_id);
CREATE INDEX IF NOT EXISTS idx_parsed_documents_created_at ON parsed_documents(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_user_id ON document_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_chunk_type ON document_chunks(chunk_type);
CREATE INDEX IF NOT EXISTS idx_document_chunks_parent_id ON document_chunks(parent_id);

-- Full-text search index on content
CREATE INDEX IF NOT EXISTS idx_document_chunks_content_search ON document_chunks USING gin(to_tsvector('english', content));

-- Row Level Security (RLS)
ALTER TABLE parsed_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for parsed_documents
CREATE POLICY "Users can view their own documents" ON parsed_documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own documents" ON parsed_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents" ON parsed_documents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents" ON parsed_documents
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for document_chunks
CREATE POLICY "Users can view their own chunks" ON document_chunks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chunks" ON document_chunks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chunks" ON document_chunks
  FOR DELETE USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_parsed_documents_updated_at BEFORE UPDATE ON parsed_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Optional: Function to search chunks
CREATE OR REPLACE FUNCTION search_document_chunks(
  p_user_id UUID,
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_type TEXT,
  content TEXT,
  metadata JSONB,
  rank REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id,
    dc.document_id,
    dc.chunk_type,
    dc.content,
    dc.metadata,
    ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', p_query)) AS rank
  FROM document_chunks dc
  WHERE dc.user_id = p_user_id
    AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', p_query)
  ORDER BY rank DESC
  LIMIT p_limit;
END;
$$;