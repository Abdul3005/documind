import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import RefreshToken from '../src/models/RefreshToken.js';

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
  await RefreshToken.deleteMany({});
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

  describe('Week 5: Refresh Token Foundation & Security Suite', () => {
    it('should issue an HttpOnly refresh cookie on successful registration and store only hashed token in DB', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Refresh User',
          email: 'refresh_reg@example.com',
          password: 'Password123',
        });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();

      // Check Set-Cookie header
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = cookies.find((c) => c.startsWith('documind_refresh='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('Path=/api/auth');

      // Verify token in database: only hashed token stored, NOT the raw token
      const rawCookieVal = refreshCookie.split(';')[0].split('=')[1];
      const tokensInDb = await RefreshToken.find({});
      expect(tokensInDb.length).toBe(1);
      expect(tokensInDb[0].tokenHash).not.toBe(rawCookieVal);
      expect(tokensInDb[0].isRevoked).toBe(false);
      expect(tokensInDb[0].family).toBeDefined();
    });

    it('should issue an HttpOnly refresh cookie on successful login', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Login User',
          email: 'login_refresh@example.com',
          password: 'Password123',
        });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login_refresh@example.com',
          password: 'Password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = cookies.find((c) => c.startsWith('documind_refresh='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
    });

    it('should successfully rotate token on POST /api/auth/refresh and return new access token', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Rotate User',
          email: 'rotate@example.com',
          password: 'Password123',
        });

      const rawCookie = regRes.headers['set-cookie'].find((c) => c.startsWith('documind_refresh='));

      // Perform refresh request
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [rawCookie]);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.token).toBeDefined();
      expect(refreshRes.body.accessToken).toBeDefined();

      // Check that a new rotated cookie was sent
      const newCookies = refreshRes.headers['set-cookie'];
      expect(newCookies).toBeDefined();
      const newCookie = newCookies.find((c) => c.startsWith('documind_refresh='));
      expect(newCookie).toBeDefined();
      expect(newCookie).not.toBe(rawCookie);

      // Verify that old token is marked as revoked/rotated in DB
      const tokensInDb = await RefreshToken.find({}).sort({ createdAt: 1 });
      expect(tokensInDb.length).toBe(2);
      expect(tokensInDb[0].isRevoked).toBe(true);
      expect(tokensInDb[0].revokedReason).toBe('rotated');
      expect(tokensInDb[1].isRevoked).toBe(false);
      expect(tokensInDb[1].parentTokenHash).toBe(tokensInDb[0].tokenHash);
    });

    it('should reject refresh if refresh cookie is missing', async () => {
      const res = await request(app).post('/api/auth/refresh');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/cookie missing/i);
    });

    it('should reject refresh if token is expired', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Expired User',
          email: 'expired@example.com',
          password: 'Password123',
        });

      const rawCookie = regRes.headers['set-cookie'].find((c) => c.startsWith('documind_refresh='));

      // Manually set expiration in past
      await RefreshToken.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 10000) } });

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [rawCookie]);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/expired/i);
    });

    it('should detect reuse of an old rotated token outside grace period and invalidate entire family', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Reuse User',
          email: 'reuse@example.com',
          password: 'Password123',
        });

      const oldCookie = regRes.headers['set-cookie'].find((c) => c.startsWith('documind_refresh='));

      // First refresh: rotates successfully
      const firstRefresh = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [oldCookie]);

      expect(firstRefresh.status).toBe(200);

      // Fast-forward past the 5-second race condition grace period
      const pastDate = new Date(Date.now() - 15000);
      await RefreshToken.updateMany(
        { revokedReason: 'rotated' },
        { $set: { updatedAt: pastDate, revokedAt: pastDate } }
      );

      // Attacker or replayed old token usage
      const replayRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [oldCookie]);

      expect(replayRes.status).toBe(401);
      expect(replayRes.body.error).toMatch(/reuse detected/i);

      // Verify that all tokens in this family have been revoked
      const allTokens = await RefreshToken.find({});
      expect(allTokens.length).toBeGreaterThan(0);
      expect(allTokens.every((t) => t.isRevoked === true)).toBe(true);
    });

    it('should handle concurrent refresh requests safely within grace period without cascading revocation', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Concurrent User',
          email: 'concurrent@example.com',
          password: 'Password123',
        });

      const sharedCookie = regRes.headers['set-cookie'].find((c) => c.startsWith('documind_refresh='));

      // Fire two refresh requests concurrently with the same initial cookie
      const [res1, res2] = await Promise.all([
        request(app).post('/api/auth/refresh').set('Cookie', [sharedCookie]),
        request(app).post('/api/auth/refresh').set('Cookie', [sharedCookie]),
      ]);

      // Both requests should succeed (one performs rotation, the other safely falls into grace window)
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.token).toBeDefined();
      expect(res2.body.token).toBeDefined();

      // Ensure that sessions were NOT erroneously invalidated for reuse
      const activeTokens = await RefreshToken.find({ isRevoked: false });
      expect(activeTokens.length).toBe(1);
    });

    it('should revoke token and clear cookie on POST /api/auth/logout', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Logout User',
          email: 'logout_test@example.com',
          password: 'Password123',
        });

      const rawCookie = regRes.headers['set-cookie'].find((c) => c.startsWith('documind_refresh='));

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [rawCookie]);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);
      expect(logoutRes.body.message).toMatch(/logged out/i);

      // Verify cookie is cleared (has past expiration or Max-Age=0)
      const clearedCookies = logoutRes.headers['set-cookie'];
      expect(clearedCookies).toBeDefined();
      const clearedCookie = clearedCookies.find((c) => c.startsWith('documind_refresh='));
      expect(clearedCookie).toBeDefined();

      // Verify token in DB is revoked
      const tokenInDb = await RefreshToken.findOne({});
      expect(tokenInDb.isRevoked).toBe(true);
      expect(tokenInDb.revokedReason).toBe('logged_out');

      // Subsequent attempt to use that token must fail
      const subsequentRefresh = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [rawCookie]);

      expect(subsequentRefresh.status).toBe(401);
    });

    it('should block refresh requests from untrusted cross-origin origins', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Cors User',
          email: 'cors_test@example.com',
          password: 'Password123',
        });

      const rawCookie = regRes.headers['set-cookie'].find((c) => c.startsWith('documind_refresh='));

      // Attacker origin
      const evilRes = await request(app)
        .post('/api/auth/refresh')
        .set('Origin', 'https://malicious-phishing-site.com')
        .set('Cookie', [rawCookie]);

      expect(evilRes.status).toBe(403);
      expect(evilRes.body.error).toMatch(/CORS policy violation|untrusted origin/i);
    });

    it('should reject refresh requests if client validation header / Content-Type is missing in browser contexts', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Csrf User',
          email: 'csrf_test@example.com',
          password: 'Password123',
        });

      const rawCookie = regRes.headers['set-cookie'].find((c) => c.startsWith('documind_refresh='));

      // Simulate a browser form POST from legitimate origin but with text/plain or no json header
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Origin', 'http://localhost:5173')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .set('Cookie', [rawCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/client validation header/i);
    });

    it('should reject browser refresh requests when sec-fetch-site is cross-site and origin is omitted', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'SecFetch User',
          email: 'secfetch_test@example.com',
          password: 'Password123',
        });

      const rawCookie = regRes.headers['set-cookie'].find((c) => c.startsWith('documind_refresh='));

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Sec-Fetch-Site', 'cross-site')
        .set('Cookie', [rawCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/cross-site request rejected/i);
    });

    it('should allow refresh from exact production deployed origin configured via CORS_ORIGIN', async () => {
      const origCorsOrigin = process.env.CORS_ORIGIN;
      process.env.CORS_ORIGIN = 'https://documind-one-sigma.vercel.app';

      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Vercel Prod User',
          email: 'vercel_prod@example.com',
          password: 'Password123',
        });

      const rawCookie = regRes.headers['set-cookie'].find((c) => c.startsWith('documind_refresh='));

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Origin', 'https://documind-one-sigma.vercel.app')
        .set('Content-Type', 'application/json')
        .set('Cookie', [rawCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();

      process.env.CORS_ORIGIN = origCorsOrigin;
    });

    it('should block refresh even from random .vercel.app subdomains now that wildcard is removed', async () => {
      const origCorsOrigin = process.env.CORS_ORIGIN;
      process.env.CORS_ORIGIN = 'https://documind-one-sigma.vercel.app';

      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Wildcard Block User',
          email: 'wildcard_block@example.com',
          password: 'Password123',
        });

      const rawCookie = regRes.headers['set-cookie'].find((c) => c.startsWith('documind_refresh='));

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Origin', 'https://random-attacker-project.vercel.app')
        .set('Content-Type', 'application/json')
        .set('Cookie', [rawCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/CORS policy violation|untrusted origin/i);

      process.env.CORS_ORIGIN = origCorsOrigin;
    });
  });
});
