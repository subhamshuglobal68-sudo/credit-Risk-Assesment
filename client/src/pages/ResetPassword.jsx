import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, CheckCircle, ArrowRight, Check } from 'lucide-react';

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const { resetPassword, verifyOtp } = useAuth();

  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState(location.state?.code || '');
  const [isAlreadyVerified, setIsAlreadyVerified] = useState(Boolean(location.state?.verified));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword && newPassword === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!hasLength) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!isAlreadyVerified && code) {
        try {
          await verifyOtp({ email, token: code, type: 'recovery' });
        } catch (otpErr) {
          // If session was already established, proceed
        }
      }

      await resetPassword(newPassword);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Password reset failed. Please request a new 6-digit code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-[540px] bg-white rounded-xl p-8 sm:p-12 border border-[#e0e0e0] shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <h1 className="font-serif text-4xl sm:text-[42px] font-bold text-[#1d1d1d] leading-tight mb-3">
          Set new password
        </h1>
        <p className="text-[15px] text-[#5c5c5c] mb-8 leading-relaxed">
          Create a new, strong password for your CREA AI account.
        </p>

        {error && (
          <div className="mb-6 p-3.5 bg-red-50 border border-red-200 text-[#c0392b] text-sm rounded-md flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
            <h2 className="font-serif text-2xl font-bold text-[#1d1d1d] mb-2">Password Updated!</h2>
            <p className="text-sm text-[#5c5c5c] mb-6">
              Your password has been reset successfully in Supabase Auth.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-[#007c89] text-white font-semibold px-8 py-3 rounded-full hover:bg-[#006570] transition-colors shadow-sm"
            >
              Log in with new password <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isAlreadyVerified && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-[#1d1d1d] mb-1.5" htmlFor="email">
                    Account Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your email address"
                    className="w-full px-3.5 py-3 border-[1.5px] border-[#d5d5d5] rounded-md text-[15px] text-[#1d1d1d] bg-white focus:outline-none focus:border-[#007c89] focus:ring-4 focus:ring-[#007c89]/10 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1d1d1d] mb-1.5" htmlFor="code">
                    6-Digit Recovery Code
                  </label>
                  <input
                    id="code"
                    type="text"
                    required
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 123456"
                    className="w-full px-3.5 py-3 border-[1.5px] border-[#d5d5d5] rounded-md text-[15px] font-mono tracking-widest text-[#1d1d1d] bg-white focus:outline-none focus:border-[#007c89] focus:ring-4 focus:ring-[#007c89]/10 transition-colors"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-semibold text-[#1d1d1d] mb-1.5" htmlFor="newPassword">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-3.5 py-3 border-[1.5px] border-[#d5d5d5] rounded-md text-[15px] text-[#1d1d1d] bg-white focus:outline-none focus:border-[#007c89] focus:ring-4 focus:ring-[#007c89]/10 transition-colors"
              />
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

            <div>
              <label className="block text-sm font-semibold text-[#1d1d1d] mb-1.5" htmlFor="confirmPassword">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full px-3.5 py-3 border-[1.5px] border-[#d5d5d5] rounded-md text-[15px] text-[#1d1d1d] bg-white focus:outline-none focus:border-[#007c89] focus:ring-4 focus:ring-[#007c89]/10 transition-colors"
              />
              {confirmPassword && (
                <p className={`text-xs mt-1.5 ${passwordsMatch ? 'text-emerald-600' : 'text-red-500'}`}>
                  {passwordsMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
                </p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !passwordsMatch || !hasLength}
                className="w-auto inline-flex items-center justify-center gap-2 bg-[#007c89] hover:bg-[#006570] text-white font-semibold text-base px-8 py-3 rounded-full transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {isSubmitting ? 'Updating password...' : 'Update password'}
                {!isSubmitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </form>
        )}
      </div>

      <footer className="mt-8 text-center text-xs text-[#5c5c5c]">
        &copy; {new Date().getFullYear()} CREA AI &mdash; Credit Risk Intelligence Platform
      </footer>
    </div>
  );
}
