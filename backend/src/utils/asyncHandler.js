/**
 * Utility wrapper for async express route handlers.
 * Catches rejected promises and forwards errors to the centralized error middleware.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
