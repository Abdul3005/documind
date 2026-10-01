import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Document from '../src/models/Document.js';
import { generateEmbedding, generateBatchEmbeddings, generateMockVector } from '../src/services/embedding.service.js';
import { migrateEmbeddings, parseArgs, MIGRATION_MARKER } from '../scripts/migrateEmbeddings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  await Document.deleteMany({});
});

describe('AI Provider Deprecation & Migration Safeguard Suite', () => {
  describe('1. Embedding Service (gemini-embedding-001 Contract)', () => {
    it('should generate 768-dimensional vector embeddings', async () => {
      const vec = await generateEmbedding('DocuMind AI assistance and retrieval');
      expect(Array.isArray(vec)).toBe(true);
      expect(vec.length).toBe(768);
      expect(typeof vec[0]).toBe('number');
    });

    it('should strictly produce unit-normalized vectors (||v|| = 1.0)', async () => {
      const vec = await generateEmbedding('Normalization check for vector similarity');
      const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
      expect(norm).toBeCloseTo(1.0, 4);
    });

    it('should handle batch embeddings maintaining 768 dimensions and normalization across all items', async () => {
      const texts = [
        'Quarterly earnings revenue $4.2M',
        'Compliance clause 14.2 confidentiality',
        'Machine learning vector embeddings',
      ];
      const batch = await generateBatchEmbeddings(texts, 2);
      expect(batch.length).toBe(3);
      for (const vec of batch) {
        expect(vec.length).toBe(768);
        const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
        expect(norm).toBeCloseTo(1.0, 4);
      }
    });

    it('should enforce production failure behavior and reject instead of generating silent mock embeddings', async () => {
      const origEnv = process.env.NODE_ENV;
      const origKey = process.env.LLM_API_KEY;

      process.env.NODE_ENV = 'production';
      process.env.LLM_API_KEY = 'invalid_real_api_key_123';

      await expect(generateEmbedding('Must fail in production on bad key')).rejects.toThrow();

      process.env.NODE_ENV = origEnv;
      process.env.LLM_API_KEY = origKey;
    });

    it('should not contain decommissioned text-embedding-004 in embedding.service.js', () => {
      const embeddingServicePath = path.resolve(__dirname, '../src/services/embedding.service.js');
      const code = fs.readFileSync(embeddingServicePath, 'utf-8');
      expect(code).not.toContain('text-embedding-004:embedContent');
      expect(code).toContain('gemini-embedding-001');
      expect(code).toContain('outputDimensionality: VECTOR_DIMENSION');
    });
  });

  describe('2. Groq Active Models Verification (No Decommissioned Models in Production)', () => {
    it('should not contain decommissioned Groq models in candidateModels in ai.service.js', () => {
      const aiServicePath = path.resolve(__dirname, '../src/services/ai.service.js');
      const code = fs.readFileSync(aiServicePath, 'utf-8');

      // Verify all decommissioned models are completely absent from candidates
      expect(code).not.toContain("'llama3-70b-8192'");
      expect(code).not.toContain("'llama3-8b-8192'");
      expect(code).not.toContain("'gemma2-9b-it'");
      expect(code).not.toContain("'llama-3.1-8b-instant'");
      expect(code).not.toContain("'llama-3.3-70b-versatile'");
      expect(code).not.toContain("'mixtral-8x7b-32768'");

      // Verify verified active production models on Groq are present
      expect(code).toContain("'openai/gpt-oss-120b'");
      expect(code).toContain("'openai/gpt-oss-20b'");
    });
  });

  describe('3. Embedding Migration Script Safeguards & Functionality', () => {
    it('should parse CLI arguments correctly', () => {
      const parsed = parseArgs(['--dry-run', '--limit', '10', '--batchSize', '2', '--resume']);
      expect(parsed.dryRun).toBe(true);
      expect(parsed.confirm).toBe(false);
      expect(parsed.limit).toBe(10);
      expect(parsed.batchSize).toBe(2);
      expect(parsed.resume).toBe(true);
    });

    it('should strictly throw a SAFETY VIOLATION error if run without --confirm or --dry-run', async () => {
      await expect(
        migrateEmbeddings({ dryRun: false, confirm: false })
      ).rejects.toThrow(/SAFETY VIOLATION/i);
    });

    it('should execute in dry-run mode without modifying stored document embeddings', async () => {
      const fakeOldEmbedding = new Array(768).fill(0.123);
      const testDoc = await Document.create({
        userId: new mongoose.Types.ObjectId(),
        filename: 'dry_run_doc.pdf',
        fileType: 'pdf',
        extractedText: 'Important financial report context.',
        status: 'ready',
        chunks: [
          { index: 0, text: 'Important financial report context.', embedding: fakeOldEmbedding },
        ],
        embeddingModel: null,
        migrationMarker: null,
      });

      const result = await migrateEmbeddings({ dryRun: true });
      expect(result.dryRun).toBe(true);
      expect(result.migratedDocs).toBe(1);

      // Verify DB was NOT modified in dry-run
      const freshDoc = await Document.findById(testDoc._id);
      expect(freshDoc.migrationMarker).toBeNull();
      expect(freshDoc.chunks[0].embedding[0]).toBe(0.123);
    });

    it('should NEVER falsely skip existing old documents that lack migrationMarker during --resume', async () => {
      // Create a legacy document representing pre-existing MongoDB records (no migrationMarker, no embeddingModel)
      const fakeOldEmbedding = new Array(768).fill(0.999);
      const legacyDoc = await Document.create({
        userId: new mongoose.Types.ObjectId(),
        filename: 'legacy_pre_migration_doc.pdf',
        fileType: 'pdf',
        extractedText: 'Legacy document embedded with previous model.',
        status: 'ready',
        chunks: [
          { index: 0, text: 'Legacy document embedded with previous model.', embedding: fakeOldEmbedding },
        ],
        // Simulates old documents without new metadata
        embeddingModel: null,
        migrationMarker: null,
      });

      // Resume mode MUST find and include this document for migration
      const result = await migrateEmbeddings({ dryRun: true, resume: true });
      expect(result.totalDocs).toBe(1);
      expect(result.migratedDocs).toBe(1);
    });

    it('should atomically update document chunks and write verified migrationMarker when confirm is true', async () => {
      const fakeOldEmbedding = new Array(768).fill(0.001);
      const testDoc = await Document.create({
        userId: new mongoose.Types.ObjectId(),
        filename: 'live_test_doc.pdf',
        fileType: 'pdf',
        extractedText: 'First section text. Second section text.',
        status: 'ready',
        chunks: [
          { index: 0, text: 'First section text.', offsetStart: 0, offsetEnd: 19, embedding: fakeOldEmbedding },
          { index: 1, text: 'Second section text.', offsetStart: 20, offsetEnd: 40, embedding: fakeOldEmbedding },
        ],
        embeddingModel: null,
        migrationMarker: null,
      });

      const result = await migrateEmbeddings({ confirm: true, limit: 1 });
      expect(result.migratedDocs).toBe(1);
      expect(result.failedDocs).toBe(0);

      const updated = await Document.findById(testDoc._id);
      expect(updated.embeddingModel).toBe('gemini-embedding-001');
      expect(updated.migrationMarker).toBe(MIGRATION_MARKER);
      expect(updated.migratedAt).toBeInstanceOf(Date);
      expect(updated.chunks.length).toBe(2);
      expect(updated.chunks[0].offsetStart).toBe(0);
      expect(updated.chunks[0].offsetEnd).toBe(19);
      expect(updated.chunks[0].embedding.length).toBe(768);
      // New embedding should be different from 0.001
      expect(updated.chunks[0].embedding[0]).not.toBe(0.001);
    });

    it('should respect resume flag and safely skip documents that possess verified migrationMarker', async () => {
      await Document.create({
        userId: new mongoose.Types.ObjectId(),
        filename: 'already_migrated.pdf',
        fileType: 'pdf',
        extractedText: 'Already migrated text content.',
        status: 'ready',
        chunks: [{ index: 0, text: 'Already migrated text content.', embedding: new Array(768).fill(0.5) }],
        embeddingModel: 'gemini-embedding-001',
        migrationMarker: MIGRATION_MARKER,
      });

      const result = await migrateEmbeddings({ dryRun: true, resume: true });
      expect(result.totalDocs).toBe(0);
      expect(result.migratedDocs).toBe(0);
    });
  });
});
