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
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
          isUser
            ? 'bg-gradient-to-tr from-indigo-600 to-violet-500 text-white'
            : 'bg-gradient-to-tr from-slate-800 to-slate-700 text-indigo-400 border border-slate-700'
        }`}
      >
        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </div>

      <div className={`group relative max-w-[85%] rounded-2xl p-4 text-sm shadow-lg leading-relaxed ${
        isUser
          ? 'bg-indigo-600 text-white rounded-tr-none'
          : 'bg-slate-900/90 text-slate-200 border border-slate-800 rounded-tl-none backdrop-blur-md'
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

        <div className={`flex items-center justify-between mt-2 pt-2 border-t text-[10px] ${
          isUser ? 'border-indigo-500/40 text-indigo-200' : 'border-slate-800 text-slate-500'
        }`}>
          <span>{message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</span>
          
          <button
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 transition p-1 hover:text-white rounded"
            title="Copy message"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </div>
  );
}
