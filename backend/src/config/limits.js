/**
 * Centralized Application System Limits & Configuration
 */

// File & Page Upload Limits
export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024; // 50 MB in Bytes
export const MAX_IMAGE_SIZE_MB = 50;
export const MAX_PDF_PAGES = 3000;

// Processing Batch & Timeout Configurations
export const OCR_PAGE_TIMEOUT_MS = parseInt(process.env.OCR_PAGE_TIMEOUT_MS || '30000', 10); // 30s per page
export const OCR_BATCH_SIZE = parseInt(process.env.OCR_BATCH_SIZE || '5', 10); // 5 pages per OCR batch
export const EMBEDDING_BATCH_SIZE = parseInt(process.env.EMBEDDING_BATCH_SIZE || '16', 10); // 16 chunks per embedding batch
