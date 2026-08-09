/**
 * Centralized Error Handler Middleware
 * Formats errors into a standardized JSON response.
 */
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  // Handle Multer specific upload errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      statusCode = 413; // Payload Too Large per MASTER_PLAN.md Section 10
      message = 'File size exceeds the maximum limit of 10MB.';
    } else {
      statusCode = 400;
      message = `Upload error: ${err.message}`;
    }
  }

  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, message);

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
