import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, ShieldCheck, CheckCircle2, User, Key, ExternalLink, Database, Sparkles } from 'lucide-react';

export default function UserDashboard() {
  const { user, session } = useAuth();

  const role = String(user?.role || 'user').toLowerCase();
  const isAdmin = role === 'admin';
  const provider = session?.user?.app_metadata?.provider || 'email';

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl p-8 border border-[#e0e0e0] shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#007c89] bg-[#e6f4f5] px-3 py-1 rounded-full">
              Production Workspace
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1d1d1d] mt-3">
              Welcome, {user?.name || user?.email?.split('@')[0]}
            </h1>
            <p className="text-sm text-[#5c5c5c] mt-1">
              Your account is authenticated via Supabase Auth with PostgreSQL Row Level Security protection.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Verified Account
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                isAdmin
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              Role: {role}
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Profile & Security */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl p-6 border border-[#e0e0e0] shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-[#e6f4f5] flex items-center justify-center text-[#007c89]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-[#1d1d1d]">Supabase Profile</h2>
              <p className="text-xs text-[#5c5c5c]">Synchronized from <code className="bg-[#f0efeb] px-1 rounded">public.profiles</code></p>
            </div>
          </div>

          <div className="space-y-3.5 text-sm">
            <div className="flex justify-between py-2 border-b border-[#f0efeb]">
              <span className="text-[#5c5c5c]">Email</span>
              <span className="font-medium text-[#1d1d1d]">{user?.email}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#f0efeb]">
              <span className="text-[#5c5c5c]">Full Name</span>
              <span className="font-medium text-[#1d1d1d]">{user?.name || 'Not specified'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#f0efeb]">
              <span className="text-[#5c5c5c]">Assigned Role</span>
              <span className={`font-semibold uppercase text-xs px-2 py-0.5 rounded ${
                isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {role}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#f0efeb]">
              <span className="text-[#5c5c5c]">Auth Provider</span>
              <span className="font-medium text-[#1d1d1d] uppercase text-xs tracking-wider">
                {provider}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#5c5c5c]">UUID</span>
              <span className="font-mono text-xs text-[#5c5c5c] truncate max-w-[200px]">
                {user?.id}
              </span>
            </div>
          </div>
        </div>

        {/* Security & RLS Policy Card */}
        <div className="bg-white rounded-2xl p-6 border border-[#e0e0e0] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-serif text-xl font-bold text-[#1d1d1d]">Security & RLS Policies</h2>
                <p className="text-xs text-[#5c5c5c]">PostgreSQL server-side enforcement</p>
              </div>
            </div>

            <p className="text-sm text-[#5c5c5c] mb-4 leading-relaxed">
              Your session is verified on every request by PostgreSQL Row Level Security policies. Roles are never trusted from client input.
            </p>

            <div className="p-3.5 rounded-xl border border-[#e0e0e0] bg-[#f9f9f8] space-y-2 mb-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#1d1d1d]">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Active RLS Policies on <code className="bg-white px-1 py-0.5 rounded border border-[#e0e0e0]">profiles</code>:</span>
              </div>
              <ul className="text-xs text-[#5c5c5c] space-y-1 list-disc list-inside pl-1">
                <li><code className="text-[#1d1d1d]">Users can view own profile</code> (auth.uid() = id)</li>
                <li><code className="text-[#1d1d1d]">Admins can view all profiles</code> (role = 'admin')</li>
              </ul>
            </div>
          </div>

          <Link
            to="/auth-center"
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-center bg-[#e6f4f5] text-[#007c89] hover:bg-[#d8eef0] border border-[#007c89]/20 transition-colors"
          >
            View Live JWT Claims & Security Center &rarr;
          </Link>
        </div>
      </div>

      {/* Architecture & Session Security Card */}
      <div className="bg-white rounded-2xl p-6 border border-[#e0e0e0] shadow-sm mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-bold text-[#1d1d1d]">Authentication Engine</h2>
            <p className="text-xs text-[#5c5c5c]">Native Supabase Auth & GoTrue</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-[#5c5c5c]">
          <div className="p-3 bg-[#f9f9f8] rounded-lg border border-[#e5e5e5]">
            <span className="font-bold text-[#1d1d1d] block mb-1">Native 6-Digit Email OTP</span>
            Supabase email templates configured with <code className="bg-white px-1 rounded">{'{{ .Token }}'}</code> deliver single-use 6-digit codes for passwordless sign-in and recovery.
          </div>
          <div className="p-3 bg-[#f9f9f8] rounded-lg border border-[#e5e5e5]">
            <span className="font-bold text-[#1d1d1d] block mb-1">Google & Apple OAuth</span>
            Native OAuth flows with Supabase redirect handling and automatic user provisioning via Postgres triggers.
          </div>
          <div className="p-3 bg-[#f9f9f8] rounded-lg border border-[#e5e5e5]">
            <span className="font-bold text-[#1d1d1d] block mb-1">Auto-Refresh & Storage</span>
            Sessions are validated and refreshed automatically with zero mock data.
          </div>
        </div>
      </div>

      {/* Credit Risk Integration link */}
      <div className="bg-[#f0efeb] rounded-2xl p-6 border border-[#d5d5d5] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-lg font-bold text-[#1d1d1d]">CREA AI Credit Risk Assessment Model</h3>
          <p className="text-xs text-[#5c5c5c] mt-0.5">
            German Credit ML Risk Assessment server running on http://127.0.0.1:5001.
          </p>
        </div>
        <a
          href="http://127.0.0.1:5001"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-full bg-[#007c89] hover:bg-[#006570] text-white transition-colors"
        >
          Launch ML Platform <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
