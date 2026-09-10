import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, CheckCircle, ArrowRight, RefreshCw, Mail } from 'lucide-react';

export default function VerifyOtp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyOtp, resendOtp } = useAuth();

  const email = location.state?.email || '';
  const rawType = location.state?.type || location.state?.purpose || 'email';
  const customMessage = location.state?.message || '';

  // Normalize type for Supabase Auth ('signup' | 'email' | 'recovery')
  const normalizeType = (val) => {
    if (val === 'SIGNUP_VERIFY' || val === 'signup') return 'signup';
    if (val === 'PASSWORD_RESET' || val === 'recovery') return 'recovery';
    return 'email';
  };

  const otpType = normalizeType(rawType);

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  const inputRefs = useRef([]);

  // Auto-focus first input box
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // Live 60-second cooldown timer for rate limit
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Handle single digit typing & auto-advance
  const handleInputChange = (index, value) => {
    const char = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);
    setError(null);

    // Auto-advance to next box if character was entered
    if (char && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  // Handle Backspace navigation
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0 && inputRefs.current[index - 1]) {
        inputRefs.current[index - 1].focus();
      }
    }
  };

  // Handle Clipboard Paste (e.g. user copies '123456' from their email)
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const newDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pastedData[i] || '';
    }
    setDigits(newDigits);

    const nextIndex = Math.min(pastedData.length, 5);
    if (inputRefs.current[nextIndex]) {
      inputRefs.current[nextIndex].focus();
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const fullCode = digits.join('');
    if (fullCode.length !== 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await verifyOtp({
        email,
        token: fullCode,
        type: otpType,
      });

      if (otpType === 'signup') {
        setSuccessMsg('Email verified successfully! Opening your workspace...');
        setTimeout(() => navigate('/dashboard'), 1000);
      } else if (otpType === 'recovery') {
        setSuccessMsg('Recovery code verified! Proceed to set a new password.');
        setTimeout(() => {
          navigate('/reset-password', {
            state: { email, verified: true },
          });
        }, 1000);
      } else {
        setSuccessMsg('Sign-in code verified! Logging you in...');
        setTimeout(() => {
          const role = String(res.role || '').toLowerCase();
          if (role === 'admin') {
            navigate('/admin');
          } else {
            navigate('/dashboard');
          }
        }, 1000);
      }
    } catch (err) {
      setError(err.message || 'Invalid or expired 6-digit code. Please verify and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError(null);
    setSuccessMsg(null);

    try {
      await resendOtp({ email, type: otpType });
      setSuccessMsg('A fresh 6-digit code has been dispatched to your email.');
      setCooldown(60);
      setDigits(['', '', '', '', '', '']);
      if (inputRefs.current[0]) inputRefs.current[0].focus();
    } catch (err) {
      setError(err.message || 'Failed to resend code.');
    }
  };

  const getHeading = () => {
    if (otpType === 'signup') return 'Confirm your email';
    if (otpType === 'recovery') return 'Password recovery';
    return 'Enter 6-digit code';
  };

  if (!email) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex flex-col justify-center items-center px-4">
        <div className="w-full max-w-md bg-white rounded-xl p-8 text-center border border-[#e0e0e0] shadow-sm">
          <Mail className="w-12 h-12 text-[#007c89] mx-auto mb-4" />
          <h2 className="font-serif text-2xl font-bold mb-2">No verification in progress</h2>
          <p className="text-sm text-[#5c5c5c] mb-6">Please log in or create an account to receive a verification code.</p>
          <Link
            to="/login"
            className="inline-block bg-[#007c89] text-white font-semibold px-6 py-2.5 rounded-full hover:bg-[#006570] transition-colors"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-[540px] bg-white rounded-xl p-8 sm:p-12 border border-[#e0e0e0] shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <h1 className="font-serif text-4xl sm:text-[42px] font-bold text-[#1d1d1d] leading-tight mb-3">
          {getHeading()}
        </h1>
        <p className="text-[15px] text-[#5c5c5c] mb-8 leading-relaxed">
          Enter the single-use 6-digit code sent to <strong className="text-[#1d1d1d]">{email}</strong>.
          {customMessage && <span className="block text-xs text-[#007c89] mt-1">{customMessage}</span>}
        </p>

        {error && (
          <div className="mb-6 p-3.5 bg-red-50 border border-red-200 text-[#c0392b] text-sm rounded-md flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-md flex items-center gap-2.5">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* 6 Individual OTP Digit Inputs */}
          <div className="flex items-center justify-between gap-2 sm:gap-3 mb-8" onPaste={handlePaste}>
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => (inputRefs.current[idx] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleInputChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className="w-12 h-14 sm:w-16 sm:h-16 text-center text-2xl sm:text-3xl font-bold font-mono text-[#1d1d1d] bg-white border-[1.5px] border-[#d5d5d5] rounded-md focus:outline-none focus:border-[#007c89] focus:ring-4 focus:ring-[#007c89]/10 transition-colors shadow-sm"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || digits.join('').length !== 6}
            className="w-auto inline-flex items-center justify-center gap-2 bg-[#007c89] hover:bg-[#006570] text-white font-semibold text-base px-8 py-3 rounded-full transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {isSubmitting ? 'Verifying code...' : 'Verify code'}
            {!isSubmitting && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        {/* Resend & Cooldown */}
        <div className="mt-8 pt-6 border-t border-[#f0efeb] text-sm text-[#5c5c5c] space-y-2">
          <p>
            Can't find the email? Check your spam or promotions folders.
          </p>
          <div className="flex items-center gap-2">
            <span>Didn't receive it?</span>
            {cooldown > 0 ? (
              <span className="text-xs font-medium text-[#5c5c5c] bg-[#f9f9f8] px-2.5 py-1 rounded border border-[#e0e0e0]">
                Resend code in {cooldown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="text-[#007c89] font-medium hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Resend code
              </button>
            )}
          </div>
        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-[#5c5c5c]">
        &copy; {new Date().getFullYear()} CREA AI &mdash; Credit Risk Intelligence Platform
      </footer>
    </div>
  );
}
