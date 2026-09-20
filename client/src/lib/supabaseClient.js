import { createClient } from '@supabase/supabase-js';

// Retrieve credentials from environment variables OR localStorage (in-browser dynamic configuration)
export function getSupabaseConfig() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  let localUrl = '';
  let localKey = '';
  try {
    localUrl = localStorage.getItem('CREA_SUPABASE_URL') || '';
    localKey = localStorage.getItem('CREA_SUPABASE_ANON_KEY') || '';
  } catch (e) {
    // Ignore localStorage access errors
  }

  const effectiveUrl = (envUrl && !envUrl.includes('placeholder') ? envUrl : localUrl).trim();
  const effectiveKey = (envKey && !envKey.includes('placeholder') ? envKey : localKey).trim();

  const isConfigured = Boolean(
    effectiveUrl &&
    effectiveKey &&
    !effectiveUrl.includes('placeholder') &&
    !effectiveKey.includes('placeholder') &&
    effectiveUrl.startsWith('https://')
  );

  return {
    url: effectiveUrl,
    anonKey: effectiveKey,
    isConfigured,
    source: envUrl && !envUrl.includes('placeholder') ? 'env' : localUrl ? 'storage' : 'none'
  };
}

const initialConfig = getSupabaseConfig();

export let isSupabaseConfigured = initialConfig.isConfigured;

// Initialize production Supabase client
export function createSupabaseInstance(url, key) {
  return createClient(
    url || 'https://placeholder.supabase.co',
    key || 'placeholder',
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
    }
  );
}

export let supabase = createSupabaseInstance(initialConfig.url, initialConfig.anonKey);

// Update credentials dynamically from UI without requiring build-time env vars
export function saveClientCredentials(url, key) {
  const cleanUrl = url.trim();
  const cleanKey = key.trim();

  try {
    localStorage.setItem('CREA_SUPABASE_URL', cleanUrl);
    localStorage.setItem('CREA_SUPABASE_ANON_KEY', cleanKey);
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }

  supabase = createSupabaseInstance(cleanUrl, cleanKey);
  isSupabaseConfigured = Boolean(
    cleanUrl &&
    cleanKey &&
    !cleanUrl.includes('placeholder') &&
    cleanUrl.startsWith('https://')
  );

  return { supabase, isSupabaseConfigured };
}

// Clear dynamically saved credentials
export function clearClientCredentials() {
  try {
    localStorage.removeItem('CREA_SUPABASE_URL');
    localStorage.removeItem('CREA_SUPABASE_ANON_KEY');
  } catch (e) {}

  const config = getSupabaseConfig();
  supabase = createSupabaseInstance(config.url, config.anonKey);
  isSupabaseConfigured = config.isConfigured;
  return { supabase, isSupabaseConfigured };
}
