import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Document from '../src/models/Document.js';
import Message from '../src/models/Message.js';

let mongoServer;
let tokenA;
let userAId;
let tokenB;
let userBId;
let docAId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Document.deleteMany({});
  await Message.deleteMany({});

  // Register User A
  const resA = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'User A',
      email: 'usera@example.com',
      password: 'Password123',
    });
  tokenA = resA.body.token;
  userAId = resA.body.user.id;

  // Register User B
  const resB = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'User B',
      email: 'userb@example.com',
      password: 'Password123',
    });
  tokenB = resB.body.token;
  userBId = resB.body.user.id;

  // Create Document A for User A directly in DB
  const docA = await Document.create({
    userId: userAId,
    filename: 'user_a_contract.pdf',
    fileType: 'pdf',
    extractedText: 'Confidential agreement details for User A.',
    status: 'ready',
  });
  docAId = docA._id.toString();
});

describe('Document Authorization & Ownership Isolation', () => {
  it('should allow User A to view their own document', async () => {
    const res = await request(app)
      .get(`/api/documents/${docAId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.document.id).toBe(docAId);
    expect(res.body.document.filename).toBe('user_a_contract.pdf');
  });

  it('should allow User A to list their own documents', async () => {
    const res = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.documents[0].id).toBe(docAId);
  });

  it('should return empty list when User B queries document list', async () => {
    const res = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.documents).toEqual([]);
  });

  it('should return 404 when User B tries to view User A document details', async () => {
    const res = await request(app)
      .get(`/api/documents/${docAId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/document not found/i);
  });

  it('should return 404 when User B attempts to send a chat message to User A document', async () => {
    const res = await request(app)
      .post(`/api/documents/${docAId}/messages`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ content: 'What is in User A document?' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should return 404 when User B attempts to get messages for User A document', async () => {
    const res = await request(app)
      .get(`/api/documents/${docAId}/messages`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should return 404 when User B attempts to summarize User A document', async () => {
    const res = await request(app)
      .post(`/api/documents/${docAId}/summarize`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should return 404 when User B attempts to delete User A document and NOT delete the document', async () => {
    const deleteRes = await request(app)
      .delete(`/api/documents/${docAId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(deleteRes.status).toBe(404);

    // Verify document still exists in database
    const docInDb = await Document.findById(docAId);
    expect(docInDb).not.toBeNull();
  });

  it('should allow User A to delete their own document and cascade delete associated messages', async () => {
    // Create a message for Document A
    await Message.create({
      documentId: docAId,
      userId: userAId,
      role: 'user',
      content: 'Sample question from User A',
    });

    const res = await request(app)
      .delete(`/api/documents/${docAId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify Document is deleted
    const docInDb = await Document.findById(docAId);
    expect(docInDb).toBeNull();

    // Verify associated Messages are cascade deleted
    const messagesInDb = await Message.find({ documentId: docAId });
    expect(messagesInDb.length).toBe(0);
  });
});
