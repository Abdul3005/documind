/**
 * In-memory system and AI telemetry metrics service for DocuMind V2.
 * Collects HTTP traffic counts, latencies, status distributions, and provider token usage.
 */

const metricsState = {
  startedAt: new Date().toISOString(),
  http: {
    totalRequests: 0,
    activeRequests: 0,
    statusCodes: {},
    totalDurationMs: 0,
    minDurationMs: null,
    maxDurationMs: 0,
  },
  ai: {
    totalCalls: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    byModel: {},
    errors: 0,
  },
};

/**
 * Record completed HTTP request metrics
 */
export const recordHttpRequest = ({ method, path, statusCode, durationMs }) => {
  metricsState.http.totalRequests += 1;
  metricsState.http.totalDurationMs += durationMs;

  const codeGroup = `${Math.floor(statusCode / 100)}xx`;
  metricsState.http.statusCodes[statusCode] = (metricsState.http.statusCodes[statusCode] || 0) + 1;
  metricsState.http.statusCodes[codeGroup] = (metricsState.http.statusCodes[codeGroup] || 0) + 1;

  if (metricsState.http.minDurationMs === null || durationMs < metricsState.http.minDurationMs) {
    metricsState.http.minDurationMs = durationMs;
  }
  if (durationMs > metricsState.http.maxDurationMs) {
    metricsState.http.maxDurationMs = durationMs;
  }
};

/**
 * Record actual AI provider token usage and latency.
 * Never invents token counts when usage metadata is unavailable.
 */
export const recordAiUsage = ({
  provider,
  model,
  promptTokens = 0,
  completionTokens = 0,
  totalTokens = 0,
  latencyMs = 0,
  hasUsage = true,
  error = false,
}) => {
  metricsState.ai.totalCalls += 1;
  if (error) {
    metricsState.ai.errors += 1;
    return;
  }

  const modelKey = model || provider || 'unknown';
  if (!metricsState.ai.byModel[modelKey]) {
    metricsState.ai.byModel[modelKey] = {
      calls: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      totalLatencyMs: 0,
      recordedTokenCalls: 0,
    };
  }

  const modelMetrics = metricsState.ai.byModel[modelKey];
  modelMetrics.calls += 1;
  modelMetrics.totalLatencyMs += latencyMs;

  if (hasUsage && (promptTokens > 0 || completionTokens > 0 || totalTokens > 0)) {
    const computedTotal = totalTokens || promptTokens + completionTokens;
    metricsState.ai.totalPromptTokens += promptTokens;
    metricsState.ai.totalCompletionTokens += completionTokens;
    metricsState.ai.totalTokens += computedTotal;

    modelMetrics.promptTokens += promptTokens;
    modelMetrics.completionTokens += completionTokens;
    modelMetrics.totalTokens += computedTotal;
    modelMetrics.recordedTokenCalls += 1;
  }
};

/**
 * Get snapshot of current metrics
 */
export const getMetricsSnapshot = () => {
  const reqCount = metricsState.http.totalRequests;
  const avgDurationMs = reqCount > 0 ? Math.round(metricsState.http.totalDurationMs / reqCount) : 0;

  return {
    uptimeSeconds: Math.floor(process.uptime()),
    startedAt: metricsState.startedAt,
    http: {
      totalRequests: metricsState.http.totalRequests,
      statusCodes: metricsState.http.statusCodes,
      avgDurationMs,
      minDurationMs: metricsState.http.minDurationMs || 0,
      maxDurationMs: metricsState.http.maxDurationMs,
    },
    ai: {
      totalCalls: metricsState.ai.totalCalls,
      totalPromptTokens: metricsState.ai.totalPromptTokens,
      totalCompletionTokens: metricsState.ai.totalCompletionTokens,
      totalTokens: metricsState.ai.totalTokens,
      errors: metricsState.ai.errors,
      models: metricsState.ai.byModel,
    },
    process: {
      nodeVersion: process.version,
      memoryUsageBytes: process.memoryUsage(),
    },
  };
};

/**
 * Reset metrics state (useful for test isolation)
 */
export const resetMetrics = () => {
  metricsState.http.totalRequests = 0;
  metricsState.http.activeRequests = 0;
  metricsState.http.statusCodes = {};
  metricsState.http.totalDurationMs = 0;
  metricsState.http.minDurationMs = null;
  metricsState.http.maxDurationMs = 0;
  metricsState.ai.totalCalls = 0;
  metricsState.ai.totalPromptTokens = 0;
  metricsState.ai.totalCompletionTokens = 0;
  metricsState.ai.totalTokens = 0;
  metricsState.ai.errors = 0;
  metricsState.ai.byModel = {};
};
