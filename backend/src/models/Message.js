import mongoose from 'mongoose';

/**
 * Message Schema
 * Represents a single chat message associated with a specific Document.
 */
const messageSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: [true, 'Document reference is required'],
      index: true,
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: ['user', 'assistant'],
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient chronological query per document
messageSchema.index({ documentId: 1, createdAt: 1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;
