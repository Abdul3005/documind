import React, { useState } from 'react';
import UploadDropzone from '../components/UploadDropzone.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { FileText, Image, ArrowRight, Trash2, Clock, CheckCircle2, AlertCircle, RefreshCw, Scan, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';

const ITEMS_PER_PAGE = 6;

export default function Dashboard({
  documents = [],
  loading = false,
  isUploading = false,
  onUpload,
  onSelectDocument,
  onDeleteDocument,
}) {
  const [deleteDocId, setDeleteDocId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(documents.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedDocuments = documents.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleDeleteConfirm = async () => {
    if (!deleteDocId || !onDeleteDocument) return;
    setIsDeleting(true);
    try {
      await onDeleteDocument(deleteDocId);
    } finally {
      setIsDeleting(false);
      setDeleteDocId(null);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!deleteDocId}
        loading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDocId(null)}
      />

      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 glass-panel rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/90 via-indigo-950/20 to-slate-900/90">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Document Intelligence Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            Upload PDF contracts or image receipts to extract text, chat with AI, and generate summaries.
          </p>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300">
            Total Docs: <span className="font-semibold text-indigo-400">{documents.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300">
            OCR Engine: <span className="font-semibold text-emerald-400">PDF + Tesseract</span>
          </div>
        </div>
      </div>

      {/* Upload Dropzone Section */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          <span>Upload New Document</span>
        </h2>
        <UploadDropzone onUpload={onUpload} isUploading={isUploading} />
      </div>

      {/* Document Library Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-200">Document Library</h2>
          <span className="text-xs text-slate-400">{documents.length} items stored in MongoDB</span>
        </div>

        {loading ? (
          <div className="glass-panel p-12 rounded-2xl border border-slate-800">
            <LoadingSpinner size="lg" label="Loading stored documents from MongoDB..." />
          </div>
        ) : documents.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedDocuments.map((doc) => {
                const docId = doc.id || doc._id;
                const isOcr = doc.extractionMethod === 'ocr';

                return (
                  <div
                    key={docId}
                    className="group relative glass-card p-5 rounded-2xl border border-slate-800 hover:border-indigo-500/50 transition-all hover:shadow-xl hover:shadow-indigo-500/5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-3 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-110 transition">
                          {doc.fileType === 'pdf' ? (
                            <FileText className="w-6 h-6" />
                          ) : (
                            <Image className="w-6 h-6 text-emerald-400" />
                          )}
                        </div>

                        <div className="flex flex-col items-end space-y-1">
                          <span
                            className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                              doc.status === 'ready'
                                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50'
                                : doc.status === 'processing'
                                ? 'bg-amber-950/60 text-amber-400 border-amber-800/50'
                                : 'bg-red-950/60 text-red-400 border-red-800/50'
                            }`}
                          >
                            {doc.status === 'ready' && <CheckCircle2 className="w-3 h-3" />}
                            {doc.status === 'processing' && <RefreshCw className="w-3 h-3 animate-spin" />}
                            {doc.status === 'failed' && <AlertCircle className="w-3 h-3" />}
                            <span className="capitalize">{doc.status}</span>
                          </span>

                          {/* STEP 3 — OCR Extraction Method Indicator */}
                          {doc.status === 'ready' && (
                            <span
                              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                isOcr
                                  ? 'bg-amber-950/40 text-amber-300 border-amber-800/40'
                                  : 'bg-indigo-950/40 text-indigo-300 border-indigo-800/40'
                              }`}
                              title={isOcr ? 'Text extracted using Tesseract OCR Fallback' : 'Native text extracted directly from PDF'}
                            >
                              {isOcr ? <Scan className="w-3 h-3 text-amber-400" /> : <Sparkles className="w-3 h-3 text-indigo-400" />}
                              <span>{isOcr ? 'Extracted via OCR' : 'Native Text'}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="text-sm font-semibold text-slate-100 truncate mb-1" title={doc.filename}>
                        {doc.filename}
                      </h3>

                      <div className="flex items-center space-x-2 text-xs text-slate-400 mb-4">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="uppercase">{doc.fileType}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                      <button
                        onClick={() => onSelectDocument && onSelectDocument(doc)}
                        className="inline-flex items-center space-x-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition"
                      >
                        <span>Open Workspace</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      {onDeleteDocument && (
                        <button
                          onClick={() => setDeleteDocId(docId)}
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition"
                          title="Delete Document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
                <span>
                  Showing Page <span className="font-semibold text-slate-200">{currentPage}</span> of{' '}
                  <span className="font-semibold text-slate-200">{totalPages}</span>
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
