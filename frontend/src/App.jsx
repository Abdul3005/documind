import React, { useState } from 'react';
import Navbar from './components/Navbar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import DocumentWorkspace from './pages/DocumentWorkspace.jsx';
import ErrorBanner from './components/ErrorBanner.jsx';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard'); // 'dashboard' | 'workspace'
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSelectDocument = (doc) => {
    setSelectedDocument(doc);
    setActivePage('workspace');
  };

  const handleBackToDashboard = () => {
    setActivePage('dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar activePage={activePage} onNavigate={setActivePage} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ErrorBanner message={errorMessage} onClose={() => setErrorMessage(null)} />

        {activePage === 'dashboard' ? (
          <Dashboard
            onSelectDocument={handleSelectDocument}
            onUpload={(file) => {
              console.log('[UI Shell] Selected file for upload:', file.name);
            }}
          />
        ) : (
          <DocumentWorkspace
            document={selectedDocument}
            onBack={handleBackToDashboard}
            onSendMessage={(msg) => {
              console.log('[UI Shell] Send message:', msg);
            }}
            onGenerateSummary={() => {
              console.log('[UI Shell] Generate summary clicked');
            }}
          />
        )}
      </main>
    </div>
  );
}
