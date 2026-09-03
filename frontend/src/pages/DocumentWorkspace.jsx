import React, { useState } from 'react';
import DocumentPreviewPanel from '../components/DocumentPreviewPanel.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { ArrowLeft, FileText, Image, Trash2, CheckCircle2, Scan, Sparkles } from 'lucide-react';

export default function DocumentWorkspace({
  document,
  messages = [],
  loading = false,
  isSending = false,
  isSummarizing = false,
  onBack,
  onSendMessage,
  onGenerateSummary,
  onDeleteDocument,
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
    <div className="flex flex-col h-[calc(100vh-6rem)] space-y-4">
      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={showConfirm}
        loading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Workspace Header */}
      <div className="flex items-center justify-between px-5 py-3 glass-panel rounded-2xl border border-slate-800 shrink-0">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-800" />

          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
              {document.fileType === 'pdf' ? (
                <FileText className="w-5 h-5" />
              ) : (
                <Image className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-semibold text-slate-100 truncate max-w-md">{document.filename}</h2>
                
                {/* STEP 3 — OCR Method Badge in Workspace */}
                {document.status === 'ready' && (
                  <span
                    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                      isOcr
                        ? 'bg-amber-950/40 text-amber-300 border-amber-800/40'
                        : 'bg-indigo-950/40 text-indigo-300 border-indigo-800/40'
                    }`}
                  >
                    {isOcr ? <Scan className="w-3 h-3 text-amber-400" /> : <Sparkles className="w-3 h-3 text-indigo-400" />}
                    <span>{isOcr ? 'Extracted via OCR' : 'Native Text'}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
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
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-medium rounded-xl border border-red-800/40 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Document</span>
          </button>
        )}
      </div>

      {/* Split Workspace View (50 / 50 Desktop Grid) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        {/* Left Column: Extracted Text & Summary Panel */}
        <div className="h-full min-h-0">
          <DocumentPreviewPanel
            document={document}
            onGenerateSummary={onGenerateSummary}
            isSummarizing={isSummarizing}
          />
        </div>

        {/* Right Column: AI Chat Assistant Panel */}
        <div className="h-full min-h-0">
          <ChatWindow
            messages={messages}
            onSendMessage={onSendMessage}
            isLoading={isSending}
          />
        </div>
      </div>
    </div>
  );
}
