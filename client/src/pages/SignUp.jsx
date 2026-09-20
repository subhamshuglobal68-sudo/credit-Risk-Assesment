import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, ArrowRight, Check, Shield, Database } from 'lucide-react';
import SupabaseConnectModal from '../components/SupabaseConnectModal';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);

  const { signUp, signInWithOAuth, isConfigured, loginAsDemo } = useAuth();
  const navigate = useNavigate();

  // Password requirements calculation
  const hasLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isStrong = hasLength && hasUppercase && hasNumber;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!hasLength) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await signUp(email, password, name);
      if (data?.isDemo) {
        const target = data.user?.role === 'admin' ? '/admin' : '/dashboard';
        navigate(target, { replace: true });
        return;
      }

      // Supabase sends a confirmation email with a 6-digit OTP when configured with {{ .Token }}
      navigate('/verify-otp', {
        state: {
          email,
          type: 'signup',
          message: `A 6-digit activation code was dispatched to ${email}.`,
        },
      });
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError(null);
    try {
      setIsSubmitting(true);
      await signInWithOAuth('google');
    } catch (err) {
      setError(err.message || 'Google signup failed.');
      setIsSubmitting(false);
    }
  };

  const handleAppleSignup = async () => {
    setError(null);
    try {
      setIsSubmitting(true);
      await signInWithOAuth('apple');
    } catch (err) {
      setError(err.message || 'Apple signup failed.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col justify-center items-center px-4 py-12">
      <SupabaseConnectModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
      />

      <div className="w-full max-w-[540px] bg-white rounded-xl p-8 sm:p-12 border border-[#e0e0e0] shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <h1 className="font-serif text-4xl sm:text-[42px] font-bold text-[#1d1d1d] leading-tight mb-3">
          Create an account
        </h1>
        <p className="text-[15px] text-[#5c5c5c] mb-6">
          Already have an account?{' '}
          <Link to="/login" className="text-[#007c89] font-medium hover:underline">
            Sign in
          </Link>
        </p>

        {!isConfigured && (
          <div className="mb-6 p-4 bg-teal-50/80 border border-teal-200 rounded-xl space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 font-bold text-xs text-teal-900">
                  <Database className="w-3.5 h-3.5 text-[#007c89]" />
                  <span>Connect Supabase Project</span>
                </div>
                <p className="text-[11px] text-teal-800 mt-0.5">
                  Link your live database directly in this browser or explore immediately in Sandbox Demo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConnectModal(true)}
                className="px-2.5 py-1 bg-[#007c89] hover:bg-[#006570] text-white text-[11px] font-bold rounded-md shadow-xs transition-colors whitespace-nowrap cursor-pointer"
              >
                Connect Keys
              </button>
            </div>
            <div className="pt-2 border-t border-teal-200/60 flex items-center justify-between text-[11px]">
              <span className="text-stone-500">Want to test right now?</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    loginAsDemo('user');
                    navigate('/dashboard');
                  }}
                  className="text-[#007c89] font-bold hover:underline cursor-pointer"
                >
                  Demo User &rarr;
                </button>
                <span className="text-stone-300">|</span>
                <button
                  type="button"
                  onClick={() => {
                    loginAsDemo('admin');
                    navigate('/admin');
                  }}
                  className="text-[#007c89] font-bold hover:underline cursor-pointer"
                >
                  Demo Admin &rarr;
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-3.5 bg-red-50 border border-red-200 text-[#c0392b] text-sm rounded-md flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#1d1d1d] mb-1.5" htmlFor="name">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full px-3.5 py-3 border-[1.5px] border-[#d5d5d5] rounded-md text-[15px] text-[#1d1d1d] bg-white focus:outline-none focus:border-[#007c89] focus:ring-4 focus:ring-[#007c89]/10 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#1d1d1d] mb-1.5" htmlFor="email">
              Work Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full px-3.5 py-3 border-[1.5px] border-[#d5d5d5] rounded-md text-[15px] text-[#1d1d1d] bg-white focus:outline-none focus:border-[#007c89] focus:ring-4 focus:ring-[#007c89]/10 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#1d1d1d] mb-1.5" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              className="w-full px-3.5 py-3 border-[1.5px] border-[#d5d5d5] rounded-md text-[15px] text-[#1d1d1d] bg-white focus:outline-none focus:border-[#007c89] focus:ring-4 focus:ring-[#007c89]/10 transition-colors"
            />

            {/* Password checklist */}
            <div className="mt-2.5 flex flex-wrap gap-3 text-xs text-[#5c5c5c]">
              <span className={`inline-flex items-center gap-1 ${hasLength ? 'text-emerald-700 font-medium' : ''}`}>
                <Check className={`w-3.5 h-3.5 ${hasLength ? 'opacity-100 text-emerald-600' : 'opacity-40'}`} />
                8+ characters
              </span>
              <span className={`inline-flex items-center gap-1 ${hasUppercase ? 'text-emerald-700 font-medium' : ''}`}>
                <Check className={`w-3.5 h-3.5 ${hasUppercase ? 'opacity-100 text-emerald-600' : 'opacity-40'}`} />
                1 uppercase
              </span>
              <span className={`inline-flex items-center gap-1 ${hasNumber ? 'text-emerald-700 font-medium' : ''}`}>
                <Check className={`w-3.5 h-3.5 ${hasNumber ? 'opacity-100 text-emerald-600' : 'opacity-40'}`} />
                1 number
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !isStrong}
              className="w-auto inline-flex items-center justify-center gap-2 bg-[#007c89] hover:bg-[#006570] text-white font-semibold text-base px-8 py-3 rounded-full transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {isSubmitting ? 'Creating account...' : 'Sign up'}
              {!isSubmitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-7 text-xs font-semibold text-[#5c5c5c] tracking-wider uppercase">
          <div className="flex-1 h-px bg-[#d5d5d5]" />
          <span>OR</span>
          <div className="flex-1 h-px bg-[#d5d5d5]" />
        </div>

        {/* OAuth Buttons */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-3 bg-white border-[1.5px] border-[#d5d5d5] rounded-md p-3 text-[15px] font-medium text-[#1d1d1d] hover:bg-[#f7f7f7] hover:border-[#bbb] transition-all cursor-pointer disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <button
            type="button"
            onClick={handleAppleSignup}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-3 bg-white border-[1.5px] border-[#d5d5d5] rounded-md p-3 text-[15px] font-medium text-[#1d1d1d] hover:bg-[#f7f7f7] hover:border-[#bbb] transition-all cursor-pointer disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.57 2.95-1.39z"/>
            </svg>
            Continue with Apple
          </button>
        </div>

        <div className="mt-8 flex items-center gap-2 text-xs text-[#5c5c5c]">
          <Shield className="w-4 h-4 text-[#007c89] shrink-0" />
          <span>New accounts are automatically provisioned with the standard User role under PostgreSQL RLS policies.</span>
        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-[#5c5c5c]">
        &copy; {new Date().getFullYear()} CREA AI &mdash; Credit Risk Intelligence Platform
      </footer>
    </div>
  );
}
