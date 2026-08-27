import { useState, useEffect, useCallback } from 'react';
import { fetchDocumentById, fetchMessages, sendMessage, generateDocumentSummary } from '../services/api.js';

const formatUserFriendlyError = (rawError) => {
  if (!rawError) return 'An unexpected error occurred.';
  const str = String(rawError);
  if (
    str.includes('503') ||
    str.includes('UNAVAILABLE') ||
    str.includes('high demand') ||
    str.includes('temporarily busy')
  ) {
    return 'The AI service is temporarily busy. Please try again in a moment.';
  }
  return str;
};

export function useChat(documentId) {
  const [document, setDocument] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    if (!documentId) return;

    setLoading(true);
    setError(null);
    try {
      const [docRes, msgRes] = await Promise.all([
        fetchDocumentById(documentId),
        fetchMessages(documentId),
      ]);

      if (docRes.success) setDocument(docRes.document);
      if (msgRes.success) setMessages(msgRes.messages || []);
    } catch (err) {
      console.error('[useChat] Failed to load workspace data:', err);
      setError(formatUserFriendlyError(err.response?.data?.error || 'Failed to load document workspace.'));
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSendMessage = async (content) => {
    if (!documentId || !content.trim()) return;

    setIsSending(true);
    setError(null);

    // Optimistic user message append
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const data = await sendMessage(documentId, content.trim());
      if (data.success) {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempUserMsg.id),
          data.userMessage,
          data.assistantMessage,
        ]);
      }
    } catch (err) {
      console.error('[useChat] Send message failed:', err);
      setError(formatUserFriendlyError(err.response?.data?.error || err.message || 'Failed to get AI response.'));
      // Remove temp message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setIsSending(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!documentId) return;

    setIsSummarizing(true);
    setError(null);
    try {
      const data = await generateDocumentSummary(documentId);
      if (data.success) {
        setDocument((prev) => (prev ? { ...prev, summary: data.summary } : null));
      }
    } catch (err) {
      console.error('[useChat] Summary generation failed:', err);
      setError(formatUserFriendlyError(err.response?.data?.error || err.message || 'Failed to generate summary.'));
    } finally {
      setIsSummarizing(false);
    }
  };

  return {
    document,
    messages,
    loading,
    isSending,
    isSummarizing,
    error,
    reloadWorkspace: loadData,
    sendMessage: handleSendMessage,
    generateSummary: handleGenerateSummary,
    clearError: () => setError(null),
  };
}
