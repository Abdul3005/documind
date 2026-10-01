import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { User, Bot, Copy, Check } from 'lucide-react';
import CitationBadge from './CitationBadge.jsx';

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex items-start space-x-3 my-4 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
      <div
        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 shadow-soft-xs transition-transform duration-200 ${
          isUser
            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
            : 'bg-slate-900/90 text-emerald-400 border border-slate-800 shadow-soft-xs'
        }`}
      >
        {isUser ? <User className="w-4 h-4 sm:w-4.5 sm:h-4.5" /> : <Bot className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-400" />}
      </div>

      <div className={`group relative max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed transition-all duration-200 ${
        isUser
          ? 'bg-gradient-to-br from-emerald-950/80 to-slate-900/90 border border-emerald-500/30 text-slate-100 shadow-lg shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] rounded-tr-none backdrop-blur-md'
          : 'border-l-4 border-l-emerald-500 bg-slate-900/40 backdrop-blur-md border-t border-r border-b border-white/10 rounded-tl-none text-slate-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] shadow-elevation-1'
      }`}>
        <div className="markdown-body">
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ReactMarkdown>{message.content}</ReactMarkdown>
          )}
        </div>

        {/* Grounded RAG Citation Sources */}
        {!isUser && message.sources && <CitationBadge sources={message.sources} />}

        <div className={`flex items-center justify-between mt-2.5 pt-2 border-t text-[10px] font-medium ${
          isUser ? 'border-emerald-800/40 text-emerald-300/90' : 'border-slate-800/80 text-slate-300/90'
        }`}>
          <span>{message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</span>
          
          <button
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-slate-800/80 hover:text-slate-200 rounded-md active:scale-95 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-emerald-500"
            title="Copy message"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-300/90" />}
          </button>
        </div>
      </div>
    </div>
  );
}
