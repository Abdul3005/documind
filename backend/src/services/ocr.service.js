import fs from 'fs';
import zlib from 'zlib';
import pdfParse from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { MAX_PDF_PAGES, OCR_PAGE_TIMEOUT_MS, OCR_BATCH_SIZE, MAX_OCR_PAGES, MAX_TOTAL_OCR_TIMEOUT_MS } from '../config/limits.js';

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
            // Filter out watermark banners, icons, stamps, and small divider lines
            // Genuine document page scans are typically > 25KB (camera scans are usually 200KB - 800KB)
            if (imageBuffer.length >= 25000) {
              images.push(imageBuffer);
              accumulatedBytes += imageBuffer.length;
              if (accumulatedBytes >= MAX_ACCUMULATED_IMAGE_BYTES || images.length >= MAX_OCR_PAGES) {
                console.log(`[OCR Service Memory Safety] Reached maximum image buffer or page cap (${images.length} images).`);
                break;
              }
            } else {
              console.log(`[OCR Service Optimization] Skipped small non-page graphic/watermark stream (${imageBuffer.length} bytes).`);
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

/**
 * Attempt fast Cloud Vision OCR using Gemini 1.5 Flash (if API key available).
 * Takes ~1.5s per page, consumes 0MB container RAM, and handles handwriting & math.
 */
export const recognizeWithGeminiVision = async (imageBuffer) => {
  const key =
    process.env.GEMINI_API_KEY ||
    (process.env.LLM_API_KEY && !process.env.LLM_API_KEY.startsWith('gsk_') && process.env.LLM_API_KEY !== 'mock_key_for_dev'
      ? process.env.LLM_API_KEY
      : null);

  if (!key) return null;

  try {
    const base64Image = imageBuffer.toString('base64');
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    const url = `${endpoint}?key=${key}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'Transcribe all text from this scanned document page verbatim. Maintain headings, questions, and structure accurately. Output ONLY the transcribed document text, with zero conversational commentary.',
              },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64Image,
                },
              },
            ],
          },
        ],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const transcribed = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (transcribed && transcribed.length > 25) {
        console.log(`[OCR Service] Gemini Vision successfully transcribed ${transcribed.length} characters.`);
        return transcribed;
      }
    }
  } catch (err) {
    console.warn(`[OCR Service Warning] Gemini Vision OCR skipped: ${err.message}`);
  }
  return null;
};

export const ocrService = {
  isValidImageBuffer,
  getPdfPageCount,
  extractImagesFromPdf,
  recognizeWithGeminiVision,
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
        let worker = null;
        const ocrStartTime = Date.now();
        const hasGeminiKey =
          Boolean(process.env.GEMINI_API_KEY) ||
          Boolean(process.env.LLM_API_KEY && !process.env.LLM_API_KEY.startsWith('gsk_') && process.env.LLM_API_KEY !== 'mock_key_for_dev');

        try {
          if (!hasGeminiKey) {
            worker = await createWorker('eng');
          }

          for (let i = 0; i < images.length; i++) {
            const elapsed = Date.now() - ocrStartTime;
            if (elapsed >= MAX_TOTAL_OCR_TIMEOUT_MS) {
              console.warn(`[OCR Service Budget] Time budget (${MAX_TOTAL_OCR_TIMEOUT_MS}ms) reached after ${i} pages. Returning extracted text so far.`);
              break;
            }

            const imgBuffer = images[i];
            if (!isValidImageBuffer(imgBuffer)) {
              images[i] = null;
              continue;
            }

            // 1. Attempt high-speed Gemini Vision OCR first
            let pageText = null;
            if (hasGeminiKey) {
              const visionFn = ocrService.recognizeWithGeminiVision || recognizeWithGeminiVision;
              pageText = await visionFn(imgBuffer);
            }

            // 2. Fall back to Tesseract OCR if Vision was unavailable or returned no text
            if (!pageText) {
              if (!worker) {
                try {
                  worker = await createWorker('eng');
                } catch (wErr) {
                  console.error('[OCR Service Error] Tesseract worker creation failed:', wErr.message);
                  break;
                }
              }

              const remainingBudget = Math.max(4000, MAX_TOTAL_OCR_TIMEOUT_MS - (Date.now() - ocrStartTime));
              const pageTimeout = Math.min(OCR_PAGE_TIMEOUT_MS, remainingBudget);

              try {
                const { data: { text } } = await recognizeWithTimeout(worker, imgBuffer, pageTimeout);
                pageText = text ? text.trim() : null;
              } catch (imgOcrErr) {
                console.warn(`[OCR Service Warning] Failed to OCR page image ${i + 1}: ${imgOcrErr.message}`);
                try { await worker.terminate(); } catch (tErr) {}
                worker = null;
              }
            }

            if (pageText && pageText.trim()) {
              ocrText += (ocrText ? '\n\n' : '') + `[Page ${i + 1}]\n` + pageText.trim();
            }

            images[i] = null; // Explicitly release memory reference
          }
        } catch (workerErr) {
          console.error('[OCR Service Error] OCR processing error:', workerErr.message);
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
      const finalOcrResult = ocrText.trim() || textFromPdf || '[Scanned PDF] Scanned document processed. No high-confidence text detected via OCR.';

      return {
        extractedText: finalOcrResult,
        extractionMethod: 'ocr',
      };
    } else if (fileType === 'image') {
      let worker;
      let extractedText = '';
      try {
        const imgBuffer = fs.readFileSync(filePath);
        if (isValidImageBuffer(imgBuffer)) {
          // Attempt Gemini Vision first
          const visionFn = ocrService.recognizeWithGeminiVision || recognizeWithGeminiVision;
          extractedText = await visionFn(imgBuffer);

          // Fallback to Tesseract if Vision unavailable
          if (!extractedText) {
            worker = await createWorker('eng');
            const { data: { text } } = await recognizeWithTimeout(worker, imgBuffer, OCR_PAGE_TIMEOUT_MS);
            extractedText = text ? text.trim() : '';
          }
        } else {
          console.warn('[OCR Service Warning] Image file signature validation failed.');
        }
      } catch (imgErr) {
        console.error('[OCR Service Error] Image OCR failed:', imgErr.message);
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
