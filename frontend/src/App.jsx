import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import DocumentWorkspace from './pages/DocumentWorkspace.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ErrorBanner from './components/ErrorBanner.jsx';
import LoadingSpinner from './components/LoadingSpinner.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { useDocuments } from './hooks/useDocuments.js';
import { useChat } from './hooks/useChat.js';

function AppContent() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [activePage, setActivePage] = useState('dashboard'); // 'dashboard' | 'workspace' | 'login' | 'register'
  const [selectedDocId, setSelectedDocId] = useState(null);

  // Sync page state when auth status changes
  useEffect(() => {
    if (!authLoading) {
      if (isAuthenticated) {
        if (activePage === 'login' || activePage === 'register') {
          setActivePage('dashboard');
        }
      } else {
        if (activePage !== 'register') {
          setActivePage('login');
        }
      }
    }
  }, [isAuthenticated, authLoading]);

  // Custom Hooks (only load documents if authenticated)
  const {
    documents,
    loading: docsLoading,
    isUploading,
    error: docsError,
    uploadDocument,
    deleteDocument,
    clearError: clearDocsError,
  } = useDocuments();

  const {
    document: activeDocument,
    messages,
    loading: workspaceLoading,
    isSending,
    isSummarizing,
    error: chatError,
    sendMessage,
    generateSummary,
    clearError: clearChatError,
  } = useChat(selectedDocId);

  const handleSelectDocument = (doc) => {
    const id = doc.id || doc._id;
    setSelectedDocId(id);
    setActivePage('workspace');
  };

  const handleBackToDashboard = () => {
    setActivePage('dashboard');
    setSelectedDocId(null);
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner size="lg" label="Restoring authenticated session..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar activePage={activePage} onNavigate={setActivePage} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ErrorBanner
          message={activeError}
          onClose={() => {
            clearDocsError();
            clearChatError();
          }}
        />

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
            onBack={handleBackToDashboard}
            onSendMessage={sendMessage}
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
