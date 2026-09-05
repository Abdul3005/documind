import { useState, useEffect, useCallback } from 'react';
import { fetchDocuments, uploadDocument, deleteDocument } from '../services/api.js';

export function useDocuments(enabled = true) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const loadDocuments = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);
    try {
      const data = await fetchDocuments();
      if (data.success) {
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('[useDocuments] Failed to fetch documents:', err);
      setError(err.response?.data?.error || 'Failed to load documents list.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      loadDocuments();
    } else {
      setDocuments([]);
      setLoading(false);
      setError(null);
    }
  }, [enabled, loadDocuments]);

  const handleUpload = async (file) => {
    setIsUploading(true);
    setError(null);
    try {
      const data = await uploadDocument(file);
      if (data.success && data.document) {
        setDocuments((prev) => [data.document, ...prev]);
        return data.document;
      }
    } catch (err) {
      let msg = err.response?.data?.error || err.message || 'Upload failed.';
      if (msg.includes('timeout') || err.code === 'ECONNABORTED') {
        msg = 'Upload processing timed out. For large scanned PDFs, text extraction or OCR took too long. Please try a file with fewer scanned pages or native text.';
      }
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id) => {
    setError(null);
    try {
      const data = await deleteDocument(id);
      if (data.success) {
        setDocuments((prev) => prev.filter((d) => (d.id || d._id) !== id));
      }
    } catch (err) {
      console.error('[useDocuments] Delete failed:', err);
      setError(err.response?.data?.error || 'Failed to delete document.');
    }
  };

  return {
    documents,
    loading,
    isUploading,
    error,
    refreshDocuments: loadDocuments,
    uploadDocument: handleUpload,
    deleteDocument: handleDelete,
    clearError: () => setError(null),
  };
}
