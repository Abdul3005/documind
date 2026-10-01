import React, { useEffect, useState } from 'react';
import { FileText, Cpu, Database, LayoutDashboard, LogOut, User, LogIn, UserPlus } from 'lucide-react';
import { checkHealth } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar({ activePage = 'dashboard', onNavigate }) {
  const [isOnline, setIsOnline] = useState(false);
  const [provider, setProvider] = useState('DocuMind AI');
  const { user, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    const verifyHealth = async () => {
      try {
        const res = await checkHealth();
        if (res.status === 'ok') {
          setIsOnline(true);
          if (res.provider) setProvider(res.provider);
        }
      } catch (err) {
        setIsOnline(false);
      }
    };
    verifyHealth();
    const interval = setInterval(verifyHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => onNavigate && onNavigate(isAuthenticated ? 'dashboard' : 'login')}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.15)] group-hover:scale-105 group-hover:border-emerald-500/60 transition-all duration-200">
            <FileText className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <span className="text-lg font-bold bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent tracking-tight">
              DocuMind
            </span>
            <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 shadow-sm">
              AI Assistant
            </span>
          </div>
        </div>

        {/* Navigation & User Actions */}
        <div className="flex items-center space-x-4 sm:space-x-6">
          {isAuthenticated ? (
            <>
              <button
                onClick={() => onNavigate && onNavigate('dashboard')}
                className={`flex items-center space-x-2 text-xs font-medium px-3 py-1.5 rounded-xl transition ${
                  activePage === 'dashboard'
                    ? 'bg-emerald-950/40 text-emerald-300 font-semibold border border-emerald-800/50 shadow-sm'
                    : 'text-slate-300/90 font-medium hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </button>

              <div className="hidden sm:flex items-center space-x-4 border-l border-slate-800/80 pl-6">
                <div className="flex items-center space-x-2 text-xs text-slate-300/90 font-medium">
                  <Database className={`w-3.5 h-3.5 ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`} />
                  <span>{isOnline ? 'MongoDB Connected' : 'DB Reconnecting...'}</span>
                </div>

                <div className="flex items-center space-x-2 text-xs text-slate-300/90 font-medium">
                  <Cpu className={`w-3.5 h-3.5 ${isOnline ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span>{isOnline ? `${provider} Online` : 'AI Connecting...'}</span>
                </div>
              </div>

              {/* Authenticated User Badge & Logout */}
              <div className="flex items-center space-x-3 border-l border-slate-800/80 pl-4 sm:pl-6">
                <div className="hidden md:flex items-center space-x-2 px-3 py-1 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-xs text-emerald-300 shadow-sm font-medium">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-semibold">{user?.name || user?.email}</span>
                </div>

                <button
                  onClick={logout}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-300/90 hover:text-red-400 text-xs font-medium rounded-xl border border-slate-800 hover:border-red-900/50 shadow-soft-xs active:scale-95 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center space-x-3">
              <button
                onClick={() => onNavigate && onNavigate('login')}
                className={`flex items-center space-x-1.5 text-xs font-medium px-3.5 py-2 rounded-xl transition ${
                  activePage === 'login'
                    ? 'bg-emerald-950/40 text-emerald-300 font-semibold border border-emerald-800/50 shadow-sm'
                    : 'text-slate-300/90 font-medium hover:text-white'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>

              <button
                onClick={() => onNavigate && onNavigate('register')}
                className="flex items-center space-x-1.5 text-xs font-semibold px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.45)] hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
