import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';

let mongoServer;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing';
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe('Authentication API (/api/auth)', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully and return JWT token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Abdul Rehman',
          email: 'abdul@example.com',
          password: 'Password123',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.name).toBe('Abdul Rehman');
      expect(res.body.user.email).toBe('abdul@example.com');
      expect(res.body.token).toBeDefined();

      // Verify user in database
      const dbUser = await User.findOne({ email: 'abdul@example.com' }).select('+password');
      expect(dbUser).not.toBeNull();
      expect(dbUser.password).not.toBe('Password123'); // Password must be hashed!
    });

    it('should reject registration if email is already taken', async () => {
      await User.create({
        name: 'Existing User',
        email: 'abdul@example.com',
        password: 'Password123',
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Another Name',
          email: 'abdul@example.com',
          password: 'NewPassword123',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/already exists/i);
    });

    it('should reject registration if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject registration if password is less than 6 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Short Pass',
          email: 'short@example.com',
          password: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'user@example.com',
          password: 'SecurePassword123',
        });
    });

    it('should login successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'SecurePassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('user@example.com');
      expect(res.body.token).toBeDefined();
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'WrongPassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/invalid email or password/i);
    });

    it('should reject login for non-existent user email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SecurePassword123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    let token;
    let userId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Authenticated User',
          email: 'auth@example.com',
          password: 'Password123',
        });
      token = res.body.token;
      userId = res.body.user.id;
    });

    it('should return user profile when valid Bearer token is provided', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.id).toBe(userId);
      expect(res.body.user.email).toBe('auth@example.com');
    });

    it('should reject request when Authorization header is missing', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/token missing/i);
    });

    it('should reject request when token is invalid or malformed', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token_xyz');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/invalid or expired token/i);
    });
  });
});
