import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import {
  recordHttpRequest,
  recordAiUsage,
  getMetricsSnapshot,
  resetMetrics,
} from '../src/services/metrics.service.js';

describe('Week 6 Phase 2: Observability & Telemetry Suite', () => {
  beforeEach(() => {
    resetMetrics();
    delete process.env.METRICS_TOKEN;
    delete process.env.METRICS_AUTH_TOKEN;
  });

  describe('1. Request Correlation ID Middleware', () => {
    it('should generate a valid UUID X-Request-ID header when none is provided', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should preserve and reflect an incoming X-Request-ID header', async () => {
      const customId = 'client-trace-id-12345';
      const res = await request(app)
        .get('/api/health')
        .set('X-Request-ID', customId);

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBe(customId);
    });
  });

  describe('2. In-Memory Metrics Service & Telemetry', () => {
    it('should track HTTP traffic, status distribution, and duration', () => {
      recordHttpRequest({ method: 'GET', path: '/api/health', statusCode: 200, durationMs: 15 });
      recordHttpRequest({ method: 'POST', path: '/api/documents/upload', statusCode: 201, durationMs: 45 });
      recordHttpRequest({ method: 'GET', path: '/api/missing', statusCode: 404, durationMs: 5 });

      const metrics = getMetricsSnapshot();

      expect(metrics.http.totalRequests).toBe(3);
      expect(metrics.http.statusCodes['200']).toBe(1);
      expect(metrics.http.statusCodes['201']).toBe(1);
      expect(metrics.http.statusCodes['404']).toBe(1);
      expect(metrics.http.statusCodes['2xx']).toBe(2);
      expect(metrics.http.statusCodes['4xx']).toBe(1);
      expect(metrics.http.minDurationMs).toBe(5);
      expect(metrics.http.maxDurationMs).toBe(45);
      expect(metrics.http.avgDurationMs).toBe(22); // (15 + 45 + 5) / 3 = 21.6 -> 22
    });

    it('should track AI provider usage only when actual usage metadata is provided', () => {
      // Call with actual usage metadata from Groq/OpenAI
      recordAiUsage({
        provider: 'groq',
        model: 'openai/gpt-oss-120b',
        promptTokens: 120,
        completionTokens: 45,
        totalTokens: 165,
        latencyMs: 310,
        hasUsage: true,
      });

      // Call where provider does NOT return usage metadata
      recordAiUsage({
        provider: 'custom_ollama',
        model: 'qwen2.5:1.5b',
        latencyMs: 1200,
        hasUsage: false,
      });

      const metrics = getMetricsSnapshot();

      expect(metrics.ai.totalCalls).toBe(2);
      expect(metrics.ai.totalPromptTokens).toBe(120);
      expect(metrics.ai.totalCompletionTokens).toBe(45);
      expect(metrics.ai.totalTokens).toBe(165);

      const groqModel = metrics.ai.models['openai/gpt-oss-120b'];
      expect(groqModel.calls).toBe(1);
      expect(groqModel.promptTokens).toBe(120);
      expect(groqModel.totalTokens).toBe(165);
      expect(groqModel.recordedTokenCalls).toBe(1);

      const ollamaModel = metrics.ai.models['qwen2.5:1.5b'];
      expect(ollamaModel.calls).toBe(1);
      expect(ollamaModel.promptTokens).toBe(0); // Never invented
      expect(ollamaModel.recordedTokenCalls).toBe(0);
    });
  });

  describe('3. Metrics Endpoint (/api/metrics)', () => {
    it('should return snapshot metrics when unauthenticated in development/default mode', async () => {
      const res = await request(app).get('/api/metrics');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('http');
      expect(res.body.data).toHaveProperty('ai');
      expect(res.body.data).toHaveProperty('uptimeSeconds');
      expect(res.body.data).toHaveProperty('process');
    });

    it('should restrict metrics when METRICS_TOKEN is configured', async () => {
      process.env.METRICS_TOKEN = 'secret-metrics-token-999';

      // Unauthorized without token
      const unauthRes = await request(app).get('/api/metrics');
      expect(unauthRes.status).toBe(401);

      // Authorized with X-Metrics-Token header
      const authHeaderRes = await request(app)
        .get('/api/metrics')
        .set('X-Metrics-Token', 'secret-metrics-token-999');
      expect(authHeaderRes.status).toBe(200);
      expect(authHeaderRes.body.success).toBe(true);

      // Authorized with Bearer Authorization header
      const authBearerRes = await request(app)
        .get('/api/metrics')
        .set('Authorization', 'Bearer secret-metrics-token-999');
      expect(authBearerRes.status).toBe(200);
      expect(authBearerRes.body.success).toBe(true);
    });
  });
});
