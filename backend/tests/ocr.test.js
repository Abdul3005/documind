import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import os from 'os';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Document from '../src/models/Document.js';
import { extractText } from '../src/services/ocr.service.js';

let mongoServer;
let token;
let userId;
let tempDir;

// Helper to generate text PDF buffer using pdfkit
const createTextPdfBuffer = (text) => {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument();
    const buffers = [];
    pdf.on('data', (chunk) => buffers.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(buffers)));
    pdf.on('error', (err) => reject(err));

    pdf.text(text);
    pdf.end();
  });
};

// Helper to generate scanned PDF buffer without text layer (< 50 chars)
const createScannedPdfBuffer = () => {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument();
    const buffers = [];
    pdf.on('data', (chunk) => buffers.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(buffers)));
    pdf.on('error', (err) => reject(err));

    // Vector rectangle drawing without text layer
    pdf.rect(10, 10, 100, 100).fill('#000000');
    pdf.end();
  });
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'documind-ocr-test-'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

beforeEach(async () => {
  await User.deleteMany({});
  await Document.deleteMany({});

  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'OCR Tester',
      email: 'ocr@example.com',
      password: 'Password123',
    });
  token = res.body.token;
  userId = res.body.user.id;
});

describe('PDF Text Extraction & OCR Fallback Pipeline', () => {
  it('should extract text from a normal text PDF and mark extractionMethod as "text"', async () => {
    const textContent = 'This is a valid text-based PDF document containing more than 50 characters to satisfy the text layer threshold.';
    const pdfBuffer = await createTextPdfBuffer(textContent);
    const filePath = path.join(tempDir, 'text_doc.pdf');
    fs.writeFileSync(filePath, pdfBuffer);

    const result = await extractText(filePath, 'pdf');

    expect(result.extractionMethod).toBe('text');
    expect(result.extractedText).toContain('valid text-based PDF document');
  });

  it(
    'should trigger OCR fallback for scanned PDF with less than 50 text characters',
    async () => {
      const scannedBuffer = await createScannedPdfBuffer();
      const filePath = path.join(tempDir, 'scanned_doc.pdf');
      fs.writeFileSync(filePath, scannedBuffer);

      const result = await extractText(filePath, 'pdf');

      // Scanned PDF with no text layer should trigger fallback to OCR method
      expect(result.extractionMethod).toBe('ocr');
      expect(result.extractedText).toBeDefined();
    },
    30000
  );

  it('should handle unreadable/corrupted files gracefully without crashing backend', async () => {
    const corruptedPath = path.join(tempDir, 'corrupted.pdf');
    fs.writeFileSync(corruptedPath, Buffer.from('NOT_A_REAL_PDF_HEADER_CONTENT'));

    await expect(extractText(corruptedPath, 'pdf')).rejects.toThrow(/invalid pdf format|corrupted|extraction failed/i);
  });

  it('should upload a text PDF via API and set document extractionMethod to "text"', async () => {
    const pdfBuffer = await createTextPdfBuffer('Detailed specification document containing full text content for testing endpoint extraction.');
    
    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', pdfBuffer, 'api_text_doc.pdf');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.document.extractionMethod).toBe('text');
    expect(res.body.document.status).toBe('ready');
  });

  it('should validate image buffer magic bytes correctly', async () => {
    const { isValidImageBuffer } = await import('../src/services/ocr.service.js');
    const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A]);
    const invalidBuffer = Buffer.from([0x78, 0x9C, 0x00, 0x11, 0x22, 0x33]);

    expect(isValidImageBuffer(jpegBuffer)).toBe(true);
    expect(isValidImageBuffer(pngBuffer)).toBe(true);
    expect(isValidImageBuffer(invalidBuffer)).toBe(false);
    expect(isValidImageBuffer(null)).toBe(false);
  });

  it('should calculate page count correctly for a valid PDF', async () => {
    const { getPdfPageCount } = await import('../src/services/ocr.service.js');
    const pdfBuffer = await createTextPdfBuffer('Sample page count test document text content.');
    const count = await getPdfPageCount(pdfBuffer);
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(3000);
  });

  it('should reject PDFs exceeding the 3000 page limit cleanly', async () => {
    const module = await import('../src/services/ocr.service.js');
    const pdfBuffer = await createTextPdfBuffer('Sample text content for 3000 page limit test.');
    const filePath = path.join(tempDir, 'page_limit_exceeded.pdf');
    fs.writeFileSync(filePath, pdfBuffer);

    // Temporarily spy/override getPdfPageCount to return 3001 pages
    const pageCountSpy = vi.spyOn(module.ocrService, 'getPdfPageCount').mockResolvedValue(3001);

    try {
      await expect(module.extractText(filePath, 'pdf')).rejects.toThrow(/PDF exceeds the maximum allowed limit of 3000 pages/i);
    } finally {
      pageCountSpy.mockRestore();
    }
  });
});
