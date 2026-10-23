import { MongoMemoryServer } from '../backend/node_modules/mongodb-memory-server/index.js';
import mongoose from '../backend/node_modules/mongoose/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Force safe offline test environment before loading app
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'load_test_jwt_secret_32_characters_long_spec!';
process.env.LLM_API_KEY = 'mock_key_for_dev';
delete process.env.MONGO_URI;
delete process.env.MONGODB_URI;

import app from '../backend/src/app.js';
import User from '../backend/src/models/User.js';
import Document from '../backend/src/models/Document.js';
import { generateToken } from '../backend/src/services/auth.service.js';
import { generateMockVector } from '../backend/src/services/embedding.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.TEST_PORT || 5050;

async function bootstrap() {
  console.log('[Load Test Server] Starting ephemeral in-memory MongoDB...');
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  await mongoose.connect(uri);
  console.log('[Load Test Server] Connected to in-memory database:', uri);

  // Seed primary test user
  const user = await User.create({
    name: 'Load Test User',
    email: 'loaduser@example.com',
    password: 'Password123',
  });

  const token = generateToken(user._id);

  // Seed sample document with precomputed mock vector embeddings
  const sampleText = `DocuMind Enterprise Architecture Overview.
This document outlines scaling, performance benchmarks, and cost engineering for DocuMind V2.
The target workload is 100,000 documents, 10,000 registered users, and 1,000,000 queries per month.
Vector retrieval uses 768-dimensional normalized embeddings.
Multi-tenant isolation ensures User A cannot access User B documents.
System latency SLA: p95 < 2000ms for end-to-end RAG chat queries.`;

  const chunk0 = 'DocuMind Enterprise Architecture Overview. Target workload is 100,000 documents and 10,000 users.';
  const chunk1 = 'The monthly query volume is 1,000,000 queries. 768-dimensional normalized embeddings are used.';
  const chunk2 = 'Multi-tenant isolation ensures complete privacy. Latency SLA target is p95 under 2000ms.';

  const doc = await Document.create({
    userId: user._id,
    filename: 'architecture_scaling_plan.pdf',
    fileType: 'pdf',
    extractedText: sampleText,
    extractionMethod: 'text',
    status: 'ready',
    chunks: [
      { index: 0, text: chunk0, embedding: generateMockVector(chunk0) },
      { index: 1, text: chunk1, embedding: generateMockVector(chunk1) },
      { index: 2, text: chunk2, embedding: generateMockVector(chunk2) },
    ],
  });

  // Save credentials to local JSON for Locust
  const credentials = {
    baseUrl: `http://127.0.0.1:${PORT}`,
    token,
    userId: user._id.toString(),
    documentId: doc._id.toString(),
    email: user.email,
    password: 'Password123',
  };

  const credPath = path.join(__dirname, 'test-credentials.json');
  fs.writeFileSync(credPath, JSON.stringify(credentials, null, 2), 'utf8');
  console.log(`[Load Test Server] Credentials written to ${credPath}`);

  const server = app.listen(PORT, () => {
    console.log(`[Load Test Server] Ready and listening on http://localhost:${PORT}`);
    console.log(`[Load Test Server] Target document ID: ${doc._id}`);
  });

  const cleanup = async () => {
    console.log('\n[Load Test Server] Shutting down gracefully...');
    server.close();
    await mongoose.disconnect();
    await mongoServer.stop();
    console.log('[Load Test Server] Stopped successfully.');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

bootstrap().catch((err) => {
  console.error('[Load Test Server Error]', err);
  process.exit(1);
});
