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
  if (mongoServer) await mongoServer.stop();
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

  it('should preserve word spacing in coordinate-positioned PDFs without smushing words', async () => {
    // Generate coordinate-positioned PDF with individual words on the same baseline
    const createCoordinatePdfBuffer = () => {
      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        const y = 100;
        doc.text('Inferential', 72, y, { continued: false });
        doc.text('statistics', 140, y, { continued: false });
        doc.text('involves', 200, y, { continued: false });
        doc.text('making', 255, y, { continued: false });
        doc.text('decisions', 310, y, { continued: false });
        doc.text('and', 375, y, { continued: false });
        doc.text('drawing', 405, y, { continued: false });
        doc.text('conclusions.', 460, y, { continued: false });
        doc.end();
      });
    };

    const coordBuffer = await createCoordinatePdfBuffer();
    const filePath = path.join(tempDir, 'coordinate_positioned.pdf');
    fs.writeFileSync(filePath, coordBuffer);

    const result = await extractText(filePath, 'pdf');

    expect(result.extractionMethod).toBe('text');
    expect(result.extractedText).toContain('Inferential statistics involves making decisions and drawing conclusions.');
    expect(result.extractedText).not.toContain('Inferentialstatisticsinvolvesmakingdecisions');
  });

  it('should accurately evaluate whitespace health with isWhitespaceHealthy', async () => {
    const { isWhitespaceHealthy } = await import('../src/services/ocr.service.js');

    // Healthy natural text with normal word spacing
    const healthy = 'Inferential statistics involves making decisions and drawing conclusions based on sample information.';
    expect(isWhitespaceHealthy(healthy)).toBe(true);

    // Defective text with smushed words and no whitespace
    const defective = 'InferentialstatisticsinvolvesmakingdecisionsanddrawingconclusionsbasedonsampleinformationUnlikedescriptivestatisticswhichonlydescribethedatainferentialstatisticsallowyoutomakeinferencesanddecisionsbeyondtheimmediatedata';
    expect(isWhitespaceHealthy(defective)).toBe(false);

    // Short text under 50 characters returns false
    expect(isWhitespaceHealthy('Too short')).toBe(false);
  });

  it('should not introduce excessive or duplicate spaces in already-correct PDFs', async () => {
    const normalText = 'This is an already-correct paragraph with (parenthetical notes), punctuation, and numbers: 100%.';
    const pdfBuffer = await createTextPdfBuffer(normalText);
    const filePath = path.join(tempDir, 'already_correct.pdf');
    fs.writeFileSync(filePath, pdfBuffer);

    const result = await extractText(filePath, 'pdf');

    expect(result.extractionMethod).toBe('text');
    // Ensure punctuation is not erroneously preceded by space
    expect(result.extractedText).not.toContain('( ');
    expect(result.extractedText).not.toContain(' ,');
    expect(result.extractedText).not.toContain(' .');
    expect(result.extractedText).toContain('already-correct');
  });

  it('should preprocess low-resolution image buffers to high-DPI normalized grayscale PNG', async () => {
    const sharp = (await import('sharp')).default;
    const { preprocessImage } = await import('../src/services/ocr.service.js');

    const rawJpg = await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 3,
        background: { r: 240, g: 240, b: 240 },
      },
    })
      .jpeg()
      .toBuffer();

    const processed = await preprocessImage(rawJpg);
    expect(Buffer.isBuffer(processed)).toBe(true);

    const metadata = await sharp(processed).metadata();
    expect(metadata.format).toBe('png');
    expect(metadata.width).toBeGreaterThanOrEqual(1600);
    expect(metadata.density).toBe(300);
  });

  it('should evaluate OCR quality metrics accurately for clean vs garbled text', async () => {
    const { evaluateOcrQuality } = await import('../src/services/ocr.service.js');

    const cleanInvoiceText = `
      INVOICE #INV-2026-001
      TechVentures Pakistan Pvt Ltd
      Billed To: Alpha Solutions Inc.
      Date: October 20, 2026
      Due Date: November 15, 2026
      Description: Cloud Architecture & DevOps Consulting
      Total Amount Due: $1,500.00
      Payment Terms: Net 30 days
    `;
    const cleanEvaluation = evaluateOcrQuality(cleanInvoiceText, 88);
    expect(cleanEvaluation.isPoorQuality).toBe(false);
    expect(['good', 'medium']).toContain(cleanEvaluation.qualityTier);
    expect(cleanEvaluation.confidence).toBe(88);

    const garbledText = '77 all \n Ms fds \n 3 Cup \n #%& \n \x0c';
    const garbledEvaluation = evaluateOcrQuality(garbledText, 25);
    expect(garbledEvaluation.isPoorQuality).toBe(true);
    expect(['low', 'unreadable']).toContain(garbledEvaluation.qualityTier);
  });

  it('should persist OCR quality, confidence, and raw text on image upload via API', async () => {
    const sharp = (await import('sharp')).default;
    const sampleImageBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer();

    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', sampleImageBuffer, 'sample_receipt.png');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.document.fileType).toBe('image');
    expect(res.body.document.extractionMethod).toBe('ocr');
    expect(res.body.document.ocrQuality).toBeDefined();
    expect(typeof res.body.document.ocrConfidence).toBe('number');

    const savedDoc = await Document.findById(res.body.document._id || res.body.document.id);
    expect(savedDoc).toBeTruthy();
    expect(savedDoc.extractionMethod).toBe('ocr');
    expect(savedDoc.rawOcrText).toBeDefined();
  });

  it('should answer "What is this document for?" on an invoice image document with grounded details', async () => {
    const invoiceText = `
INVOICE
Invoice Number: INV-98432
Issuer: TechVentures Pakistan (Pvt) Ltd
Vendor Address: Islamabad, Pakistan
Customer: Acme Global Enterprises
Billed To: Acme Accounts Payable
Issue Date: October 15, 2026
Due Date: November 15, 2026
Line Items:
1. Enterprise Cloud Migration Services - Qty 1 - $3,500.00
2. Security & Compliance Audit - Qty 1 - $1,500.00
Subtotal: $5,000.00
Tax (0%): $0.00
Total Amount Due: $5,000.00
Payment Instructions: Wire transfer to Habib Bank Limited, Account 9876543210.
    `.trim();

    const invoiceDoc = await Document.create({
      userId,
      filename: 'invoice_october.jpg',
      fileType: 'image',
      extractedText: invoiceText,
      rawOcrText: invoiceText,
      extractionMethod: 'ocr',
      ocrQuality: 'good',
      ocrConfidence: 94,
      status: 'ready',
      chunks: [
        {
          index: 0,
          text: invoiceText,
          embedding: new Array(768).fill(0.01),
        },
      ],
    });

    const res = await request(app)
      .post(`/api/documents/${invoiceDoc._id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'What is this document for?' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const reply = res.body.assistantMessage.content.toLowerCase();
    expect(reply).not.toContain('the provided document does not contain this information');
    expect(reply).toContain('invoice');
    expect(res.body.assistantMessage.sources.length).toBeGreaterThan(0);
  });

  it('should answer natural-language invoice field queries (issuer, recipient, total, due date)', async () => {
    const invoiceText = `
INVOICE
Invoice Number: INV-98432
Issuer: TechVentures Pakistan (Pvt) Ltd
Vendor Address: Islamabad, Pakistan
Billed To: Acme Global Enterprises
Customer: Acme Global Enterprises
Issue Date: October 15, 2026
Due Date: November 15, 2026
Line Items:
1. Enterprise Cloud Migration Services - Qty 1 - $3,500.00
2. Security & Compliance Audit - Qty 1 - $1,500.00
Subtotal: $5,000.00
Tax (0%): $0.00
Total Amount Due: $5,000.00
Payment Instructions: Wire transfer to Habib Bank Limited.
    `.trim();

    const invoiceDoc = await Document.create({
      userId,
      filename: 'invoice_nl_queries.jpg',
      fileType: 'image',
      extractedText: invoiceText,
      rawOcrText: invoiceText,
      extractionMethod: 'ocr',
      ocrQuality: 'good',
      ocrConfidence: 94,
      status: 'ready',
      chunks: [
        {
          index: 0,
          text: invoiceText,
          embedding: new Array(768).fill(0.01),
        },
      ],
    });

    const resIssuer = await request(app)
      .post(`/api/documents/${invoiceDoc._id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Who is the issuer of this invoice?' });

    expect(resIssuer.status).toBe(201);
    expect(resIssuer.body.assistantMessage.content.toLowerCase()).toContain('techventures');

    const resTotal = await request(app)
      .post(`/api/documents/${invoiceDoc._id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'What is the total amount due?' });

    expect(resTotal.status).toBe(201);
    expect(resTotal.body.assistantMessage.content).toMatch(/5,?000/);

    const resDueDate = await request(app)
      .post(`/api/documents/${invoiceDoc._id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'When is the payment due date?' });

    expect(resDueDate.status).toBe(201);
    expect(resDueDate.body.assistantMessage.content.toLowerCase()).toContain('november 15');
  });

  it('should return helpful guidance instead of UNGROUNDED_RESPONSE when OCR quality is low or unreadable', async () => {
    const lowQualityDoc = await Document.create({
      userId,
      filename: 'blurry_receipt.jpg',
      fileType: 'image',
      extractedText: '77 all \n Ms fds \n 3 Cup \n #%& \n \x0c',
      rawOcrText: '77 all \n Ms fds \n 3 Cup \n #%& \n \x0c',
      extractionMethod: 'ocr',
      ocrQuality: 'low',
      ocrConfidence: 28,
      status: 'ready',
      chunks: [
        {
          index: 0,
          text: '77 all \n Ms fds \n 3 Cup \n #%& \n \x0c',
          embedding: new Array(768).fill(0.01),
        },
      ],
    });

    const resOverview = await request(app)
      .post(`/api/documents/${lowQualityDoc._id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'What is this document for?' });

    expect(resOverview.status).toBe(201);
    const overviewReply = resOverview.body.assistantMessage.content;
    expect(overviewReply).not.toBe('I am sorry, but the provided document does not contain this information.');
    expect(overviewReply.toLowerCase()).toContain('could not be read reliably due to low image quality');
    expect(overviewReply.toLowerCase()).toContain('clearer');

    const resSpecific = await request(app)
      .post(`/api/documents/${lowQualityDoc._id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'What is the total price on this receipt?' });

    expect(resSpecific.status).toBe(201);
    const specificReply = resSpecific.body.assistantMessage.content;
    expect(specificReply.toLowerCase()).toContain('could not be read reliably due to low image quality');
  });
});
