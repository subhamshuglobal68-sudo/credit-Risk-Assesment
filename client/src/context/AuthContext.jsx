import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch or sync the profile from public.profiles
  const fetchProfile = useCallback(async (userId, retryCount = 0) => {
    if (!userId || !isSupabaseConfigured) {
      setIsLoading(false);
      return null;
    }

    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.warn('[Supabase Auth] Profile query error (RLS or network):', profileError.message);
      }

      // If newly registered, the Postgres trigger on auth.users might take a moment
      if (!data && retryCount < 2) {
        await new Promise((res) => setTimeout(res, 500));
        return fetchProfile(userId, retryCount + 1);
      }

      const userRole = data?.role ? String(data.role).toLowerCase() : 'user';
      setProfile(data || null);

      setUser((prev) => ({
        ...(prev || {}),
        id: userId,
        email: data?.email || prev?.email,
        name: data?.full_name || prev?.name || data?.email?.split('@')[0],
        role: userRole,
        profile: data || null,
      }));

      return data;
    } catch (err) {
      console.error('[Supabase Auth] Unexpected error fetching profile:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize and listen to Supabase auth state changes
  useEffect(() => {
    let mounted = true;

    async function initSession() {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }

      try {
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (mounted) {
          setSession(initialSession);
          if (initialSession?.user) {
            setUser({
              id: initialSession.user.id,
              email: initialSession.user.email,
              name: initialSession.user.user_metadata?.full_name || initialSession.user.email?.split('@')[0],
              role: 'user', // will be updated by fetchProfile
            });
            await fetchProfile(initialSession.user.id);
          } else {
            setUser(null);
            setProfile(null);
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error('[Supabase Auth] Error initializing session:', err);
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initSession();

    // Real-time listener for sign-in, token refresh, sign-out
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;
      setSession(currentSession);

      if (currentSession?.user) {
        setUser((prev) => ({
          ...(prev || {}),
          id: currentSession.user.id,
          email: currentSession.user.email,
          name: currentSession.user.user_metadata?.full_name || currentSession.user.email?.split('@')[0],
          role: prev?.role || 'user',
        }));
        await fetchProfile(currentSession.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [fetchProfile]);

  // 1. Password Login
  const signInWithPassword = async (email, password) => {
    setError(null);
    const { data, error: authErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authErr) {
      throw new Error(authErr.message || 'Invalid email or password.');
    }

    // Load profile row to check role immediately
    let role = 'user';
    if (data?.user?.id) {
      const p = await fetchProfile(data.user.id);
      if (p?.role) role = String(p.role).toLowerCase();
    }

    return { ...data, role };
  };

  // 2. Passwordless Email OTP Login
  const signInWithOtp = async (email) => {
    setError(null);
    const { data, error: authErr } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
      },
    });

    if (authErr) {
      throw new Error(authErr.message || 'Failed to request OTP code.');
    }

    return data;
  };

  // 3. User Sign Up
  const signUp = async (email, password, fullName) => {
    setError(null);
    const { data, error: authErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName?.trim() || '',
        },
      },
    });

    if (authErr) {
      throw new Error(authErr.message || 'Failed to register account.');
    }

    return data;
  };

  // 4. Verify 6-digit OTP (for signup verification, email OTP login, or password reset)
  const verifyOtp = async ({ email, token, type = 'email' }) => {
    setError(null);
    const { data, error: authErr } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type, // 'signup' | 'email' | 'recovery'
    });

    if (authErr) {
      throw new Error(authErr.message || 'Invalid or expired 6-digit code.');
    }

    let role = 'user';
    if (data?.user?.id) {
      const p = await fetchProfile(data.user.id);
      if (p?.role) role = String(p.role).toLowerCase();
    }

    return { ...data, role };
  };

  // 5. Resend OTP code
  const resendOtp = async ({ email, type = 'email' }) => {
    setError(null);
    let result;

    if (type === 'signup') {
      result = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });
    } else if (type === 'recovery') {
      result = await supabase.auth.resetPasswordForEmail(email.trim());
    } else {
      result = await supabase.auth.signInWithOtp({
        email: email.trim(),
      });
    }

    if (result.error) {
      throw new Error(result.error.message || 'Failed to resend code.');
    }

    return result.data;
  };

  // 6. OAuth Sign In (Google & Apple)
  const signInWithOAuth = async (provider) => {
    setError(null);
    const { data, error: authErr } = await supabase.auth.signInWithOAuth({
      provider, // 'google' | 'apple'
      options: {
        redirectTo: `${window.location.origin}/auth-center`,
      },
    });

    if (authErr) {
      throw new Error(authErr.message || `Failed to sign in with ${provider}.`);
    }

    return data;
  };

  // 7. Request Password Reset Email (OTP)
  const forgotPassword = async (email) => {
    setError(null);
    const { data, error: authErr } = await supabase.auth.resetPasswordForEmail(email.trim());

    if (authErr) {
      throw new Error(authErr.message || 'Failed to send password reset code.');
    }

    return data;
  };

  // 8. Update Password (after verifying recovery OTP)
  const resetPassword = async (newPassword) => {
    setError(null);
    const { data, error: authErr } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (authErr) {
      throw new Error(authErr.message || 'Failed to update password.');
    }

    return data;
  };

  // 9. Sign Out
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out warning:', err);
    }
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  // 10. Admin Invite or Role Promotion (Calls Edge Function or fallback RLS update)
  const inviteOrPromoteAdmin = async ({ email, fullName, action = 'invite' }) => {
    setError(null);
    const cleanEmail = email.trim().toLowerCase();

    // 1. Attempt invoking Supabase Edge Function 'admin-invite'
    try {
      const { data, error: fnError } = await supabase.functions.invoke('admin-invite', {
        body: { email: cleanEmail, fullName, action },
      });

      if (!fnError && data?.success) {
        return data;
      }

      if (fnError && !fnError.message?.includes('Failed to send a request to the Edge Function')) {
        throw new Error(fnError.message || 'Edge function error.');
      }
    } catch (edgeErr) {
      console.warn('[Admin Action] Edge function invocation note:', edgeErr.message);
    }

    // 2. Direct RLS fallback: If caller is Admin, RLS policy allows updating profiles directly!
    if (action === 'promote') {
      const { data: updated, error: updateErr } = await supabase
        .from('profiles')
        .update({ role: 'admin', updated_at: new Date().toISOString() })
        .eq('email', cleanEmail)
        .select();

      if (updateErr) {
        throw new Error(updateErr.message || 'Failed to promote user in profiles table.');
      }

      if (!updated || updated.length === 0) {
        throw new Error(`No user registered with email ${cleanEmail}.`);
      }

      return {
        success: true,
        message: `Successfully promoted ${cleanEmail} to Admin in database.`,
        user: updated[0],
      };
    }

    throw new Error(
      'To invite brand-new admins by email, deploy the `admin-invite` Edge Function with SUPABASE_SERVICE_ROLE_KEY.'
    );
  };

  // Convenient aliases for backward compatibility with existing views
  const login = signInWithPassword;
  const signup = signUp;
  const oauthGoogle = () => signInWithOAuth('google');
  const oauthApple = () => signInWithOAuth('apple');

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isLoading,
        error,
        isConfigured: isSupabaseConfigured,
        // Supabase Auth APIs
        signInWithPassword,
        signInWithOtp,
        signUp,
        verifyOtp,
        resendOtp,
        signInWithOAuth,
        forgotPassword,
        resetPassword,
        logout,
        inviteOrPromoteAdmin,
        fetchProfile,
        // Aliases
        login,
        signup,
        oauthGoogle,
        oauthApple,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
