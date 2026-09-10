import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { forgotPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await forgotPassword(email);
      navigate('/verify-otp', {
        state: {
          email,
          type: 'recovery',
          purpose: 'PASSWORD_RESET',
          message: 'A 6-digit password reset code has been sent to your email.',
        },
      });
    } catch (err) {
      setError(err.message || 'Failed to send reset code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-[540px] bg-white rounded-xl p-8 sm:p-12 border border-[#e0e0e0] shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#007c89] hover:underline mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Log in
        </Link>

        <h1 className="font-serif text-4xl sm:text-[42px] font-bold text-[#1d1d1d] leading-tight mb-3">
          Reset password
        </h1>
        <p className="text-[15px] text-[#5c5c5c] mb-8 leading-relaxed">
          Enter your account email address and we'll send a 6-digit verification code to reset your password.
        </p>

        {error && (
          <div className="mb-6 p-3.5 bg-red-50 border border-red-200 text-[#c0392b] text-sm rounded-md flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-[#1d1d1d] mb-1.5" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your Email"
              className="w-full px-3.5 py-3 border-[1.5px] border-[#d5d5d5] rounded-md text-[15px] text-[#1d1d1d] bg-white focus:outline-none focus:border-[#007c89] focus:ring-4 focus:ring-[#007c89]/10 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-auto inline-flex items-center justify-center gap-2 bg-[#007c89] hover:bg-[#006570] text-white font-semibold text-base px-8 py-3 rounded-full transition-colors cursor-pointer disabled:opacity-50 mt-2 shadow-sm"
          >
            {isSubmitting ? 'Sending code...' : 'Send reset code'}
            {!isSubmitting && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      </div>

      <footer className="mt-8 text-center text-xs text-[#5c5c5c]">
        &copy; {new Date().getFullYear()} CREA AI &mdash; Credit Risk Intelligence Platform
      </footer>
    </div>
  );
}
