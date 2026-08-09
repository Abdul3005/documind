import mongoose from 'mongoose';

/**
 * Document Schema
 * Represents an uploaded PDF or image file and its extracted text.
 */
const documentSchema = new mongoose.Schema(
  {
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

const Document = mongoose.model('Document', documentSchema);

export default Document;
