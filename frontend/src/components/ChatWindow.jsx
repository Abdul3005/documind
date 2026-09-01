import React, { useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage.jsx';
import ChatInput from './ChatInput.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';
import { MessageSquare, Bot } from 'lucide-react';

export default function ChatWindow({ messages = [], onSendMessage, isLoading = false }) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-slate-900/80 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">AI Document Assistant</h3>
            <p className="text-xs text-slate-400">Ask questions grounded in document text</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 px-2.5 py-1 bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 rounded-full text-[11px] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>Local AI Online</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-2 bg-slate-950/40">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-500">
            <Bot className="w-12 h-12 mb-3 text-indigo-400/50" />
            <p className="text-sm font-medium text-slate-300 mb-1">No conversation history yet</p>
            <p className="text-xs max-w-xs">Ask a question below to start chatting with your document using AI.</p>
          </div>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id || msg._id || Math.random()} message={msg} />)
        )}

        {isLoading && (
          <div className="flex items-center space-x-2 p-3 text-indigo-400 text-xs bg-slate-900/60 border border-slate-800 rounded-xl w-max">
            <LoadingSpinner size="sm" label="" />
            <span>DocuMind is thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSendMessage={onSendMessage} disabled={isLoading} />
    </div>
  );
}
