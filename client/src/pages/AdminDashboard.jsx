import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { ShieldCheck, UserPlus, Users, CheckCircle, AlertCircle, X, RefreshCw, ArrowUpRight, Lock, UserCheck, Database } from 'lucide-react';
import SupabaseConnectModal from '../components/SupabaseConnectModal';

export default function AdminDashboard() {
  const { user, inviteOrPromoteAdmin, isConfigured } = useAuth();

  const [users, setUsers] = useState([]);
  const [metrics, setMetrics] = useState({ totalUsers: 0, adminCount: 0, userCount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showConnectModal, setShowConnectModal] = useState(false);

  // Modal State for Inviting / Promoting Admins
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [targetName, setTargetName] = useState('');
  const [actionType, setActionType] = useState('promote'); // 'promote' | 'invite'
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [modalSuccess, setModalSuccess] = useState(null);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);

    if (!isConfigured || user?.isDemo) {
      const mockList = [
        { id: '1', email: 'admin@crea-ai.internal', full_name: 'Lead Risk Officer', role: 'admin', created_at: new Date().toISOString() },
        { id: '2', email: 'analyst@crea-ai.internal', full_name: 'Senior Credit Analyst', role: 'user', created_at: new Date(Date.now() - 86400000).toISOString() },
        { id: '3', email: 'compliance@crea-ai.internal', full_name: 'Compliance Officer', role: 'user', created_at: new Date(Date.now() - 172800000).toISOString() },
      ];
      setUsers(mockList);
      setMetrics({ totalUsers: mockList.length, adminCount: 1, userCount: 2 });
      setIsLoading(false);
      return;
    }

    try {
      // Direct RLS query: 'Admins can view all profiles' policy applies
      const { data, error: selectError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (selectError) {
        throw new Error(selectError.message || 'Failed to query profiles table.');
      }

      const profileList = data || [];
      setUsers(profileList);

      const admins = profileList.filter((u) => String(u.role).toLowerCase() === 'admin').length;
      setMetrics({
        totalUsers: profileList.length,
        adminCount: admins,
        userCount: profileList.length - admins,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAdminAction = async (e) => {
    e.preventDefault();
    setModalError(null);
    setModalSuccess(null);
    setModalSubmitting(true);

    try {
      const res = await inviteOrPromoteAdmin({
        email: targetEmail,
        fullName: targetName,
        action: actionType,
      });

      setModalSuccess(res.message || 'Admin action completed successfully!');
      setTargetEmail('');
      setTargetName('');
      loadUsers();
      setTimeout(() => {
        setIsModalOpen(false);
        setModalSuccess(null);
      }, 1500);
    } catch (err) {
      setModalError(err.message);
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleQuickRoleToggle = async (profileId, currentRole, email) => {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin';
    const confirmChange = window.confirm(
      `Are you sure you want to change ${email}'s role to ${nextRole.toUpperCase()}?`
    );
    if (!confirmChange) return;

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: nextRole, updated_at: new Date().toISOString() })
        .eq('id', profileId);

      if (updateError) throw updateError;
      loadUsers();
    } catch (err) {
      alert(`Role update failed: ${err.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-8 border border-[#e0e0e0] shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                PostgreSQL RLS Protected
              </span>
              <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1d1d1d] mt-2">
                Admin Control Center
              </h1>
              <p className="text-sm text-[#5c5c5c] mt-0.5">
                Manage user permissions and administrative roles via Supabase Auth & Row Level Security.
              </p>
            </div>
          </div>

          <button
            onClick={() => { setIsModalOpen(true); setModalError(null); setModalSuccess(null); }}
            className="inline-flex items-center gap-2 bg-[#007c89] hover:bg-[#006570] text-white font-semibold text-sm px-5 py-2.5 rounded-full transition-colors cursor-pointer shadow-sm self-start sm:self-center"
          >
            <UserPlus className="w-4 h-4" />
            Invite / Promote Admin
          </button>
        </div>
      </div>

      <SupabaseConnectModal
        isOpen={showConnectModal}
        onClose={() => {
          setShowConnectModal(false);
          loadUsers();
        }}
      />

      {!isConfigured && (
        <div className="mb-6 p-4 bg-teal-50 border border-teal-200 text-teal-950 text-xs rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#007c89] shrink-0" />
            <span>
              <strong>Running in Sandbox Demo:</strong> To synchronize real admin users with your live database, connect your Supabase project keys.
            </span>
          </div>
          <button
            onClick={() => setShowConnectModal(true)}
            className="px-3 py-1.5 bg-[#007c89] hover:bg-[#006570] text-white font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-xs"
          >
            Connect Supabase
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-[#c0392b] text-sm rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Aggregate Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 border border-[#e0e0e0] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#5c5c5c]">Total Accounts</p>
            <p className="text-3xl font-bold text-[#1d1d1d] mt-1">{metrics.totalUsers}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-[#e0e0e0] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#5c5c5c]">Administrators</p>
            <p className="text-3xl font-bold text-[#1d1d1d] mt-1">{metrics.adminCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-[#e0e0e0] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#5c5c5c]">Regular Users</p>
            <p className="text-3xl font-bold text-[#1d1d1d] mt-1">{metrics.userCount}</p>
          </div>
        </div>
      </div>

      {/* Users Management Table */}
      <div className="bg-white rounded-2xl border border-[#e0e0e0] shadow-sm overflow-hidden mb-8">
        <div className="p-6 border-b border-[#f0efeb] flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl font-bold text-[#1d1d1d]">Postgres Profiles Directory</h2>
            <p className="text-xs text-[#5c5c5c]">Directly queried from <code className="bg-[#f0efeb] px-1 rounded">public.profiles</code> under active RLS session</p>
          </div>
          <button
            onClick={loadUsers}
            disabled={isLoading}
            className="text-xs text-[#5c5c5c] hover:text-[#007c89] flex items-center gap-1.5 p-2 rounded hover:bg-[#f9f9f8] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh list
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#1d1d1d]">
            <thead className="bg-[#f9f9f8] text-xs uppercase tracking-wider text-[#5c5c5c] border-b border-[#e0e0e0]">
              <tr>
                <th className="px-6 py-4 font-semibold">User / Profile</th>
                <th className="px-6 py-4 font-semibold">Auth ID (UUID)</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold">Created At</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0efeb]">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[#5c5c5c]">
                    <div className="w-8 h-8 border-4 border-[#007c89] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading profiles from Supabase...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[#5c5c5c]">
                    No profiles returned. Ensure your user has <code className="bg-[#f0efeb] px-1 rounded">role = 'admin'</code> in <code className="bg-[#f0efeb] px-1 rounded">public.profiles</code> to satisfy the RLS policy.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const roleNormalized = String(u.role || 'user').toLowerCase();
                  const isAdmin = roleNormalized === 'admin';
                  return (
                    <tr key={u.id} className="hover:bg-[#faf9f8] transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-[#1d1d1d]">{u.full_name || u.email?.split('@')[0]}</div>
                        <div className="text-xs text-[#5c5c5c]">{u.email}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-[#5c5c5c]">
                        {u.id}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider ${
                            isAdmin
                              ? 'bg-purple-100 text-purple-700 border border-purple-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {roleNormalized}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-[#5c5c5c]">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        }) : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleQuickRoleToggle(u.id, roleNormalized, u.email)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                            isAdmin
                              ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                              : 'text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100'
                          }`}
                        >
                          {isAdmin ? 'Demote to User' : 'Promote to Admin'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Invite / Promote Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-[#e0e0e0] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#1d1d1d]">
                    {actionType === 'promote' ? 'Promote User to Admin' : 'Invite New Admin'}
                  </h3>
                  <p className="text-xs text-[#5c5c5c]">Privileged security action</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#5c5c5c] hover:text-[#1d1d1d] p-1.5 rounded-lg hover:bg-[#f0efeb]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Action Type Toggle */}
            <div className="flex border border-[#e0e0e0] rounded-lg p-1 bg-[#f9f9f8] mb-5">
              <button
                type="button"
                onClick={() => setActionType('promote')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  actionType === 'promote'
                    ? 'bg-white text-purple-700 shadow-sm'
                    : 'text-[#5c5c5c] hover:text-[#1d1d1d]'
                }`}
              >
                Promote Existing User
              </button>
              <button
                type="button"
                onClick={() => setActionType('invite')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  actionType === 'invite'
                    ? 'bg-white text-purple-700 shadow-sm'
                    : 'text-[#5c5c5c] hover:text-[#1d1d1d]'
                }`}
              >
                Invite via Edge Function
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-[#c0392b] text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {modalSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{modalSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAdminAction} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1d] mb-1">
                  User Email Address
                </label>
                <input
                  type="email"
                  required
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="admin-candidate@company.com"
                  className="w-full px-3.5 py-2.5 border border-[#d5d5d5] rounded-lg text-sm text-[#1d1d1d] focus:outline-none focus:border-[#007c89] focus:ring-3 focus:ring-[#007c89]/10"
                />
              </div>

              {actionType === 'invite' && (
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1d] mb-1">
                    Full Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={targetName}
                    onChange={(e) => setTargetName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full px-3.5 py-2.5 border border-[#d5d5d5] rounded-lg text-sm text-[#1d1d1d] focus:outline-none focus:border-[#007c89] focus:ring-3 focus:ring-[#007c89]/10"
                  />
                </div>
              )}

              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900 flex items-start gap-2">
                <Lock className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                <span>
                  {actionType === 'promote'
                    ? 'Promoting an existing user grants immediate access to all admin-gated routes and tables.'
                    : 'Invoking the `admin-invite` Edge Function uses the service role key server-side to send an official invite.'}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-[#5c5c5c] hover:text-[#1d1d1d]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting || !targetEmail}
                  className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-full transition-colors cursor-pointer disabled:opacity-50"
                >
                  {modalSubmitting ? 'Processing...' : actionType === 'promote' ? 'Promote User' : 'Dispatch Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
