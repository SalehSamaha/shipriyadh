import { useState, type FormEvent } from 'react';
import { Globe, PackageCheck } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { copy, type Lang } from '../lib/i18n';
import { isValidWaNumber, toWaDigits } from '../types/database';

interface AuthScreenProps {
  lang: Lang;
  onToggleLang: () => void;
}

type AuthMode = 'login' | 'signup';

export function AuthScreen({ lang, onToggleLang }: AuthScreenProps) {
  const t = copy[lang];
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          setErrorMsg(error.message);
        }
      } else {
        const cleanedPhone = toWaDigits(whatsappPhone);
        if (!shopName.trim()) {
          setErrorMsg(
            lang === 'ar'
              ? 'يرجى إدخال اسم المتجر.'
              : 'Please enter your shop name.'
          );
          setLoading(false);
          return;
        }
        if (!isValidWaNumber(cleanedPhone)) {
          setErrorMsg(
            lang === 'ar'
              ? 'يرجى إدخال رقم واتساب صحيح (مثال 05XXXXXXXX).'
              : 'Please enter a valid WhatsApp number (e.g. 05XXXXXXXX).'
          );
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              shop_name: shopName.trim(),
              whatsapp_phone: cleanedPhone,
            },
          },
        });

        if (error) {
          setErrorMsg(error.message);
        } else if (!data.session) {
          setSuccessMsg(t.signupConfirmEmail);
          setMode('login');
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <PackageCheck className="w-6 h-6 text-emerald-600" aria-hidden="true" />
            <span className="text-xl font-bold tracking-tight text-slate-900">
              {t.brand}
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleLang}
            className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Globe className="w-4 h-4 text-slate-500" aria-hidden="true" />
            <span>{t.langSwitch}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-14 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        <section className="lg:col-span-5 space-y-5 pt-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 text-balance leading-tight">
            {t.heroTitle}
          </h1>
          <p className="text-base text-slate-600 leading-relaxed">
            {t.heroSubtitle}
          </p>
          <div className="pt-2 border-t border-slate-200 space-y-3 text-sm text-slate-600">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                01
              </span>
              <span>
                {lang === 'ar'
                  ? 'أضف اسم العميل ورقمه وعنوانه في نموذج سريع.'
                  : 'Paste customer name, phone, and Riyadh address in one form.'}
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                02
              </span>
              <span>
                {lang === 'ar'
                  ? 'احصل على رقم التتبع مباشرة في جدول طلباتك.'
                  : 'Track every shipment status in your live shop table.'}
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                03
              </span>
              <span>
                {lang === 'ar'
                  ? 'أرسل رسالة واتساب جاهزة برقم التتبع للعميل بضغطة زر.'
                  : 'Send pre-filled WhatsApp tracking messages with one tap.'}
              </span>
            </div>
          </div>
        </section>

        <section className="lg:col-span-7 w-full">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8">
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`min-h-[44px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.loginTab}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`min-h-[44px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.signupTab}
              </button>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-sm font-medium text-red-800"
              >
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div
                role="status"
                className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-medium text-emerald-800"
              >
                {successMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <>
                  <div>
                    <label
                      htmlFor="shop_name"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      {t.shopNameLabel}
                    </label>
                    <input
                      id="shop_name"
                      name="shop_name"
                      type="text"
                      required
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder={t.shopNamePlaceholder}
                      className="w-full min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="whatsapp_phone"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      {t.whatsappLabel}
                    </label>
                    <input
                      id="whatsapp_phone"
                      name="whatsapp_phone"
                      type="tel"
                      dir="ltr"
                      required
                      value={whatsappPhone}
                      onChange={(e) => setWhatsappPhone(e.target.value)}
                      placeholder={t.whatsappPlaceholder}
                      className="w-full min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white text-base font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                    />
                  </div>
                </>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  {t.emailLabel}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  className="w-full min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  {t.passwordLabel}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  dir="ltr"
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                  minLength={6}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                  className="w-full min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[52px] px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-base transition-all cursor-pointer"
                >
                  {loading
                    ? mode === 'login'
                      ? t.loggingIn
                      : t.signingUp
                    : mode === 'login'
                      ? t.loginButton
                      : t.signupButton}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
