import React, { useState, useEffect } from 'react';
import DocumentPreviewPanel from '../components/DocumentPreviewPanel.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { ArrowLeft, FileText, Image, Trash2, CheckCircle2, Scan, Sparkles, MessageSquare } from 'lucide-react';

export default function DocumentWorkspace({
  document,
  messages = [],
  loading = false,
  isSending = false,
  isSummarizing = false,
  lastFailedQuestion = null,
  userId = null,
  onBack,
  onSendMessage,
  onClearChat,
  onRetryLastQuestion,
  onGenerateSummary,
  onDeleteDocument,
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState('chat'); // 'chat' | 'preview'

  // Reset workspace UI states whenever document or user changes
  useEffect(() => {
    setShowConfirm(false);
    setIsDeleting(false);
    setActiveMobileTab('chat');
  }, [document?.id, document?._id, userId]);

  // Listen for global logout event
  useEffect(() => {
    const handleLogout = () => {
      setShowConfirm(false);
      setIsDeleting(false);
      setActiveMobileTab('chat');
    };

    window.addEventListener('documind_logout', handleLogout);
    return () => window.removeEventListener('documind_logout', handleLogout);
  }, []);

  if (loading || !document) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] glass-panel rounded-2xl border border-slate-800">
        <LoadingSpinner size="lg" label="Loading Document Workspace & AI Chat Memory..." />
      </div>
    );
  }

  const docId = document.id || document._id;
  const isOcr = document.extractionMethod === 'ocr';

  const handleDeleteConfirm = async () => {
    if (!docId || !onDeleteDocument) return;
    setIsDeleting(true);
    try {
      await onDeleteDocument(docId);
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] space-y-3 sm:space-y-4">
      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={showConfirm}
        loading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Workspace Header */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 glass-panel rounded-2xl border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] shadow-soft-sm shrink-0">
        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium rounded-xl border border-slate-700/80 shadow-soft-xs active:scale-95 transition shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-800 hidden sm:block shrink-0" />

          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)] shrink-0">
              {document.fileType === 'pdf' ? (
                <FileText className="w-5 h-5 text-emerald-400" />
              ) : (
                <Image className="w-5 h-5 text-teal-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="text-xs sm:text-sm bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent font-bold tracking-tight truncate max-w-[180px] sm:max-w-md">
                  {document.filename}
                </h2>

                {/* OCR Method Badge in Workspace */}
                {document.status === 'ready' && (
                  <span
                    className={`hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border shrink-0 ${
                      isOcr
                        ? 'bg-amber-950/40 text-amber-300 border-amber-800/40'
                        : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                    }`}
                    title={isOcr ? 'Text extracted using Tesseract OCR Fallback' : 'Native text extracted directly from PDF'}
                  >
                    {isOcr ? <Scan className="w-3 h-3 text-amber-400" /> : <Sparkles className="w-3 h-3 text-emerald-400" />}
                    <span>{isOcr ? 'Extracted via OCR' : 'Native Text'}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2 text-[11px] text-slate-300/90 font-medium mt-0.5">
                <span className="uppercase font-medium">{document.fileType}</span>
                <span>•</span>
                <span className="flex items-center space-x-1 text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  <span className="capitalize">{document.status}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {onDeleteDocument && (
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-950/30 hover:bg-red-950/60 text-red-300 hover:text-red-200 text-xs font-medium rounded-xl border border-red-800/40 hover:border-red-700/60 shadow-soft-xs active:scale-95 transition shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Delete Document</span>
          </button>
        )}
      </div>

      {/* Mobile Tab Switcher (< 1024px) */}
      <div className="flex lg:hidden items-center bg-slate-950/80 border border-slate-800 p-1 rounded-xl text-xs shrink-0 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
        <button
          onClick={() => setActiveMobileTab('chat')}
          className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-lg font-semibold transition ${
            activeMobileTab === 'chat'
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 shadow-sm'
              : 'text-slate-300/90 font-medium hover:text-white'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>AI Chat ({messages.length})</span>
        </button>
        <button
          onClick={() => setActiveMobileTab('preview')}
          className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-lg font-semibold transition ${
            activeMobileTab === 'preview'
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 shadow-sm'
              : 'text-slate-300/90 font-medium hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Document & Summary</span>
        </button>
      </div>

      {/* Workspace Panels: Side-by-side on lg, Switchable on mobile */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        {/* Left Column: Extracted Text & Summary Panel */}
        <div className={`h-full min-h-0 ${activeMobileTab === 'preview' ? 'block' : 'hidden lg:block'}`}>
          <DocumentPreviewPanel
            document={document}
            onGenerateSummary={onGenerateSummary}
            isSummarizing={isSummarizing}
          />
        </div>

        {/* Right Column: AI Chat Assistant Panel */}
        <div className={`h-full min-h-0 ${activeMobileTab === 'chat' ? 'block' : 'hidden lg:block'}`}>
          <ChatWindow
            messages={messages}
            onSendMessage={onSendMessage}
            onClearChat={onClearChat}
            onRetryLastQuestion={onRetryLastQuestion}
            lastFailedQuestion={lastFailedQuestion}
            isLoading={isSending}
          />
        </div>
      </div>
    </div>
  );
}
