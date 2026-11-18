import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  LayoutDashboard,
  Zap,
  CreditCard,
  Bell,
  ArrowRight,
  Check,
  ChevronDown,
  Sparkles,
  ExternalLink,
  Smartphone,
  QrCode,
  X,
  Copy,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Settings,
} from 'lucide-react';
import {
  BOT_URL,
  ADMIN_URL,
  DEMO_URL,
  STEPS,
  FEATURES,
  FAQ,
  LEGAL_SECTIONS,
} from './content.js';

const API_BASE =
  import.meta.env.VITE_API_URL ??
  (typeof window !== 'undefined' && window.location.port === '5175'
    ? 'http://localhost:3000'
    : '');

// STRICTLY for Platform SaaS Subscription checkout ONLY
const PLATFORM_PAYNET_QR_URL =
  "https://app.paynet.uz/qr-online/00020101021140440012qr-online.uz01186r2s8nPSzGNGRQjdxV0202115204531153038605802UZ5910AO'PAYNET'6008Tashkent610610002164280002uz0106PAYNET0208Toshkent80520012qr-online.uz03097120207070419marketing@paynet.uz63043D65";

type SelfServePlanId = 'BASIC_20' | 'PRO_30';

const TARIFF_DETAILS: Record<
  SelfServePlanId,
  {
    name: string;
    usdPrice: string;
    period: string;
    uzsPrice: string;
    amountUzs: number;
  }
> = {
  BASIC_20: {
    name: 'Базовый чат-бот (Basic)',
    usdPrice: '$20',
    period: '/ мес',
    uzsPrice: '255 000 сум',
    amountUzs: 255000,
  },
  PRO_30: {
    name: 'Pro Mini App',
    usdPrice: '$30',
    period: '/ мес',
    uzsPrice: '385 000 сум',
    amountUzs: 385000,
  },
};

interface CheckoutStep2Data {
  token: string;
  invoiceNumber: string;
  subscriptionId: string;
  amountUzs: number;
  paynetQrUrl: string;
  botDeepLink: string;
  plan: SelfServePlanId;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function App() {
  const [activeTab, setActiveTab] = useState<'miniapp' | 'bot' | 'admin'>('miniapp');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [openLegalId, setOpenLegalId] = useState<string | null>('operator');

  // Unified 2-Step Checkout Modal State
  const [selectedPlan, setSelectedPlan] = useState<SelfServePlanId | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmittingStep1, setIsSubmittingStep1] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);

  const [checkoutData, setCheckoutData] = useState<CheckoutStep2Data | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [qrLoadError, setQrLoadError] = useState(false);
  const [copiedField, setCopiedField] = useState<'link' | 'invoice' | null>(null);
  const [isNotifying, setIsNotifying] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedPlan) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmittingStep1 && !isNotifying) {
        setSelectedPlan(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPlan, isSubmittingStep1, isNotifying]);

  const openPaymentModal = (plan: SelfServePlanId) => {
    setSelectedPlan(plan);
    setCheckoutStep(1);
    setCheckoutData(null);
    setStep1Error(null);
    setNotifyError(null);
    setReviewSubmitted(false);
    setPaymentReference('');
    setQrLoadError(false);
    setCopiedField(null);
  };

  const handleCopy = async (field: 'link' | 'invoice', text: string) => {
    const ok = await copyToClipboard(text);
    if (!ok) return;
    setCopiedField(field);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopiedField((curr) => (curr === field ? null : curr));
    }, 2000);
  };

  const handleStep1CreateAccountAndInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;

    setStep1Error(null);
    if (!email.trim() || !password || !storeName.trim()) {
      setStep1Error('Укажите email, пароль и название магазина.');
      return;
    }
    if (password.length < 6) {
      setStep1Error('Пароль должен содержать минимум 6 символов.');
      return;
    }

    setIsSubmittingStep1(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlan,
          email: email.trim(),
          password,
          storeName: storeName.trim(),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Ошибка создания счёта (${res.status})`);
      }

      const data = await res.json();
      if (data.token) {
        try {
          localStorage.setItem('tg_merchant_token', data.token);
        } catch {
          // ignore storage restrictions
        }
      }

      const invoiceNumber =
        data.subscription?.invoice_number || data.invoiceNumber || `INV-${Date.now()}`;
      const subscriptionId = data.subscription?.id || data.subscriptionId || '';
      const amountUzs =
        data.subscription?.amount_uzs ||
        data.priceUzs ||
        TARIFF_DETAILS[selectedPlan].amountUzs;

      setCheckoutData({
        token: data.token || '',
        invoiceNumber,
        subscriptionId,
        amountUzs,
        paynetQrUrl: data.paynetQrUrl || PLATFORM_PAYNET_QR_URL,
        botDeepLink: data.botDeepLink || BOT_URL,
        plan: selectedPlan,
      });
      setCheckoutStep(2);
    } catch (err: any) {
      setStep1Error(err?.message || 'Не удалось создать аккаунт и выставить счёт.');
    } finally {
      setIsSubmittingStep1(false);
    }
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutData) return;

    setIsNotifying(true);
    setNotifyError(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/billing/confirm-paynet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(checkoutData.token ? { Authorization: `Bearer ${checkoutData.token}` } : {}),
        },
        body: JSON.stringify({
          plan: checkoutData.plan,
          invoiceNumber: checkoutData.invoiceNumber,
          subscriptionId: checkoutData.subscriptionId || undefined,
          paymentReference: paymentReference.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Ошибка отправки (${res.status})`);
      }

      setReviewSubmitted(true);
    } catch (err: any) {
      setNotifyError(err?.message || 'Не удалось отправить заявку об оплате на проверку.');
    } finally {
      setIsNotifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 text-slate-100 selection:bg-brand selection:text-white">
      {/* Glow ambient background accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-brand/15 blur-[120px] rounded-full" />
        <div className="absolute top-[800px] right-0 w-[500px] h-[400px] bg-sky-500/10 blur-[130px] rounded-full" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-dark-950/80 backdrop-blur-md border-b border-white/[0.08]">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center font-bold text-white shadow-lg shadow-brand/25">
              <Zap className="w-4 h-4 fill-white" />
            </div>
            <span className="font-bold text-base tracking-tight text-white">
              Mirai Commerce
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">
              Возможности
            </a>
            <a href="#demo" className="hover:text-white transition-colors">
              Интерактивное демо
            </a>
            <a href="#comparison" className="hover:text-white transition-colors">
              Сравнение
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">
              Тарифы
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              FAQ
            </a>
            <a href="#legal" className="hover:text-white transition-colors">
              Правовая информация
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <a
              href={ADMIN_URL}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold px-3.5 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-slate-200 transition-colors"
            >
              Вход в админку
            </a>
            <button
              type="button"
              onClick={() => openPaymentModal('PRO_30')}
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white shadow-lg shadow-brand/20 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span>Создать магазин</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 pt-16 pb-20 md:pt-24 md:pb-28 text-center px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-xs font-medium text-brand-light">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Платформа Telegram-торговли • Ташкент и Узбекистан</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
            Продавайте в Telegram через{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300">
              Mini App и умного бота
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Полноэкранный Telegram Mini App, бот для заказов в чате и веб-панель управления. Приём оплаты через Paynet QR-Online (Uzcard, Humo — 0% по условиям Paynet для самозанятых и ИП; для ООО условия по договору с Paynet).
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => openPaymentModal('PRO_30')}
              className="w-full sm:w-auto h-12 px-7 rounded-xl bg-brand hover:bg-brand-dark font-semibold text-sm text-white shadow-xl shadow-brand/25 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Bot className="w-4 h-4" />
              <span>Запустить свой магазин</span>
            </button>

            <a
              href={DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto h-12 px-6 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 font-semibold text-sm text-slate-200 flex items-center justify-center gap-2 transition-all"
            >
              <Smartphone className="w-4 h-4 text-sky-400" />
              <span>Посмотреть демо-витрину</span>
            </a>
          </div>

          {/* Honest Badges */}
          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-medium">
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>0% комиссия платформы с ваших продаж</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Пошаговый запуск за ~10 минут</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Мгновенные уведомления и очередь проверки оплат</span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Showcase Section */}
      <section id="demo" className="relative z-10 py-16 px-4 bg-dark-900/60 border-y border-white/[0.08]">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
              Интерактивный предпросмотр платформы
            </h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              Посмотрите 3 части экосистемы: витрину покупателя, чат-бота и веб-панель управления.
            </p>

            {/* Tab switchers */}
            <div className="inline-flex p-1 rounded-xl bg-dark-850 border border-white/10 mt-3 flex-wrap justify-center">
              <button
                type="button"
                onClick={() => setActiveTab('miniapp')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'miniapp'
                    ? 'bg-brand text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>1. Telegram Mini App</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('bot')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'bot'
                    ? 'bg-brand text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>2. Обычный бот в чате</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'admin'
                    ? 'bg-brand text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>3. Админка мерчанта</span>
              </button>
            </div>
          </div>

          {/* Interactive Screen Container */}
          <div className="relative rounded-2xl border border-white/10 bg-dark-950 p-4 sm:p-8 overflow-hidden shadow-2xl">
            {activeTab === 'miniapp' && (
              <div className="max-w-md mx-auto rounded-3xl border-2 border-slate-700 bg-white text-zinc-900 overflow-hidden shadow-2xl">
                <div className="bg-zinc-100 px-5 py-2.5 flex items-center justify-between text-xs text-zinc-500 border-b border-zinc-200">
                  <span className="font-semibold text-zinc-800">9:41</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-blue-600">MODA Tashkent (Демо)</span>
                  </div>
                  <span>100%</span>
                </div>

                <div className="p-4 border-b border-zinc-100 bg-white flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-zinc-900">MODA Tashkent</h4>
                    <p className="text-[11px] text-zinc-500">Демонстрационная витрина одежды и обуви</p>
                  </div>
                  <span className="px-2 py-1 rounded bg-zinc-100 text-xs font-medium text-zinc-700">
                    RU
                  </span>
                </div>

                <div className="px-4 py-2.5 flex gap-1.5 overflow-x-auto bg-zinc-50 border-b border-zinc-100">
                  <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-semibold">
                    Все товары
                  </span>
                  <span className="px-3 py-1 rounded-full bg-zinc-200 text-zinc-700 text-xs font-medium">
                    Одежда
                  </span>
                  <span className="px-3 py-1 rounded-full bg-zinc-200 text-zinc-700 text-xs font-medium">
                    Обувь
                  </span>
                  <span className="px-3 py-1 rounded-full bg-zinc-200 text-zinc-700 text-xs font-medium">
                    Аксессуары
                  </span>
                </div>

                <div className="p-4 grid grid-cols-2 gap-3 bg-zinc-50">
                  <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden p-2.5 space-y-2">
                    <div className="aspect-square bg-zinc-100 rounded-lg overflow-hidden">
                      <img
                        src="https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=400&q=80"
                        alt="Худи"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-900 truncate">Худи Tashkent Edition</p>
                      <p className="text-[10px] text-zinc-500">Размеры: S · M · L</p>
                      <p className="text-xs font-bold text-zinc-900 mt-1">420 000 сум</p>
                    </div>
                    <button type="button" className="w-full py-1.5 rounded-lg bg-blue-50 text-blue-600 font-semibold text-xs">
                      Выбрать размер
                    </button>
                  </div>

                  <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden p-2.5 space-y-2">
                    <div className="aspect-square bg-zinc-100 rounded-lg overflow-hidden">
                      <img
                        src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80"
                        alt="Кроссовки"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-900 truncate">Кроссовки Classic Street</p>
                      <p className="text-[10px] text-zinc-500">Размеры: 39 · 40 · 41</p>
                      <p className="text-xs font-bold text-zinc-900 mt-1">650 000 сум</p>
                    </div>
                    <button type="button" className="w-full py-1.5 rounded-lg bg-blue-50 text-blue-600 font-semibold text-xs">
                      Выбрать размер
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-white border-t border-zinc-200">
                  <button type="button" className="w-full py-3 rounded-xl bg-blue-600 font-bold text-white text-xs flex items-center justify-between px-4">
                    <span>Корзина (2)</span>
                    <span>1 070 000 сум</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'bot' && (
              <div className="max-w-md mx-auto rounded-2xl border border-slate-700 bg-dark-900 p-4 space-y-4 font-sans text-xs">
                <div className="flex items-center gap-2.5 pb-3 border-b border-white/10 text-slate-300">
                  <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center font-bold text-white">
                    M
                  </div>
                  <div>
                    <div className="font-semibold text-white">@miraiedu_bot</div>
                    <div className="text-[10px] text-emerald-400">бот онлайн</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-dark-850 border border-white/10 space-y-2">
                  <p className="font-bold text-white text-sm">🛍️ Оверсайз худи Tashkent Edition</p>
                  <p className="text-slate-400 text-xs">100% узбекский хлопок пенье, плотность 420г/м². Размеры: S, M, L.</p>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-emerald-400 font-semibold">🟢 В наличии (35 шт.)</span>
                    <span className="text-white font-bold text-sm">420 000 сум</span>
                  </div>
                  <div className="pt-2 space-y-1.5">
                    <button type="button" className="w-full py-2 rounded-lg bg-brand text-white font-semibold text-xs">
                      ➕ В корзину (420 000 сум)
                    </button>
                    <div className="grid grid-cols-3 gap-1.5 text-center text-slate-300">
                      <span className="py-1.5 rounded bg-white/5 border border-white/5">⬅️ Назад</span>
                      <span className="py-1.5 font-semibold text-white">1 / 8</span>
                      <span className="py-1.5 rounded bg-white/5 border border-white/5">Вперед ➡️</span>
                    </div>
                    <button type="button" className="w-full py-2 rounded-lg bg-white/10 text-white font-semibold text-xs">
                      🛒 Оформить с телефоном и доставкой
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'admin' && (
              <div className="rounded-xl border border-white/10 bg-white text-zinc-900 p-5 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                  <div>
                    <h3 className="font-bold text-base text-zinc-900">MODA Tashkent • Панель управления</h3>
                    <p className="text-xs text-zinc-500">Тариф Pro · $30/мес</p>
                  </div>
                  <a href={ADMIN_URL} target="_blank" rel="noreferrer" className="text-xs font-semibold px-3 py-1.5 rounded bg-zinc-900 text-white flex items-center gap-1">
                    <span>Открыть админку</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-lg border border-zinc-200 bg-zinc-50">
                    <div className="text-xs text-zinc-500">Выручка за 14 дней</div>
                    <div className="text-xl font-bold text-zinc-900 mt-1">14 250 000 сум</div>
                  </div>
                  <div className="p-3.5 rounded-lg border border-zinc-200 bg-zinc-50">
                    <div className="text-xs text-zinc-500">Оплаченные заказы</div>
                    <div className="text-xl font-bold text-zinc-900 mt-1">42</div>
                  </div>
                  <div className="p-3.5 rounded-lg border border-zinc-200 bg-zinc-50">
                    <div className="text-xs text-zinc-500">На проверке оплаты</div>
                    <div className="text-xl font-bold text-sky-600 mt-1">3</div>
                  </div>
                  <div className="p-3.5 rounded-lg border border-zinc-200 bg-zinc-50">
                    <div className="text-xs text-zinc-500">Готовность витрины</div>
                    <div className="text-xl font-bold text-emerald-600 mt-1">4 / 4</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Core Advantages */}
      <section id="features" className="relative z-10 py-20 px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
              Как устроен магазин внутри Telegram
            </h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              Покупатель оформляет заказ в привычном мессенджере, а вы контролируете каталог, остатки и поступление оплат.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-dark-900 border border-white/[0.08] space-y-4 hover:border-brand/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-brand-light flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">Быстрое оформление без регистрации</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Telegram передаёт имя и профиль пользователя (initData), а контактный телефон, способ получения (курьер или самовывоз) и адрес покупатель указывает и подтверждает прямо в форме заказа.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-dark-900 border border-white/[0.08] space-y-4 hover:border-brand/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">Paynet QR-Online и честная проверка</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ставка 0% в Paynet Xolis применяется по условиям Paynet (преимущественно для самозанятых и ИП; для ООО комиссия определяется договором с Paynet). Для цифровых товаров внутри Telegram учитываются правила Telegram Stars.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-dark-900 border border-white/[0.08] space-y-4 hover:border-brand/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">Контроль оплат и остатков</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                После нажатия покупателем «Я оплатил» заказ переходит в статус «На проверке оплаты». Вы проверяете поступление по ID транзакции Paynet и подтверждаете перевод в 1 клик.
              </p>
            </div>
          </div>

          {/* Step-by-step launch (~10 min) */}
          <div className="pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((step) => (
              <div
                key={step.title}
                className="p-5 rounded-xl bg-dark-900/70 border border-white/[0.07] space-y-2"
              >
                <h4 className="text-sm font-semibold text-white">{step.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {FEATURES.map((feat) => (
              <div
                key={feat.term}
                className="p-4 rounded-xl bg-dark-950/60 border border-white/[0.06] space-y-1.5"
              >
                <div className="text-xs font-semibold text-white">{feat.term}</div>
                <div className="text-xs text-slate-400 leading-relaxed">{feat.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section id="comparison" className="relative z-10 py-16 px-4 bg-dark-900/40 border-t border-white/[0.08]">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Обычный чат-бот или Pro Mini App?
            </h2>
            <p className="text-xs text-slate-400">
              Сравнение форматов для вашего бизнеса
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-dark-950 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="p-4">Возможность</th>
                  <th className="p-4">Базовый чат-бот</th>
                  <th className="p-4 text-brand-light font-bold">Pro Mini App</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-slate-300">
                <tr>
                  <td className="p-4 font-medium text-white">Интерфейс витрины</td>
                  <td className="p-4">Сообщения с кнопками в чате</td>
                  <td className="p-4 text-brand-light font-medium">Полноэкранный WebApp внутри Telegram</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-white">Поиск, категории и варианты</td>
                  <td className="p-4">Категории и inline-кнопки</td>
                  <td className="p-4 text-brand-light font-medium">Живой поиск, чипсы категорий и выбор размеров</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-white">Юридические реквизиты и доставка</td>
                  <td className="p-4 text-emerald-400">Включено перед оплатой</td>
                  <td className="p-4 text-emerald-400">Расчёт доставки + реквизиты до оплаты</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-white">Веб-панель и загрузка фото/CSV</td>
                  <td className="p-4 text-emerald-400">Включена</td>
                  <td className="p-4 text-emerald-400">Включена + экспорт CSV</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative z-10 py-20 px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
              Прозрачные тарифы без скрытых платежей
            </h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              Никаких процентов платформы с ваших продаж. Абонентская плата оплачивается по счёту через Paynet QR-Online.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Basic Plan */}
            <div className="rounded-2xl border border-white/10 bg-dark-900 p-6 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white/5 text-slate-300">
                  Для быстрого старта
                </span>
                <h3 className="text-xl font-bold text-white">Basic</h3>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-white">$20</span>
                    <span className="text-xs text-slate-400">/ месяц</span>
                  </div>
                  <div className="text-xs font-medium text-emerald-400 mt-1 tabular">
                    255 000 сум / мес по Paynet QR-Online
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Каталог товаров, корзина и оформление заказов в сообщениях Telegram.
                </p>

                <ul className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-white/10">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Интерактивный каталог и корзина в чате</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Сбор телефона, способа доставки и адреса</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Оплата через ваш Paynet QR-Online</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Панель управления товарами и заказами</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => openPaymentModal('BASIC_20')}
                className="w-full py-3 rounded-xl border border-white/15 hover:bg-white/5 text-center text-xs font-semibold text-white transition-colors"
              >
                Оформить и выставить счёт
              </button>
            </div>

            {/* Pro Mini App Plan (Featured) */}
            <div className="relative rounded-2xl border-2 border-brand bg-dark-900 p-6 space-y-6 flex flex-col justify-between shadow-2xl shadow-brand/20">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-brand text-white text-[11px] font-bold uppercase tracking-wider">
                Хит продаж
              </div>

              <div className="space-y-4">
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-brand/10 text-brand-light">
                  Максимум конверсии
                </span>
                <h3 className="text-xl font-bold text-white">Pro Mini App</h3>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-white">$30</span>
                    <span className="text-xs text-slate-400">/ месяц</span>
                  </div>
                  <div className="text-xs font-medium text-emerald-400 mt-1 tabular">
                    385 000 сум / мес по Paynet QR-Online
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Полноэкранная витрина Telegram Mini App с поиском, размерами и ботом.
                </p>

                <ul className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-white/10">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-light shrink-0" />
                    <span className="font-medium text-white">Полноэкранный Telegram Mini App</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-light shrink-0" />
                    <span>Поиск по каталогу, категории и размеры/варианты</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-light shrink-0" />
                    <span>Кнопки Telegram MainButton и BackButton</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-light shrink-0" />
                    <span>Персональный Paynet QR-Online + проверка оплат</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-light shrink-0" />
                    <span>Аналитика выручки и экспорт заказов CSV</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => openPaymentModal('PRO_30')}
                className="w-full py-3 rounded-xl bg-brand hover:bg-brand-dark text-center text-xs font-bold text-white shadow-lg shadow-brand/20 transition-all active:scale-95"
              >
                Оформить и выставить счёт
              </button>
            </div>

            {/* Standalone VPS Turnkey (Contact Support — No self-serve checkout) */}
            <div className="rounded-2xl border border-white/10 bg-dark-900 p-6 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white/5 text-slate-300">
                  Индивидуальное внедрение
                </span>
                <h3 className="text-xl font-bold text-white">Standalone VPS</h3>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-white">$350</span>
                    <span className="text-xs text-slate-400">под ключ</span>
                  </div>
                  <div className="text-xs font-medium text-slate-400 mt-1 tabular">
                    4 500 000 сум · по договору и согласованию
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Автономный сервер (Docker, PostgreSQL, Redis, HTTPS) и установка под ваш бренд.
                </p>

                <ul className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-white/10">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Развёртывание на вашем отдельном VPS</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Без ежемесячной SaaS-подписки</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Полный доступ к коду платформы</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Помощь инженера при первом запуске</span>
                  </li>
                </ul>
              </div>

              <a
                href={BOT_URL}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 rounded-xl border border-white/15 hover:bg-white/5 text-center text-xs font-semibold text-white transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <span>Запросить внедрение (Telegram)</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="relative z-10 py-16 px-4 max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Частые вопросы</h2>
          <p className="text-xs text-slate-400">Честные ответы перед стартом продаж</p>
        </div>

        <div className="space-y-3">
          {FAQ.map((item, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-white/10 bg-dark-900 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full p-4 text-left flex items-center justify-between text-sm font-semibold text-white hover:text-brand-light transition-colors"
              >
                <span>{item.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 ml-3 transition-transform ${
                    openFaq === idx ? 'rotate-180 text-brand-light' : ''
                  }`}
                />
              </button>
              {openFaq === idx && (
                <div className="px-4 pb-4 text-xs text-slate-400 leading-relaxed border-t border-white/[0.06] pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Compliance / Legal / Requisites / Terms & Privacy Section */}
      <section id="legal" className="relative z-10 py-14 px-4 max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <h2 className="text-xl font-bold text-white">
                Правовая информация, реквизиты и поддержка
              </h2>
              <p className="text-xs text-slate-400">
                Публичная оферта SaaS, политика конфиденциальности и условия возврата
              </p>
            </div>
          </div>
          <a
            href={BOT_URL}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-brand-light hover:underline inline-flex items-center gap-1"
          >
            <span>Поддержка: @miraiedu_bot</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="space-y-2.5">
          {LEGAL_SECTIONS.map((sec) => {
            const isOpen = openLegalId === sec.id;
            return (
              <div
                key={sec.id}
                className="rounded-xl border border-white/10 bg-dark-900 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenLegalId(isOpen ? null : sec.id)}
                  className="w-full px-4 py-3.5 text-left flex items-center justify-between text-xs sm:text-sm font-semibold text-white hover:text-brand-light transition-colors"
                >
                  <span>{sec.title}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 ml-3 transition-transform ${
                      isOpen ? 'rotate-180 text-brand-light' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-2 border-t border-white/[0.06] space-y-2 text-xs text-slate-400 leading-relaxed">
                    {sec.body.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-10 px-4 border-t border-white/[0.08] text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-400 font-semibold">
            <Zap className="w-4 h-4 text-brand" />
            <span>Mirai Commerce Platform</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5">
            <a href="#legal" className="hover:text-white transition-colors">
              Оферта и конфиденциальность
            </a>
            <a href={BOT_URL} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              Поддержка (@miraiedu_bot)
            </a>
            <a href={DEMO_URL} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              Демо-витрина
            </a>
            <a href={ADMIN_URL} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              Панель мерчанта
            </a>
          </div>

          <div>© 2026 Mirai Commerce.</div>
        </div>
      </footer>

      {/* Unified 2-Step Account & Paynet Billing Modal */}
      {selectedPlan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => !isSubmittingStep1 && !isNotifying && setSelectedPlan(null)}
        >
          <div
            className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-white/15 bg-dark-900 p-6 shadow-2xl space-y-5 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand/15 text-brand-light text-[11px] font-semibold mb-1.5">
                  <span>Шаг {checkoutStep} из 2</span>
                  <span>·</span>
                  <span>
                    {checkoutStep === 1 ? 'Аккаунт магазина' : 'Оплата счёта Paynet'}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  {TARIFF_DETAILS[selectedPlan].name}
                </h3>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-extrabold text-white tabular">
                    {TARIFF_DETAILS[selectedPlan].usdPrice}
                  </span>
                  <span className="text-xs text-slate-400">
                    {TARIFF_DETAILS[selectedPlan].period}
                  </span>
                  <span className="text-sm font-semibold text-emerald-400 tabular">
                    · {TARIFF_DETAILS[selectedPlan].uzsPrice}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPlan(null)}
                disabled={isSubmittingStep1 || isNotifying}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {checkoutStep === 1 && (
              <>
                {/* Plan Switcher Pills (Self-serve plans ONLY) */}
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-dark-950 border border-white/10">
                  {(['BASIC_20', 'PRO_30'] as const).map((planKey) => (
                    <button
                      key={planKey}
                      type="button"
                      onClick={() => {
                        setSelectedPlan(planKey);
                        setStep1Error(null);
                      }}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                        selectedPlan === planKey
                          ? 'bg-brand text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {planKey === 'BASIC_20' ? 'Basic · $20 / 255 000 сум' : 'Pro Mini App · $30 / 385 000 сум'}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleStep1CreateAccountAndInvoice} className="space-y-3.5">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Эти данные создадут ваш единый аккаунт для входа в админ-панель и привязки Telegram-бота. Если у вас уже есть аккаунт — введите его email и пароль.
                  </p>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Название магазина *
                    </label>
                    <input
                      type="text"
                      required
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Например: MODA Tashkent"
                      className="w-full h-10 px-3 rounded-xl bg-dark-950 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="owner@shop.uz"
                        className="w-full h-10 px-3 rounded-xl bg-dark-950 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Пароль * (от 6 символов)
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-10 px-3 rounded-xl bg-dark-950 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Телефон (необязательно)
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+998 90 123-45-67"
                      className="w-full h-10 px-3 rounded-xl bg-dark-950 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand"
                    />
                  </div>

                  {step1Error && (
                    <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span>{step1Error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmittingStep1}
                    className="w-full py-3 rounded-xl bg-brand hover:bg-brand-dark disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-brand/20 transition-all"
                  >
                    {isSubmittingStep1
                      ? 'Создание аккаунта и счёта…'
                      : 'Продолжить к оплате (Выставить счёт)'}
                  </button>
                </form>
              </>
            )}

            {checkoutStep === 2 && checkoutData && (
              <div className="space-y-4">
                {/* Invoice Strip */}
                <div className="p-3.5 rounded-xl bg-dark-950 border border-white/10 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] text-slate-400">Номер выставленного счёта</div>
                    <div className="text-sm font-mono font-bold text-white">
                      {checkoutData.invoiceNumber}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy('invoice', checkoutData.invoiceNumber)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs text-slate-200 inline-flex items-center gap-1.5"
                  >
                    {copiedField === 'invoice' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Скопировано</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Копировать</span>
                      </>
                    )}
                  </button>
                </div>

                {/* QR Code & Direct Paynet Links */}
                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-dark-950 border border-white/10">
                  <div className="w-40 h-40 rounded-xl bg-white p-2 flex items-center justify-center shrink-0">
                    {qrLoadError ? (
                      <div className="text-center space-y-1.5 px-2">
                        <QrCode className="w-8 h-8 text-emerald-600 mx-auto" />
                        <p className="text-[11px] font-semibold text-zinc-900">
                          QR-код недоступен
                        </p>
                        <p className="text-[10px] text-zinc-500">
                          Нажмите «Перейти в Paynet»
                        </p>
                      </div>
                    ) : (
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(
                          checkoutData.paynetQrUrl
                        )}`}
                        alt="Paynet QR-Online"
                        onError={() => setQrLoadError(true)}
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>

                  <div className="flex-1 space-y-2.5 w-full">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Отсканируйте QR в Paynet и оплатите{' '}
                      <strong className="text-white tabular">
                        {checkoutData.amountUzs.toLocaleString('ru-RU')} сум
                      </strong>{' '}
                      ({TARIFF_DETAILS[checkoutData.plan].usdPrice}).
                    </p>

                    <a
                      href={checkoutData.paynetQrUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>⚡ Перейти в Paynet для оплаты</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() => handleCopy('link', checkoutData.paynetQrUrl)}
                      className="w-full py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {copiedField === 'link' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-semibold">Ссылка скопирована!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Скопировать ссылку Paynet</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Payment Confirmation Form OR Review Status */}
                {!reviewSubmitted ? (
                  <form onSubmit={handleConfirmPayment} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Номер чека / транзакции Paynet (необязательно)
                      </label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="Например: чек №123456"
                        className="w-full h-10 px-3 rounded-xl bg-dark-950 border border-white/10 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-brand"
                      />
                    </div>

                    {notifyError && (
                      <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <span>{notifyError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isNotifying}
                      className="w-full py-3 rounded-xl bg-brand hover:bg-brand-dark disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-brand/20 transition-all"
                    >
                      {isNotifying
                        ? 'Отправка на проверку…'
                        : '✅ Я оплатил — отправить на проверку'}
                    </button>
                  </form>
                ) : (
                  <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold text-white">
                        Заявка на проверке · {checkoutData.invoiceNumber}
                      </div>
                      <p className="leading-relaxed opacity-90">
                        Оплата отправлена на проверку администратору платформы. После подтверждения подписка активируется на 30 дней. Пока идёт проверка, вы уже можете привязать бота и настроить каталог!
                      </p>
                    </div>
                  </div>
                )}

                {/* Two Clear Handoff Buttons */}
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <a
                    href={checkoutData.botDeepLink}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/15 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>🤖 Подключить бота в @miraiedu_bot</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
                  </a>

                  <a
                    href={`${ADMIN_URL}?tab=settings`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl border border-white/15 hover:bg-white/5 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>⚙️ Открыть панель магазина (/admin/)</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
