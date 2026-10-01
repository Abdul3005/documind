import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Document from '../src/models/Document.js';
import { generateBatchEmbeddings } from '../src/services/embedding.service.js';

// Load environment variables if running as standalone script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TARGET_MODEL = 'gemini-embedding-001';
export const MIGRATION_MARKER = 'gemini-embedding-001-v1';
const EXPECTED_DIMENSION = 768;

/**
 * Parses CLI arguments into an options object.
 */
export const parseArgs = (argv = process.argv.slice(2)) => {
  const options = {
    dryRun: false,
    confirm: false,
    limit: null,
    resume: false,
    docId: null,
    batchSize: 5,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--confirm') options.confirm = true;
    if (arg === '--resume') options.resume = true;
    if (arg === '--limit' && argv[i + 1]) {
      options.limit = parseInt(argv[i + 1], 10);
      i++;
    }
    if (arg === '--docId' && argv[i + 1]) {
      options.docId = argv[i + 1];
      i++;
    }
    if (arg === '--batchSize' && argv[i + 1]) {
      options.batchSize = parseInt(argv[i + 1], 10);
      i++;
    }
  }

  // Check environment variables as well
  if (process.env.DRY_RUN === 'true') options.dryRun = true;
  if (process.env.CONFIRM_MIGRATE === 'true') options.confirm = true;
  if (process.env.RESUME === 'true') options.resume = true;
  if (process.env.LIMIT) options.limit = parseInt(process.env.LIMIT, 10);

  return options;
};

/**
 * Core migration engine.
 * Can be executed programmatically or via CLI.
 */
export const migrateEmbeddings = async (opts = {}) => {
  const {
    dryRun = false,
    confirm = false,
    limit = null,
    resume = false,
    docId = null,
    batchSize = 5,
  } = opts;

  console.log('====================================================');
  console.log('DocuMind V2 - Embedding Vector Migration Utility');
  console.log('Target Model:     ', TARGET_MODEL);
  console.log('Migration Marker: ', MIGRATION_MARKER);
  console.log('Expected Dim:     ', EXPECTED_DIMENSION);
  console.log('Mode:             ', dryRun ? 'DRY-RUN (Simulated, no writes)' : 'LIVE MIGRATION');
  console.log('Resume Mode:      ', resume ? 'ENABLED (Skip already verified migrated)' : 'DISABLED');
  if (limit) console.log('Document Limit:   ', limit);
  if (docId) console.log('Single Doc ID:    ', docId);
  console.log('====================================================');

  // SAFEGUARD: Refuse execution if not confirmed and not dry-run
  if (!dryRun && !confirm) {
    const errorMsg =
      '[SAFETY VIOLATION] Migration blocked! You must pass --confirm or set CONFIRM_MIGRATE=true to modify database records. Run with --dry-run to simulate without modifying data.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Build query: only documents with chunks
  const query = { 'chunks.0': { $exists: true } };
  if (docId) {
    query._id = docId;
  }
  if (resume) {
    // CRITICAL SAFETY RULE: Only skip documents with explicit, verified migrationMarker
    // Never rely on schema defaults. If migrationMarker is null/missing/different, it MUST be migrated.
    query.migrationMarker = { $ne: MIGRATION_MARKER };
  }

  let docQuery = Document.find(query);
  if (limit && limit > 0) {
    docQuery = docQuery.limit(limit);
  }

  const documents = await docQuery;
  const totalDocs = documents.length;
  console.log(`[Migration] Found ${totalDocs} document(s) requiring migration.`);

  if (totalDocs === 0) {
    console.log('[Migration] No documents require migration. Exiting.');
    return { totalDocs: 0, migratedDocs: 0, failedDocs: 0, dryRun };
  }

  let migratedDocs = 0;
  let failedDocs = 0;
  const errors = [];

  for (let d = 0; d < totalDocs; d++) {
    const doc = documents[d];
    const chunkCount = doc.chunks?.length || 0;
    console.log(
      `\n[Doc ${d + 1}/${totalDocs}] Processing doc ${doc._id} (${doc.filename}) with ${chunkCount} chunks...`
    );

    if (chunkCount === 0) {
      console.log(`[Doc ${d + 1}/${totalDocs}] No chunks found, skipping.`);
      continue;
    }

    try {
      const chunkTexts = doc.chunks.map((c) => c.text);

      if (dryRun) {
        // In dry run, validate chunks without writing to DB
        console.log(`[DRY-RUN] Simulating embedding generation for ${chunkTexts.length} chunks...`);
        console.log(`[DRY-RUN] Preserving chunk fields: index, text, offsetStart, offsetEnd`);
        console.log(`[DRY-RUN] Would update Document ${doc._id} embeddingModel to ${TARGET_MODEL} and migrationMarker to ${MIGRATION_MARKER}`);
        migratedDocs++;
        continue;
      }

      // Generate new embeddings in batches
      console.log(`[Doc ${d + 1}/${totalDocs}] Generating new ${TARGET_MODEL} embeddings in batches of ${batchSize}...`);
      const newEmbeddings = await generateBatchEmbeddings(chunkTexts, batchSize);

      // Validate all returned embeddings BEFORE modifying anything
      if (!Array.isArray(newEmbeddings) || newEmbeddings.length !== chunkCount) {
        throw new Error(
          `Embedding count mismatch: expected ${chunkCount}, received ${newEmbeddings?.length || 0}`
        );
      }

      for (let i = 0; i < newEmbeddings.length; i++) {
        const vec = newEmbeddings[i];
        if (!Array.isArray(vec) || vec.length !== EXPECTED_DIMENSION) {
          throw new Error(
            `Chunk ${i} embedding dimension mismatch: expected ${EXPECTED_DIMENSION}, got ${vec?.length || 0}`
          );
        }
      }

      // Construct updated chunks preserving all existing fields except embedding
      const updatedChunks = doc.chunks.map((oldChunk, idx) => ({
        index: oldChunk.index,
        text: oldChunk.text,
        offsetStart: oldChunk.offsetStart ?? 0,
        offsetEnd: oldChunk.offsetEnd ?? oldChunk.text.length,
        embedding: newEmbeddings[idx],
      }));

      // Atomic update for document: only writes marker AFTER all chunks are validated
      await Document.updateOne(
        { _id: doc._id },
        {
          $set: {
            chunks: updatedChunks,
            embeddingModel: TARGET_MODEL,
            migrationMarker: MIGRATION_MARKER,
            migratedAt: new Date(),
          },
        }
      );

      migratedDocs++;
      console.log(`[Doc ${d + 1}/${totalDocs}] Successfully updated document ${doc._id} with ${TARGET_MODEL} embeddings.`);
    } catch (docErr) {
      failedDocs++;
      console.error(`[Doc ${d + 1}/${totalDocs}] Failed to migrate document ${doc._id}:`, docErr.message);
      errors.push({ docId: doc._id, error: docErr.message });
      // Document is left untouched on failure - never partially overwritten
    }
  }

  console.log('\n====================================================');
  console.log('Migration Run Complete');
  console.log(`Total Found:     ${totalDocs}`);
  console.log(`Successfully Migrated: ${migratedDocs}`);
  console.log(`Failed:          ${failedDocs}`);
  if (dryRun) console.log('Note: Run was DRY-RUN. No database writes performed.');
  console.log('====================================================');

  return { totalDocs, migratedDocs, failedDocs, errors, dryRun };
};

/**
 * Standalone CLI runner
 */
const run = async () => {
  const options = parseArgs();

  const mongoUri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    'mongodb://localhost:27017/documind';

  console.log('[Migration] Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('[Migration] Connected to MongoDB successfully.');

  try {
    await migrateEmbeddings(options);
  } catch (err) {
    console.error('[Migration Fatal Error]', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('[Migration] Database connection closed.');
  }
};

// Execute if run directly from command line
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
