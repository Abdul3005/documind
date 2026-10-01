import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { FileText, LogIn, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

export default function LoginPage({ onSwitchToRegister }) {
  const { login, error: authError, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (!email.trim() || !password.trim()) {
      setLocalError('Please fill in both email and password.');
      return;
    }

    setLoading(true);
    try {
      await login({ email, password });
    } catch (err) {
      setLocalError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto glass-panel p-8 rounded-3xl hover:border-emerald-500/40 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300 ease-out shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_20px_40px_rgba(0,0,0,0.6)] space-y-6">
        {/* Brand & Header */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <FileText className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-2xl bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent font-bold tracking-tight">
            Welcome Back to DocuMind
          </h2>
          <p className="text-xs text-slate-300/90 font-medium">
            Sign in to access your secure document library and AI assistant
          </p>
        </div>

        {/* Error Alert */}
        {displayError && (
          <div className="flex items-center space-x-2 p-3.5 bg-red-950/60 border border-red-800/50 rounded-xl text-xs text-red-300 shadow-soft-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{displayError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300/90 mb-1.5">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 text-slate-100 placeholder-slate-400 font-medium rounded-xl text-sm transition-all duration-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300/90 mb-1.5">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 text-slate-100 placeholder-slate-400 font-medium rounded-xl text-sm transition-all duration-200"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-semibold shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.45)] hover:-translate-y-1 rounded-xl flex items-center justify-center space-x-2 transition-all duration-300 ease-out active:scale-95 disabled:opacity-50 mt-2"
          >
            {loading ? (
              <LoadingSpinner size="sm" label="" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        {/* Footer switch */}
        <div className="pt-4 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-300/90 font-medium">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center space-x-1 transition"
            >
              <span>Create Account</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
