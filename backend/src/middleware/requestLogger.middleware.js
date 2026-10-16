import crypto from 'crypto';
import logger from '../utils/logger.js';
import { recordHttpRequest } from '../services/metrics.service.js';

/**
 * Express middleware for request correlation ID tracking and structured request logging.
 * Returns X-Request-ID in response headers and updates in-memory traffic metrics.
 */
export const requestCorrelationAndLogging = (req, res, next) => {
  const incomingId = req.headers['x-request-id'];
  const requestId =
    typeof incomingId === 'string' && incomingId.trim().length > 0
      ? incomingId.trim()
      : crypto.randomUUID();

  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);

  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    recordHttpRequest({
      method: req.method,
      path: req.route?.path || req.baseUrl || req.path,
      statusCode: res.statusCode,
      durationMs,
    });

    logger.info(
      {
        reqId: requestId,
        method: req.method,
        url: req.originalUrl || req.url,
        status: res.statusCode,
        durationMs,
        ip: req.ip,
        userAgent: req.get('user-agent') || 'unknown',
      },
      `${req.method} ${req.originalUrl || req.url} - ${res.statusCode} (${durationMs}ms)`
    );
  });

  next();
};

export default requestCorrelationAndLogging;
