import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Check,
  Clock,
  Copy,
  Globe,
  LogOut,
  MessageCircle,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Truck,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { copy, type Lang } from '../lib/i18n';
import {
  isValidWaNumber,
  toWaDigits,
  trackingWhatsAppLink,
  type Shipment,
  type ShipmentInsert,
  type Shop,
} from '../types/database';

interface DashboardProps {
  userId: string;
  userEmail: string;
  fallbackShopName?: string;
  lang: Lang;
  onToggleLang: () => void;
}

type StatusFilter = 'all' | 'pending' | 'shipped';

function isForbiddenInsertError(error: {
  status?: number;
  code?: string;
  message?: string;
}): boolean {
  if (error.status === 403) return true;
  if (error.code === '42501') return true;
  const msg = (error.message ?? '').toLowerCase();
  return (
    msg.includes('403') ||
    msg.includes('row-level security') ||
    msg.includes('permission denied')
  );
}

// Mirrors the shipments INSERT policy: active flag AND (no expiry OR not expired)
function isShopActive(shop: Shop): boolean {
  if (!shop.subscription_active) return false;
  if (!shop.paid_until) return true;
  const until = new Date(shop.paid_until).getTime();
  return Number.isNaN(until) ? false : until > Date.now();
}

function formatCreatedAt(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function Dashboard({
  userId,
  userEmail,
  fallbackShopName,
  lang,
  onToggleLang,
}: DashboardProps) {
  const t = copy[lang];

  const [shop, setShop] = useState<Shop | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const shopDisplayName =
    shop?.shop_name?.trim() || fallbackShopName?.trim() || userEmail;

  const fetchDashboardData = useCallback(
    async (isManualRefresh = false) => {
      if (!supabase) return;
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);

      try {
        const [shopRes, shipmentsRes] = await Promise.all([
          supabase.from('shops').select('*').eq('id', userId).maybeSingle(),
          supabase
            .from('shipments')
            .select('*')
            .order('created_at', { ascending: false }),
        ]);

        if (shopRes.error) {
          throw new Error(shopRes.error.message);
        }
        if (shipmentsRes.error) {
          throw new Error(shipmentsRes.error.message);
        }

        setShop(shopRes.data);
        setShipments(shipmentsRes.data ?? []);
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : 'Failed to load shipments'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    void fetchDashboardData(false);
  }, [fetchDashboardData]);

  const handleCreateOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    setFormError(null);
    setFormSuccess(null);

    const trimmedName = customerName.trim();
    const cleanedPhone = toWaDigits(customerPhone);
    const trimmedAddress = customerAddress.trim();

    if (!trimmedName || !trimmedAddress) {
      setFormError(
        lang === 'ar'
          ? 'يرجى تعبئة اسم العميل والعنوان.'
          : 'Please fill in customer name and address.'
      );
      return;
    }

    if (!isValidWaNumber(cleanedPhone)) {
      setFormError(
        lang === 'ar'
          ? 'يرجى إدخال رقم جوال صحيح.'
          : 'Please enter a valid customer phone number.'
      );
      return;
    }

    setSubmitting(true);

    try {
      // Strictly send only customer_name, customer_phone, customer_address.
      // RLS and DB defaults handle shop_id, status, and tracking_number.
      const payload: ShipmentInsert = {
        customer_name: trimmedName,
        customer_phone: cleanedPhone,
        customer_address: trimmedAddress,
      };

      const { data, error, status } = await supabase
        .from('shipments')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        if (
          status === 403 ||
          isForbiddenInsertError({
            status,
            code: error.code,
            message: error.message,
          })
        ) {
          setFormError(t.pendingActivationError);
        } else {
          setFormError(error.message);
        }
        return;
      }

      if (data) {
        setShipments((prev) => [data, ...prev]);
      } else {
        await fetchDashboardData(true);
      }

      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setFormSuccess(t.orderSaved);
      setFormOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to create shipment'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyTracking = async (id: string, tracking: string) => {
    try {
      await navigator.clipboard.writeText(tracking);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 1800);
    } catch {
      // Clipboard API unavailable in restricted iframe contexts
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const counts = useMemo(() => {
    let pending = 0;
    let shipped = 0;
    for (const s of shipments) {
      if (s.status === 'shipped') shipped += 1;
      else pending += 1;
    }
    return { total: shipments.length, pending, shipped };
  }, [shipments]);

  const filteredShipments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return shipments.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.customer_name.toLowerCase().includes(q) ||
        s.customer_phone.toLowerCase().includes(q) ||
        s.customer_address.toLowerCase().includes(q) ||
        (s.tracking_number ?? '').toLowerCase().includes(q)
      );
    });
  }, [shipments, statusFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4 sm:gap-8">
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <PackageCheck
              className="w-6 h-6 text-emerald-600"
              aria-hidden="true"
            />
            <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              {t.brand}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-3 text-sm text-slate-600 min-w-0">
            <span className="font-medium text-slate-900 truncate max-w-[260px]">
              {shopDisplayName}
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span dir="ltr" className="font-mono text-xs text-slate-500 truncate">
              {userEmail}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleLang}
              className="min-h-[44px] px-3 sm:px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Globe className="w-4 h-4 text-slate-500" aria-hidden="true" />
              <span>{t.langSwitch}</span>
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-[44px] px-3 sm:px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-slate-500" aria-hidden="true" />
              <span className="hidden sm:inline">{t.logout}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {shop && !isShopActive(shop) && (
          <div
            role="status"
            className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-sm text-amber-900"
          >
            <AlertCircle
              className="w-5 h-5 text-amber-700 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <span className="font-medium">{t.accountInactiveNotice}</span>
          </div>
        )}

        <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
                {shopDisplayName}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                <span>
                  {t.totalOrders}:{' '}
                  <strong className="font-mono tabular-nums text-slate-900">
                    {counts.total}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {t.pendingOrders}:{' '}
                  <strong className="font-mono tabular-nums text-amber-700">
                    {counts.pending}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {t.shippedOrders}:{' '}
                  <strong className="font-mono tabular-nums text-emerald-700">
                    {counts.shipped}
                  </strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => fetchDashboardData(true)}
                disabled={refreshing}
                aria-label={t.refresh}
                className="min-h-[52px] min-w-[52px] px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">{t.refresh}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormOpen((prev) => !prev);
                  setFormError(null);
                  setFormSuccess(null);
                }}
                className={`flex-1 sm:flex-initial min-h-[52px] px-6 py-3 rounded-xl font-semibold text-base inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  formOpen
                    ? 'bg-slate-900 hover:bg-slate-800 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {formOpen ? (
                  <>
                    <X className="w-5 h-5" aria-hidden="true" />
                    <span>{t.closeForm}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" aria-hidden="true" />
                    <span>{t.newOrder}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {formSuccess && !formOpen && (
            <div
              role="status"
              className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-medium text-emerald-800 flex items-center gap-2.5"
            >
              <Check className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
              <span>{formSuccess}</span>
            </div>
          )}

          {formOpen && (
            <form
              onSubmit={handleCreateOrder}
              className="pt-5 border-t border-slate-200 space-y-4"
            >
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {t.createShipmentTitle}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {t.createShipmentSubtitle}
                </p>
              </div>

              {formError && (
                <div
                  role="alert"
                  className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm font-semibold text-red-800 flex items-start gap-2.5"
                >
                  <AlertCircle
                    className="w-5 h-5 text-red-700 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="customer_name"
                    className="block text-sm font-medium text-slate-800 mb-1.5"
                  >
                    {t.customerNameLabel}
                  </label>
                  <input
                    id="customer_name"
                    name="customer_name"
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={t.customerNamePlaceholder}
                    className="w-full min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="customer_phone"
                    className="block text-sm font-medium text-slate-800 mb-1.5"
                  >
                    {t.customerPhoneLabel}
                  </label>
                  <input
                    id="customer_phone"
                    name="customer_phone"
                    type="tel"
                    dir="ltr"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder={t.customerPhonePlaceholder}
                    className="w-full min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white text-base font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="customer_address"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  {t.customerAddressLabel}
                </label>
                <textarea
                  id="customer_address"
                  name="customer_address"
                  rows={3}
                  required
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder={t.customerAddressPlaceholder}
                  className="w-full p-4 rounded-xl border border-slate-300 bg-white text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setFormOpen(false);
                    setFormError(null);
                  }}
                  className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-base transition-colors whitespace-nowrap cursor-pointer"
                >
                  {t.closeForm}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto min-h-[52px] px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-base transition-all whitespace-nowrap cursor-pointer"
                >
                  {submitting ? t.submittingOrder : t.submitOrder}
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="grid grid-cols-3 sm:inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              {(['all', 'pending', 'shipped'] as const).map((tab) => {
                const active = statusFilter === tab;
                const label =
                  tab === 'all'
                    ? t.allFilter
                    : tab === 'pending'
                      ? t.pendingFilter
                      : t.shippedFilter;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStatusFilter(tab)}
                    className={`min-h-[40px] px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-72">
              <Search
                className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label={t.searchPlaceholder}
                className="w-full min-h-[44px] ps-10 pe-4 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>
          </div>

          {loadError && (
            <div
              role="alert"
              className="m-4 sm:m-5 p-4 rounded-xl bg-red-50 border border-red-200 text-sm font-medium text-red-800"
            >
              {loadError}
            </div>
          )}

          {loading ? (
            <div className="p-4 sm:p-6 space-y-3" aria-label={t.loadingOrders}>
              {[0, 1, 2, 3].map((row) => (
                <div
                  key={row}
                  className="h-16 rounded-xl bg-slate-100 animate-pulse"
                />
              ))}
            </div>
          ) : shipments.length === 0 ? (
            <div className="px-6 py-14 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
                <Truck className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h2 className="text-base font-semibold text-slate-900">
                  {t.emptyTitle}
                </h2>
                <p className="text-sm text-slate-500">{t.emptySubtitle}</p>
              </div>
              {!formOpen && (
                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className="min-h-[48px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>{t.newOrder}</span>
                </button>
              )}
            </div>
          ) : filteredShipments.length === 0 ? (
            <div className="px-6 py-12 text-center space-y-1.5">
              <h2 className="text-base font-semibold text-slate-900">
                {t.noMatchesTitle}
              </h2>
              <p className="text-sm text-slate-500">{t.noMatchesSubtitle}</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-200 md:hidden">
                {filteredShipments.map((s) => {
                  const isShipped = s.status === 'shipped';
                  const hasTracking = Boolean(s.tracking_number);
                  return (
                    <article key={s.id} className="p-4 space-y-3 bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-slate-900 truncate">
                            {s.customer_name}
                          </h3>
                          <p
                            dir="ltr"
                            className="text-sm font-mono tabular-nums text-slate-600 mt-0.5"
                          >
                            {s.customer_phone}
                          </p>
                        </div>
                        <span className="text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap shrink-0">
                          {formatCreatedAt(s.created_at, lang)}
                        </span>
                      </div>

                      <p className="text-sm text-slate-600 leading-relaxed">
                        {s.customer_address}
                      </p>

                      <div className="pt-1">
                        {isShipped ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                                <Truck className="w-4 h-4 shrink-0" aria-hidden="true" />
                                <span>{t.shippedStatusText}</span>
                              </span>
                              {hasTracking && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopyTracking(
                                      s.id,
                                      s.tracking_number ?? ''
                                    )
                                  }
                                  className="min-h-[36px] px-2.5 rounded-lg border border-slate-200 text-xs font-mono tabular-nums text-slate-900 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <span>{s.tracking_number}</span>
                                  {copiedId === s.id ? (
                                    <Check
                                      className="w-3.5 h-3.5 text-emerald-600"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Copy
                                      className="w-3.5 h-3.5 text-slate-400"
                                      aria-hidden="true"
                                    />
                                  )}
                                </button>
                              )}
                            </div>

                            {hasTracking && (
                              <a
                                href={trackingWhatsAppLink(s, shopDisplayName)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                              >
                                <MessageCircle
                                  className="w-5 h-5 shrink-0"
                                  aria-hidden="true"
                                />
                                <span>{t.sendWhatsApp}</span>
                              </a>
                            )}
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 text-sm font-medium text-amber-700">
                            <Clock
                              className="w-4 h-4 shrink-0"
                              aria-hidden="true"
                            />
                            <span>{t.pendingStatusText}</span>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-start border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-500">
                      <th className="py-3.5 px-5 text-start whitespace-nowrap">
                        {t.colCustomer}
                      </th>
                      <th className="py-3.5 px-5 text-start whitespace-nowrap">
                        {t.colAddress}
                      </th>
                      <th className="py-3.5 px-5 text-start whitespace-nowrap">
                        {t.colDate}
                      </th>
                      <th className="py-3.5 px-5 text-start whitespace-nowrap">
                        {t.colStatus}
                      </th>
                      <th className="py-3.5 px-5 text-end whitespace-nowrap">
                        {t.colAction}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {filteredShipments.map((s) => {
                      const isShipped = s.status === 'shipped';
                      const hasTracking = Boolean(s.tracking_number);
                      return (
                        <tr
                          key={s.id}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-4 px-5 align-top">
                            <div className="font-semibold text-slate-900">
                              {s.customer_name}
                            </div>
                            <div
                              dir="ltr"
                              className="text-xs font-mono tabular-nums text-slate-500 mt-0.5 inline-block"
                            >
                              {s.customer_phone}
                            </div>
                          </td>
                          <td className="py-4 px-5 align-top text-slate-600 max-w-xs">
                            <p className="line-clamp-2 leading-relaxed">
                              {s.customer_address}
                            </p>
                          </td>
                          <td className="py-4 px-5 align-top font-mono text-xs tabular-nums text-slate-500 whitespace-nowrap">
                            {formatCreatedAt(s.created_at, lang)}
                          </td>
                          <td className="py-4 px-5 align-top">
                            {isShipped ? (
                              <div className="space-y-1">
                                <div className="inline-flex items-center gap-1.5 font-medium text-emerald-700 whitespace-nowrap">
                                  <Truck
                                    className="w-4 h-4 shrink-0"
                                    aria-hidden="true"
                                  />
                                  <span>{t.shippedStatusText}</span>
                                </div>
                                {hasTracking && (
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      dir="ltr"
                                      className="font-mono text-xs font-semibold tabular-nums text-slate-900"
                                    >
                                      {s.tracking_number}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleCopyTracking(
                                          s.id,
                                          s.tracking_number ?? ''
                                        )
                                      }
                                      className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 cursor-pointer"
                                    >
                                      {copiedId === s.id ? (
                                        <>
                                          <Check
                                            className="w-3.5 h-3.5 text-emerald-600"
                                            aria-hidden="true"
                                          />
                                          <span>{t.copiedTracking}</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy
                                            className="w-3.5 h-3.5"
                                            aria-hidden="true"
                                          />
                                          <span>{t.copyTracking}</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 whitespace-nowrap">
                                <Clock
                                  className="w-4 h-4 shrink-0"
                                  aria-hidden="true"
                                />
                                <span>{t.pendingStatusText}</span>
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-5 align-top text-end whitespace-nowrap">
                            {isShipped && hasTracking ? (
                              <a
                                href={trackingWhatsAppLink(s, shopDisplayName)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                              >
                                <MessageCircle
                                  className="w-4 h-4 shrink-0"
                                  aria-hidden="true"
                                />
                                <span>{t.sendWhatsApp}</span>
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
