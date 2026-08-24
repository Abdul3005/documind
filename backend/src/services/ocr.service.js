import fs from 'fs';
import pdfParse from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';

/**
 * Helper to extract raw image buffers embedded inside PDF pages (for scanned PDFs)
 */
export const extractImagesFromPdf = async (pdfBuffer) => {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const images = [];

    const indirectObjects = pdfDoc.context.enumerateIndirectObjects();
    for (const [ref, obj] of indirectObjects) {
      if (obj instanceof PDFRawStream) {
        const dict = obj.dict;
        const subtype = dict.get(PDFName.of('Subtype'));
        if (subtype === PDFName.of('Image')) {
          const imageBytes = obj.getContents();
          images.push(Buffer.from(imageBytes));
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
 * Service to extract raw text from PDF files or images via 2-stage text layer extraction with OCR fallback.
 */
export const extractText = async (filePath, fileType) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found for extraction at path: ${filePath}`);
    }

    if (fileType === 'pdf') {
      const dataBuffer = fs.readFileSync(filePath);

      // Check PDF header magic bytes (%PDF-)
      const header = dataBuffer.toString('utf8', 0, 5);
      if (!header.startsWith('%PDF-')) {
        throw new Error('Invalid PDF format or corrupted file header.');
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
            try {
              const { data: { text } } = await worker.recognize(images[i]);
              if (text && text.trim()) {
                ocrText += (ocrText ? '\n\n' : '') + text.trim();
              }
            } catch (imgOcrErr) {
              console.error(`[OCR Service] Failed to OCR page image ${i + 1}:`, imgOcrErr.message);
            }
          }
        } finally {
          if (worker) {
            await worker.terminate();
          }
        }
      }

      // Return OCR extraction result with extractionMethod: 'ocr'
      const finalOcrResult = ocrText.trim() || textFromPdf || '[Scanned PDF] No readable text found via OCR.';

      return {
        extractedText: finalOcrResult,
        extractionMethod: 'ocr',
      };
    } else if (fileType === 'image') {
      const worker = await createWorker('eng');
      let extractedText = '';
      try {
        const { data: { text } } = await worker.recognize(filePath);
        extractedText = text ? text.trim() : '';
      } finally {
        await worker.terminate();
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
      throw new Error(`Unsupported file type for extraction: ${fileType}`);
    }
  } catch (error) {
    console.error(`[OCR Service Error] Text extraction failed for ${filePath}:`, error.message);
    throw new Error(`Text extraction failed: ${error.message}`);
  }
};
