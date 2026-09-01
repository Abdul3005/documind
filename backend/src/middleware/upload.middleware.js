import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { MAX_FILE_SIZE_BYTES } from '../config/limits.js';

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// File Filter for PDF and Image types (MIME type + file extension validation)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    const error = new Error('Unsupported file type. Only PDF, JPG, JPEG, and PNG files are allowed.');
    error.statusCode = 400;
    cb(error, false);
  }
};

// Multer instance with 50MB limit
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES, // 50 MB limit
  },
});

/**
 * Validates actual binary magic-bytes header of uploaded file on disk
 */
export const validateFileMagicBytes = (req, res, next) => {
  if (!req.file) return next();

  try {
    const filePath = req.file.path;
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    const ext = path.extname(req.file.originalname).toLowerCase();
    let isValid = false;

    if (ext === '.pdf') {
      // Magic bytes: %PDF- (0x25 0x50 0x44 0x46 0x2D)
      isValid = buffer.toString('utf8', 0, 5) === '%PDF-';
    } else if (ext === '.jpg' || ext === '.jpeg') {
      // Magic bytes: FF D8 FF
      isValid = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    } else if (ext === '.png') {
      // Magic bytes: 89 50 4E 47 0D 0A 1A 0A
      isValid = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    }

    if (!isValid) {
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
      const error = new Error('File signature does not match allowed file type.');
      error.statusCode = 400;
      return next(error);
    }

    next();
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    const error = new Error('Failed to validate file header signature.');
    error.statusCode = 400;
    return next(error);
  }
};

export const uploadSingleDocument = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return next(err);
    validateFileMagicBytes(req, res, next);
  });
};
