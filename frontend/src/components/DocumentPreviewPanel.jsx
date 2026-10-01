import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { FileText, Sparkles, Copy, Check, Eye, ListFilter } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner.jsx';

export default function DocumentPreviewPanel({ document, onGenerateSummary, isSummarizing = false }) {
  const [activeTab, setActiveTab] = useState('text'); // 'text' | 'summary'
  const [copied, setCopied] = useState(false);

  if (!document) return null;

  const handleCopyText = () => {
    navigator.clipboard.writeText(document.extractedText || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] shadow-elevation-2">
      {/* Header Tabs */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/60 backdrop-blur-md border-b border-slate-800/80 shrink-0">
        <div className="flex items-center space-x-1.5 p-0.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
          <button
            onClick={() => setActiveTab('text')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
              activeTab === 'text'
                ? 'bg-emerald-950/60 text-emerald-300 font-semibold border border-emerald-800/60 shadow-sm'
                : 'text-slate-300/90 font-medium hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Extracted Text</span>
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
              activeTab === 'summary'
                ? 'bg-emerald-950/60 text-emerald-300 font-semibold border border-emerald-800/60 shadow-sm'
                : 'text-slate-300/90 font-medium hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Summary</span>
          </button>
        </div>

        {activeTab === 'text' && document.extractedText && (
          <button
            onClick={handleCopyText}
            className="flex items-center space-x-1.5 px-2.5 py-1 bg-slate-800/90 hover:bg-slate-750 text-slate-300 hover:text-white text-xs rounded-lg transition-all border border-slate-700/70 active:scale-95 shadow-soft-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 p-5 overflow-y-auto bg-slate-950/40">
        {activeTab === 'text' ? (
          <div>
            <div className="flex items-center justify-between mb-3 text-xs text-slate-300/90 font-medium pb-2 border-b border-slate-800/80">
              <span className="font-medium text-slate-200">Document Content ({document.fileType?.toUpperCase()})</span>
              <span>{document.extractedText ? `${document.extractedText.length} characters` : '0 characters'}</span>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm text-slate-200 leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] shadow-soft-xs">
              {document.extractedText || 'No text extracted yet.'}
            </pre>
          </div>
        ) : (
          <div>
            {document.summary ? (
              <div className="prose prose-invert prose-sm max-w-none bg-slate-900/60 p-5 rounded-xl border border-slate-800/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] shadow-soft-xs">
                <ReactMarkdown>{document.summary}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 mb-3 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                  <Sparkles className="w-6 h-6 animate-pulse text-emerald-400" />
                </div>
                <h4 className="text-sm bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent font-bold tracking-tight mb-1">Generate AI Document Summary</h4>
                <p className="text-xs text-slate-300/90 font-medium max-w-xs mb-4">Get a structured overview of the key facts, bullet points, and main takeaways.</p>
                
                <button
                  onClick={onGenerateSummary}
                  disabled={isSummarizing}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 text-xs font-semibold rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.45)] hover:-translate-y-1 transition-all duration-300 ease-out active:scale-95 disabled:opacity-50"
                >
                  {isSummarizing ? <LoadingSpinner size="sm" label="" /> : <Sparkles className="w-4 h-4 text-slate-950" />}
                  <span>{isSummarizing ? 'Generating...' : 'Generate Summary'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
