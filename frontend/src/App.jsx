import React, { useState } from 'react';
import Navbar from './components/Navbar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import DocumentWorkspace from './pages/DocumentWorkspace.jsx';
import ErrorBanner from './components/ErrorBanner.jsx';
import { useDocuments } from './hooks/useDocuments.js';
import { useChat } from './hooks/useChat.js';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard'); // 'dashboard' | 'workspace'
  const [selectedDocId, setSelectedDocId] = useState(null);

  // Custom Hooks
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

        {activePage === 'dashboard' ? (
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
