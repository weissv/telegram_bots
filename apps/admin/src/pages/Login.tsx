import React, { useState } from 'react';
import { apiRequest, setAuthToken } from '../api/client.js';
import { Bot, Lock, Mail, ArrowRight, Store } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('demo_merchant@telegram-commerce.local');
  const [password, setPassword] = useState('password123');
  const [storeName, setStoreName] = useState('Apex Streetwear');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = isRegister ? '/api/v1/admin/auth/register' : '/api/v1/admin/auth/login';
      const payload = isRegister ? { email, password, storeName } : { email, password };

      const data = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (data.token) {
        setAuthToken(data.token);
        onLoginSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-sky-500/10">
            <Bot className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">
            {isRegister ? 'Create Merchant Account' : 'Merchant Backoffice'}
          </h1>
          <p className="text-sm text-slate-400">
            {isRegister
              ? 'Launch your automated Telegram e-commerce store'
              : 'Sign in to manage catalog, orders, and bot configuration'}
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="text-xs font-semibold text-slate-300">Store / Brand Name</label>
              <div className="relative mt-1">
                <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Apex Streetwear"
                  className="w-full h-11 pl-10 pr-3 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-300">Email Address</label>
            <div className="relative mt-1">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="merchant@example.com"
                className="w-full h-11 pl-10 pr-3 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Password</label>
            <div className="relative mt-1">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 pl-10 pr-3 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 active:scale-[0.98] transition-all"
          >
            {isLoading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>{isRegister ? 'Register & Launch' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="text-xs text-slate-400 hover:text-sky-400 transition-colors"
          >
            {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register new store"}
          </button>
        </div>
      </div>
    </div>
  );
}
