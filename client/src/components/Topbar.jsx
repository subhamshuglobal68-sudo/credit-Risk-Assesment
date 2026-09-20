import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, LogOut, User as UserIcon, Database } from 'lucide-react';
import SupabaseConnectModal from './SupabaseConnectModal';

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showConnectModal, setShowConnectModal] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="w-full border-b border-[#e5e5e5] bg-white/80 backdrop-blur sticky top-0 z-50">
      <SupabaseConnectModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
      />

      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-3 text-decoration-none group">
          <div className="w-9 h-9 rounded-lg bg-[#007c89] flex items-center justify-center text-white font-serif font-bold text-xl shadow-sm group-hover:bg-[#006570] transition-colors">
            C
          </div>
          <span className="font-serif font-bold text-2xl tracking-tight text-[#1d1d1d]">
            CREA AI
          </span>
        </Link>

        {/* User Navigation / Status */}
        {user ? (
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm text-[#5c5c5c] bg-[#f9f9f8] px-3 py-1.5 rounded-full border border-[#e0e0e0]">
              <UserIcon className="w-4 h-4 text-[#007c89]" />
              <span className="font-medium text-[#1d1d1d]">{user.email}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                  user.role?.toLowerCase() === 'admin'
                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                }`}
              >
                {user.role}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/auth-center"
                className="text-xs font-semibold px-3 py-2 rounded-lg bg-[#e6f4f5] text-[#007c89] hover:bg-[#d8eef0] border border-[#007c89]/20 transition-colors flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4 text-[#007c89]" />
                <span className="hidden md:inline">Auth Center</span>
              </Link>

              <Link
                to="/dashboard"
                className="text-xs font-semibold px-3 py-2 rounded-lg text-[#5c5c5c] hover:text-[#1d1d1d] hover:bg-[#f0efeb] transition-colors"
              >
                Workspace
              </Link>
            </div>

            {user.role?.toLowerCase() === 'admin' && (
              <Link
                to="/admin"
                className="text-xs font-semibold px-3 py-2 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <span className="hidden md:inline">Admin</span>
              </Link>
            )}

            {/* Persistent Supabase Configuration Access */}
            <button
              onClick={() => setShowConnectModal(true)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#007c89]/30 text-[#007c89] hover:bg-[#007c89]/10 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Configure or update Supabase Project Keys"
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Supabase Keys</span>
            </button>

            <button
              onClick={handleLogout}
              className="text-xs font-semibold px-3 py-2 rounded-lg text-[#5c5c5c] hover:text-[#c0392b] hover:bg-red-50 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {/* Persistent Supabase Configuration Access (Logged Out) */}
            <button
              onClick={() => setShowConnectModal(true)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#007c89]/40 text-[#007c89] hover:bg-[#007c89]/10 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Configure or re-enter Supabase Project Keys"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Supabase Keys</span>
            </button>

            <Link
              to="/login"
              className="text-sm font-semibold text-[#007c89] hover:underline px-3 py-1.5"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="text-sm font-semibold text-white bg-[#007c89] hover:bg-[#006570] px-4 py-2 rounded-full transition-colors shadow-sm"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
