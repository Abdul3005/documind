import { useState, useEffect, useCallback } from 'react';
import { fetchDocuments, uploadDocument, deleteDocument } from '../services/api.js';

export function useDocuments(enabled = true, userId = null) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('idle'); // 'idle' | 'uploading' | 'processing' | 'indexing' | 'ready'
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

  // Purge document state on userId change or disable, and fetch fresh list when authenticated
  useEffect(() => {
    setDocuments([]);
    setError(null);

    if (enabled) {
      loadDocuments();
    } else {
      setLoading(false);
    }
  }, [enabled, userId, loadDocuments]);

  // Listen for global logout event to purge cached documents in memory
  useEffect(() => {
    const handleLogout = () => {
      setDocuments([]);
      setError(null);
      setLoading(false);
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStage('idle');
    };

    window.addEventListener('documind_logout', handleLogout);
    return () => window.removeEventListener('documind_logout', handleLogout);
  }, []);

  const handleUpload = async (file) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStage('uploading');
    setError(null);

    let stageTimer = null;

    try {
      const data = await uploadDocument(file, (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
          if (percentCompleted >= 100) {
            setUploadStage('processing');
            stageTimer = setTimeout(() => {
              setUploadStage('indexing');
            }, 1800);
          }
        }
      });

      setUploadStage('ready');
      setUploadProgress(100);

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
      if (stageTimer) clearTimeout(stageTimer);
      setIsUploading(false);
      setTimeout(() => {
        setUploadProgress(0);
        setUploadStage('idle');
      }, 800);
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
    uploadProgress,
    uploadStage,
    error,
    refreshDocuments: loadDocuments,
    uploadDocument: handleUpload,
    deleteDocument: handleDelete,
    clearDocuments: () => setDocuments([]),
    clearError: () => setError(null),
  };
}
