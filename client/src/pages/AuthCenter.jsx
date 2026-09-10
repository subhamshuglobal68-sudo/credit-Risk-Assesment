import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import {
  ShieldCheck,
  ShieldAlert,
  User,
  Key,
  Mail,
  RefreshCw,
  Users,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  UserPlus,
  Lock,
  AlertCircle,
  X,
  Sparkles,
  Database,
  Code
} from 'lucide-react';

export default function AuthCenter() {
  const { user, session, profile, resetPassword, inviteOrPromoteAdmin, fetchProfile, isConfigured } = useAuth();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'tokens' | 'admin' | 'password' | 'setup'
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedUserId, setCopiedUserId] = useState(false);

  // Admin users state
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminMetrics, setAdminMetrics] = useState({ totalUsers: 0, adminCount: 0, userCount: 0 });
  const [loadingAdminUsers, setLoadingAdminUsers] = useState(false);
  const [isCreateAdminOpen, setIsCreateAdminOpen] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [adminActionType, setAdminActionType] = useState('promote');
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [createAdminError, setCreateAdminError] = useState(null);
  const [createAdminSuccess, setCreateAdminSuccess] = useState(null);

  // Password reset state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState(null);

  const role = String(user?.role || 'user').toLowerCase();
  const isAdmin = role === 'admin';

  // Decode JWT payload for inspection
  const parseJwt = (token) => {
    try {
      if (!token) return null;
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  };

  const jwtClaims = session?.access_token ? parseJwt(session.access_token) : null;

  // Load user directory for admins
  const loadAdminDirectory = async () => {
    if (!isAdmin || !isSupabaseConfigured) return;
    setLoadingAdminUsers(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const list = data || [];
      setAdminUsers(list);
      const admins = list.filter((u) => String(u.role).toLowerCase() === 'admin').length;
      setAdminMetrics({
        totalUsers: list.length,
        adminCount: admins,
        userCount: list.length - admins,
      });
    } catch (err) {
      console.warn('Failed to load admin directory:', err.message);
    } finally {
      setLoadingAdminUsers(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadAdminDirectory();
    }
  }, [isAdmin]);

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'token') {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else if (type === 'userId') {
      setCopiedUserId(true);
      setTimeout(() => setCopiedUserId(false), 2000);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setPasswordNotice(null);

    if (newPassword.length < 8) {
      setPasswordNotice({ type: 'error', message: 'Password must be at least 8 characters.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordNotice({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    setUpdatingPassword(true);
    try {
      await resetPassword(newPassword);
      setPasswordNotice({ type: 'success', message: 'Password updated successfully in Supabase Auth.' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordNotice({ type: 'error', message: err.message || 'Failed to update password.' });
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setCreateAdminError(null);
    setCreateAdminSuccess(null);
    setCreatingAdmin(true);

    try {
      const res = await inviteOrPromoteAdmin({
        email: newAdminEmail,
        fullName: newAdminName,
        action: adminActionType,
      });
      setCreateAdminSuccess(res.message || 'Admin action completed!');
      setNewAdminEmail('');
      setNewAdminName('');
      loadAdminDirectory();
      setTimeout(() => {
        setIsCreateAdminOpen(false);
        setCreateAdminSuccess(null);
      }, 1500);
    } catch (err) {
      setCreateAdminError(err.message || 'Action failed.');
    } finally {
      setCreatingAdmin(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-8 border border-[#e0e0e0] shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#e6f4f5] flex items-center justify-center text-[#007c89] shadow-sm">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#007c89] bg-[#e6f4f5] px-3 py-1 rounded-full border border-[#007c89]/20">
                  Supabase Auth Engine
                </span>
                <span
                  className={`text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full border ${
                    isAdmin
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  Role: {role}
                </span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1d1d1d] mt-2">
                Auth & Security Center
              </h1>
              <p className="text-sm text-[#5c5c5c] mt-0.5">
                Inspect live Supabase sessions, JWT claims, PostgreSQL Row Level Security policies, and administrative roles.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (user?.id) fetchProfile(user.id);
                if (isAdmin) loadAdminDirectory();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#d5d5d5] text-xs font-semibold text-[#5c5c5c] hover:text-[#1d1d1d] hover:bg-[#f9f9f8] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync Session
            </button>
          </div>
        </div>
      </div>

      {!isConfigured && (
        <div className="mb-8 p-5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-sm">Supabase Credentials Not Yet Configured in client/.env</p>
            <p>
              To execute live queries and real OTP emails against your Supabase project, set <code className="bg-white px-1 py-0.5 rounded border border-amber-300">VITE_SUPABASE_URL</code> and <code className="bg-white px-1 py-0.5 rounded border border-amber-300">VITE_SUPABASE_ANON_KEY</code>.
            </p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-[#e0e0e0] mb-8">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'border-[#007c89] text-[#007c89]'
              : 'border-transparent text-[#5c5c5c] hover:text-[#1d1d1d]'
          }`}
        >
          Identity & Profile
        </button>

        <button
          onClick={() => setActiveTab('tokens')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'tokens'
              ? 'border-[#007c89] text-[#007c89]'
              : 'border-transparent text-[#5c5c5c] hover:text-[#1d1d1d]'
          }`}
        >
          JWT Claims Inspector
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-[#5c5c5c] hover:text-[#1d1d1d]'
            }`}
          >
            Admin Directory (RLS)
          </button>
        )}

        <button
          onClick={() => setActiveTab('password')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'password'
              ? 'border-[#007c89] text-[#007c89]'
              : 'border-transparent text-[#5c5c5c] hover:text-[#1d1d1d]'
          }`}
        >
          Update Password
        </button>

        <button
          onClick={() => setActiveTab('setup')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'setup'
              ? 'border-[#007c89] text-[#007c89]'
              : 'border-transparent text-[#5c5c5c] hover:text-[#1d1d1d]'
          }`}
        >
          Supabase Setup Guide
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Identity Card */}
            <div className="bg-white rounded-2xl p-6 border border-[#e0e0e0] shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[#e6f4f5] flex items-center justify-center text-[#007c89]">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-serif text-xl font-bold text-[#1d1d1d]">Identity Overview</h2>
                  <p className="text-xs text-[#5c5c5c]">Supabase Auth core record</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-[#f0efeb]">
                  <span className="text-[#5c5c5c]">Email</span>
                  <span className="font-medium text-[#1d1d1d]">{user?.email}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#f0efeb]">
                  <span className="text-[#5c5c5c]">Full Name</span>
                  <span className="font-medium text-[#1d1d1d]">{user?.name || 'Not specified'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#f0efeb]">
                  <span className="text-[#5c5c5c]">UUID (auth.users)</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs text-[#5c5c5c] truncate max-w-[150px]">
                      {user?.id}
                    </span>
                    <button
                      onClick={() => handleCopy(user?.id, 'userId')}
                      className="text-[#007c89] hover:text-[#006570] p-1 rounded"
                    >
                      {copiedUserId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between py-2 border-b border-[#f0efeb]">
                  <span className="text-[#5c5c5c]">Role (public.profiles)</span>
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded uppercase tracking-wider ${
                      isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {role}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-[#5c5c5c]">Auth Provider</span>
                  <span className="font-medium text-[#1d1d1d] uppercase text-xs">
                    {session?.user?.app_metadata?.provider || 'email'}
                  </span>
                </div>
              </div>
            </div>

            {/* RLS Status Card */}
            <div className="bg-white rounded-2xl p-6 border border-[#e0e0e0] shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-700">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-serif text-xl font-bold text-[#1d1d1d]">PostgreSQL RLS Enforcement</h2>
                  <p className="text-xs text-[#5c5c5c]">Server-side authorization policies</p>
                </div>
              </div>

              <div className="space-y-4 text-xs text-[#5c5c5c]">
                <div className="p-3 bg-[#f9f9f8] rounded-xl border border-[#e5e5e5] space-y-1">
                  <span className="font-bold text-[#1d1d1d] block">Policy: Users can view own profile</span>
                  <code>USING (auth.uid() = id)</code>
                  <p className="pt-1 text-[#5c5c5c]">
                    Regular users can only select and update their own row. Attempts to query another user's profile return zero rows.
                  </p>
                </div>

                <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 space-y-1">
                  <span className="font-bold text-purple-900 block">Policy: Admins can view all profiles</span>
                  <code>USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))</code>
                  <p className="pt-1 text-purple-800">
                    Administrators possess query access to all user accounts and audit rows across the platform.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TOKENS & JWT */}
      {activeTab === 'tokens' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-[#e0e0e0] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-serif text-xl font-bold text-[#1d1d1d]">Supabase Access Token (JWT)</h2>
                <p className="text-xs text-[#5c5c5c]">Issued by GoTrue and verified by PostgreSQL</p>
              </div>
              {session?.access_token && (
                <button
                  onClick={() => handleCopy(session.access_token, 'token')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#d5d5d5] text-xs font-semibold text-[#5c5c5c] hover:text-[#1d1d1d] hover:bg-[#f9f9f8]"
                >
                  {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedToken ? 'Copied!' : 'Copy JWT'}
                </button>
              )}
            </div>

            {session?.access_token ? (
              <div className="space-y-4">
                <div className="p-4 bg-[#f9f9f8] rounded-xl border border-[#e5e5e5] font-mono text-xs text-[#1d1d1d] break-all max-h-32 overflow-y-auto">
                  {session.access_token}
                </div>

                {jwtClaims && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5c5c5c] mb-2">
                      Decoded Token Claims
                    </h3>
                    <div className="p-4 bg-[#1e1e1e] text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto">
                      <pre>{JSON.stringify(jwtClaims, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-[#5c5c5c] text-sm">
                No active JWT session found. Please sign in.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ADMIN DIRECTORY */}
      {activeTab === 'admin' && isAdmin && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-[#e0e0e0] shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="font-serif text-xl font-bold text-[#1d1d1d]">PostgreSQL User Directory</h2>
                <p className="text-xs text-[#5c5c5c]">Queried via active admin RLS privileges</p>
              </div>

              <button
                onClick={() => setIsCreateAdminOpen(true)}
                className="inline-flex items-center gap-2 bg-[#007c89] hover:bg-[#006570] text-white font-semibold text-xs px-4 py-2 rounded-full transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Invite or Promote Admin
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-[#f9f9f8] rounded-xl border border-[#e5e5e5]">
                <span className="text-xs text-[#5c5c5c]">Total Accounts</span>
                <p className="text-2xl font-bold text-[#1d1d1d] mt-1">{adminMetrics.totalUsers}</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                <span className="text-xs text-purple-700 font-semibold">Administrators</span>
                <p className="text-2xl font-bold text-purple-900 mt-1">{adminMetrics.adminCount}</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-xs text-emerald-700 font-semibold">Regular Users</span>
                <p className="text-2xl font-bold text-emerald-900 mt-1">{adminMetrics.userCount}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[#1d1d1d]">
                <thead className="bg-[#f9f9f8] text-xs uppercase tracking-wider text-[#5c5c5c] border-b border-[#e0e0e0]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Auth ID</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0efeb]">
                  {loadingAdminUsers ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-[#5c5c5c]">
                        Loading directory...
                      </td>
                    </tr>
                  ) : adminUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-[#5c5c5c]">
                        No users found in <code className="bg-[#f0efeb] px-1 rounded">public.profiles</code>.
                      </td>
                    </tr>
                  ) : (
                    adminUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-[#faf9f8]">
                        <td className="px-4 py-3">
                          <div className="font-medium">{u.full_name || u.email?.split('@')[0]}</div>
                          <div className="text-xs text-[#5c5c5c]">{u.email}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#5c5c5c]">
                          {u.id}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase ${
                              String(u.role).toLowerCase() === 'admin'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#5c5c5c]">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PASSWORD */}
      {activeTab === 'password' && (
        <div className="max-w-md bg-white rounded-2xl p-6 border border-[#e0e0e0] shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-700">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-[#1d1d1d]">Update Password</h2>
              <p className="text-xs text-[#5c5c5c]">Updates encrypted hash in auth.users</p>
            </div>
          </div>

          {passwordNotice && (
            <div
              className={`mb-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
                passwordNotice.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {passwordNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{passwordNotice.message}</span>
            </div>
          )}

          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1d1d1d] mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-3.5 py-2.5 border border-[#d5d5d5] rounded-lg text-sm text-[#1d1d1d] focus:outline-none focus:border-[#007c89] focus:ring-3 focus:ring-[#007c89]/10"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1d1d1d] mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full px-3.5 py-2.5 border border-[#d5d5d5] rounded-lg text-sm text-[#1d1d1d] focus:outline-none focus:border-[#007c89] focus:ring-3 focus:ring-[#007c89]/10"
              />
            </div>

            <button
              type="submit"
              disabled={updatingPassword}
              className="w-full py-2.5 bg-[#007c89] hover:bg-[#006570] text-white text-sm font-semibold rounded-full transition-colors cursor-pointer disabled:opacity-50"
            >
              {updatingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 5: SUPABASE SETUP GUIDE */}
      {activeTab === 'setup' && (
        <div className="bg-white rounded-2xl p-6 border border-[#e0e0e0] shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#e6f4f5] flex items-center justify-center text-[#007c89]">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-[#1d1d1d]">Supabase Project Configuration Guide</h2>
              <p className="text-xs text-[#5c5c5c]">Step-by-step checklist to connect your live Supabase project</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#1d1d1d]">
            <div className="p-4 bg-[#f9f9f8] rounded-xl border border-[#e0e0e0] space-y-2">
              <span className="font-bold text-sm block text-[#007c89]">1. Email 6-Digit OTP Template</span>
              <p className="text-[#5c5c5c]">
                In your Supabase Dashboard under <strong>Authentication &rarr; Email Templates &rarr; Confirm signup / Magic link</strong>, replace the email body to show:
              </p>
              <code className="block bg-white p-2 rounded border border-[#d5d5d5] font-mono text-[#007c89]">
                {'{{ .Token }}'}
              </code>
              <p className="text-[#5c5c5c]">
                This instructs Supabase to deliver a numeric 6-digit verification code instead of a URL.
              </p>
            </div>

            <div className="p-4 bg-[#f9f9f8] rounded-xl border border-[#e0e0e0] space-y-2">
              <span className="font-bold text-sm block text-[#007c89]">2. Google & Apple OAuth</span>
              <p className="text-[#5c5c5c]">
                In <strong>Authentication &rarr; Providers</strong>:
              </p>
              <ul className="list-disc list-inside text-[#5c5c5c] space-y-1">
                <li>Enable <strong>Google</strong> (Client ID & Secret from Google Cloud Console).</li>
                <li>Enable <strong>Apple</strong> (Services ID, Team ID, Key ID from Apple Developer).</li>
              </ul>
            </div>

            <div className="p-4 bg-[#f9f9f8] rounded-xl border border-[#e0e0e0] space-y-2">
              <span className="font-bold text-sm block text-[#007c89]">3. URL Configuration</span>
              <p className="text-[#5c5c5c]">
                In <strong>Authentication &rarr; URL Configuration</strong>:
              </p>
              <ul className="list-disc list-inside text-[#5c5c5c] space-y-1">
                <li>Site URL: <code className="bg-white px-1 rounded">http://localhost:5173</code></li>
                <li>Redirect URLs: <code className="bg-white px-1 rounded">http://localhost:5173/**</code></li>
              </ul>
            </div>

            <div className="p-4 bg-[#f9f9f8] rounded-xl border border-[#e0e0e0] space-y-2">
              <span className="font-bold text-sm block text-[#007c89]">4. Database Schema Execution</span>
              <p className="text-[#5c5c5c]">
                Open the Supabase <strong>SQL Editor</strong> and run the contents of <code className="bg-white px-1 rounded">supabase/schema.sql</code> to create the profiles table, user_role enum, and RLS policies.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Invite Modal */}
      {isCreateAdminOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-[#e0e0e0]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-xl font-bold text-[#1d1d1d]">
                {adminActionType === 'promote' ? 'Promote User to Admin' : 'Invite New Admin'}
              </h3>
              <button
                onClick={() => setIsCreateAdminOpen(false)}
                className="text-[#5c5c5c] hover:text-[#1d1d1d]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex border border-[#e0e0e0] rounded-lg p-1 bg-[#f9f9f8] mb-4">
              <button
                type="button"
                onClick={() => setAdminActionType('promote')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md ${
                  adminActionType === 'promote' ? 'bg-white text-purple-700 shadow-sm' : 'text-[#5c5c5c]'
                }`}
              >
                Promote User
              </button>
              <button
                type="button"
                onClick={() => setAdminActionType('invite')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md ${
                  adminActionType === 'invite' ? 'bg-white text-purple-700 shadow-sm' : 'text-[#5c5c5c]'
                }`}
              >
                Invite New Admin
              </button>
            </div>

            {createAdminError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-[#c0392b] text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createAdminError}</span>
              </div>
            )}

            {createAdminSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{createAdminSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1d] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="admin@company.com"
                  className="w-full px-3.5 py-2.5 border border-[#d5d5d5] rounded-lg text-sm"
                />
              </div>

              {adminActionType === 'invite' && (
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1d] mb-1">
                    Full Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full px-3.5 py-2.5 border border-[#d5d5d5] rounded-lg text-sm"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateAdminOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-[#5c5c5c]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingAdmin || !newAdminEmail}
                  className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-full disabled:opacity-50"
                >
                  {creatingAdmin ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
