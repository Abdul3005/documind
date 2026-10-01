import React, { useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage.jsx';
import ChatInput from './ChatInput.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';
import { MessageSquare, Bot, Trash2, RotateCcw, Sparkles, AlertCircle } from 'lucide-react';

const STARTER_PROMPTS = [
  'Summarize key points and obligations',
  'List all numbers, dates & financial figures',
  'What are the main findings or conclusions?',
  'Are there any risks, warnings, or penalties?',
];

export default function ChatWindow({
  messages = [],
  onSendMessage,
  onClearChat,
  onRetryLastQuestion,
  lastFailedQuestion = null,
  isLoading = false,
}) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, lastFailedQuestion]);

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] shadow-elevation-2">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/60 backdrop-blur-md border-b border-slate-800/80 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <MessageSquare className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent font-bold tracking-tight">AI Document Assistant</h3>
            <p className="text-xs text-slate-300/90 font-medium">Ask questions grounded in document text</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {messages.length > 0 && onClearChat && (
            <button
              onClick={onClearChat}
              disabled={isLoading}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-slate-300/90 font-medium hover:text-red-400 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-xl transition-all duration-150 disabled:opacity-40 active:scale-95 focus-visible:ring-1 focus-visible:ring-red-500/50"
              title="Clear conversation history"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear Chat</span>
            </button>
          )}

          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 rounded-full text-[11px] font-medium shadow-[0_0_10px_rgba(16,185,129,0.2)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>AI Ready</span>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-950/40">
        {messages.length === 0 ? (
          /* Empty Chat State with Starter Prompt Chips */
          <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-5">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <Bot className="w-9 h-9" />
            </div>

            <div>
              <p className="text-base bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent font-bold tracking-tight">Start Exploring Your Document</p>
              <p className="text-xs text-slate-300/90 font-medium max-w-sm mt-1">
                Ask specific questions or select an interactive starter prompt below to analyze this document with AI.
              </p>
            </div>

            {/* Clickable Starter Prompt Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md pt-2">
              {STARTER_PROMPTS.map((promptText, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage && onSendMessage(promptText)}
                  disabled={isLoading}
                  className="flex items-center space-x-2.5 p-3 bg-slate-900/70 hover:bg-emerald-950/30 border border-slate-800/90 hover:border-emerald-500/40 rounded-xl text-left text-xs text-slate-300/90 hover:text-emerald-200 transition-all duration-300 ease-out shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/10 group disabled:opacity-50 active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition shrink-0" />
                  <span className="line-clamp-2 font-medium">{promptText}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id || msg._id || Math.random()} message={msg} />)
        )}

        {/* Loading Spinner Indicator */}
        {isLoading && (
          <div className="flex items-center space-x-2 p-3 text-emerald-300 text-xs bg-emerald-950/40 border border-emerald-800/50 rounded-xl w-max shadow-sm">
            <LoadingSpinner size="sm" label="" />
            <span>DocuMind is retrieving document context & generating grounded answer...</span>
          </div>
        )}

        {/* Inline Failed Question Retry Banner */}
        {lastFailedQuestion && !isLoading && (
          <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl flex items-center justify-between text-xs text-red-200 shadow-soft-xs">
            <div className="flex items-center space-x-2 mr-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>Failed to send: "{lastFailedQuestion}"</span>
            </div>
            {onRetryLastQuestion && (
              <button
                onClick={onRetryLastQuestion}
                className="flex items-center space-x-1 px-2.5 py-1 bg-red-900/80 hover:bg-red-800 text-white rounded-lg transition-all text-[11px] font-medium shrink-0 active:scale-95"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSendMessage={onSendMessage} disabled={isLoading} />
    </div>
  );
}
