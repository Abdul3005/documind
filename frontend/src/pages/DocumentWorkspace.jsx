import React, { useState } from 'react';
import DocumentPreviewPanel from '../components/DocumentPreviewPanel.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import { ArrowLeft, FileText, Image, Trash2, CheckCircle2 } from 'lucide-react';

export default function DocumentWorkspace({
  document,
  messages = [],
  onBack,
  onSendMessage,
  onGenerateSummary,
  onDeleteDocument,
  isChatLoading = false,
  isSummarizing = false,
}) {
  // Mock document fallback for UI shell standalone rendering
  const activeDoc = document || {
    id: 'mock-1',
    filename: 'DocuMind_Employment_Agreement.pdf',
    fileType: 'pdf',
    status: 'ready',
    extractedText:
      'DocuMind Employment Offer Letter\nThis employment offer is extended to Abdul Rehman for the role of Principal AI Engineer at DocuMind Systems. The agreed base salary for this position is $140,000 USD per annum, payable semi-monthly. The start date is set for September 1, 2026.',
    summary:
      '### Employment Offer Summary\n- **Candidate:** Abdul Rehman\n- **Role:** Principal AI Engineer\n- **Salary:** $140,000 USD per annum\n- **Start Date:** September 1, 2026',
    createdAt: new Date().toISOString(),
  };

  const sampleMessages = messages.length > 0 ? messages : [
    {
      id: 'm-1',
      role: 'user',
      content: 'What is the base salary for this position?',
      createdAt: new Date(Date.now() - 60000).toISOString(),
    },
    {
      id: 'm-2',
      role: 'assistant',
      content: 'Based on the provided document, the base salary for this position is **$140,000 USD per annum**.',
      createdAt: new Date().toISOString(),
    },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] space-y-4">
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
              {activeDoc.fileType === 'pdf' ? <FileText className="w-5 h-5" /> : <Image className="w-5 h-5 text-emerald-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 truncate max-w-md">{activeDoc.filename}</h2>
              <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                <span className="uppercase font-medium">{activeDoc.fileType}</span>
                <span>•</span>
                <span className="flex items-center space-x-1 text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Ready</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {onDeleteDocument && (
          <button
            onClick={() => onDeleteDocument(activeDoc.id || activeDoc._id)}
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
            document={activeDoc}
            onGenerateSummary={onGenerateSummary}
            isSummarizing={isSummarizing}
          />
        </div>

        {/* Right Column: AI Chat Assistant Panel */}
        <div className="h-full min-h-0">
          <ChatWindow
            messages={sampleMessages}
            onSendMessage={onSendMessage}
            isLoading={isChatLoading}
          />
        </div>
      </div>
    </div>
  );
}
