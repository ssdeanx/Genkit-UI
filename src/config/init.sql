-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a sample table with a 3072-dimensional vector column for Gemini
CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT,
  embedding VECTOR(1536)
);
