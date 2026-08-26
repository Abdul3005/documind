import React, { useEffect, useState } from 'react';
import { FileText, Cpu, Database, LayoutDashboard, LogOut, User, LogIn, UserPlus } from 'lucide-react';
import { checkHealth } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar({ activePage = 'dashboard', onNavigate }) {
  const [isOnline, setIsOnline] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    const verifyHealth = async () => {
      try {
        const res = await checkHealth();
        if (res.status === 'ok') {
          setIsOnline(true);
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
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => onNavigate && onNavigate(isAuthenticated ? 'dashboard' : 'login')}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
              DocuMind
            </span>
            <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
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
                    ? 'bg-slate-800 text-indigo-400 border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </button>

              <div className="hidden sm:flex items-center space-x-4 border-l border-slate-800 pl-6">
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <Database className={`w-3.5 h-3.5 ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`} />
                  <span>{isOnline ? 'MongoDB Connected' : 'DB Reconnecting...'}</span>
                </div>

                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <Cpu className={`w-3.5 h-3.5 ${isOnline ? 'text-indigo-400' : 'text-slate-500'}`} />
                  <span>{isOnline ? 'Gemini AI Online' : 'AI Offline'}</span>
                </div>
              </div>

              {/* Authenticated User Badge & Logout */}
              <div className="flex items-center space-x-3 border-l border-slate-800 pl-4 sm:pl-6">
                <div className="hidden md:flex items-center space-x-2 px-3 py-1 bg-indigo-950/60 border border-indigo-800/40 rounded-xl text-xs text-indigo-300">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-semibold">{user?.name || user?.email}</span>
                </div>

                <button
                  onClick={logout}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-red-400 text-xs font-medium rounded-xl border border-slate-800 hover:border-red-900/50 transition"
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
                    ? 'bg-slate-800 text-indigo-400 border border-slate-700'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>

              <button
                onClick={() => onNavigate && onNavigate('register')}
                className="flex items-center space-x-1.5 text-xs font-semibold px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl shadow-lg shadow-indigo-600/20 transition"
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
