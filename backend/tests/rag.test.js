import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Document from '../src/models/Document.js';
import Message from '../src/models/Message.js';
import { chunkText } from '../src/services/chunking.service.js';
import { generateEmbedding, generateBatchEmbeddings } from '../src/services/embedding.service.js';
import { cosineSimilarity, retrieveRelevantChunks } from '../src/services/retrieval.service.js';
import { buildPrompt } from '../src/services/ai.service.js';
import { generateToken } from '../src/services/auth.service.js';

let mongoServer;
let tokenA;
let userAId;
let tokenB;
let userBId;
let docAId;

beforeAll(async () => {
  // Enforce secret and mock mode for deterministic offline testing
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing';
  process.env.LLM_API_KEY = 'mock_key_for_dev';

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Document.deleteMany({});
  await Message.deleteMany({});

  // Register User A
  const resA = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'User A',
      email: 'usera_rag@example.com',
      password: 'Password123',
    });
  tokenA = resA.body.token;
  userAId = resA.body.user.id;

  // Register User B
  const resB = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'User B',
      email: 'userb_rag@example.com',
      password: 'Password123',
    });
  tokenB = resB.body.token;
  userBId = resB.body.user.id;

  // Create RAG Document for User A with embedded chunks
  const chunk0Text = 'DocuMind V2 implements Retrieval-Augmented Generation (RAG) architecture with Gemini text-embedding-004 vectors.';
  const chunk1Text = 'Financial summary for User A: Q3 revenue grew by 45% reaching $1.2 million with 85% gross profit margin.';
  const chunk2Text = 'User A security guidelines state that multi-tenant data isolation must prevent cross-user data exposure.';

  const embed0 = await generateEmbedding(chunk0Text);
  const embed1 = await generateEmbedding(chunk1Text);
  const embed2 = await generateEmbedding(chunk2Text);

  const docA = await Document.create({
    userId: userAId,
    filename: 'user_a_report.pdf',
    fileType: 'pdf',
    extractedText: `${chunk0Text}\n\n${chunk1Text}\n\n${chunk2Text}`,
    extractionMethod: 'text',
    status: 'ready',
    chunks: [
      { index: 0, text: chunk0Text, embedding: embed0 },
      { index: 1, text: chunk1Text, embedding: embed1 },
      { index: 2, text: chunk2Text, embedding: embed2 },
    ],
  });
  docAId = docA._id.toString();
});

describe('Phase 4: RAG Architecture & Vector Search Pipeline', () => {
  describe('1. Chunking Service (chunking.service.js)', () => {
    it('should return empty array for empty or whitespace text', () => {
      expect(chunkText('')).toEqual([]);
      expect(chunkText('   ')).toEqual([]);
      expect(chunkText(null)).toEqual([]);
    });

    it('should return a single chunk for short text under 800 characters', () => {
      const shortText = 'DocuMind is an AI-powered document assistant.';
      const chunks = chunkText(shortText, 800, 150);

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toEqual({ index: 0, text: shortText });
    });

    it('should split long text into multiple overlapping chunks', () => {
      const paragraph = 'DocuMind RAG pipeline splits text into chunks. ';
      const longText = paragraph.repeat(30); // ~1410 characters
      const chunks = chunkText(longText, 800, 150);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].index).toBe(0);
      expect(chunks[1].index).toBe(1);
      expect(chunks[0].text.length).toBeLessThanOrEqual(850);
    });
  });

  describe('2. Embedding Service (embedding.service.js)', () => {
    it('should generate a normalized float vector of 768 dimensions', async () => {
      const embedding = await generateEmbedding('DocuMind vector embeddings');

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);
      expect(typeof embedding[0]).toBe('number');
    });

    it('should generate batch embeddings for an array of text chunks', async () => {
      const embeddings = await generateBatchEmbeddings(['Chunk one text', 'Chunk two text']);

      expect(embeddings.length).toBe(2);
      expect(embeddings[0].length).toBe(768);
      expect(embeddings[1].length).toBe(768);
    });
  });

  describe('3. Vector Search & Cosine Similarity (retrieval.service.js)', () => {
    it('should calculate accurate cosine similarity scores', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];
      const vec3 = [0, 1, 0];

      expect(cosineSimilarity(vec1, vec2)).toBe(1.0);
      expect(cosineSimilarity(vec1, vec3)).toBe(0.0);
    });

    it('should rank relevant chunks higher than irrelevant chunks', async () => {
      const results = await retrieveRelevantChunks({
        documentId: docAId,
        userId: userAId,
        question: 'What is Q3 revenue for User A?',
        topK: 3,
      });

      expect(results.length).toBe(3);
      // Chunk 1 contains Q3 revenue -> should be ranked #1
      expect(results[0].chunkIndex).toBe(1);
      expect(results[0].similarity).toBeGreaterThan(results[2].similarity);
    });

    it('should respect Top-K limit', async () => {
      const results = await retrieveRelevantChunks({
        documentId: docAId,
        userId: userAId,
        question: 'security guidelines',
        topK: 2,
      });

      expect(results.length).toBe(2);
    });
  });

  describe('4. Ownership Isolation in RAG Retrieval', () => {
    it('should return empty retrieval results when User B attempts to search User A document chunks', async () => {
      const results = await retrieveRelevantChunks({
        documentId: docAId,
        userId: userBId, // Unauthorized User B
        question: 'What is Q3 revenue?',
        topK: 3,
      });

      expect(results).toEqual([]);
    });
  });

  describe('5. AI Prompt Grounding & Context Delimiters (ai.service.js)', () => {
    it('should construct prompt with <<<CONTEXT>>> bounded retrieved chunks', () => {
      const retrievedChunks = [
        { chunkIndex: 1, text: 'Q3 revenue reached $1.2M.' },
      ];
      const prompt = buildPrompt({
        retrievedChunks,
        question: 'How much was Q3 revenue?',
      });

      expect(prompt).toContain('<<<CONTEXT>>>');
      expect(prompt).toContain('[Chunk #1]:\nQ3 revenue reached $1.2M.');
      expect(prompt).toContain('<<<END CONTEXT>>>');
    });
  });

  describe('6. End-to-End RAG Chat API & Citations (POST /api/documents/:id/messages)', () => {
    it('should process user question via RAG vector search, return answer and source citations', async () => {
      const res = await request(app)
        .post(`/api/documents/${docAId}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'What is the Q3 revenue figure?' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.assistantMessage).toBeDefined();
      expect(res.body.assistantMessage.content).toBeDefined();
      
      // Verify citation metadata sources array is returned
      expect(Array.isArray(res.body.assistantMessage.sources)).toBe(true);
      expect(res.body.assistantMessage.sources.length).toBe(3);
      expect(res.body.assistantMessage.sources[0]).toHaveProperty('chunkIndex');
      expect(res.body.assistantMessage.sources[0]).toHaveProperty('similarity');
    }, 15000);
  });

  describe('7. Hardened Audit Fixes Verification', () => {
    it('should throw an explicit error when JWT_SECRET environment variable is missing', () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      expect(() => generateToken('sample_user_id')).toThrow(/JWT_SECRET environment variable is missing/i);

      process.env.JWT_SECRET = originalSecret;
    });

    it('should rethrow error when real API key is configured and API call fails', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalKey = process.env.LLM_API_KEY;

      process.env.NODE_ENV = 'production';
      process.env.LLM_API_KEY = 'invalid_real_api_key_123';

      await expect(generateEmbedding('Test text')).rejects.toThrow();

      process.env.NODE_ENV = originalNodeEnv;
      process.env.LLM_API_KEY = originalKey;
    }, 15000);
  });
});
