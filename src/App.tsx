import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AlertCircle, Globe, PackageCheck } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { copy, type Lang } from './lib/i18n';
import { AuthScreen } from './components/AuthScreen';
import { Dashboard } from './components/Dashboard';

const LANG_STORAGE_KEY = 'shipriyadh_lang';

function getInitialLang(): Lang {
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'en' || saved === 'ar') return saved;
  } catch {
    // localStorage can be blocked (private mode / iframes); fall through
  }
  const browserLang =
    typeof navigator !== 'undefined' ? (navigator.language ?? '') : '';
  return browserLang.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

export default function App() {
  const [lang, setLang] = useState<Lang>(getInitialLang);
  const [session, setSession] = useState<Session | null>(null);
  // If Supabase isn't configured there is no session to wait for.
  const [authReady, setAuthReady] = useState<boolean>(supabase === null);

  const t = copy[lang];

  // Keep <html lang/dir> in sync so RTL/LTR layout (start/end utilities) works.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // ignore storage errors
    }
  }, [lang]);

  // Initial session check + live auth changes (login, logout, token refresh).
  useEffect(() => {
    if (!supabase) return;

    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setAuthReady(true);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setAuthReady(true);
      });

    // Keep this callback synchronous: no awaited Supabase calls inside it.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === 'en' ? 'ar' : 'en'));
  }, []);

  // 1) Missing / wrong env vars
  if (!supabase) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="border-b border-slate-200 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
              <PackageCheck
                className="w-6 h-6 text-emerald-600"
                aria-hidden="true"
              />
              <span className="text-xl font-bold tracking-tight text-slate-900">
                {t.brand}
              </span>
            </div>
            <button
              type="button"
              onClick={toggleLang}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Globe className="w-4 h-4 text-slate-500" aria-hidden="true" />
              <span>{t.langSwitch}</span>
            </button>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div
            role="alert"
            className="max-w-lg w-full p-6 rounded-2xl bg-amber-50 border border-amber-200 space-y-3"
          >
            <div className="flex items-center gap-2.5 text-amber-900">
              <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
              <h1 className="text-lg font-semibold">{t.missingEnvTitle}</h1>
            </div>
            <p className="text-sm text-amber-900 leading-relaxed">
              {t.missingEnvBody}
            </p>
            <p
              dir="ltr"
              className="text-xs font-mono text-amber-800 leading-relaxed"
            >
              VITE_SUPABASE_URL=https://&lt;project-ref&gt;.supabase.co
            </p>
          </div>
        </main>
      </div>
    );
  }

  // 2) Waiting for getSession() so we don't flash the login screen
  if (!authReady) {
    return (
      <div
        className="min-h-screen bg-white flex items-center justify-center"
        aria-busy="true"
        aria-label={t.loadingOrders}
      >
        <PackageCheck
          className="w-8 h-8 text-emerald-600 animate-pulse"
          aria-hidden="true"
        />
      </div>
    );
  }

  // 3) Logged out
  if (!session?.user) {
    return <AuthScreen lang={lang} onToggleLang={toggleLang} />;
  }

  // 4) Logged in
  const metaShopName = session.user.user_metadata?.shop_name;

  return (
    <Dashboard
      key={session.user.id}
      userId={session.user.id}
      userEmail={session.user.email ?? ''}
      fallbackShopName={typeof metaShopName === 'string' ? metaShopName : undefined}
      lang={lang}
      onToggleLang={toggleLang}
    />
  );
}
