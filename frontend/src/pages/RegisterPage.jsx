import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { FileText, UserPlus, Lock, Mail, User, ArrowRight, AlertCircle } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

export default function RegisterPage({ onSwitchToLogin }) {
  const { register, error: authError, clearError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (!name.trim() || !email.trim() || !password.trim()) {
      setLocalError('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await register({ name, email, password });
    } catch (err) {
      setLocalError(err.message || 'Registration failed.');
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
            Create Your Account
          </h2>
          <p className="text-xs text-slate-300/90 font-medium">
            Get started with isolated per-user document intelligence and AI chat
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
            <label className="block text-xs font-medium text-slate-300/90 mb-1.5">Full Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Abdul Rehman"
                className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 text-slate-100 placeholder-slate-400 font-medium rounded-xl text-sm transition-all duration-200"
              />
            </div>
          </div>

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
                placeholder="At least 6 characters"
                className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 text-slate-100 placeholder-slate-400 font-medium rounded-xl text-sm transition-all duration-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300/90 mb-1.5">Confirm Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
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
                <UserPlus className="w-4 h-4" />
                <span>Create Account</span>
              </>
            )}
          </button>
        </form>

        {/* Footer switch */}
        <div className="pt-4 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-300/90 font-medium">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center space-x-1 transition"
            >
              <span>Sign In</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
