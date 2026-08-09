import { useState, useEffect, useCallback } from 'react';
import { fetchDocuments, uploadDocument, deleteDocument } from '../services/api.js';

export function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const loadDocuments = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

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
      console.error('[useDocuments] Upload failed:', err);
      const msg = err.response?.data?.error || err.message || 'Upload failed.';
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
