import fs from 'fs';
import zlib from 'zlib';
import pdfParse from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { MAX_PDF_PAGES, OCR_PAGE_TIMEOUT_MS, OCR_BATCH_SIZE } from '../config/limits.js';

/**
 * Validates whether a buffer contains standard JPEG or PNG magic bytes.
 */
export const isValidImageBuffer = (buf) => {
  if (!buf || !Buffer.isBuffer(buf) || buf.length < 4) return false;
  // JPEG magic bytes: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true;
  // PNG magic bytes: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true;
  return false;
};

/**
 * Helper to check PDF page count before initiating heavy extraction.
 */
export const getPdfPageCount = async (pdfBuffer) => {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    return pdfDoc.getPageCount();
  } catch (err) {
    const error = new Error(`Corrupted PDF file structure: ${err.message}`);
    error.statusCode = 400;
    throw error;
  }
};

/**
 * Helper to extract raw image buffers embedded inside PDF pages (for scanned PDFs).
 * Flate/zlib streams are decompressed and verified against valid image magic bytes.
 */
export const extractImagesFromPdf = async (pdfBuffer) => {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const images = [];
    let accumulatedBytes = 0;
    const MAX_ACCUMULATED_IMAGE_BYTES = 40 * 1024 * 1024; // 40 MB cap for total decompressed image buffers in RAM

    const indirectObjects = pdfDoc.context.enumerateIndirectObjects();
    for (const [ref, obj] of indirectObjects) {
      if (obj instanceof PDFRawStream) {
        const dict = obj.dict;
        const subtype = dict.get(PDFName.of('Subtype'));
        if (subtype === PDFName.of('Image')) {
          const rawBytes = Buffer.from(obj.getContents());
          let imageBuffer = rawBytes;

          // Attempt zlib inflation if stream is Flate compressed or starts with zlib header
          const filterStr = dict.get(PDFName.of('Filter'))?.toString() || '';
          if (rawBytes.length > 2 && (rawBytes[0] === 0x78 || filterStr.includes('FlateDecode'))) {
            try {
              imageBuffer = zlib.inflateSync(rawBytes);
            } catch (inflateErr) {
              try {
                imageBuffer = zlib.unzipSync(rawBytes);
              } catch (unzipErr) {
                imageBuffer = rawBytes;
              }
            }
          }

          if (isValidImageBuffer(imageBuffer)) {
            images.push(imageBuffer);
            accumulatedBytes += imageBuffer.length;
            if (accumulatedBytes >= MAX_ACCUMULATED_IMAGE_BYTES || images.length >= 10) {
              console.warn('[OCR Service Memory Safety] Reached maximum image buffer cap for OCR fallback.');
              break;
            }
          } else {
            console.warn('[OCR Service Warning] Skipping non-JPEG/PNG embedded PDF image stream.');
          }
        }
      }
    }
    return images;
  } catch (err) {
    console.warn('[OCR Service Warning] Could not parse embedded PDF images:', err.message);
    return [];
  }
};

/**
 * Wraps Tesseract worker recognize call with an explicit page-level timeout
 */
const recognizeWithTimeout = (worker, imageBuffer, timeoutMs = OCR_PAGE_TIMEOUT_MS) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`OCR operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    worker
      .recognize(imageBuffer)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

export const ocrService = {
  isValidImageBuffer,
  getPdfPageCount,
  extractImagesFromPdf,
  extractText: null, // assigned below
};

/**
 * Service to extract raw text from PDF files or images via 2-stage text layer extraction with OCR fallback.
 */
export const extractText = async (filePath, fileType) => {
  try {
    if (!fs.existsSync(filePath)) {
      const err = new Error(`File not found for extraction at path: ${filePath}`);
      err.statusCode = 404;
      throw err;
    }

    if (fileType === 'pdf') {
      const dataBuffer = fs.readFileSync(filePath);

      // Check PDF header magic bytes (%PDF-)
      const header = dataBuffer.toString('utf8', 0, 5);
      if (!header.startsWith('%PDF-')) {
        const err = new Error('Invalid PDF format or corrupted file header.');
        err.statusCode = 400;
        throw err;
      }

      // Check PDF Page Count before starting heavy extraction
      let pageCount = 0;
      try {
        const fetchPageCountFn = ocrService.getPdfPageCount || getPdfPageCount;
        pageCount = await fetchPageCountFn(dataBuffer);
      } catch (pageErr) {
        if (pageErr.message && pageErr.message.includes('maximum allowed limit')) {
          throw pageErr;
        }
        const err = new Error(`Invalid or corrupted PDF file: ${pageErr.message}`);
        err.statusCode = 400;
        throw err;
      }

      if (pageCount > MAX_PDF_PAGES) {
        const err = new Error(`PDF exceeds the maximum allowed limit of ${MAX_PDF_PAGES} pages.`);
        err.statusCode = 400;
        throw err;
      }

      // Stage 1: Fast direct text extraction via pdf-parse
      let textFromPdf = '';
      try {
        const pdfData = await pdfParse(new Uint8Array(dataBuffer));
        textFromPdf = pdfData.text ? pdfData.text.trim() : '';
      } catch (pdfErr) {
        console.warn(`[OCR Service] pdf-parse failed: ${pdfErr.message}. Falling back to OCR.`);
      }

      // If pdf-parse extracted 50 or more characters, accept as valid text layer
      if (textFromPdf.length >= 50) {
        return {
          extractedText: textFromPdf,
          extractionMethod: 'text',
        };
      }

      // Stage 2: OCR Fallback for scanned PDFs (< 50 chars or missing text layer)
      console.log(`[OCR Service] PDF text layer insufficient (${textFromPdf.length} chars). Initiating Tesseract OCR fallback...`);

      const images = await extractImagesFromPdf(dataBuffer);
      let ocrText = '';

      if (images.length > 0) {
        let worker;
        try {
          worker = await createWorker('eng');
          for (let i = 0; i < images.length; i++) {
            const imgBuffer = images[i];
            if (!isValidImageBuffer(imgBuffer)) {
              images[i] = null;
              continue;
            }

            try {
              const { data: { text } } = await recognizeWithTimeout(worker, imgBuffer, OCR_PAGE_TIMEOUT_MS);
              if (text && text.trim()) {
                ocrText += (ocrText ? '\n\n' : '') + text.trim();
              }
            } catch (imgOcrErr) {
              console.warn(`[OCR Service Warning] Failed to OCR page image ${i + 1}: ${imgOcrErr.message}`);
            } finally {
              images[i] = null; // Explicitly release memory reference
            }
          }
        } catch (workerErr) {
          console.error('[OCR Service Error] Tesseract worker initialization failed:', workerErr.message);
        } finally {
          if (worker) {
            try {
              await worker.terminate();
            } catch (termErr) {
              console.warn('[OCR Service Warning] Failed to terminate worker:', termErr.message);
            }
          }
          images.length = 0; // Clear array references
        }
      }

      // Return OCR extraction result with extractionMethod: 'ocr'
      const finalOcrResult = ocrText.trim() || textFromPdf || '[Scanned PDF] No readable text found via OCR.';

      return {
        extractedText: finalOcrResult,
        extractionMethod: 'ocr',
      };
    } else if (fileType === 'image') {
      let worker;
      let extractedText = '';
      try {
        worker = await createWorker('eng');
        const imgBuffer = fs.readFileSync(filePath);
        if (isValidImageBuffer(imgBuffer)) {
          const { data: { text } } = await recognizeWithTimeout(worker, imgBuffer, OCR_PAGE_TIMEOUT_MS);
          extractedText = text ? text.trim() : '';
        } else {
          console.warn('[OCR Service Warning] Image file signature validation failed.');
        }
      } catch (imgErr) {
        console.error('[OCR Service Error] Tesseract image OCR failed:', imgErr.message);
      } finally {
        if (worker) {
          try {
            await worker.terminate();
          } catch (termErr) {
            console.warn('[OCR Service Warning] Failed to terminate worker:', termErr.message);
          }
        }
      }

      if (!extractedText) {
        return {
          extractedText: '[Image OCR] No readable text recognized in image.',
          extractionMethod: 'ocr',
        };
      }

      return {
        extractedText,
        extractionMethod: 'ocr',
      };
    } else {
      const err = new Error(`Unsupported file type for extraction: ${fileType}`);
      err.statusCode = 400;
      throw err;
    }
  } catch (error) {
    console.error(`[OCR Service Error] Text extraction failed for ${filePath}:`, error.message);
    if (!error.statusCode) {
      error.statusCode = 400;
    }
    throw error;
  }
};

ocrService.extractText = extractText;
