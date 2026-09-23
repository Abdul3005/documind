import { useState, useEffect, useCallback } from 'react';
import { fetchDocumentById, fetchMessages, sendMessage, generateDocumentSummary, clearMessagesApi } from '../services/api.js';

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

export function useChat(documentId, userId = null) {
  const [document, setDocument] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [lastFailedQuestion, setLastFailedQuestion] = useState(null);
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
      if (err.response?.status === 404) {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.removeItem('documind_active_doc_id');
            localStorage.removeItem('documind_active_chat_id');
          }
        } catch (e) {}
      }
      setError(formatUserFriendlyError(err.response?.data?.error || 'Failed to load document workspace.'));
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  // Purge chat state on documentId or userId change, and fetch if valid documentId is provided
  useEffect(() => {
    setDocument(null);
    setMessages([]);
    setError(null);
    setLastFailedQuestion(null);

    if (documentId) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [documentId, userId, loadData]);

  // Listen for global logout event to clear chat memory
  useEffect(() => {
    const handleLogout = () => {
      setDocument(null);
      setMessages([]);
      setError(null);
      setLoading(false);
      setIsSending(false);
      setIsSummarizing(false);
      setLastFailedQuestion(null);
    };

    window.addEventListener('documind_logout', handleLogout);
    return () => window.removeEventListener('documind_logout', handleLogout);
  }, []);

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
        setLastFailedQuestion(null);
      }
    } catch (err) {
      console.error('[useChat] Send message failed:', err);
      setError(formatUserFriendlyError(err.response?.data?.error || err.message || 'Failed to get AI response.'));
      setLastFailedQuestion(content.trim());
      // Remove temp message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setIsSending(false);
    }
  };

  const handleClearChat = async () => {
    if (!documentId) return;
    setError(null);
    try {
      await clearMessagesApi(documentId);
      setMessages([]);
      setLastFailedQuestion(null);
    } catch (err) {
      console.error('[useChat] Clear chat failed:', err);
      setError(formatUserFriendlyError(err.response?.data?.error || 'Failed to clear chat history.'));
    }
  };

  const handleRetryLast = async () => {
    if (lastFailedQuestion) {
      await handleSendMessage(lastFailedQuestion);
    } else if (messages.length > 0) {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
      if (lastUserMsg) {
        await handleSendMessage(lastUserMsg.content);
      }
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
    lastFailedQuestion,
    error,
    reloadWorkspace: loadData,
    sendMessage: handleSendMessage,
    clearChat: handleClearChat,
    retryLastQuestion: handleRetryLast,
    generateSummary: handleGenerateSummary,
    clearChatState: () => {
      setDocument(null);
      setMessages([]);
      setError(null);
      setLastFailedQuestion(null);
    },
    clearError: () => setError(null),
  };
}
