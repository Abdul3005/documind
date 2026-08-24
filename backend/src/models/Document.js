import mongoose from 'mongoose';

/**
 * Document Schema
 * Represents an uploaded PDF or image file and its extracted text, owned by a specific User.
 */
const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    filename: {
      type: String,
      required: [true, 'Filename is required'],
      trim: true,
    },
    fileType: {
      type: String,
      required: [true, 'File type is required'],
      enum: ['pdf', 'image'],
    },
    extractedText: {
      type: String,
      required: [true, 'Extracted text is required'],
    },
    extractionMethod: {
      type: String,
      enum: ['text', 'ocr'],
      default: 'text',
    },
    status: {
      type: String,
      required: true,
      enum: ['processing', 'ready', 'failed'],
      default: 'processing',
    },
    summary: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// Compound index for user document listing sorted by creation date
documentSchema.index({ userId: 1, createdAt: -1 });

const Document = mongoose.model('Document', documentSchema);

export default Document;
