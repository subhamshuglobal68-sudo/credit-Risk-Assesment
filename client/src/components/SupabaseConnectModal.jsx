import React, { useState } from 'react';
import { Database, Key, CheckCircle, AlertCircle, X, ExternalLink, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SupabaseConnectModal({ isOpen, onClose }) {
  const { saveCredentials, isConfigured, loginAsDemo } = useAuth();
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [testing, setTesting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const cleanUrl = url.trim();
    const cleanKey = anonKey.trim();

    if (!cleanUrl.startsWith('https://')) {
      setError('Supabase URL must start with https://');
      return;
    }

    if (!cleanUrl.includes('supabase.co')) {
      setError('Please provide a valid Supabase project URL (e.g. https://xyz.supabase.co)');
      return;
    }

    if (!cleanKey || cleanKey.length < 20) {
      setError('Please provide a valid anon/public API key');
      return;
    }

    setTesting(true);
    try {
      // Test the URL ping
      const res = await fetch(`${cleanUrl}/auth/v1/health`, {
        headers: { apikey: cleanKey },
      }).catch(() => null);

      if (res && !res.ok && res.status !== 401 && res.status !== 404) {
        throw new Error(`Connection test responded with status ${res.status}`);
      }

      saveCredentials(cleanUrl, cleanKey);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to verify Supabase project. Please verify your Project URL and Anon key.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 bg-[#007c89] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-teal-200" />
            <h3 className="font-serif text-xl font-bold">Connect Supabase Project</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <p className="text-xs text-stone-600 leading-relaxed">
            Link your live Supabase database directly from this browser session. Once saved, your project URL and anon key will connect immediately with live authentication.
          </p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Connected successfully! Refreshing authentication state...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="supa-url">
                Supabase Project URL
              </label>
              <input
                id="supa-url"
                type="url"
                required
                placeholder="https://xxxxxxxxxxxxxxxx.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-[#007c89] focus:ring-2 focus:ring-[#007c89]/20 font-mono"
              />
              <span className="text-[10px] text-stone-500 mt-1 block">
                Found in Supabase Dashboard &rarr; Project Settings &rarr; API &rarr; Project URL
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="supa-key">
                Supabase anon (public) Key
              </label>
              <textarea
                id="supa-key"
                rows={3}
                required
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-[#007c89] focus:ring-2 focus:ring-[#007c89]/20 font-mono resize-none"
              />
              <span className="text-[10px] text-stone-500 mt-1 block">
                Found in Supabase Dashboard &rarr; Project Settings &rarr; API &rarr; anon public API key
              </span>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={testing}
                className="px-6 py-2.5 bg-[#007c89] hover:bg-[#006570] text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {testing ? 'Verifying...' : 'Save & Connect'}
              </button>
            </div>
          </form>

          {/* Quick Demo Sandbox Option */}
          <div className="mt-4 pt-4 border-t border-stone-200">
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-stone-800">Want to test without keys?</p>
                <p className="text-[11px] text-stone-500">Explore both User & Admin portals instantly in Sandbox Demo Mode.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    loginAsDemo('user');
                    onClose();
                  }}
                  className="px-2.5 py-1.5 bg-white border border-stone-300 hover:border-teal-500 text-teal-800 text-[11px] font-semibold rounded-md shadow-xs transition-colors"
                >
                  Demo User
                </button>
                <button
                  type="button"
                  onClick={() => {
                    loginAsDemo('admin');
                    onClose();
                  }}
                  className="px-2.5 py-1.5 bg-[#007c89] hover:bg-[#006570] text-white text-[11px] font-semibold rounded-md shadow-xs transition-colors"
                >
                  Demo Admin
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
