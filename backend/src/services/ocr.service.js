import fs from 'fs';
import pdfParse from 'pdf-parse';
import { createWorker } from 'tesseract.js';

/**
 * Service to extract raw text from PDF files or images via OCR.
 */
export const extractText = async (filePath, fileType) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found for extraction at path: ${filePath}`);
    }

    if (fileType === 'pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(new Uint8Array(dataBuffer));
      const extractedText = pdfData.text ? pdfData.text.trim() : '';
      return extractedText || 'No readable text layer found in PDF.';
    } else if (fileType === 'image') {
      const worker = await createWorker('eng');
      const { data: { text } } = await worker.recognize(filePath);
      await worker.terminate();
      const extractedText = text ? text.trim() : '';
      return extractedText || 'No readable text found in image.';
    } else {
      throw new Error(`Unsupported file type for extraction: ${fileType}`);
    }
  } catch (error) {
    console.error(`[OCR Service Error] Text extraction failed for ${filePath}:`, error.message);
    throw new Error(`Text extraction failed: ${error.message}`);
  }
};
