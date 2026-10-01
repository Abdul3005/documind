import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import DocumentWorkspace from './pages/DocumentWorkspace.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import Toast from './components/Toast.jsx';
import LoadingSpinner from './components/LoadingSpinner.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { useDocuments } from './hooks/useDocuments.js';
import { useChat } from './hooks/useChat.js';

const safeGetSavedSession = () => {
  try {
    if (typeof window === 'undefined') return { docId: null, page: 'dashboard' };

    // 1. Check URL parameters (?doc=... or ?documentId=... or ?chatId=...)
    const params = new URLSearchParams(window.location.search);
    const paramDocId = params.get('doc') || params.get('documentId') || params.get('chatId');
    if (paramDocId) {
      return { docId: paramDocId, page: 'workspace' };
    }

    // 2. Check localStorage
    if (window.localStorage) {
      const savedDocId = localStorage.getItem('documind_active_doc_id') || localStorage.getItem('documind_active_chat_id');
      if (savedDocId) {
        return { docId: savedDocId, page: 'workspace' };
      }
    }
  } catch (e) {}
  return { docId: null, page: 'dashboard' };
};

const safeSaveSession = (docId) => {
  try {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (docId) {
        if (window.localStorage) {
          localStorage.setItem('documind_active_doc_id', docId);
          localStorage.setItem('documind_active_chat_id', docId);
        }
        url.searchParams.set('doc', docId);
      } else {
        if (window.localStorage) {
          localStorage.removeItem('documind_active_doc_id');
          localStorage.removeItem('documind_active_chat_id');
        }
        url.searchParams.delete('doc');
        url.searchParams.delete('documentId');
        url.searchParams.delete('chatId');
      }
      window.history.replaceState({}, '', url.pathname + (docId ? url.search : ''));
    }
  } catch (e) {}
};

function AppContent() {
  const { user, isAuthenticated, loading: authLoading, purgeDocumentState } = useAuth();
  const userId = user?.id || user?._id || null;
  const prevUserIdRef = useRef(userId);

  const savedSession = safeGetSavedSession();
  const [selectedDocId, setSelectedDocId] = useState(savedSession.docId);
  const [activePage, setActivePage] = useState(() => (savedSession.docId ? 'workspace' : 'dashboard'));

  // Reset all cached document state and navigation whenever userId changes or on logout
  useEffect(() => {
    if (prevUserIdRef.current !== userId) {
      setSelectedDocId(null);
      safeSaveSession(null);
      if (purgeDocumentState) {
        purgeDocumentState();
      }
      if (!isAuthenticated) {
        if (activePage !== 'register') {
          setActivePage('login');
        }
      } else {
        // Fresh login: always open dashboard cleanly
        setActivePage('dashboard');
      }
      prevUserIdRef.current = userId;
    }
  }, [userId, isAuthenticated, purgeDocumentState, activePage]);

  // Sync page state when auth status changes
  useEffect(() => {
    if (!authLoading) {
      if (isAuthenticated) {
        if (activePage === 'login' || activePage === 'register') {
          setActivePage(selectedDocId ? 'workspace' : 'dashboard');
        }
      } else {
        if (activePage !== 'register') {
          setActivePage('login');
        }
      }
    }
  }, [isAuthenticated, authLoading, selectedDocId]);

  // Custom Hooks (only load documents if authenticated, scoped to userId)
  const {
    documents,
    loading: docsLoading,
    isUploading,
    uploadProgress,
    uploadStage,
    error: docsError,
    uploadDocument,
    deleteDocument,
    clearDocuments,
    clearError: clearDocsError,
  } = useDocuments(isAuthenticated, userId);

  const {
    document: activeDocument,
    messages,
    loading: workspaceLoading,
    isSending,
    isSummarizing,
    lastFailedQuestion,
    error: chatError,
    sendMessage,
    clearChat,
    retryLastQuestion,
    generateSummary,
    clearChatState,
    clearError: clearChatError,
  } = useChat(selectedDocId, userId);

  const handleSelectDocument = (doc) => {
    const id = doc.id || doc._id;
    setSelectedDocId(id);
    safeSaveSession(id);
    setActivePage('workspace');
  };

  const handleBackToDashboard = () => {
    setActivePage('dashboard');
    setSelectedDocId(null);
    safeSaveSession(null);
    if (clearChatState) clearChatState();
  };

  const handleUpload = async (file) => {
    try {
      const uploadedDoc = await uploadDocument(file);
      if (uploadedDoc) {
        handleSelectDocument(uploadedDoc);
      }
    } catch (err) {
      // Error handled by useDocuments hook
    }
  };

  const handleDeleteDocument = async (id) => {
    await deleteDocument(id);
    if (selectedDocId === id) {
      handleBackToDashboard();
    }
  };

  const activeError = docsError || chatError;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <LoadingSpinner size="lg" label="Restoring authenticated session..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-slate-100 flex flex-col selection:bg-emerald-950 selection:text-emerald-200 font-sans">
      {/* Top Navbar */}
      <Navbar activePage={activePage} onNavigate={setActivePage} />

      {/* Floating Non-Intrusive Toast Notification */}
      <Toast
        message={activeError}
        type="error"
        onClose={() => {
          clearDocsError();
          clearChatError();
        }}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!isAuthenticated ? (
          activePage === 'register' ? (
            <RegisterPage onSwitchToLogin={() => setActivePage('login')} />
          ) : (
            <LoginPage onSwitchToRegister={() => setActivePage('register')} />
          )
        ) : activePage === 'dashboard' ? (
          <Dashboard
            documents={documents}
            loading={docsLoading}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            uploadStage={uploadStage}
            userId={userId}
            onSelectDocument={handleSelectDocument}
            onUpload={handleUpload}
            onDeleteDocument={handleDeleteDocument}
          />
        ) : (
          <DocumentWorkspace
            document={activeDocument}
            messages={messages}
            loading={workspaceLoading}
            isSending={isSending}
            isSummarizing={isSummarizing}
            lastFailedQuestion={lastFailedQuestion}
            userId={userId}
            onBack={handleBackToDashboard}
            onSendMessage={sendMessage}
            onClearChat={clearChat}
            onRetryLastQuestion={retryLastQuestion}
            onGenerateSummary={generateSummary}
            onDeleteDocument={handleDeleteDocument}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
