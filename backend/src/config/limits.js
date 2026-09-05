/**
 * Centralized Application System Limits & Configuration
 */

// File & Page Upload Limits
export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024; // 50 MB in Bytes
export const MAX_IMAGE_SIZE_MB = 50;
export const MAX_PDF_PAGES = 3000;

// Processing Batch & Timeout Configurations (Optimized for cloud container constraints like Render)
export const OCR_PAGE_TIMEOUT_MS = parseInt(process.env.OCR_PAGE_TIMEOUT_MS || '30000', 10); // 30s per page timeout
export const MAX_TOTAL_OCR_TIMEOUT_MS = parseInt(process.env.MAX_TOTAL_OCR_TIMEOUT_MS || '60000', 10); // 60s total budget for synchronous OCR
export const MAX_OCR_PAGES = parseInt(process.env.MAX_OCR_PAGES || '4', 10); // Up to 4 primary scanned pages within 60s budget
export const OCR_BATCH_SIZE = parseInt(process.env.OCR_BATCH_SIZE || '5', 10);
export const EMBEDDING_BATCH_SIZE = parseInt(process.env.EMBEDDING_BATCH_SIZE || '16', 10);

