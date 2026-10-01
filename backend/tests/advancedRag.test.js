import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Document from '../src/models/Document.js';
import User from '../src/models/User.js';
import {
  CHUNK_PRESETS,
  splitTextByTokens,
  estimateTokenCount,
  chunkText,
} from '../src/services/textSplitter.service.js';
import {
  rewriteQuery,
  extractSearchTerms,
  calculateTextScore,
  hybridSearch,
} from '../src/services/advancedRetrieval.service.js';
import { rerankChunks, calculateProximityScore } from '../src/services/reranker.service.js';
import { generateEmbedding } from '../src/services/embedding.service.js';
import { generateToken } from '../src/services/auth.service.js';
import { createDocumentRecord } from '../src/services/document.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sampleFixture = path.join(__dirname, 'fixtures/sample_text.pdf');

let mongoServer;
let userAId;
let userBId;
let tokenA;
let tokenB;
let docAId;
let docBId;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test_secret_for_advanced_rag';
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

  const userA = await User.create({
    name: 'Advanced User A',
    email: 'adv_a@example.com',
    password: 'Password123',
  });
  userAId = userA._id.toString();

  const userB = await User.create({
    name: 'Advanced User B',
    email: 'adv_b@example.com',
    password: 'Password123',
  });
  userBId = userB._id.toString();

  tokenA = generateToken(userAId);
  tokenB = generateToken(userBId);

  // Create Document A for User A with embedded chunks
  const chunk0 = 'DocuMind V2 implements an advanced hybrid RAG architecture with configurable token chunking.';
  const chunk1 = 'Annual financial review: Q3 revenue exceeded projections by 38% reaching $4.8M.';
  const chunk2 = 'Multi-tenant isolation ensures data belonging to user A is strictly hidden from user B.';

  const embed0 = await generateEmbedding(chunk0);
  const embed1 = await generateEmbedding(chunk1);
  const embed2 = await generateEmbedding(chunk2);

  const docA = await Document.create({
    userId: userAId,
    filename: 'quarterly_report_a.pdf',
    fileType: 'pdf',
    extractedText: `${chunk0}\n\n${chunk1}\n\n${chunk2}`,
    extractionMethod: 'text',
    status: 'ready',
    chunks: [
      { index: 0, text: chunk0, embedding: embed0 },
      { index: 1, text: chunk1, embedding: embed1 },
      { index: 2, text: chunk2, embedding: embed2 },
    ],
  });
  docAId = docA._id.toString();

  // Create Document B for User B
  const docBChunk = 'Confidential project details belonging exclusively to User B.';
  const embedB = await generateEmbedding(docBChunk);
  const docB = await Document.create({
    userId: userBId,
    filename: 'user_b_private.pdf',
    fileType: 'pdf',
    extractedText: docBChunk,
    extractionMethod: 'text',
    status: 'ready',
    chunks: [
      { index: 0, text: docBChunk, embedding: embedB },
    ],
  });
  docBId = docB._id.toString();
});

describe('Phase 1: Advanced RAG Architecture Setup', () => {
  describe('1. Chunk Size Configuration & Experimentation (textSplitter.service.js)', () => {
    it('should define standard token presets (256, 512, 1024)', () => {
      expect(CHUNK_PRESETS[256]).toBeDefined();
      expect(CHUNK_PRESETS[512]).toBeDefined();
      expect(CHUNK_PRESETS[1024]).toBeDefined();

      expect(CHUNK_PRESETS[256].tokens).toBe(256);
      expect(CHUNK_PRESETS[512].tokens).toBe(512);
      expect(CHUNK_PRESETS[1024].tokens).toBe(1024);
    });

    it('should accurately estimate token counts with estimateTokenCount', () => {
      expect(estimateTokenCount('')).toBe(0);
      expect(estimateTokenCount('hello')).toBeGreaterThan(0);
      const text100Chars = 'a'.repeat(100);
      expect(estimateTokenCount(text100Chars)).toBe(25);
    });

    it('should split document into 256-token chunks with overlap', () => {
      const paragraph = 'Advanced RAG provides enhanced retrieval precision for enterprise search systems. ';
      const longText = paragraph.repeat(40); // ~3200 characters
      const chunks = splitTextByTokens(longText, { preset: 256 });

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].tokenEstimate).toBeLessThanOrEqual(300);
      expect(chunks[0]).toHaveProperty('offsetStart');
      expect(chunks[0]).toHaveProperty('offsetEnd');
      expect(chunks[0]).toHaveProperty('tokenEstimate');
    });

    it('should support 512 and 1024 token presets', () => {
      const paragraph = 'Deep neural networks enable high accuracy semantic search across large corpus collections. ';
      const longText = paragraph.repeat(80); // ~7200 characters

      const chunks512 = splitTextByTokens(longText, { preset: 512 });
      const chunks1024 = splitTextByTokens(longText, { preset: 1024 });

      expect(chunks512.length).toBeGreaterThan(1);
      expect(chunks1024.length).toBeGreaterThan(0);
      expect(chunks512.length).toBeGreaterThan(chunks1024.length);
    });

    it('should support custom chunkSizeTokens and overlapTokens', () => {
      const text = 'Custom chunking with explicit token size parameters. '.repeat(20);
      const chunks = splitTextByTokens(text, { chunkSizeTokens: 64, overlapTokens: 16 });

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].tokenEstimate).toBeLessThanOrEqual(100);
    });

    it('should maintain backward compatibility with chunkText default 800/150 chars', () => {
      const sample = 'DocuMind standard backward compatible chunking verification.';
      const res = chunkText(sample);
      expect(res.length).toBe(1);
      expect(res[0].offsetStart).toBe(0);
      expect(res[0].offsetEnd).toBe(sample.length);
    });
  });

  describe('2. Query Rewriting & Expansion (advancedRetrieval.service.js)', () => {
    it('should extract meaningful search terms excluding stop words', () => {
      const terms = extractSearchTerms('What is the Q3 revenue for this company?');
      expect(terms).toContain('revenue');
      expect(terms).not.toContain('what');
      expect(terms).not.toContain('the');
      expect(terms).not.toContain('for');
    });

    it('should resolve conversational pronouns using recent chat history', async () => {
      const history = [
        { role: 'user', content: 'Tell me about the annual financial report.' },
        { role: 'assistant', content: 'The annual report shows strong Q3 earnings and profits.' },
      ];

      const result = await rewriteQuery({
        query: 'What was its revenue?',
        conversationHistory: history,
      });

      expect(result).toHaveProperty('rewrittenQuery');
      expect(result).toHaveProperty('originalQuery', 'What was its revenue?');
      expect(result).toHaveProperty('expandedTerms');
      expect(result.rewrittenQuery.toLowerCase()).toMatch(/financial|report|annual|revenue/);
    });

    it('should handle empty or whitespace query gracefully', async () => {
      const res = await rewriteQuery({ query: '   ' });
      expect(res.rewrittenQuery).toBe('');
      expect(res.expandedTerms).toEqual([]);
    });
  });

  describe('3. Hybrid Retrieval & Multi-Tenant Isolation (advancedRetrieval.service.js)', () => {
    it('should calculate text scores with exact phrase match boost', () => {
      const chunk = 'The quarterly earnings report indicates Q3 revenue reached $4.8M.';
      const score = calculateTextScore(chunk, 'Q3 revenue', ['q3', 'revenue']);
      expect(score).toBeGreaterThan(0.5);
    });

    it('should enforce strict tenant isolation (require userId)', async () => {
      const resultsWithoutUser = await hybridSearch({
        userId: null,
        query: 'Q3 revenue',
      });
      expect(resultsWithoutUser).toEqual([]);
    });

    it('should prevent User B from retrieving User A document chunks in hybrid search', async () => {
      const results = await hybridSearch({
        userId: userBId, // Unauthorized User B
        documentId: docAId, // User A's document
        query: 'Q3 revenue',
      });
      expect(results).toEqual([]);
    });

    it('should perform hybrid search combining vector and text signals for authorized user', async () => {
      const results = await hybridSearch({
        userId: userAId,
        documentId: docAId,
        query: 'What is Q3 revenue?',
        topK: 3,
        vectorWeight: 0.7,
        textWeight: 0.3,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('hybridScore');
      expect(results[0]).toHaveProperty('vectorScore');
      expect(results[0]).toHaveProperty('textScore');
      expect(results[0].chunkIndex).toBe(1); // Chunk 1 is financial review
    });

    it('should support search across all user documents when documentId is omitted', async () => {
      const results = await hybridSearch({
        userId: userAId,
        query: 'hybrid RAG architecture',
        topK: 2,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].chunkIndex).toBe(0);
    });

    it('should filter chunks below minScore threshold', async () => {
      const results = await hybridSearch({
        userId: userAId,
        documentId: docAId,
        query: 'Q3 revenue',
        topK: 3,
        minScore: 0.40,
      });

      for (const item of results) {
        expect(item.hybridScore).toBeGreaterThanOrEqual(0.40);
      }
    });
  });

  describe('4. Post-Retrieval Reranking Layer (reranker.service.js)', () => {
    it('should calculate proximity bonus when query terms cluster together', () => {
      const clustered = 'According to recent data, revenue grew dramatically this quarter.';
      const separated = 'Revenue was reported. Many paragraphs later, here is some unrelated text.';

      const scoreClustered = calculateProximityScore(clustered, ['revenue', 'quarter']);
      const scoreSeparated = calculateProximityScore(separated, ['revenue', 'quarter']);

      expect(scoreClustered).toBeGreaterThanOrEqual(scoreSeparated);
    });

    it('should rerank candidate chunks and prioritize exact matches and high coverage', async () => {
      const candidates = [
        {
          chunkIndex: 0,
          text: 'General notes on industry market trends and broad ecosystem dynamics.',
          hybridScore: 0.45,
        },
        {
          chunkIndex: 1,
          text: 'Detailed financial statement: Q3 revenue reached $4.8M with exceptional margins.',
          hybridScore: 0.50,
        },
      ];

      const reranked = await rerankChunks({
        query: 'What is the Q3 revenue reached?',
        chunks: candidates,
        topK: 2,
      });

      expect(reranked.length).toBe(2);
      expect(reranked[0].chunkIndex).toBe(1);
      expect(reranked[0]).toHaveProperty('rerankScore');
      expect(reranked[0]).toHaveProperty('originalRank');
      expect(reranked[0].rerankScore).toBeGreaterThan(reranked[1].rerankScore);
    });

    it('should handle empty or null candidate lists gracefully', async () => {
      const emptyRes = await rerankChunks({ query: 'test', chunks: [] });
      expect(emptyRes).toEqual([]);

      const nullRes = await rerankChunks({ query: 'test', chunks: null });
      expect(nullRes).toEqual([]);
    });

    it('should respect topK parameter', async () => {
      const candidates = [
        { chunkIndex: 0, text: 'Alpha text', hybridScore: 0.5 },
        { chunkIndex: 1, text: 'Beta text', hybridScore: 0.6 },
        { chunkIndex: 2, text: 'Gamma text', hybridScore: 0.7 },
      ];

      const reranked = await rerankChunks({
        query: 'Alpha Beta Gamma',
        chunks: candidates,
        topK: 1,
      });

      expect(reranked.length).toBe(1);
    });
  });

  describe('5. Document Ingestion Chunk Presets (POST /api/documents/upload)', () => {
    const createPdf = (text) => {
      return new Promise((resolve, reject) => {
        const pdf = new PDFDocument();
        const buffers = [];
        pdf.on('data', (c) => buffers.push(c));
        pdf.on('end', () => resolve(Buffer.concat(buffers)));
        pdf.on('error', reject);
        pdf.text(text);
        pdf.end();
      });
    };

    it('should ingest document with 256-token chunk preset via upload API', async () => {
      const pdfBuffer = await createPdf('Advanced RAG token chunking specification. '.repeat(40));
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenA}`)
        .field('chunkPreset', 256)
        .attach('file', pdfBuffer, 'doc_256.pdf');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.document.status).toBe('ready');

      const savedDoc = await Document.findById(res.body.document.id);
      expect(savedDoc.chunks.length).toBeGreaterThan(0);
      expect(savedDoc.chunks[0]).toHaveProperty('offsetStart');
    });

    it('should ingest document with 512-token chunk preset via upload API', async () => {
      const pdfBuffer = await createPdf('Advanced RAG 512 token chunking specification. '.repeat(40));
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenA}`)
        .field('chunkPreset', 512)
        .attach('file', pdfBuffer, 'doc_512.pdf');

      expect(res.status).toBe(201);
      expect(res.body.document.status).toBe('ready');

      const savedDoc = await Document.findById(res.body.document.id);
      expect(savedDoc.chunks.length).toBeGreaterThan(0);
    });

    it('should ingest document with 1024-token chunk preset via upload API', async () => {
      const pdfBuffer = await createPdf('Advanced RAG 1024 token chunking specification. '.repeat(80));
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenA}`)
        .field('chunkPreset', 1024)
        .attach('file', pdfBuffer, 'doc_1024.pdf');

      expect(res.status).toBe(201);
      expect(res.body.document.status).toBe('ready');

      const savedDoc = await Document.findById(res.body.document.id);
      expect(savedDoc.chunks.length).toBeGreaterThan(0);
    });

    it('should safely fall back to default 512 preset on invalid chunkPreset', async () => {
      const pdfBuffer = await createPdf('Advanced RAG invalid chunk preset test text. '.repeat(30));
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenA}`)
        .field('chunkPreset', 'invalid_999')
        .attach('file', pdfBuffer, 'doc_invalid.pdf');

      expect(res.status).toBe(201);
      expect(res.body.document.status).toBe('ready');

      const savedDoc = await Document.findById(res.body.document.id);
      expect(savedDoc.chunks.length).toBeGreaterThan(0);
    });

    it('should default to 512 token preset when no chunkPreset option is specified', async () => {
      const pdfBuffer = await createPdf('Advanced RAG default chunk preset test text. '.repeat(30));
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('file', pdfBuffer, 'doc_default.pdf');

      expect(res.status).toBe(201);
      expect(res.body.document.status).toBe('ready');

      const savedDoc = await Document.findById(res.body.document.id);
      expect(savedDoc.chunks.length).toBeGreaterThan(0);
    });
  });

  describe('6. Production Chat Pipeline Advanced RAG Integration (POST /api/documents/:id/messages)', () => {
    it('should route user message through query rewriting, hybrid retrieval, and reranking', async () => {
      const res = await request(app)
        .post(`/api/documents/${docAId}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'What is Q3 revenue reached?' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.assistantMessage).toBeDefined();
      expect(res.body.assistantMessage.content).toBeDefined();
      expect(Array.isArray(res.body.assistantMessage.sources)).toBe(true);
      expect(res.body.assistantMessage.sources.length).toBeGreaterThan(0);
      expect(res.body.assistantMessage.sources[0]).toHaveProperty('chunkIndex');
      expect(res.body.assistantMessage.sources[0]).toHaveProperty('similarity');
    });

    it('should resolve conversational pronouns through query rewriter in chat history', async () => {
      // First turn
      await request(app)
        .post(`/api/documents/${docAId}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'Tell me about the annual financial review' });

      // Follow-up with pronoun 'it'
      const followUp = await request(app)
        .post(`/api/documents/${docAId}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'What was its revenue?' });

      expect(followUp.status).toBe(201);
      expect(followUp.body.success).toBe(true);
      expect(followUp.body.assistantMessage.sources.length).toBeGreaterThan(0);
      expect(followUp.body.assistantMessage.sources[0].chunkIndex).toBe(1);
    });

    it('should enforce strict ownership isolation and prevent unauthorized access to another user document', async () => {
      const res = await request(app)
        .post(`/api/documents/${docAId}/messages`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ content: 'What is Q3 revenue?' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
