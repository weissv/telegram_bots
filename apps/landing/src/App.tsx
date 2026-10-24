import React, { useState } from 'react';
import {
  ShoppingBag,
  Bot,
  LayoutDashboard,
  Zap,
  ShieldCheck,
  CreditCard,
  Bell,
  ArrowRight,
  Check,
  ChevronDown,
  Sparkles,
  ExternalLink,
  Smartphone,
  Star,
  Globe,
} from 'lucide-react';

const BOT_URL = 'https://t.me/miraiedu_bot';
const DEMO_MINIAPP_URL = '/miniapp/?tenant_id=00000000-0000-0000-0000-000000000001';
const ADMIN_URL = '/admin/';

export function App() {
  const [activeTab, setActiveTab] = useState<'miniapp' | 'bot' | 'admin'>('miniapp');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

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
            <a
              href={BOT_URL}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white shadow-lg shadow-brand/20 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span>Запустить бота</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 pt-16 pb-20 md:pt-24 md:pb-28 text-center px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-xs font-medium text-brand-light">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Платформа Telegram-торговли нового поколения • Ташкент & СНГ</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
            Продавайте в Telegram с конверсией{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300">
              в 3 раза выше сайтов
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Полноэкранный Telegram Mini App, умный бот для заказов прямо в чате и удобная веб-панель для мерчанта. Прием платежей через Uzcard, Humo, Click, Payme, Visa и Telegram Stars в один клик.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <a
              href={BOT_URL}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto h-12 px-7 rounded-xl bg-brand hover:bg-brand-dark font-semibold text-sm text-white shadow-xl shadow-brand/25 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Bot className="w-4 h-4" />
              <span>Открыть демо в Telegram</span>
            </a>

            <a
              href={DEMO_MINIAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto h-12 px-6 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 font-semibold text-sm text-slate-200 flex items-center justify-center gap-2 transition-all"
            >
              <Smartphone className="w-4 h-4 text-sky-400" />
              <span>Полноэкранная витрина (Web)</span>
            </a>
          </div>

          {/* Social Proof Badges */}
          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-medium">
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>0% комиссий платформы</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Запуск за 2 минуты без кода</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Мгновенные уведомления о заказах</span>
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
              Попробуйте все 3 грани экосистемы: витрину покупателя, чат-бота и веб-панель управления.
            </p>

            {/* Tab switchers */}
            <div className="inline-flex p-1 rounded-xl bg-dark-850 border border-white/10 mt-3">
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
                {/* Simulated Phone Bar */}
                <div className="bg-zinc-100 px-5 py-2.5 flex items-center justify-between text-xs text-zinc-500 border-b border-zinc-200">
                  <span className="font-semibold text-zinc-800">9:41</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-blue-600">MODA Tashkent</span>
                  </div>
                  <span>100%</span>
                </div>

                {/* Simulated Mini App Header */}
                <div className="p-4 border-b border-zinc-100 bg-white flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-zinc-900">MODA Tashkent</h4>
                    <p className="text-[11px] text-zinc-500">Официальный магазин одежды и обуви</p>
                  </div>
                  <span className="px-2 py-1 rounded bg-zinc-100 text-xs font-medium text-zinc-700">
                    RU
                  </span>
                </div>

                {/* Chips */}
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

                {/* Products Grid Mock */}
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
                      <p className="text-xs font-bold text-zinc-900 mt-1">420 000 сум</p>
                    </div>
                    <button type="button" className="w-full py-1.5 rounded-lg bg-blue-50 text-blue-600 font-semibold text-xs">
                      + В корзину
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
                      <p className="text-xs font-bold text-zinc-900 mt-1">650 000 сум</p>
                    </div>
                    <button type="button" className="w-full py-1.5 rounded-lg bg-blue-50 text-blue-600 font-semibold text-xs">
                      + В корзину
                    </button>
                  </div>
                </div>

                {/* Pinned Native Telegram MainButton */}
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
                  <p className="text-slate-400 text-xs">100% узбекский хлопок пенье, плотность 420г/м². Мягкий начес, идеальная посадка.</p>
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
                      🛒 Корзина в чате (1)
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
                    <div className="text-xs text-zinc-500">Ожидают доставки</div>
                    <div className="text-xl font-bold text-amber-600 mt-1">3</div>
                  </div>
                  <div className="p-3.5 rounded-lg border border-zinc-200 bg-zinc-50">
                    <div className="text-xs text-zinc-500">Товаров в наличии</div>
                    <div className="text-xl font-bold text-zinc-900 mt-1">8 шт.</div>
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
              Почему Telegram-магазины продают больше
            </h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              Покупателю не нужно переходить в браузер, вспоминать пароли или регистрироваться.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-dark-900 border border-white/[0.08] space-y-4 hover:border-brand/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-brand-light flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">0% трения при покупке</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Telegram автоматически передает имя, телефон и Telegram ID клиента. Заказ оформляется в 2 касания без логинов и смс-кодов.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-dark-900 border border-white/[0.08] space-y-4 hover:border-brand/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">Все способы оплаты</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Поддержка карт Uzcard, Humo, международных карт Visa/Mastercard через Stripe и Telegram Stars ⭐.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-dark-900 border border-white/[0.08] space-y-4 hover:border-brand/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">Мгновенные оповещения</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                О каждом новом заказе мерчант получает подробное уведомление в Telegram с составом, адресом и номером телефона покупателя.
              </p>
            </div>
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

          <div className="rounded-xl border border-white/10 bg-dark-950 overflow-hidden">
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
                  <td className="p-4 text-brand-light font-medium">Полноэкранный WebApp с анимацией</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-white">Фильтрация и категории</td>
                  <td className="p-4">Текстовые команды</td>
                  <td className="p-4 text-brand-light font-medium">Интерактивные чипсы и поиск</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-white">Адаптация темы</td>
                  <td className="p-4">Стандартная тема чата</td>
                  <td className="p-4 text-brand-light font-medium">Telegram Dark/Light Mode</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-white">Тактильный отклик (Haptic)</td>
                  <td className="p-4 text-slate-500">—</td>
                  <td className="p-4 text-emerald-400 font-semibold">Да (виброотклик на нажатия)</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-white">Веб-панель управления</td>
                  <td className="p-4 text-emerald-400">Включена</td>
                  <td className="p-4 text-emerald-400">Включена</td>
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
              Никаких процентов от ваших продаж. Фиксированная ежемесячная абонентская плата.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Basic Plan */}
            <div className="rounded-2xl border border-white/10 bg-dark-900 p-6 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white/5 text-slate-300">
                  Для быстрого старта
                </span>
                <h3 className="text-xl font-bold text-white">Базовый чат-бот</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white">$20</span>
                  <span className="text-xs text-slate-400">/ месяц</span>
                </div>
                <p className="text-xs text-slate-400">
                  Каталог товаров и прием заказов в сообщениях Telegram.
                </p>

                <ul className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-white/10">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Интерактивный каталог в чате</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Управление корзиной прямо в диалоге</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Уведомления мерчанту о заказах</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Панель управления товарами</span>
                  </li>
                </ul>
              </div>

              <a
                href={BOT_URL}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 rounded-xl border border-white/10 hover:bg-white/5 text-center text-xs font-semibold text-white transition-colors"
              >
                Подключить бота
              </a>
            </div>

            {/* Pro Mini App Plan (Featured) */}
            <div className="relative rounded-2xl border-2 border-brand bg-dark-900 p-6 space-y-6 flex flex-col justify-between shadow-2xl shadow-brand/20">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-brand text-white text-[11px] font-bold uppercase tracking-wider">
                Хит продаж
              </div>

              <div className="space-y-4">
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-brand/10 text-brand-light">
                  Максимум продаж
                </span>
                <h3 className="text-xl font-bold text-white">Pro Mini App</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white">$30</span>
                  <span className="text-xs text-slate-400">/ месяц</span>
                </div>
                <p className="text-xs text-slate-400">
                  Полноэкранная витрина Telegram Mini App с персональным дизайном.
                </p>

                <ul className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-white/10">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-light shrink-0" />
                    <span className="font-medium text-white">Полноэкранный Telegram Mini App</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-light shrink-0" />
                    <span>Фильтрация, поиск и галереи товаров</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-light shrink-0" />
                    <span>Нативная кнопка MainButton и BackButton</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-light shrink-0" />
                    <span>Оплата в 1 клик (Click, Payme, Cards, Stars)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-light shrink-0" />
                    <span>Аналитика продаж и графики выручки</span>
                  </li>
                </ul>
              </div>

              <a
                href={BOT_URL}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 rounded-xl bg-brand hover:bg-brand-dark text-center text-xs font-bold text-white shadow-lg shadow-brand/20 transition-all active:scale-95"
              >
                Запустить Pro Mini App
              </a>
            </div>

            {/* Standalone Lifetime Plan */}
            <div className="rounded-2xl border border-white/10 bg-dark-900 p-6 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white/5 text-slate-300">
                  Для крупных брендов
                </span>
                <h3 className="text-xl font-bold text-white">Standalone VPS</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white">$350</span>
                  <span className="text-xs text-slate-400">разово навсегда</span>
                </div>
                <p className="text-xs text-slate-400">
                  Автономный сервер, полный доступ к коду и базе данных.
                </p>

                <ul className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-white/10">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Развертывание на вашем отдельном VPS</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>0% комиссий и без абонентской платы</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Полный доступ к коду платформы</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Прямое подключение эквайринга</span>
                  </li>
                </ul>
              </div>

              <a
                href={BOT_URL}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 rounded-xl border border-white/10 hover:bg-white/5 text-center text-xs font-semibold text-white transition-colors"
              >
                Получить Standalone
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="relative z-10 py-16 px-4 max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Частые вопросы</h2>
          <p className="text-xs text-slate-400">Всё, что нужно знать перед стартом продаж</p>
        </div>

        <div className="space-y-3">
          {[
            {
              q: 'Нужен ли мне программист для запуска магазина?',
              a: 'Нет. Вы просто открываете бота @miraiedu_bot, указываете имя магазина, вставляете токен бота от @BotFather — и магазин готов к работе за 2 минуты.',
            },
            {
              q: 'Как я узнаю о новом заказе?',
              a: 'Мгновенно. Как только клиент нажимает «Оплатить», вам в Telegram приходит подробное сообщение с номером заказа, именем, телефоном, адресом доставки и составом корзины.',
            },
            {
              q: 'Какие платежные системы поддерживаются в Узбекистане?',
              a: 'Вы можете принимать платежи наличными или через перевод при получении, подключить карты Uzcard/Humo через эквайринг, международные карты Visa/Mastercard через Stripe или принимать Telegram Stars ⭐.',
            },
            {
              q: 'Могу ли я загружать товары и менять цены с телефона?',
              a: 'Да. Веб-панель мерчанта полностью адаптирована для смартфонов и планшетов. Вы можете менять фото, цены, складские остатки и статусы заказов прямо на ходу.',
            },
          ].map((item, idx) => (
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
                  className={`w-4 h-4 text-slate-400 transition-transform ${
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

      {/* Footer */}
      <footer className="relative z-10 py-10 px-4 border-t border-white/[0.08] text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-400 font-semibold">
            <Zap className="w-4 h-4 text-brand" />
            <span>Mirai Commerce Platform</span>
          </div>

          <div className="flex items-center gap-6">
            <a href={BOT_URL} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              Бот в Telegram
            </a>
            <a href={DEMO_MINIAPP_URL} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              Витрина Mini App
            </a>
            <a href={ADMIN_URL} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              Панель мерчанта
            </a>
          </div>

          <div>© 2026 Mirai Commerce. Все права защищены.</div>
        </div>
      </footer>
    </div>
  );
}
