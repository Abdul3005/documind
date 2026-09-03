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
    <div className="flex flex-col h-full glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Header Tabs */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/80 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('text')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              activeTab === 'text'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Extracted Text</span>
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              activeTab === 'summary'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Summary</span>
          </button>
        </div>

        {activeTab === 'text' && document.extractedText && (
          <button
            onClick={handleCopyText}
            className="flex items-center space-x-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition border border-slate-700"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 p-5 overflow-y-auto bg-slate-950/40">
        {activeTab === 'text' ? (
          <div>
            <div className="flex items-center justify-between mb-3 text-xs text-slate-400 pb-2 border-b border-slate-800/80">
              <span className="font-medium text-slate-300">Document Content ({document.fileType?.toUpperCase()})</span>
              <span>{document.extractedText ? `${document.extractedText.length} characters` : '0 characters'}</span>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm text-slate-200 leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
              {document.extractedText || 'No text extracted yet.'}
            </pre>
          </div>
        ) : (
          <div>
            {document.summary ? (
              <div className="prose prose-invert prose-sm max-w-none bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                <ReactMarkdown>{document.summary}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-900/40 rounded-xl border border-dashed border-slate-800">
                <Sparkles className="w-10 h-10 mb-3 text-indigo-400 animate-pulse" />
                <h4 className="text-sm font-semibold text-slate-200 mb-1">Generate AI Document Summary</h4>
                <p className="text-xs text-slate-400 max-w-xs mb-4">Get a structured overview of the key facts, bullet points, and main takeaways.</p>
                
                <button
                  onClick={onGenerateSummary}
                  disabled={isSummarizing}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                >
                  {isSummarizing ? <LoadingSpinner size="sm" label="" /> : <Sparkles className="w-4 h-4" />}
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
