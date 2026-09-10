import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, ArrowRight, Sparkles, KeyRound, Mail } from 'lucide-react';

export default function Login() {
  const [authMode, setAuthMode] = useState('password'); // 'password' | 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signInWithPassword, signInWithOtp, signInWithOAuth, isConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await signInWithPassword(email, password);
      const role = String(res.role || '').toLowerCase();
      const targetPath = location.state?.from?.pathname || (role === 'admin' ? '/admin' : '/dashboard');
      navigate(targetPath, { replace: true });
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('email not confirmed')) {
        navigate('/verify-otp', {
          state: {
            email,
            type: 'signup',
            message: 'Please complete 6-digit email confirmation to activate your account.',
          },
        });
      } else {
        setError(err.message || 'Invalid credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signInWithOtp(email);
      navigate('/verify-otp', {
        state: {
          email,
          type: 'email',
          message: 'A 6-digit sign-in code has been dispatched to your email address.',
        },
      });
    } catch (err) {
      setError(err.message || 'Failed to dispatch one-time code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      setIsSubmitting(true);
      await signInWithOAuth('google');
    } catch (err) {
      setError(err.message || 'Google OAuth failed.');
      setIsSubmitting(false);
    }
  };

  const handleAppleLogin = async () => {
    setError(null);
    try {
      setIsSubmitting(true);
      await signInWithOAuth('apple');
    } catch (err) {
      setError(err.message || 'Apple OAuth failed.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col justify-center items-center px-4 py-12">
      {/* Auth Card matching signature CREA AI Mailchimp/Teal theme */}
      <div className="w-full max-w-[540px] bg-white rounded-xl p-8 sm:p-12 border border-[#e0e0e0] shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <h1 className="font-serif text-4xl sm:text-[42px] font-bold text-[#1d1d1d] leading-tight mb-3">
          Log in
        </h1>
        <p className="text-[15px] text-[#5c5c5c] mb-6">
          Need a CREA AI account?{' '}
          <Link to="/signup" className="text-[#007c89] font-medium hover:underline">
            Create an account
          </Link>
        </p>

        {!isConfigured && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg space-y-1">
            <strong className="block font-semibold">⚡ Supabase Project Setup Required</strong>
            <span>
              Add your <code className="bg-white px-1 py-0.5 rounded border border-amber-300">VITE_SUPABASE_URL</code> and{' '}
              <code className="bg-white px-1 py-0.5 rounded border border-amber-300">VITE_SUPABASE_ANON_KEY</code> to <code className="bg-white px-1 py-0.5 rounded border border-amber-300">client/.env</code> to connect directly to your live Supabase project.
            </span>
          </div>
        )}

        {/* Tab switch: Password vs Passwordless Email OTP */}
        <div className="flex border border-[#e0e0e0] rounded-lg p-1 bg-[#f9f9f8] mb-6">
          <button
            type="button"
            onClick={() => { setAuthMode('password'); setError(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all ${
              authMode === 'password'
                ? 'bg-white text-[#1d1d1d] shadow-sm'
                : 'text-[#5c5c5c] hover:text-[#1d1d1d]'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Password
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('otp'); setError(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all ${
              authMode === 'otp'
                ? 'bg-white text-[#007c89] shadow-sm'
                : 'text-[#5c5c5c] hover:text-[#1d1d1d]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#007c89]" />
            Passwordless 6-Digit OTP
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-red-50 border border-red-200 text-[#c0392b] text-sm rounded-md flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {authMode === 'password' ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-[#1d1d1d] mb-1.5" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-3.5 py-3 border-[1.5px] border-[#d5d5d5] rounded-md text-[15px] text-[#1d1d1d] bg-white focus:outline-none focus:border-[#007c89] focus:ring-4 focus:ring-[#007c89]/10 transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-[#1d1d1d]" htmlFor="password">
                  Password
                </label>
                <Link to="/forgot-password" className="text-xs font-medium text-[#007c89] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-3.5 py-3 border-[1.5px] border-[#d5d5d5] rounded-md text-[15px] text-[#1d1d1d] bg-white focus:outline-none focus:border-[#007c89] focus:ring-4 focus:ring-[#007c89]/10 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-auto inline-flex items-center justify-center gap-2 bg-[#007c89] hover:bg-[#006570] text-white font-semibold text-base px-8 py-3 rounded-full transition-colors cursor-pointer disabled:opacity-50 mt-2 shadow-sm"
            >
              {isSubmitting ? 'Signing in...' : 'Log in'}
              {!isSubmitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-[#1d1d1d] mb-1.5" htmlFor="otp-email">
                Email Address
              </label>
              <input
                id="otp-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3.5 py-3 border-[1.5px] border-[#d5d5d5] rounded-md text-[15px] text-[#1d1d1d] bg-white focus:outline-none focus:border-[#007c89] focus:ring-4 focus:ring-[#007c89]/10 transition-colors"
              />
              <p className="text-xs text-[#5c5c5c] mt-1.5 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-[#007c89]" />
                We'll email you a secure 6-digit OTP code. No password required.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !email}
              className="w-auto inline-flex items-center justify-center gap-2 bg-[#007c89] hover:bg-[#006570] text-white font-semibold text-base px-8 py-3 rounded-full transition-colors cursor-pointer disabled:opacity-50 mt-2 shadow-sm"
            >
              {isSubmitting ? 'Sending 6-digit code...' : 'Send sign-in code'}
              {!isSubmitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}

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
            onClick={handleGoogleLogin}
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
            onClick={handleAppleLogin}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-3 bg-white border-[1.5px] border-[#d5d5d5] rounded-md p-3 text-[15px] font-medium text-[#1d1d1d] hover:bg-[#f7f7f7] hover:border-[#bbb] transition-all cursor-pointer disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.57 2.95-1.39z"/>
            </svg>
            Continue with Apple
          </button>
        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-[#5c5c5c]">
        &copy; {new Date().getFullYear()} CREA AI &mdash; Credit Risk Intelligence Platform
      </footer>
    </div>
  );
}
